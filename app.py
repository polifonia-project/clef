# -*- coding: utf-8 -*-
import os
import json, csv
import datetime
import time
import sys
import re
import logging
import cgi
from importlib import reload
import urllib.parse
from urllib.parse import parse_qs, unquote, quote
import requests
import web
from web import form
import spacy
from spacy import displacy
from SPARQLWrapper import SPARQLWrapper, JSON
from rdflib import Graph
from rdflib.namespace import OWL, DC , DCTERMS, RDF , RDFS
from io import StringIO
#import subprocess

import forms, mapping, conf, queries , vocabs  , github_sync
import utils as u
#import threading

web.config.debug = False

# VARS

WIKIDATA_SPARQL = "https://query.wikidata.org/bigdata/namespace/wdq/sparql"
DEFAULT_FORM_JSON = conf.myform
DEFAULT_ENDPOINT = "http://127.0.0.1:3000/blazegraph/sparql"
IP_LOGS = "ip_logs.log"
RESOURCE_TEMPLATES = 'resource_templates/'
TEMPLATE_LIST = RESOURCE_TEMPLATES+"template_list.json"
ASK_CLASS = RESOURCE_TEMPLATES+"ask_class.json"
SKOS_VOCAB = conf.skos_vocabularies 
USER_AGENT = conf.sparql_wrapper_user_agent
NER_EN = spacy.load("en_core_web_sm")
NER_IT = spacy.load("it_core_news_sm")
#KNOWLEDGE_EXTRACTION = conf.knowledge_extraction


# ROUTING

prefix = ''
prefixLocal = prefix # REPLACE IF IN SUBFOLDER
urls = (
	prefix + '/', 'Login',
	prefix + '/setup', 'Setup',
	prefix + '/template-(.+)', 'Template',
	prefix + '/logout', 'Logout',
	prefix + '/gitauth', 'Gitauth',
	prefix + '/oauth-callback', 'Oauthcallback',
	prefix + '/welcome-(.+)','Index',
	prefix + '/record-(.+)', 'Record',
	prefix + '/modify-(.+)', 'Modify',
	prefix + '/review-(.+)', 'Review',
	prefix + '/documentation', 'Documentation',
	prefix + '/records', 'Records',
	prefix + '/model', 'DataModel',
	prefix + '/view-(.+)', 'View',
	prefix + '/term-(.+)', 'Term',
	prefix + '/(sparql)','sparql',
	prefix + '/savetheweb-(.+)','Savetheweb',
	prefix + '/nlp','Nlp',
	prefix + '/sparqlanything', 'Sparqlanything',
	prefix + '/wd', 'Wikidata',
	prefix + '/charts-visualization', 'Charts',
	prefix + '/charts-template', 'ChartsTemplate'
)

app = web.application(urls, globals())
wsgiapp = app.wsgifunc()

# SESSIONS

store, session, session_data = u.initialize_session(app)

# TEMPLATING

render = web.template.render('templates/', base="layout", cache=False,
								globals={'session':session,'time_now':u.get_timestamp,
								'isinstance':isinstance,'str':str, 'next':next,
								'upper':u.upper, 'toid':u.toid,'isnumeric':u.isnum,
								'get_type':web.form.Checkbox.get_type, 'type':type,
								'Checkbox':web.form.Checkbox,
								'Dropdown':web.form.Dropdown})


# LOAD CONFIG AND CONTROLLED VOCABULARIES
u.reload_config()
u.init_js_config(conf)
vocabs.import_vocabs()
is_git_auth = github_sync.is_git_auth()

# ERROR HANDLER

def notfound():
	return web.notfound(render.notfound(user=session['username'],
		is_git_auth=is_git_auth,project=conf.myProject,main_lang=conf.mainLang))

def internalerror():
	return web.internalerror(render.internalerror(user=session['username'],
		is_git_auth=is_git_auth,project=conf.myProject,main_lang=conf.mainLang))

class Notfound:
	def GET(self):
		raise web.notfound()

app.notfound = notfound
app.internalerror = internalerror

# UTILS

def create_record(data):
	""" POST method in static pages. The only accepted request are
	Create a new record and Create a new template.

	Parameters
	----------
	data: dict
		Dictionary of user input -- web.input().
	"""
	if data and 'action' in data and data.action.startswith('createRecord'):
		record = data.action.split("createRecord",1)[1]
		u.log_output('START NEW RECORD', session['logged_in'], session['username'])
		raise web.seeother(prefixLocal+'record-'+record)
	else:
		u.log_output('ELSE', session['logged_in'], session['username'])
		return internalerror()


# GITHUB AUTHENTICATION

class Gitauth:
	def GET(self):
		""" When the user clicks on Member area
		s/he is redirected to github authentication interface"""

		github_auth = "https://github.com/login/oauth/authorize"
		clientId = conf.gitClientID
		scope = "&scope=repo read:user"

		return web.seeother(github_auth+"?client_id="+clientId+scope)

class Oauthcallback:
	def GET(self):
		""" Redirect from class Gitauth.
		After the user authenticates, get profile information (ask_user_permission).
		Check the user is a collaborator of the repository (get_github_users)
		"""

		data = web.input()
		code = data.code
		res = github_sync.ask_user_permission(code)

		if res:
			userlogin, usermail, bearer_token = github_sync.get_user_login(res)
			is_valid_user = github_sync.get_github_users(userlogin)
			if is_valid_user == True:
				session['logged_in'] = 'True'
				session['username'] = usermail
				session['gituser'] = userlogin
				session['ip_address'] = str(web.ctx['ip'])
				session['bearer_token'] = bearer_token
				# store the token in session
				u.log_output('LOGIN VIA GITHUB', session['logged_in'], session['username'])
				raise web.seeother(prefixLocal+'welcome-1')
		else:
			print("bad request to github oauth")
			return internalerror()


class Setup:
	def GET(self):
		""" /setup webpage. Modify config.py and reload the module
		"""

		u.log_output("SETUP:GET",session['logged_in'], session['username'])
		is_git_auth = github_sync.is_git_auth()
		u.reload_config() # reload conf
		f = forms.get_form('setup.json') # get the form template
		data = u.get_vars_from_module('conf') # fill in the form with conf values
		return render.setup(f=f,user=session['username'],
							data=data, is_git_auth=is_git_auth,
							project=conf.myProject,main_lang=conf.mainLang)

	def POST(self):
		""" Modify config.py and static/js/conf.json and reload the module
		"""

		data = web.input()
		if 'action' in data:
			create_record(data)
		else:
			u.log_output("SETUP:POST",session['logged_in'], session['username'])
			original_status=conf.status

			# override the module conf and conf.json
			file = open('conf.py', 'w')
			file.writelines('# -*- coding: utf-8 -*-\n')
			file.writelines('status= "modified"\n')
			file.writelines('main_entity = "https://schema.org/CreativeWork"\n')
			file.writelines('myform = "'+DEFAULT_FORM_JSON+'"\n')
			file.writelines('myEndpoint = "'+DEFAULT_ENDPOINT+'"\n')
			file.writelines('log_file = "'+IP_LOGS+'"\n')
			file.writelines('wikidataEndpoint = "'+WIKIDATA_SPARQL+'"\n')
			file.writelines('resource_templates = "'+RESOURCE_TEMPLATES+'"\n')
			file.writelines('template_list = "'+TEMPLATE_LIST+'"\n')
			file.writelines('ask_form = "'+RESOURCE_TEMPLATES+'ask_class.json"\n')
			file.writelines('skos_vocabularies = "skos_vocabs.json"\n')
			file.writelines('charts = "charts.json"\n')
			data = u.validate_setup(data)

			for k,v in data.items():
				print(k,v)
				file.writelines(k+''' = "'''+v+'''"\n''')

			# write the json config file for javascript
			u.init_js_config(data)
			u.reload_config()

			raise web.seeother(prefixLocal+'/welcome-1')


