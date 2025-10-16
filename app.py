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
import io
import zipfile

#import subprocess

import forms, mapping, conf, queries , vocabs  , github_sync
import utils as u
#import threading

web.config.debug = False

# VARS

WIKIDATA_SPARQL = "https://query.wikidata.org/bigdata/namespace/wdq/sparql"
DEFAULT_FORM_JSON = conf.myform
DEFAULT_ENDPOINT = "http://127.0.0.1:3000/blazegraph/sparql"
IP_LOGS = "data/ip_logs.log"
RESOURCE_TEMPLATES = 'resource_templates/'
TEMPLATE_LIST = RESOURCE_TEMPLATES+"template_list.json"
ASK_CLASS = RESOURCE_TEMPLATES+"ask_class.json"
SKOS_VOCAB = conf.skos_vocabularies
USER_AGENT = "polifonia/1.0 (https://github.com/polifonia-project; polifonia@example.org)"
NER_EN = spacy.load("en_core_web_sm")
NER_IT = spacy.load("it_core_news_sm")

# ROUTING

prefix = ''
prefixLocal = '' # REPLACE IF IN SUBFOLDER
urls = (
	prefix + '/', 'Login',
	prefix + '/setup', 'Setup',
	prefix + '/template-(.+)', 'Template',
	prefix + '/logout', 'Logout',
	prefix + '/gitauth', 'Gitauth',
	prefix + '/oauth-callback', 'Oauthcallback',
	prefix + '/welcome-(.+)', 'Index',
	prefix + '/record-(.+)', 'Record',
	prefix + '/modify-(.+)', 'Modify',
	prefix + '/review-(.+)', 'Review',
	prefix + '/documentation', 'Documentation',
	prefix + '/records', 'Records',
	prefix + '/model', 'DataModel',
	prefix + '/view-(.+)', 'View',
	prefix + '/term', 'Term',
	prefix + '/(sparql)', 'sparql',
	prefix + '/savetheweb-(.+)', 'Savetheweb',
	prefix + '/nlp', 'Nlp',
	prefix + '/sparqlanything', 'Sparqlanything',
	prefix + '/wd', 'Wikidata',
	prefix + '/charts-visualization', 'Charts',
	prefix + '/charts-template', 'ChartsTemplate',
	prefix + '/serialization', 'Serialization',
	prefix + "/static/(.*)", "StaticFileHandler"  # Serve static files explicitly
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
								'Dropdown':web.form.Dropdown,
								'color':[conf.primaryColor, conf.secondaryColor]})


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

class StaticFileHandler:
	def GET(self, file):
		"""Serve static files manually when using Gunicorn"""
		static_path = os.path.join(os.path.dirname(__file__), "static")
		file_path = os.path.join(static_path, file)

		if os.path.exists(file_path):
			return open(file_path, "rb").read()
		else:
			return web.notfound()


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
		raise web.seeother('/record-'+record)
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
		scope = "&scope=repo read:user user:email"

		return web.seeother(github_auth+"?client_id="+clientId+scope)

class Oauthcallback:
	def GET(self):
		""" Redirect from class Gitauth.
		After the user authenticates, get profile information (ask_user_permission).
		Check the user is a collaborator of the repository (get_github_users)
		"""

		data = web.input()
		code = data.code

		try:
			res = github_sync.ask_user_permission(code)
		except Exception as e:
			u.log_output("ERROR GITHUB OAUTH", str(e), "None")
			return internalerror()

		if not res or "access_token" not in res:
			u.log_output("ERROR GITHUB OAUTH", "no access token", "None")
			return internalerror()

		userlogin, usermail, bearer_token = github_sync.get_user_login(res)
		is_valid_user = github_sync.get_github_users(userlogin) # look for repo collaborators

		print(userlogin, usermail, bearer_token)

		if userlogin and usermail and bearer_token:
			session['is_member'] = 'True' if is_valid_user else 'False' # set False as default value
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
		is_member = True if session["is_member"] == "True" else False
		if is_git_auth and not is_member:
			raise web.seeother(prefixLocal+'gitauth')
		
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
			file.writelines('log_file = "'+IP_LOGS+'"\n')
			file.writelines('wikidataEndpoint = "'+WIKIDATA_SPARQL+'"\n')
			file.writelines('resource_templates = "'+RESOURCE_TEMPLATES+'"\n')
			file.writelines('template_list = "'+TEMPLATE_LIST+'"\n')
			file.writelines('ask_form = "'+RESOURCE_TEMPLATES+'ask_class.json"\n')
			file.writelines('skos_vocabularies = "skos_vocabs.json"\n')
			file.writelines('sparql_wrapper_user_agent = "'+USER_AGENT+'"\n')
			file.writelines('charts = "charts.json"\n')
			data = u.validate_setup(data)

			for k,v in data.items():
				print(k,v)
				file.writelines(k+''' = "'''+v+'''"\n''')

			# write the json config file for javascript
			u.init_js_config(data)
			u.reload_config()

			raise web.seeother(prefixLocal+'welcome-1')


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
		is_member = True if session["is_member"] == "True" else False
		if is_git_auth and not is_member:
			raise web.seeother(prefixLocal+'gitauth')

		data = web.input()

		if 'action' in data and 'updateSubclass' in data.action:
			queries.updateSubclassValue(data)

		with open(TEMPLATE_LIST,'r') as tpl_file:
			tpl_list = json.load(tpl_file)

		# load template settings
		res_config = next(tpl for tpl in tpl_list if tpl["short_name"] == res_name)

		# if does not exist create the template json file
		template_path = RESOURCE_TEMPLATES+'template-'+res_name+'.json'
		if not os.path.isfile(template_path):
			f = open(template_path, "w")
			json.dump([],f)

		# modify settings
		return render.template_settings(user=session['username'],res_config=res_config,
								is_git_auth=is_git_auth,project=conf.myProject,main_lang=conf.mainLang)

	def POST(self, res_name):
		""" Save the form template for data entry and reload config files
		"""

		data = web.input()
		template_path = RESOURCE_TEMPLATES+'template-'+res_name+'.json'
		# save template initial settings then modify fields
		if 'action' in data and 'modifyFields' in data.action:

			# save config settings
			u.config_template(res_name,data=data)

			# load template settings
			with open(TEMPLATE_LIST,'r') as tpl_file:
				tpl_list = json.load(tpl_file)
			res_config = next(tpl for tpl in tpl_list if tpl["short_name"] == res_name)

			# load template form
			with open(template_path,'r') as tpl_file:
					fields = json.load(tpl_file)
			if not os.path.isfile(SKOS_VOCAB):
				skos_file = None
			else:
				with open(SKOS_VOCAB, 'r') as skos_list:
					skos_file = json.load(skos_list)

			return render.template_fields(f=fields,user=session['username'],
											res_config=res_config,is_git_auth=is_git_auth,
											project=conf.myProject,skos_vocabs=skos_file,
											templates=tpl_list,main_lang=conf.mainLang)

		elif 'action' in data and 'deleteTemplate' in data.action:
			# os.remove(template_path) # remove json file
			u.updateTemplateList(res_name,None,remove=True) # update tpl list
			u.update_ask_class(template_path, res_name,remove=True) # update ask_class
			raise web.seeother(prefixLocal+'welcome-1')
		elif 'action' in data and 'updateTemplate' in data.action:
			u.fields_to_json(data, template_path, SKOS_VOCAB) # save the json template
			u.reload_config()
			vocabs.import_vocabs()
			u.update_ask_class(template_path, res_name) # modify ask_class json
			raise web.seeother(prefixLocal+'welcome-1')
		else:
			create_record(data)


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
		is_external_user = True if 'is_member' in session and session['is_member'] == 'False' and is_git_auth else False
		session['ip_address'] = str(web.ctx['ip'])
		filterRecords = ''
		userID = session['username'].replace('@','-at-').replace('.','-dot-')
		userURI = conf.base + userID
		if is_external_user:
			alll = queries.countAll(userURI=userURI)
			all, notreviewed, underreview, published = queries.getCountings(userURI=userURI)
			results = queries.getRecordsPagination(page, userURI=userURI)
		else:
			alll = queries.countAll()
			all, notreviewed, underreview, published = queries.getCountings()
			results = queries.getRecordsPagination(page)
		records = list(reversed(sorted(results, key=lambda tup: u.key(tup[4][:-5]) ))) if len(results) > 0 else []

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
				project=conf.myProject,templates=tpl_list,main_lang=conf.mainLang,
				is_external_user=is_external_user)
		else:
			if conf.gitClientID == '':
				session['logged_in'] = 'False'
				return render.index(wikilist=records, user=session['username'],
					varIDpage=str(time.time()).replace('.','-'), alll=alll, all=all,
					notreviewed=notreviewed,underreview=underreview,
					published=published, page=page,pagination=int(conf.pagination),
					filter=filterRecords, filterName = 'filterAll',is_git_auth=is_git_auth,
					project=conf.myProject,templates=tpl_list,main_lang=conf.mainLang,
					is_external_user=is_external_user)
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
		is_external_user = True if 'is_member' in session and session['is_member'] == 'False' and is_git_auth else False
		session['ip_address'] = str(web.ctx['ip'])
		userID = session['username'].replace('@','-at-').replace('.','-dot-')
		userURI = conf.base + userID

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
			filterRecords = filter_values[actions.action]
			filterRecords = filterRecords if filterRecords not in ['none',None] else ''
			filterName = actions.action
			page = 1
			if is_external_user:
				results = queries.getRecordsPagination(page, filterRecords,userURI=userURI)
				records = list(reversed(sorted(results, key=lambda tup: u.key(tup[4][:-5]) ))) if len(results) > 0 else []
				alll = queries.countAll(userURI=userURI)
				all, notreviewed, underreview, published = queries.getCountings(userURI=userURI)
			else:
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
				project=conf.myProject,templates=tpl_list,main_lang=conf.mainLang,
				is_external_user=is_external_user)

		# create a new record
		elif actions.action.startswith('createRecord'):
			record = actions.action.split("createRecord",1)[1]
			u.log_output('START NEW RECORD (LOGGED IN)', session['logged_in'], session['username'], record )
			raise web.seeother('/record-'+record)

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
				if is_external_user:
					results = queries.getRecordsPagination(page, filterRecords,userURI=userURI)
					records = list(reversed(sorted(results, key=lambda tup: u.key(tup[4][:-5]) ))) if len(results) > 0 else []
					alll = queries.countAll(userURI=userURI)
					all, notreviewed, underreview, published = queries.getCountings(userURI=userURI)
				else:
					results = queries.getRecordsPagination(page, filterRecords)
					records = list(reversed(sorted(results, key=lambda tup: u.key(tup[4][:-5]) ))) if len(results) > 0 else []
					alll = queries.countAll()
					all, notreviewed, underreview, published = queries.getCountings()

				return render.index(wikilist=records, user=session['username'],
					varIDpage=str(time.time()).replace('.','-'),
					alll=alll, all=all, notreviewed=notreviewed,
					underreview=underreview, published=published,
					page=page, pagination=int(conf.pagination),
					filter= filterRecords, filterName = filterName, is_git_auth=is_git_auth,
					project=conf.myProject,templates=tpl_list,main_lang=conf.mainLang,
					is_external_user=is_external_user)

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
					project=conf.myProject,templates=tpl_list,main_lang=conf.mainLang,
					is_external_user=is_external_user)

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
			raise web.seeother(prefixLocal+'welcome-1')

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
		#block_user, limit = u.check_ip(str(web.ctx['ip']), str(datetime.datetime.now()) )
		u.check_ask_class()
		ask_form = u.change_template_names(is_git_auth)
		descriptions_dict = u.get_templates_description()
		f = forms.get_form(ask_form,True)

		return render.record(record_form=f, pageID=name, user=user,
							alert=False, limit=50,
							is_git_auth=is_git_auth,invalid=False,
							project=conf.myProject,template=None,
							query_templates=None,knowledge_extractor=set(),
							main_lang=conf.mainLang,descriptions_dict=descriptions_dict)

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
		#block_user, limit = u.check_ip(str(web.ctx['ip']), str(datetime.datetime.now()) )
		whereto = '/' if user == 'anonymous' else '/welcome-1'
		descriptions_dict= u.get_templates_description()

		# form validation (ask_class)
		if not f.validates():
			u.log_output('SUBMIT INVALID FORM', session['logged_in'], session['username'],name)
			return render.record(record_form=f, pageID=name, user=user, alert=False,
								limit=50, is_git_auth=is_git_auth,invalid=True,
								project=conf.myProject,template=None,
								query_templates=None,knowledge_extractor=set(),
								main_lang=conf.mainLang,descriptions_dict=descriptions_dict)
		else:
			recordData = web.input()

			# load the template selected by the user
			if 'res_name' in recordData:
				if recordData.res_name != 'None':
					f = forms.get_form(recordData.res_name,processed_templates=[])
					query_templates = u.get_query_templates(recordData.res_name)
					extractor = u.has_extractor(recordData.res_name)
					keywords_classes = u.get_keywords_classes(recordData.res_name)
					return render.record(record_form=f, pageID=name, user=user, alert=False,
									limit=50, is_git_auth=is_git_auth,invalid=False,
									project=conf.myProject,template=recordData.res_name,
									query_templates=query_templates,knowledge_extractor=extractor,
									main_lang=conf.mainLang,descriptions_dict=descriptions_dict,
									keywords_classes=keywords_classes)
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
					return render.record(record_form=f, pageID=name, user=user, alert=False,
									limit=50, is_git_auth=is_git_auth,invalid=True,
									project=conf.myProject,template=templateID,
									query_templates=query_templates,knowledge_extractor=extractor,
									main_lang=conf.mainLang,descriptions_dict=descriptions_dict)
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
		is_external_user = True if 'is_member' in session and session['is_member'] == 'False' and is_git_auth else False
		session['ip_address'] = str(web.ctx['ip'])
		session_data['logged_in'] = 'True' if (session['username'] != 'anonymous') or \
							(conf.gitClientID == '' and session['username'] == 'anonymous') else 'False'

		graphToRebuild = conf.base+name+'/'
		is_editable_by_author = queries.can_user_edit_graph(graphToRebuild,session['username'])
		if is_external_user and not is_editable_by_author:
			raise web.seeother(prefixLocal+'gitauth')
			
		if (session['username'] != 'anonymous') or \
			(conf.gitClientID == '' and session['username'] == 'anonymous'):
			recordID = name
			res_class = queries.getClass(conf.base+name)
			res_template, res_subclasses = u.get_template_from_class(res_class)
			data = queries.getData(graphToRebuild, res_template, res_subclasses=res_subclasses)
			u.log_output('START MODIFY RECORD', session['logged_in'], session['username'], recordID )

			f = forms.get_form(res_template,processed_templates=[])

			with open(res_template) as tpl_form:
				fields = json.load(tpl_form)
			ids_dropdown = u.get_dropdowns(fields)
			ids_subtemplate = u.get_subtemplates(fields)

			query_templates=u.get_query_templates(res_template)
			extractor = u.has_extractor(res_template)
			previous_extractors = u.has_extractor(res_template, name)
			extractions_data = queries.retrieve_extractions(previous_extractors)
			keywords_classes = u.get_keywords_classes(res_template)

			return render.modify(graphdata=data, pageID=recordID, record_form=f,
							user=session['username'],ids_dropdown=ids_dropdown,
							ids_subtemplate=ids_subtemplate,is_git_auth=is_git_auth,
							invalid=False,project=conf.myProject,template=res_template,
							query_templates=query_templates,knowledge_extractor=extractor,
							extractions=extractions_data,main_lang=conf.mainLang,
							keywords_classes=keywords_classes)
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
		is_external_user = True if session["is_member"] == "False" else False
		templateID = recordData.templateID if 'templateID' in recordData else None
		res_class = queries.getClass(conf.base+name)
		res_template, res_subclasses = u.get_template_from_class(res_class)

		if 'action' in recordData:
			create_record(recordData)
		else:
			f = forms.get_form(templateID,processed_templates=[])
			if not f.validates():
				graphToRebuild = conf.base+name+'/'
				recordID = name
				data = queries.getData(graphToRebuild,templateID,res_subclasses=res_subclasses)
				u.log_output('INVALID MODIFY RECORD', session['logged_in'], session['username'], recordID )
				f = forms.get_form(templateID)

				with open(templateID) as tpl_form:
					fields = json.load(tpl_form)
				ids_dropdown = u.get_dropdowns(fields)
				ids_subtemplate = u.get_subtemplates(fields)

				query_templates = u.get_query_templates(templateID)
				extractor = u.has_extractor(res_template)
				previous_extractors = u.has_extractor(res_template, name)
				extractions_data = queries.retrieve_extractions(previous_extractors)
				keywords_classes = u.get_keywords_classes(res_template)

				return render.modify(graphdata=data, pageID=recordID, record_form=f,
								user=session['username'],ids_dropdown=ids_dropdown,
								ids_subtemplate=ids_subtemplate,is_git_auth=is_git_auth,
								invalid=True,project=conf.myProject,template=res_template,
								query_templates=query_templates,knowledge_extractor=extractor,
								extractions=extractions_data,main_lang=conf.mainLang,
								keywords_classes=keywords_classes)
			else:
				recordID = recordData.recordID
				#u.update_knowledge_extraction(recordData,KNOWLEDGE_EXTRACTION)
				userID = session['username'].replace('@','-at-').replace('.','-dot-')
				graphToClear = conf.base+name+'/'
				if is_external_user:
					queries.clearGraph(graphToClear)
					stage = 'not modified'
				else:
					stage = 'modified'
				file_path = mapping.inputToRDF(recordData, userID, stage, graphToClear=graphToClear,tpl_form=templateID)
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
		is_member = True if session['is_member'] == 'True' else False
		if is_git_auth and not is_member:
			raise web.seeother(prefixLocal+'gitauth')
		
		session_data['logged_in'] = 'True' if (session['username'] != 'anonymous') or \
							(conf.gitClientID == '' and session['username'] == 'anonymous') else 'False'

		# anonymous or authenticated user
		if (session['username'] != 'anonymous') or \
			(conf.gitClientID == '' and session['username'] == 'anonymous'):
			graphToRebuild = conf.base+name+'/'
			recordID = name
			res_class = queries.getClass(conf.base+name)
			res_template, res_subclasses = u.get_template_from_class(res_class)
			data = queries.getData(graphToRebuild, res_template, res_subclasses=res_subclasses)
			session['ip_address'] = str(web.ctx['ip'])
			u.log_output('START REVIEW RECORD', session['logged_in'], session['username'], recordID )

			f = forms.get_form(res_template,processed_templates=[])

			with open(res_template) as tpl_form:
				fields = json.load(tpl_form)
			ids_dropdown = u.get_dropdowns(fields) # TODO CHANGE
			ids_subtemplate = u.get_subtemplates(fields)

			query_templates = u.get_query_templates(res_template)
			extractor = u.has_extractor(res_template)
			previous_extractors = u.has_extractor(res_template, name)
			extractions_data = queries.retrieve_extractions(previous_extractors)
			keywords_classes = u.get_keywords_classes(res_template)

			return render.review(graphdata=data, pageID=recordID, record_form=f,
								graph=graphToRebuild, user=session['username'],
								ids_dropdown=ids_dropdown,ids_subtemplate=ids_subtemplate,
								is_git_auth=is_git_auth,invalid=False,
								project=conf.myProject,template=res_template,
								query_templates=query_templates,knowledge_extractor=extractor,
								extractions=extractions_data,main_lang=conf.mainLang,
								keywords_classes=keywords_classes)
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
				res_template, res_subclasses = u.get_template_from_class(res_class)
				data = queries.getData(graphToRebuild, res_template, res_subclasses=res_subclasses)
				session['ip_address'] = str(web.ctx['ip'])
				u.log_output('INVALID REVIEW RECORD', session['logged_in'], session['username'], recordID )
				#f = forms.get_form(conf.myform)
				with open(templateID) as tpl_form:
					fields = json.load(tpl_form)
				ids_dropdown = u.get_dropdowns(fields) # TODO CHANGE
				ids_subtemplate = u.get_subtemplates(fields)

				query_templates = u.get_query_templates()
				extractor = u.has_extractor(res_template)
				previous_extractors = u.has_extractor(res_template, name)
				extractions_data = queries.retrieve_extractions(previous_extractors)
				keywords_classes = u.get_keywords_classes(res_template)

				return render.review(graphdata=data, pageID=recordID, record_form=f,
									graph=graphToRebuild, user=session['username'],
									ids_dropdown=ids_dropdown,ids_subtemplate=ids_subtemplate,
									is_git_auth=is_git_auth,invalid=True,
									project=conf.myProject,template=templateID,
									query_templates=query_templates,knowledge_extractor=extractor,
									extractions=extractions_data,main_lang=conf.mainLang,
									keywords_classes=keywords_classes)
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
				res_template, res_subclasses = u.get_template_from_class(res_class)
				data = queries.getData(graphToRebuild, res_template, res_subclasses=res_subclasses)
				session['ip_address'] = str(web.ctx['ip'])
				u.log_output('INVALID REVIEW RECORD', session['logged_in'], session['username'], recordID )
				f = forms.get_form(templateID)
				with open(templateID) as tpl_form:
					fields = json.load(tpl_form)
				ids_dropdown = u.get_dropdowns(fields)
				ids_subtemplate = u.get_subtemplates(fields)

				query_templates = u.get_query_templates()
				extractor = u.has_extractor(res_template)
				previous_extractors = u.has_extractor(res_template, name)
				extractions_data = queries.retrieve_extractions(previous_extractors)
				keywords_classes = u.get_keywords_classes(res_template)

				return render.review(graphdata=data, pageID=recordID, record_form=f,
									graph=graphToRebuild, user=session['username'],
									ids_dropdown=ids_dropdown,ids_subtemplate=ids_subtemplate,
									is_git_auth=is_git_auth,invalid=True,project=conf.myProject,template=templateID,
									query_templates=query_templates,knowledge_extractor=extractor,
									extractions=extractions_data,main_lang=conf.mainLang,
									keywords_classes=keywords_classes)
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

		records_by_template , count_by_template , count_by_subclass , filters_by_template, extraction_config = {} , {} , {} , {}, {}
		for template in templates:
			if not (is_git_auth==False and template["hidden"] =='True'):
				res_class=template["type"]
				res_subclass_dict = template["subclasses"]
				res_subclasses = list(res_subclass_dict.keys())
				records = list(queries.getRecords(res_class,res_subclasses))
				records_by_template[template["name"]] = records
				alll = queries.countAll(res_class,res_subclasses,False,False)
				count_by_template[template["name"]] = alll
				init_count_subclass = int(alll)
				if len(res_subclasses) > 0:
					count_by_subclass[template["name"]] = {}
				for res_subclass in res_subclasses:
					count_subclass = queries.countAll(res_class,res_subclasses,[res_subclass],False)
					init_count_subclass -= int(count_subclass)
					count_by_subclass[template["name"]][res_subclass] = {"label": res_subclass_dict[res_subclass], "count": count_subclass}
				
				# show other subclass
				if "other_subclass" in template and template["other_subclass"] == "True":
					count_by_subclass[template["name"]]["other"] = {"label": "Other", "count": str(init_count_subclass)}

					# ATLAS - show additional values from taxonomies
					count_by_other_values,records_other_value = queries.countAllOtherValues(res_class,res_subclasses)
					count_by_subclass[template["name"]]["other"]["other"] = count_by_other_values
					for i, record in enumerate(records_by_template[template["name"]]):
						if record[7] == "" and record[0] in records_other_value:
							print(record)
							record_info_list = list(record)
							record_info_list[7] = "other-"+records_other_value[record[0]]
							records_by_template[template["name"]][i] = tuple(record_info_list)

				filtersBrowse = queries.getBrowsingFilters(template["template"])
				filters_by_template[template["name"]] = filtersBrowse
				extraction_properties = queries.getExtractionProperties(template["template"])
				extraction_config[template["name"]] = { "extraction_properties" : extraction_properties }
				if "keywords_classes" in template:
					extraction_config[template["name"]]["keywords_classes"] = template["keywords_classes"]


		for template_name in count_by_subclass:
			items = {
				k: v for k, v in sorted(
					((k, v) for k, v in count_by_subclass[template_name].items() if k != 'other'),
					key=lambda item: int(item[1]['count']),
					reverse=True
				)
			}
			if 'other' in count_by_subclass[template_name]:
				items['other'] = count_by_subclass[template_name]['other']
			count_by_subclass[template_name] = items

		return render.records(user=session['username'], data=records_by_template,
							subclass_data=count_by_subclass,title='Latest resources', r_base=conf.base,
							alll=count_by_template, filters=filters_by_template,
							is_git_auth=is_git_auth,project=conf.myProject,
							main_lang=conf.mainLang,extraction_config=extraction_config)

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
		data, stage, title, properties, data_labels, extractions_data, new_dict_classes = None, None, None, None, {}, {}, {}
		try:
			res_template, res_subclasses = u.get_template_from_class(res_class)
			data = dict(queries.getData(record+'/',res_template,res_subclasses))
			stage = data['stage'][0] if 'stage' in data else 'draft'
			previous_extractors = u.has_extractor(res_template, name, res_subclasses=res_subclasses)
			extractions_data = queries.retrieve_extractions(previous_extractors,view=res_template)


			with open(res_template) as tpl_form:
				all_fields = json.load(tpl_form)
			fields = []
			for field in all_fields:
				if field['restricted'] in [ [], ["other"] ] or any(subclass in field['restricted'] for subclass in res_subclasses):
					fields.append(field)
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
				result_class = result['classes']['value']
				result_property_uri = result['property']['value']
				result_subject = result['subject']['value'] + ',' + result['label']['value']
				result_class = "; ".join(sorted(result_class.split("; ")))
				if result_class not in class_sorted:
					class_sorted[result_class] = { result_property_uri : [result_subject] }
				else:
					if result_property_uri in class_sorted[result_class]:
						class_sorted[result_class][result_property_uri].append(result_subject)
					else:
						class_sorted[result_class][result_property_uri] = [result_subject]


			with open(TEMPLATE_LIST) as tpl_list:
				templates = json.load(tpl_list)


			for k in list(class_sorted.keys()):

				# retrieve the corresponding template
				template = next((
					t["name"], t["template"]
				) for t in templates if all(val in (t["type"] + list(t["subclasses"].keys())) for val in k.split("; ")))
				template_name, template_file = template

				with open(template_file) as tpl_file:
					template_fields = json.load(tpl_file)
				property_label = list(class_sorted[k].keys())[0]
				property_name = next(f["label"] for f in template_fields if f["property"] == property_label.split(',',1)[0])
				if template_name in new_dict_classes:
					if property_label+','+property_name in new_dict_classes[template_name]["results"]:
						new_dict_classes[template_name]["results"][property_label+','+property_name].extend(class_sorted[k][property_label])
					else:
						new_dict_classes[template_name]["results"][property_label+','+property_name] = class_sorted[k][property_label]
				else:
					new_dict_classes[template_name] = {'results': { property_label+','+property_name : class_sorted[k][property_label]} }
		except Exception as e:
			pass

		return render.view(user=session['username'], graphdata=data_labels,
						graphID=name, title=title, stage=stage, base=base,properties=properties,
						is_git_auth=is_git_auth,project=conf.myProject,knowledge_extractor=extractions_data,
						inverses_by_class=new_dict_classes,main_lang=conf.mainLang)

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
	def GET(self):
		web.header("Cache-Control", "no-cache, max-age=0, must-revalidate, no-store")
		is_git_auth = github_sync.is_git_auth()

		params = web.input(id=None)
		if params.id:
			name = unquote(params.id)
		else:
			raise web.notfound()


		# look for occurrences in Record Graphs
		uri = mapping.getRightURIbase(name)
		label = queries.get_URI_label(uri)
		data = queries.describe_term(uri)
		results_by_class = {}

		if data is not None:
			appears_in_set = {
				result["subject"]["value"]
				for result in data["results"]["bindings"]
				if result["object"]["value"] == uri 
				and result["object"]["type"] == "uri"
			}
			appears_in = list(appears_in_set)
		else:
			appears_in = []

		# look for occurrences in Extraction Graphs
		extractions_data = queries.describe_extraction_term(uri)
		appears_in_extractions = [result["graph"]["value"][:-1] for result in extractions_data["results"]["bindings"] ] \
			if extractions_data != None else []
		hide_link = True if (len(appears_in_extractions) > 0 and len(appears_in) == 0) and conf.base in uri else False
		appears_in.extend(appears_in_extractions)
		appears_in = list(set(appears_in))

		with open(TEMPLATE_LIST) as tpl_list:
			res_templates = json.load(tpl_list)

		for res_uri in appears_in:
			res_class = sorted(queries.getClass(res_uri))
			res_tpl = next((t for t in res_templates if all(cls in (t["type"] + list(t["subclasses"].keys())) for cls in res_class)),None)
			res_type = res_tpl["name"] if res_tpl != None else None
			tpl_sublcasses = list(res_tpl["subclasses"].keys()) if res_tpl != None else []
			if res_type in results_by_class:
				results_by_class[res_type]['results'].append(res_uri)
			elif res_type != None:
				main_class = [cls for cls in res_class if cls  not in tpl_sublcasses]
				results_by_class[res_type] = {'class':main_class, 'results':[res_uri], 'subclasses': tpl_sublcasses}

		count = len(appears_in)
		map_coordinates = (queries.geonames_geocoding(uri)) if uri.startswith("https://sws.geonames.org/") else None

		return render.term(user=session['username'], label=label, count=count,
						is_git_auth=is_git_auth,project=conf.myProject,base=conf.base,
						uri=uri,name=name,results=results_by_class,map=map_coordinates,
						hide_link=hide_link,main_lang=conf.mainLang)

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
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		query_string = web.input()
		try:
			query_str_decoded = query_string.q.decode('utf-8').strip()
			endpoint = query_string.endpoint.decode('utf-8').strip() if "endpoint" in query_string else None
			has_csv_header = query_string.csvheader.decode('utf-8').strip() if "csvheader" in query_string else None
		except Exception as e:
			query_str_decoded = query_string.q.strip()
			endpoint = query_string.endpoint.strip() if "endpoint" in query_string else None
			has_csv_header = query_string.csvheader.strip() if "csvheader" in query_string else None

		action = query_string.action

		if action == "searchclasses":
			web.header('Content-Type', 'application/json')
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
					first_row = next(reader)
					results = first_row if has_csv_header == "true" else [str(i) for i in range(len(first_row))]
			return json.dumps(results)

		elif action == "searchentities":
			results = queries.SPARQLAnything(query_str_decoded,endpoint=endpoint)
			total_results = len(results["results"]["bindings"])
			service = query_string.service if "service" in query_string else "wd"
			if service == "skos":
				web.header('Content-Type', 'application/json')
				print("results:", results)
				return json.dumps(results)
			else:
				def stream():
					
					web.header('Content-Type', 'text/event-stream')
					web.header('Cache-Control', 'no-cache')
					web.header('Connection', 'keep-alive')
					yield f"data: {json.dumps({'length': total_results})}\n\n" # total length

					count = 0 
					for result in results["results"]["bindings"]:
						if "label" not in result and "uri" in result:
							uri = result["uri"]["value"]
							label = queries.entity_reconciliation(uri, service, find="label", language=conf.mainLang)
							result["label"] = {"value": label, "type": "literal"}

						if "uri" not in result:
							result["uri"] = {"value": result["label"]["value"], "type": "uri"}

						uri = result["uri"]["value"]
						if not (uri.startswith("http://") or uri.startswith("https://")):
							result["uri"]["value"] = queries.entity_reconciliation(uri, service, find="uri", language=conf.mainLang)

						count += 1
						yield f"data: {json.dumps({'count': count})}\n\n" # current count

					yield f"data: {json.dumps({'data': results})}\n\n" # data

				return stream()

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
		data = web.input()
		viz = {urllib.parse.unquote(k): urllib.parse.unquote(v) for k, v in data.items()}
		if "action" in data:
			if data.action == "preview":
				try:
					charts = u.charts_to_json(conf.charts, viz, False)
				except Exception as e:
					charts = {}
		else:
			with open(conf.charts) as chart_file:
				charts = json.load(chart_file)

		for chart in charts["charts"]:
			if chart["type"] in ["map", "timeline", "network"]:
				chart_id = str(time.time()).replace('.','-') + chart["id"]
				chart["info"] = chart_id
			elif chart["type"] == "chart":
				chart_id = str(time.time()).replace('.','-')
				x_var, x_name = chart["x-var"], chart["x-name"]
				x_var = x_var.replace("?","")
				y_var, y_name = chart["y-var"], chart["y-name"]
				y_var = y_var.replace("?","")
				chart["info"] = (chart_id, x_name, y_name)
			chart["json"] = json.dumps(chart)

		return render.charts_visualization(user=session['username'], is_git_auth=is_git_auth,
					   project=conf.myProject, charts=charts,
					   main_lang=conf.mainLang)

	def POST(self):
		web.header('Content-Type', 'application/json')
		raw_data = web.data()  # bytes
		ctype = web.ctx.env.get("CONTENT_TYPE", "")

		# form-urlencoded (submit button)
		if ctype.startswith("application/x-www-form-urlencoded"):
			params = web.input()  # già dict
			if "action" in params and params.action.startswith("createRecord"):
				create_record(params)
			else:
				return json.dumps({"error": "missing or invalid action"})

		# JSON (AJAX)
		elif ctype.startswith("application/json"):
			try:
				data = json.loads(raw_data.decode("utf-8"))
			except Exception as e:
				return json.dumps({"error": "invalid json", "details": str(e)})

			results = queries.getChartData(data)
			return json.dumps(results)

		else:
			return json.dumps({"error": f"Unsupported Content-Type: {ctype}"})