class Template:
	def GET(self, res_name):
		""" Modify the form template for data entry

		Parameters
		----------
		res_name: str
			the name assigned to the template / class
		"""

		# display template
		is_git_auth = github_sync.is_git_auth()
		data = web.input()
		if 'action' in data and 'updateSubclass' in data.action:
			queries.updateSubclassValue(data)

		with open(TEMPLATE_LIST,'r') as tpl_file:
			tpl_list = json.load(tpl_file)

		res_type = ";  ".join([i['type'] for i in tpl_list if i["short_name"] == res_name][0])
		res_full_name = [i['name'] for i in tpl_list if i["short_name"] == res_name][0]
		res_status = [i['hidden'] for i in tpl_list if i["short_name"] == res_name][0]

		# if does not exist create the template json file
		template_path = RESOURCE_TEMPLATES+'template-'+res_name+'.json'
		if not os.path.isfile(template_path):
			f = open(template_path, "w")
			json.dump([],f)
			fields = None
		else: # load template form
			with open(template_path,'r') as tpl_file:
				fields = json.load(tpl_file)
		if not os.path.isfile(SKOS_VOCAB):
			skos_file = None
		else:
			with open(SKOS_VOCAB, 'r') as skos_list:
				skos_file = json.load(skos_list)

		return render.template(f=fields,user=session['username'],
								res_type=res_type,res_name=res_full_name,
								res_status=res_status,is_git_auth=is_git_auth,
								project=conf.myProject,skos_vocabs=skos_file,
								templates=tpl_list,main_lang=conf.mainLang)

	def POST(self, res_name):
		""" Save the form template for data entry and reload config files
		"""

		data = web.input()
		print(data)
		if 'action' in data and 'updateTemplate' not in data.action and 'deleteTemplate' not in data.action:
			create_record(data)
		else:
			template_path = RESOURCE_TEMPLATES+'template-'+res_name+'.json'
			if 'action' in data and 'deleteTemplate' in data.action:
				# os.remove(template_path) # remove json file
				u.updateTemplateList(res_name,None,remove=True) # update tpl list
				u.update_ask_class(template_path, res_name,remove=True) # update ask_class
				raise web.seeother(prefixLocal+'/welcome-1')
			else:
				u.fields_to_json(data, template_path, SKOS_VOCAB) # save the json template
				u.reload_config()
				vocabs.import_vocabs()
				u.update_ask_class(template_path, res_name) # modify ask_class json
				raise web.seeother(prefixLocal+'/welcome-1')

# LOGIN : Homepage

class Login:
	def GET(self):
		""" Homepage """

		is_git_auth = github_sync.is_git_auth()
		github_repo_name = conf.repo_name if is_git_auth == True else None
		# if conf.status=='not modified':
		# 	raise web.seeother('setup')
		if session.username != 'anonymous':
			u.log_output('HOMEPAGE LOGGED IN', session['logged_in'], session['username'])
			raise web.seeother(prefixLocal+'welcome-1')
		else:
			u.log_output('HOMEPAGE ANONYMOUS', session['logged_in'], session['username'])
			return render.login(user='anonymous',is_git_auth=is_git_auth,
					   project=conf.myProject,payoff=conf.myPayoff,
					   github_repo_name=github_repo_name,main_lang=conf.mainLang)

	def POST(self):
		data = web.input()
		create_record(data)


class Logout:
	def GET(self):
		"""Logout"""
		u.log_output('LOGOUT', session['logged_in'], session['username'])
		session['logged_in'] = 'False'
		session['username'] = 'anonymous'
		session['ip_address'] = str(web.ctx['ip'])
		session['bearer_token'] = 'None'
		session['gituser'] = 'None'
		raise web.seeother(prefixLocal+'/')

	def POST(self):
		data = web.input()
		create_record(data)

# BACKEND Index: show list or records (only logged users)

class Index:
	def GET(self, page):
		""" Member area

		Parameters
		----------
		page: str
			pagination of records in the backend (1= first page)
		"""

		web.header("Content-Type","text/html; charset=utf-8")
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		is_git_auth = github_sync.is_git_auth()
		session['ip_address'] = str(web.ctx['ip'])
		filterRecords = ''
		userID = session['username'].replace('@','-at-').replace('.','-dot-')
		alll = queries.countAll()
		all, notreviewed, underreview, published = queries.getCountings()
		results = queries.getRecordsPagination(page)

		records = list(reversed(sorted(results, key=lambda tup: u.key(tup[4][:-5]) ))) if len(results) > 0 else []
		print("records:", records)

		with open(TEMPLATE_LIST,'r') as tpl_file:
			tpl_list = json.load(tpl_file)

		session_data['logged_in'] = 'True' if (session['username'] != 'anonymous') or \
							(conf.gitClientID == '' and session['username'] == 'anonymous') else 'False'

		if (session['username'] != 'anonymous') or \
			(conf.gitClientID == '' and session['username'] == 'anonymous'):
			u.log_output('WELCOME PAGE', session['logged_in'], session['username'])
			return render.index(wikilist=records, user=session['username'],
				varIDpage=str(time.time()).replace('.','-'), alll=alll, all=all,
				notreviewed=notreviewed,underreview=underreview,
				published=published, page=page,pagination=int(conf.pagination),
				filter=filterRecords, filterName = 'filterAll',is_git_auth=is_git_auth,
				project=conf.myProject,templates=tpl_list,main_lang=conf.mainLang)
		else:
			if conf.gitClientID == '':
				session['logged_in'] = 'False'
				return render.index(wikilist=records, user=session['username'],
					varIDpage=str(time.time()).replace('.','-'), alll=alll, all=all,
					notreviewed=notreviewed,underreview=underreview,
					published=published, page=page,pagination=int(conf.pagination),
					filter=filterRecords, filterName = 'filterAll',is_git_auth=is_git_auth,
					project=conf.myProject,templates=tpl_list,main_lang=conf.mainLang)
			else:
				session['logged_in'] = 'False'
				u.log_output('WELCOME PAGE NOT LOGGED IN', session['logged_in'], session['username'])
				raise web.seeother(prefixLocal+'/')

	def POST(self, page):
		""" Member area

		Parameters
		----------
		page: str
			pagination of records in the backend (1= first page)
		"""

		web.header("Content-Type","text/html; charset=utf-8")
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		actions = web.input()
		session['ip_address'] = str(web.ctx['ip'])
		is_git_auth = github_sync.is_git_auth()

		with open(TEMPLATE_LIST,'r') as tpl_file:
			tpl_list = json.load(tpl_file)

		pub_stage = "?g <http://dbpedia.org/ontology/currentStatus> ?anyValue . "
		filter = "isLiteral(?anyValue) && lcase(str(?anyValue))"
		# filters on the list of records
		filter_values = {
			"filterNew": pub_stage+"FILTER ("+filter+" = 'not modified') .",
			"filterReviewed": pub_stage+"FILTER ("+filter+" = 'modified') .",
			"filterPublished": pub_stage+ "FILTER ("+filter+" = 'published') .",
			"filterAll": "none"
		}

		# filter records
		if actions.action.startswith('filter'):
			print(actions.action)
			filterRecords = filter_values[actions.action]
			filterRecords = filterRecords if filterRecords not in ['none',None] else ''
			filterName = actions.action
			page = 1
			results = queries.getRecordsPagination(page, filterRecords)
			records = list(reversed(sorted(results, key=lambda tup: u.key(tup[4][:-5]) ))) if len(results) > 0 else []
			alll = queries.countAll()
			all, notreviewed, underreview, published = queries.getCountings()
			filterRecords = filterRecords if filterRecords != '' else 'none'

			return render.index(wikilist=records, user=session['username'],
				varIDpage=str(time.time()).replace('.','-'),
				alll=alll, all=all, notreviewed=notreviewed,
				underreview=underreview, published=published,
				page=page, pagination=int(conf.pagination),
				filter= filterRecords, filterName = filterName, is_git_auth=is_git_auth,
				project=conf.myProject,templates=tpl_list,main_lang=conf.mainLang)

		# create a new record
		elif actions.action.startswith('createRecord'):
			record = actions.action.split("createRecord",1)[1]
			u.log_output('START NEW RECORD (LOGGED IN)', session['logged_in'], session['username'], record )
			raise web.seeother(prefixLocal+'record-'+record)

		# delete a record (but not the dump in /records folder)
		elif actions.action.startswith('deleteRecord'):
			graph = actions.action.split("deleteRecord",1)[1].split(' __')[0]
			filterRecords = actions.action.split('deleteRecord',1)[1].split(' __')[1]
			queries.deleteRecord(graph)
			userID = session['username'].replace('@','-at-').replace('.','-dot-')
			if conf.github_backup == "True": # path hardcoded, to be improved
				file_path = "records/"+graph.split(conf.base)[1].rsplit('/',1)[0]+".ttl"
				github_sync.delete_file(file_path,"main", session['gituser'],
										session['username'], session['bearer_token'])
			u.log_output('DELETE RECORD', session['logged_in'], session['username'], graph )
			if filterRecords in ['none',None]:
				raise web.seeother(prefixLocal+'welcome-'+page)
			else:
				filterName = [k if v == filterRecords else 'filterName' for k,v in filter_values.items()][0]
				results = queries.getRecordsPagination(page,filterRecords)
				records = list(reversed(sorted(results, key=lambda tup: u.key(tup[4][:-5]) ))) if len(results) > 0 else []
				alll = queries.countAll()
				all, notreviewed, underreview, published = queries.getCountings(filterRecords)

				return render.index(wikilist=records, user=session['username'],
					varIDpage=str(time.time()).replace('.','-'),
					alll=alll, all=all, notreviewed=notreviewed,
					underreview=underreview, published=published,
					page=page, pagination=int(conf.pagination),
					filter= filterRecords, filterName = filterName, is_git_auth=is_git_auth,
					project=conf.myProject,templates=tpl_list,main_lang=conf.mainLang)

		# modify a record
		elif actions.action.startswith('modify'):
			record = actions.action.split(conf.base,1)[1].replace('/','')
			u.log_output('MODIFY RECORD', session['logged_in'], session['username'], record )
			raise web.seeother(prefixLocal+'modify-'+record)

		# start review of a record
		elif actions.action.startswith('review'):
			record = actions.action.split(conf.base,1)[1].replace('/','')
			u.log_output('REVIEW RECORD', session['logged_in'], session['username'], record )
			raise web.seeother(prefixLocal+'review-'+record)

		# change page
		elif actions.action.startswith('changepage'):
			pag = actions.action.split('changepage-',1)[1].split(' __')[0]
			filterRecords = actions.action.split('changepage-',1)[1].split(' __')[1]
			if filterRecords in ['none',None]:
				raise web.seeother(prefixLocal+'welcome-'+pag)
			else:
				filterName = [k if v == filterRecords else '' for k,v in filter_values.items()][0]
				results = queries.getRecordsPagination(pag, filterRecords)
				records = list(reversed(sorted(results, key=lambda tup: u.key(tup[4][:-5]) )))
				alll = queries.countAll()
				all, notreviewed, underreview, published = queries.getCountings(filterRecords)

				return render.index( wikilist=records, user=session['username'],
					varIDpage=str(time.time()).replace('.','-'),
					alll=alll, all=all, notreviewed=notreviewed,
					underreview=underreview, published=published,
					page=page, pagination=int(conf.pagination),
					filter= filterRecords, filterName = filterName, is_git_auth=is_git_auth,
					project=conf.myProject,templates=tpl_list,main_lang=conf.mainLang)

		# create a new template
		elif actions.action.startswith('createTemplate'):
			is_git_auth = github_sync.is_git_auth()
			res_type = sorted([ urllib.parse.unquote(actions[class_input].strip()) for class_input in actions if class_input.startswith("uri_class")]) 
			res_type = conf.main_entity if res_type == [] else res_type
			res_name = actions.class_name.replace(' ','_').lower() if "class_name" in actions else "not provided"

			with open(TEMPLATE_LIST,'r') as tpl_file:
				templates = json.load(tpl_file)

			names = [t['short_name'] for t in templates]
			types = [t['type'] for t in templates]
			now_time = str(time.time()).replace('.','-')
			# check for duplicates
			res_n, adress = (actions.class_name, res_name) if (res_type not in types and res_name not in names) else (actions.class_name+'_'+now_time, res_name+'_'+now_time)
			u.updateTemplateList(res_n,res_type)
			raise web.seeother(prefixLocal+'template-'+adress)
		
		# delete existing template
		elif actions.action.startswith('deleteTemplate'):
			is_git_auth = github_sync.is_git_auth()
			res_name = actions.action.replace('deleteTemplate','')
			template_path = RESOURCE_TEMPLATES+'template-'+res_name+'.json'
			u.updateTemplateList(res_name,None,remove=True) # update tpl list
			u.update_ask_class(template_path, res_name,remove=True) # update ask_class
			raise web.seeother(prefixLocal+'/welcome-1')

		# login or create a new record
		else:
			create_record(actions)

# FORM: create a new record (both logged in and anonymous users)