class ChartsTemplate(object):
	def GET(self):
		web.header("X-Forwarded-For", session['ip_address'])
		web.header("Cache-Control", "no-cache, max-age=0, must-revalidate, no-store")
		web.header("Content-Type","text/html; charset=utf-8")
		web.header('Access-Control-Allow-Origin', '*')
		web.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

		is_git_auth = github_sync.is_git_auth()
		is_member = True if session["is_member"] == "True" else False
		if (is_member and is_git_auth) or not is_git_auth:
			with open(conf.charts) as chart_file:
				charts = json.load(chart_file)

			return render.charts_template(user=session['username'], is_git_auth=is_git_auth,
						project=conf.myProject, charts=charts,
						main_lang=conf.mainLang)
		else:
			raise web.seeother(prefixLocal+'gitauth')

	def POST(self):
		data = web.input()
		if 'action' in data and 'deleteTemplate' in data.action:
			u.delete_charts(conf.charts)
		elif 'action' in data and 'updateTemplate' in data.action:
			u.charts_to_json(conf.charts, data)
		raise web.seeother(prefixLocal+'welcome-1')
	
class Serialization:
	def GET(self):
		user_data = web.input(id=None)
		format = user_data.format or 'TURTLE' # TURTLE set as default
		graph_id = user_data.id
		mime_map = {
            'ttl': 'text/turtle',
            'jsonld': 'application/ld+json',
            'rdf': 'application/rdf+xml'
        }
		accept = mime_map.get(format, 'text/turtle')
		graphs = queries.get_serialization_file(format,graph_id)

		if isinstance(graphs, list) and len(graphs) > 1:
			# Multiple graphs
			buffer = io.BytesIO()
			with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
				for idx, g in enumerate(graphs, start=1):
					filename = f"graph-{idx}.{format}"
					zipf.writestr(filename, g)

			buffer.seek(0)
			web.header('Content-Type', 'application/zip')
			web.header('Content-Disposition', f'attachment; filename="graph-{graph_id}.zip"')
			return buffer.read()

		else:
			# Single graph
			if isinstance(graphs, list):
				graph = graphs[0]
			else:
				graph = graphs

			web.header('Content-Type', accept)
			web.header('Content-Disposition', f'attachment; filename="graph-{graph_id}.{format}"')
			return graph



if __name__ == "__main__":
	app.run()