class Record(object):
	def GET(self, name):
		""" Create a new record

		Parameters
		----------
		name: str
			the record ID (a timestamp)
		"""

		web.header("X-Forwarded-For", session['ip_address'])
		web.header("Cache-Control", "no-cache, max-age=0, must-revalidate, no-store")
		web.header("Content-Type","text/html; charset=utf-8")
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
		u.log_output('GET RECORD FORM', session['logged_in'], session['username'])

		is_git_auth = github_sync.is_git_auth()
		session['ip_address'] = str(web.ctx['ip'])
		user = session['username']
		logged_in = True if user != 'anonymous' else False
		block_user, limit = u.check_ip(str(web.ctx['ip']), str(datetime.datetime.now()) )
		u.check_ask_class()
		ask_form = u.change_template_names(is_git_auth)
		f = forms.get_form(ask_form,True)

		return render.record(record_form=f, pageID=name, user=user,
							alert=block_user, limit=limit,
							is_git_auth=is_git_auth,invalid=False,
							project=conf.myProject,template=None,
							query_templates=None,knowledge_extractor=set(),
							main_lang=conf.mainLang)

	def POST(self, name):
		""" Submit a new record

		Parameters
		----------
		name: str
			the record ID (a timestamp)
		"""

		web.header("Content-Type","text/html; charset=utf-8")
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		is_git_auth = github_sync.is_git_auth()
		f = forms.get_form(conf.ask_form)
		user = session['username']
		session['ip_address'] = str(web.ctx['ip'])
		u.write_ip(str(datetime.datetime.now()), str(web.ctx['ip']), 'POST')
		block_user, limit = u.check_ip(str(web.ctx['ip']), str(datetime.datetime.now()) )
		whereto = prefixLocal+'/' if user == 'anonymous' else prefixLocal+'welcome-1'

		# form validation (ask_class)
		if not f.validates():
			u.log_output('SUBMIT INVALID FORM', session['logged_in'], session['username'],name)
			return render.record(record_form=f, pageID=name, user=user, alert=block_user,
								limit=limit, is_git_auth=is_git_auth,invalid=True,
								project=conf.myProject,template=None,
								query_templates=None,knowledge_extractor=set(),
								main_lang=conf.mainLang)
		else:
			recordData = web.input()

			# load the template selected by the user
			if 'res_name' in recordData:
				if recordData.res_name != 'None':
					f = forms.get_form(recordData.res_name,processed_templates=[])
					query_templates = u.get_query_templates(recordData.res_name)
					extractor = u.has_extractor(recordData.res_name)
					return render.record(record_form=f, pageID=name, user=user, alert=block_user,
									limit=limit, is_git_auth=is_git_auth,invalid=False,
									project=conf.myProject,template=recordData.res_name,
									query_templates=query_templates,knowledge_extractor=extractor,
									main_lang=conf.mainLang)
				else:
					raise web.seeother(prefixLocal+'record-'+name)

			if 'action' in recordData:
				create_record(recordData)

			recordID = recordData.recordID if 'recordID' in recordData else None
			templateID = recordData.templateID if 'templateID' in recordData else None
			invalid_input = recordData.invalid_input if 'invalid_input' in recordData else None
			u.log_output('CREATED RECORD', session['logged_in'], session['username'],recordID)

			if recordID:
				if invalid_input:
					f = forms.get_form(templateID)
					query_templates = u.get_query_templates(recordData.res_name)
					extractor = u.has_extractor(templateID) 
					return render.record(record_form=f, pageID=name, user=user, alert=block_user,
									limit=limit, is_git_auth=is_git_auth,invalid=True,
									project=conf.myProject,template=templateID,
									query_templates=query_templates,knowledge_extractor=extractor,
									main_lang=conf.mainLang)
				else:
					#u.update_knowledge_extraction(recordData,KNOWLEDGE_EXTRACTION)
					userID = user.replace('@','-at-').replace('.','-dot-')
					file_path = mapping.inputToRDF(recordData, userID, 'not modified', tpl_form=templateID)
					if conf.github_backup == "True":
						try:
							github_sync.push(file_path,"main", session['gituser'], session['username'], session['bearer_token'])
						except Exception as e:
							print(e)

					raise web.seeother(whereto)
			else:
				create_record(recordData)

# FORM: modify a record (only logged in users)

class Modify(object):
	def GET(self, name):
		""" Modify an existing record

		Parameters
		----------
		name: str
			the record ID (a timestamp)
		"""

		web.header("Cache-Control", "no-cache, max-age=0, must-revalidate, no-store")
		web.header("Content-Type","text/html; charset=utf-8")
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		is_git_auth = github_sync.is_git_auth()
		session['ip_address'] = str(web.ctx['ip'])
		session_data['logged_in'] = 'True' if (session['username'] != 'anonymous') or \
							(conf.gitClientID == '' and session['username'] == 'anonymous') else 'False'

		if (session['username'] != 'anonymous') or \
			(conf.gitClientID == '' and session['username'] == 'anonymous'):
			graphToRebuild = conf.base+name+'/'
			recordID = name
			res_class = queries.getClass(conf.base+name)
			res_template = u.get_template_from_class(res_class)
			data = queries.getData(graphToRebuild, res_template)
			u.log_output('START MODIFY RECORD', session['logged_in'], session['username'], recordID )

			f = forms.get_form(res_template,processed_templates=[])

			with open(res_template) as tpl_form:
				fields = json.load(tpl_form)
			ids_dropdown = u.get_dropdowns(fields)
			
			query_templates=u.get_query_templates(res_template)
			extractor = u.has_extractor(res_template)
			previous_extractors = u.has_extractor(res_template, name)
			extractions_data = queries.retrieve_extractions(previous_extractors)
			print("data:", data)

			return render.modify(graphdata=data, pageID=recordID, record_form=f,
							user=session['username'],ids_dropdown=ids_dropdown,
							is_git_auth=is_git_auth,invalid=False,
							project=conf.myProject,template=res_template,
							query_templates=query_templates,knowledge_extractor=extractor,
							extractions=extractions_data,main_lang=conf.mainLang)
		else:
			session['logged_in'] = 'False'
			raise web.seeother(prefixLocal+'/')

	def POST(self, name):
		""" Modify an existing record

		Parameters
		----------
		name: str
			the record ID (a timestamp)
		"""

		web.header("Content-Type","text/html; charset=utf-8")
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		recordData = web.input()
		session['ip_address'] = str(web.ctx['ip'])
		is_git_auth = github_sync.is_git_auth()
		templateID = recordData.templateID if 'templateID' in recordData else None
		res_class = queries.getClass(conf.base+name)
		res_template = u.get_template_from_class(res_class)

		if 'action' in recordData:
			create_record(recordData)
		else:
			f = forms.get_form(templateID,processed_templates=[])
			if not f.validates():
				graphToRebuild = conf.base+name+'/'
				recordID = name
				data = queries.getData(graphToRebuild,templateID)
				u.log_output('INVALID MODIFY RECORD', session['logged_in'], session['username'], recordID )
				f = forms.get_form(templateID)

				with open(templateID) as tpl_form:
					fields = json.load(tpl_form)
				ids_dropdown = u.get_dropdowns(fields)

				query_templates = u.get_query_templates(templateID)
				extractor = u.has_extractor(res_template)
				previous_extractors = u.has_extractor(res_template, name)
				extractions_data = queries.retrieve_extractions(previous_extractors)

				return render.modify(graphdata=data, pageID=recordID, record_form=f,
								user=session['username'],ids_dropdown=ids_dropdown,
								is_git_auth=is_git_auth,invalid=True,
								project=conf.myProject,template=res_template,
								query_templates=query_templates,knowledge_extractor=extractor,
								extractions=extractions_data,main_lang=conf.mainLang)
			else:
				recordID = recordData.recordID
				#u.update_knowledge_extraction(recordData,KNOWLEDGE_EXTRACTION)
				userID = session['username'].replace('@','-at-').replace('.','-dot-')
				graphToClear = conf.base+name+'/'
				file_path = mapping.inputToRDF(recordData, userID, 'modified', graphToClear=graphToClear,tpl_form=templateID)
				if conf.github_backup == "True":
					try:
						github_sync.push(file_path,"main", session['gituser'],
									session['username'], session['bearer_token'], '(modified)')
					except Exception as e:
						print(e)
				u.log_output('MODIFIED RECORD', session['logged_in'], session['username'], recordID )
				raise web.seeother(prefixLocal+'welcome-1')

# FORM: review a record for publication (only logged in users)

class Review(object):
	def GET(self, name):
		""" Review and publish an existing record

		Parameters
		----------
		name: str
			the record ID (a timestamp)
		"""

		web.header("Cache-Control", "no-cache, max-age=0, must-revalidate, no-store")
		web.header("Content-Type","text/html; charset=utf-8")
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		is_git_auth = github_sync.is_git_auth()
		session_data['logged_in'] = 'True' if (session['username'] != 'anonymous') or \
							(conf.gitClientID == '' and session['username'] == 'anonymous') else 'False'

		# anonymous or authenticated user
		if (session['username'] != 'anonymous') or \
			(conf.gitClientID == '' and session['username'] == 'anonymous'):
			graphToRebuild = conf.base+name+'/'
			recordID = name
			res_class = queries.getClass(conf.base+name)
			res_template = u.get_template_from_class(res_class)
			data = queries.getData(graphToRebuild,res_template)
			session['ip_address'] = str(web.ctx['ip'])
			u.log_output('START REVIEW RECORD', session['logged_in'], session['username'], recordID )

			f = forms.get_form(res_template,processed_templates=[])

			with open(res_template) as tpl_form:
				fields = json.load(tpl_form)
			ids_dropdown = u.get_dropdowns(fields) # TODO CHANGE
			
			query_templates = u.get_query_templates(res_template)
			extractor = u.has_extractor(res_template)
			previous_extractors = u.has_extractor(res_template, name)
			extractions_data = queries.retrieve_extractions(previous_extractors)

			return render.review(graphdata=data, pageID=recordID, record_form=f,
								graph=graphToRebuild, user=session['username'],
								ids_dropdown=ids_dropdown,is_git_auth=is_git_auth,
								invalid=False,project=conf.myProject,template=res_template,
								query_templates=query_templates,knowledge_extractor=extractor,
								extractions=extractions_data,main_lang=conf.mainLang)
		else:
			session['logged_in'] = 'False'
			raise web.seeother(prefixLocal+'/')

	def POST(self, name):
		""" Review and publish an existing record

		Parameters
		----------
		name: str
			the record ID (a timestamp)
		"""

		web.header("Content-Type","text/html; charset=utf-8")
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		actions = web.input()
		session['ip_address'] = str(web.ctx['ip'])
		templateID = actions.templateID if 'templateID' in actions else None
		f = forms.get_form(templateID,processed_templates=[])

		# save the new record for future publication
		if actions.action.startswith('save'):
			if not f.validates():
				graphToRebuild = conf.base+name+'/'
				recordID = name
				res_class = queries.getClass(conf.base+name)
				res_template = u.get_template_from_class(res_class)
				data = queries.getData(graphToRebuild,templateID)
				session['ip_address'] = str(web.ctx['ip'])
				u.log_output('INVALID REVIEW RECORD', session['logged_in'], session['username'], recordID )
				#f = forms.get_form(conf.myform)
				with open(templateID) as tpl_form:
					fields = json.load(tpl_form)
				ids_dropdown = u.get_dropdowns(fields) # TODO CHANGE
				
				query_templates = u.get_query_templates()
				extractor = u.has_extractor(res_template)
				previous_extractors = u.has_extractor(res_template, name)
				extractions_data = queries.retrieve_extractions(previous_extractors)

				return render.review(graphdata=data, pageID=recordID, record_form=f,
									graph=graphToRebuild, user=session['username'],
									ids_dropdown=ids_dropdown,is_git_auth=is_git_auth,
									invalid=True,project=conf.myProject,template=templateID,
									query_templates=query_templates,knowledge_extractor=extractor,
									extractions=extractions_data,main_lang=conf.mainLang)
			else:
				recordData = web.input()
				recordID = recordData.recordID
				#u.update_knowledge_extraction(recordData,KNOWLEDGE_EXTRACTION)
				userID = session['username'].replace('@','-at-').replace('.','-dot-')
				graphToClear = conf.base+name+'/'
				file_path = mapping.inputToRDF(recordData, userID, 'modified',graphToClear,templateID)
				if conf.github_backup == "True":
					try:
						github_sync.push(file_path,"main", session['gituser'],
									session['username'], session['bearer_token'], '(reviewed)')
					except Exception as e:
						print(e)
				u.log_output('REVIEWED (NOT PUBLISHED) RECORD', session['logged_in'], session['username'], recordID )
				raise web.seeother(prefixLocal+'welcome-1')

		# publish the record
		elif actions.action.startswith('publish'):
			if not f.validates():
				graphToRebuild = conf.base+name+'/'
				recordID = name
				res_class = queries.getClass(conf.base+name)
				res_template = u.get_template_from_class(res_class)
				data = queries.getData(graphToRebuild,templateID)
				session['ip_address'] = str(web.ctx['ip'])
				u.log_output('INVALID REVIEW RECORD', session['logged_in'], session['username'], recordID )
				f = forms.get_form(templateID)
				with open(templateID) as tpl_form:
					fields = json.load(tpl_form)
				ids_dropdown = u.get_dropdowns(fields)
				
				query_templates = u.get_query_templates()
				extractor = u.has_extractor(res_template)
				previous_extractors = u.has_extractor(res_template, name)
				extractions_data = queries.retrieve_extractions(previous_extractors)

				return render.review(graphdata=data, pageID=recordID, record_form=f,
									graph=graphToRebuild, user=session['username'],
									ids_dropdown=ids_dropdown,is_git_auth=is_git_auth,
									invalid=True,project=conf.myProject,template=templateID,
									query_templates=query_templates,knowledge_extractor=extractor,
									extractions=extractions_data,main_lang=conf.mainLang)
			else:
				recordData = web.input()
				#u.update_knowledge_extraction(recordData,KNOWLEDGE_EXTRACTION)
				userID = session['username'].replace('@','-at-').replace('.','-dot-')
				graphToClear = conf.base+name+'/'
				file_path= mapping.inputToRDF(recordData, userID, 'published',graphToClear,templateID)
				if conf.github_backup == "True":
					try:
						github_sync.push(file_path,"main", session['gituser'],
								session['username'], session['bearer_token'], '(published)')
					except Exception as e:
						print(e)


				u.log_output('PUBLISHED RECORD', session['logged_in'], session['username'], name )
				raise web.seeother(prefixLocal+'welcome-1')

		# login or create new record
		else:
			create_record(actions)

# FORM: view documentation

class Documentation:
	def GET(self):
		""" Editorial guidelines"""
		web.header("Cache-Control", "no-cache, max-age=0, must-revalidate, no-store")
		is_git_auth = github_sync.is_git_auth()
		return render.documentation(user=session['username'],
									is_git_auth=is_git_auth,project=conf.myProject,
									main_lang=conf.mainLang)

	def POST(self):
		""" Editorial guidelines"""

		data = web.input()
		if 'action' in data:
			create_record(data)

# VIEW : lists of types of records of the catalogue

class Records:
	def GET(self):
		""" EXPLORE page """
		web.header("Cache-Control", "no-cache, max-age=0, must-revalidate, no-store")
		#threading.Thread(target=u.fileWatcher).start()
		is_git_auth = github_sync.is_git_auth()
		# records = queries.getRecords()
		# alll = queries.countAll()
		# filtersBrowse = queries.getBrowsingFilters()

		with open(TEMPLATE_LIST,'r') as tpl_file:
			templates = json.load(tpl_file)

		records_by_template , count_by_template , count_by_subclass , filters_by_template = {} , {} , {} , {}
		for template in templates:
			if not (is_git_auth==False and template["hidden"] =='True'):
				res_class=template["type"]
				res_subclass_dict = template["subclasses"]
				res_subclasses = list(res_subclass_dict.keys())
				records = queries.getRecords(res_class,res_subclasses)
				records_by_template[template["name"]] = records
				alll = queries.countAll(res_class,res_subclasses,False,False)
				count_by_template[template["name"]] = alll
				if len(res_subclasses) > 0:
					count_by_subclass[template["name"]] = {}
				for res_subclass in res_subclasses:
					count_subclass = queries.countAll(res_class,res_subclasses,[res_subclass],False)
					count_by_subclass[template["name"]][res_subclass] = {"label": res_subclass_dict[res_subclass], "count": count_subclass}
				for template_name in count_by_subclass:
					count_by_subclass[template_name] = dict(sorted(count_by_subclass[template_name].items(), key=lambda item: item[1]['count'], reverse=True))

				filtersBrowse = queries.getBrowsingFilters(template["template"])
				filters_by_template[template["name"]] = filtersBrowse
		print("res  by templ:", records_by_template)
		return render.records(user=session['username'], data=records_by_template,
							subclass_data=count_by_subclass,title='Latest resources', r_base=conf.base,
							alll=count_by_template, filters=filters_by_template,
							is_git_auth=is_git_auth,project=conf.myProject,
							main_lang=conf.mainLang)

	def POST(self):
		""" EXPLORE page """

		data = web.input()
		if 'action' in data:
			create_record(data)

# VIEW : single record

class View(object):
	def GET(self, name):
		""" Record web page

		Parameters
		----------
		name: str
			the record ID (a timestamp)
		"""
		web.header("Cache-Control", "no-cache, max-age=0, must-revalidate, no-store")
		is_git_auth = github_sync.is_git_auth()
		base = conf.base
		record = base+name
		res_class = queries.getClass(conf.base+name)
		data, stage, title, properties, data_labels, extractions_data, new_dict_classes, properties_sorted = None, None, None, None, {}, {}, {}, {}
		try:
			res_template = u.get_template_from_class(res_class)
			data = dict(queries.getData(record+'/',res_template))
			stage = data['stage'][0] if 'stage' in data else 'draft'
			previous_extractors = u.has_extractor(res_template, name)
			extractions_data = queries.retrieve_extractions(previous_extractors,view=True)

			with open(res_template) as tpl_form:
				fields = json.load(tpl_form)
			try:
				title_field = [v for k,v in data.items() \
					for field in fields if (field['disambiguate'] == "True" \
					and k == field['id'])][0]
				title = [lang_value for lang_value in title_field if len(lang_value) == 3][0]
			except Exception as e:
				title = "No title"
			properties = {field["label"]:[field["property"], field["type"], field["view_class"], field["value"]] for field in fields if 'property' in field}

			data_labels = {}
			for k, v in data.items():  
				for field in fields:  
					if k == field['id']: 
						if properties[field["label"]][3] == "URI":
							data_labels[field['label']] = [[quote(val[0],safe=''), val[1]] for val in v]
						else:
							data_labels[field['label']] = v

		except Exception as e:
			pass

		try:
			incoming_links = queries.get_records_from_object(base+name)
			class_sorted = {}
			for result in incoming_links['results']['bindings']:
				result_class = result['class']['value']
				result_property_uri = result['property']['value']
				result_property = result_property_uri + "," + u.get_LOV_namespace(result_property_uri)
				result_subject = result['subject']['value'] + ',' + result['label']['value']
				if result_class not in class_sorted:
					class_sorted[result_class] = { result_property : [result_subject] }
				else:
					if result_property in class_sorted[result_class]:
						class_sorted[result_class][result_property].append(result_subject)
					else:
						class_sorted[result_class][result_property] = [result_subject]

			with open(TEMPLATE_LIST) as tpl_list:
				templates = json.load(tpl_list)
			for k in list(class_sorted.keys()):

				template = next((t["name"], t["template"]) for t in templates if t["type"] == sorted(k.split("; ")))
				template_name, template_file = template
				with open(template_file) as tpl_file:
					template_fields = json.load(tpl_file)
				property_label = list(class_sorted[k].keys())[0]
				property_name = next(f["label"] for f in template_fields if f["property"] == property_label.split(',',1)[0])
				if property_label in properties_sorted:
					properties_sorted[property_label].extend(class_sorted[k][property_label])
				else:
					properties_sorted[property_label] = class_sorted[k][property_label]
				new_dict_classes[template_name] = {'class':k, 'results': { property_label+','+property_name : class_sorted[k][property_label]} }
		except Exception as e:
			pass

		print("inverse_by_properties:", properties_sorted, "\nby class:", new_dict_classes)

		return render.view(user=session['username'], graphdata=data_labels,
						graphID=name, title=title, stage=stage, base=base,properties=properties,
						is_git_auth=is_git_auth,project=conf.myProject,knowledge_extractor=extractions_data,
						inverses_by_class=new_dict_classes,inverses_by_properties=properties_sorted,
						main_lang=conf.mainLang)

	def POST(self,name):
		""" Record web page

		Parameters
		----------
		name: str
			the record ID (a timestamp)
		"""

		data = web.input()
		if 'action' in data:
			create_record(data)

# TERM : vocabulary terms and newly created entities

class Term(object):
	def GET(self, name):
		""" controlled vocabulary term web page

		Parameters
		----------
		name: str
			the ID of the term, generally the last part of the URL
		"""
		try:
			name = unquote(name)
		except Exception as e:
			name = name

		web.header("Cache-Control", "no-cache, max-age=0, must-revalidate, no-store")
		is_git_auth = github_sync.is_git_auth()
		results_by_class = {}

		# look for occurrences in Record Graphs
		uri = mapping.getRightURIbase(name)
		label = queries.get_URI_label(uri)
		data = queries.describe_term(uri)
		appears_in = [ result["subject"]["value"] \
					for result in data["results"]["bindings"] \
					if (result["object"]["value"] == uri and result["object"]["type"] == 'uri') ] \
					if data != None else []
		
		# look for occurrences in Extraction Graphs
		extractions_data = queries.describe_extraction_term(uri)
		appears_in_extractions = [result["graph"]["value"][:-1] for result in extractions_data["results"]["bindings"] ] \
			if extractions_data != None else []
		appears_in.extend(appears_in_extractions)

		with open(TEMPLATE_LIST) as tpl_list:
			res_templates = json.load(tpl_list)
		for res_uri in appears_in:
			res_class = sorted(queries.getClass(res_uri))
			res_type = next((t["name"] for t in res_templates if t["type"] == res_class),None)
			if res_type in results_by_class:
				results_by_class[res_type]['results'].append(res_uri)
			elif res_type != None:
				results_by_class[res_type] = {'class':res_class, 'results':[res_uri]}

		count = len(appears_in)
		map_coordinates = (queries.geonames_geocoding(uri)) if uri.startswith("https://sws.geonames.org/") else None
		
		return render.term(user=session['username'], label=label, count=count,
						is_git_auth=is_git_auth,project=conf.myProject,base=conf.base,
						uri=uri,name=name,results=results_by_class,map=map_coordinates,
						main_lang=conf.mainLang)

	def POST(self,name):
		""" controlled vocabulary term web page

		Parameters
		----------
		name: str
			the ID of the term, generally the last part of the URL
		"""

		data = web.input()
		if 'action' in data:
			create_record(data)

# DATA MODEL

class DataModel:
	def GET(self):
		""" Data model page """

		is_git_auth = github_sync.is_git_auth()

		with open(TEMPLATE_LIST,'r') as tpl_file:
			tpl_list = json.load(tpl_file)

		res_data_models = []
		for t in tpl_list:
			if 'status' not in t:
				res_classes = t["type"]
				res_name = t["name"]
				with open(t["template"],'r') as tpl_file:
					fields = json.load(tpl_file)
					res_class_label = [u.get_LOV_labels(res_class,'class') for res_class in res_classes]
					res_data_model = {}
					res_data_model["res_name"] = res_name
					res_data_model["res_class_label"] = res_class_label
					props_labels = [ u.get_LOV_labels(field["property"],'property') for field in fields]
					res_data_model["props_labels"] = props_labels
				res_data_models.append(res_data_model)
		return render.datamodel(user=session['username'], data=res_data_models,is_git_auth=is_git_auth,
								project=conf.myProject,main_lang=conf.mainLang)

	def POST(self):
		""" Data model page """

		data = web.input()
		if 'action' in data:
			create_record(data)

# QUERY: endpoint GUI

class sparql:
	def GET(self, active):
		""" SPARQL endpoint GUI and request handler

		Parameters
		----------
		active: str
			Query string or None
			If None, renders the GUI, else parse the query (__run_query_string)
			If the query string includes an update, return error, else sends
			the query to the endpoint (__contact_tp)
		"""
		web.header("Cache-Control", "no-cache, max-age=0, must-revalidate, no-store")
		u.log_output("SPARQL:GET", session['logged_in'], session['username'])
		content_type = web.ctx.env.get('CONTENT_TYPE')
		return self.__run_query_string(active, web.ctx.env.get("QUERY_STRING"), content_type)

	def POST(self, active):
		""" SPARQL endpoint GUI and request handler

		Parameters
		----------
		active: str
			Query string or None
			If None, renders the GUI, else parse the query (__run_query_string)
			If the query string includes an update, return error, else sends
			the query to the endpoint (__contact_tp)
		"""

		u.log_output("SPARQL:POST", session['logged_in'], session['username'])
		content_type = web.ctx.env.get('CONTENT_TYPE')
		web.debug("The content_type value: ")
		web.debug(content_type)

		data = web.input()
		if 'action' in data:
			create_record(data)

		cur_data = web.data()
		if "application/x-www-form-urlencoded" in content_type:
			return self.__run_query_string(active, cur_data, True, content_type)
		elif "application/sparql-query" in content_type:
			return self.__contact_tp(cur_data, True, content_type)
		else:
			raise web.redirect(prefixLocal+"sparql")

	def __contact_tp(self, data, is_post, content_type):
		accept = web.ctx.env.get('HTTP_ACCEPT')
		if accept is None or accept == "*/*" or accept == "":
			accept = "application/sparql-results+xml"
		if is_post: # CHANGE
			req = requests.post(conf.myEndpoint, data=data,
								headers={'content-type': content_type, "accept": accept})
		else: # CHANGE
			req = requests.get("%s?%s" % (conf.myEndpoint, data),
							   headers={'content-type': content_type, "accept": accept})


		if req.status_code == 200:
			web.header('Access-Control-Allow-Origin', '*')
			web.header('Access-Control-Allow-Credentials', 'true')
			web.header('Content-Type', req.headers["content-type"])
			return req.text
		else:
			raise web.HTTPError(
				str(req.status_code), {"Content-Type": req.headers["content-type"]}, req.text)

	def __run_query_string(self, active, query_string, is_post=False,
						   content_type="application/x-www-form-urlencoded"):

		try:
			query_str_decoded = query_string.decode('utf-8')
		except Exception as e:
			query_str_decoded = query_string

		parsed_query = parse_qs(query_str_decoded)

		if query_str_decoded is None or query_str_decoded.strip() == "":
			is_git_auth = github_sync.is_git_auth()
			return render.sparql(active, user=session['username'],
								is_git_auth=is_git_auth,project=conf.myProject,
								main_lang=conf.mainLang)

		if re.search("updates?", query_str_decoded, re.IGNORECASE) is None:
			if "query" in parsed_query:
				return self.__contact_tp(query_string, is_post, content_type)
			else:
				raise web.redirect(conf.myPublicEndpoint)
		else:
			raise web.HTTPError(
				"403", {"Content-Type": "text/plain"}, "SPARQL Update queries are not permitted.")

# RECORD: send request to internet archive

class Savetheweb:
	def GET(self, name):
		# send a request to wayback machine for all URLs
		savetheweb = name.strip()
		try:
			resp = requests.get("http://web.archive.org/save/"+savetheweb,
				headers={"Content-Type": "application/x-www-form-urlencoded"} )

			if resp.status_code == 200:
				print("well done! resource "+savetheweb+" sent to wayback machine")
			else:
				print("mmmm, something wnt wrong with the wayback machine")
			return resp
		except Exception as e:
			print(e)

# perform NER
class Nlp(object):
	def GET(self):
		web.header('Content-Type', 'application/json')
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		query_string = web.input()
		try:
			query_str_decoded = query_string.q.decode('utf-8').strip()
		except Exception as e:
			query_str_decoded = query_string.q.strip()

		# parse string with spacy
        
		parsed = NER_IT(query_str_decoded) if query_string.lang == 'it' else NER_EN(query_str_decoded)
		entities = {word.text for word in parsed.ents if word.label_ in ['PERSON','ORG','GPE','LOC']}
		# prepare json
		results = []
		for e in list(entities):
			result = {}
			result['result'] = e
			results.append(result)
		return json.dumps(results)

class Sparqlanything(object):
	def GET(self):
		web.header('Content-Type', 'application/json')
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		query_string = web.input()
		try:
			query_str_decoded = query_string.q.decode('utf-8').strip()
		except Exception as e:
			query_str_decoded = query_string.q.strip()
		
		action = query_string.action
		
		if action == "searchclasses":
			if query_str_decoded.endswith(".xml"):
				classes_query = "SELECT DISTINCT ?class WHERE { SERVICE <x-sparql-anything:"+query_str_decoded+"> { ?subj a ?class } }"
				temp_results = queries.SPARQLAnything(classes_query)
				results = [binding['class']['value'] for binding in temp_results['results']['bindings'] if "class" in binding]
			elif query_str_decoded.endswith(".json"):
				classes_query = "SELECT DISTINCT (STRAFTER(STR(?propertyName), STR(xyz:)) AS ?class) WHERE { SERVICE <x-sparql-anything:"+query_str_decoded+"> { ?subj ?propertyName ?obj . FILTER(STRSTARTS(STR(?propertyName), STR(xyz:))) } }"
				temp_results = queries.SPARQLAnything(classes_query)
				results = [binding['class']['value'] for binding in temp_results['results']['bindings'] if "class" in binding]
			elif query_str_decoded.endswith(".csv"):
				response = requests.get(query_str_decoded)
				if response.status_code == 200:
					csv_content = StringIO(response.text)
					reader = csv.reader(csv_content)
					results = next(reader)
			return json.dumps(results)
		
		elif action == "searchentities":
			results = queries.SPARQLAnything(query_str_decoded)
			for result in results["results"]["bindings"]:
				if "uri" not in result:
					result["uri"] = {"value": result["label"]["value"], "type": "uri"}
				uri = result["uri"]["value"]
				if not (uri.startswith("http://") or uri.startswith("https://")):
					service = query_string.service if "service" in action else "wd"
					result["uri"]["value"] = queries.entity_reconciliation(uri,service)
			print(results)
			return json.dumps(results)
	
class Wikidata(object):
	def GET(self):
		web.header('Content-Type', 'application/json')
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		query_string = web.input()

		try:
			query_str_decoded = query_string.query.decode('utf-8').strip()
		except Exception as e:
			query_str_decoded = query_string.query.strip()
		
		sparql = SPARQLWrapper(WIKIDATA_SPARQL,agent=USER_AGENT)
		sparql.setQuery(query_str_decoded)
		sparql.setReturnFormat(JSON)
		results = sparql.query().convert()
		return json.dumps(results)
	
class Charts(object):
	def GET(self):
		web.header("X-Forwarded-For", session['ip_address'])
		web.header("Cache-Control", "no-cache, max-age=0, must-revalidate, no-store")
		web.header("Content-Type","text/html; charset=utf-8")
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		is_git_auth = github_sync.is_git_auth()
		query_viz = web.input()
		viz = {urllib.parse.unquote(k): urllib.parse.unquote(v) for k, v in query_viz.items()}
		if "action" in query_viz:
			try:
				charts = u.charts_to_json(conf.charts, viz, False)
			except Exception as e:
				charts = {}
		else:
			with open(conf.charts) as chart_file:
				charts = json.load(chart_file)
		
		for chart in charts["charts"]:
			if chart["type"] == "counter":
				for counter in chart["counters"]:
					counter_query = counter["query"]
					query_results = queries.hello_blazegraph(counter_query)
					count_result = [result["count"]["value"] for result in query_results["results"]["bindings"]]
					count = int(count_result[0]) if len(count_result) > 0 else 0
					counter["count"] = count
			elif chart["type"] == "map":
				chart_id = str(time.time()).replace('.','-')
				query_results = queries.hello_blazegraph(chart["query"])["results"]["bindings"]
				stats_result = []
				for result in query_results:
					if "geonames" in result:
						geonames = result["geonames"]["value"]
						lat, long = queries.geonames_geocoding(geonames)
						i = 0
						while i < int(result["count"]["value"]):
							stats_result.append({
								"label" : result["label"]["value"],
								"latitude": lat,
								"longitude": long
							})
							i += 1
				chart["stats"] = json.dumps(stats_result)
				chart["info"] = chart_id
			elif chart["type"] == "chart":
				chart_id = str(time.time()).replace('.','-')
				stats_query = chart["query"]
				x_var, x_name = chart["x-var"], chart["x-name"]
				x_var = x_var.replace("?","")
				y_var, y_name = chart["y-var"], chart["y-name"]
				y_var = y_var.replace("?","")
				query_results = queries.hello_blazegraph(stats_query)
				stats_result = []
				for result in query_results["results"]["bindings"]:
					x_value = int(result[x_var]["value"]) if "datatype" in result[x_var] and result[x_var]["datatype"] == "http://www.w3.org/2001/XMLSchema#integer" else result[x_var]["value"]
					y_value = int(result[y_var]["value"]) if "datatype" in result[y_var] and result[y_var]["datatype"] == "http://www.w3.org/2001/XMLSchema#integer" else result[y_var]["value"]
					stats_result.append({x_name: x_value, y_name: y_value})
				if "sorted" in chart and chart["sorted"] != "None":
					if chart["sorted"] == "x":
						stats_result = list(reversed(sorted(stats_result, key=lambda x: x[x_name])))
					elif chart["sorted"] == "y":
						stats_result = list(reversed(sorted(stats_result, key=lambda x: x[y_name])))
				chart["stats"] = json.dumps(stats_result)
				chart["info"] = (chart_id, x_name, y_name)


		return render.charts_visualization(user=session['username'], is_git_auth=is_git_auth,
					   project=conf.myProject, charts=charts,
					   main_lang=conf.mainLang)
	
class ChartsTemplate(object):
	def GET(self):
		web.header("X-Forwarded-For", session['ip_address'])
		web.header("Cache-Control", "no-cache, max-age=0, must-revalidate, no-store")
		web.header("Content-Type","text/html; charset=utf-8")
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		is_git_auth = github_sync.is_git_auth()
		with open(conf.charts) as chart_file:
			charts = json.load(chart_file)

		return render.charts_template(user=session['username'], is_git_auth=is_git_auth,
					   project=conf.myProject, charts=charts,
					   main_lang=conf.mainLang)

	def POST(self):
		data = web.input()
		if 'action' in data and 'deleteTemplate' in data.action:
			u.delete_charts(conf.charts)
		elif 'action' in data and 'updateTemplate' in data.action:
			u.charts_to_json(conf.charts, data)
		raise web.seeother(prefixLocal+'/welcome-1')


if __name__ == "__main__":
	app.run()
