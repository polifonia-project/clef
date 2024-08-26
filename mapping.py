# -*- coding: utf-8 -*-
import os
import datetime
import time
import json
import urllib.parse
import web
from web import form, storify
import rdflib
from rdflib import URIRef , XSD, Namespace , Literal, term
from rdflib.namespace import OWL, DC , DCTERMS, RDF , RDFS, SKOS
from rdflib.plugins.sparql import prepareQuery
from SPARQLWrapper import SPARQLWrapper, JSON
from pymantic import sparql
import conf , queries
import utils as u

u.reload_config()

# NAMESPACES
WD = Namespace("http://www.wikidata.org/entity/")
VIAF = Namespace("http://www.viaf.org/viaf/")
WDP = Namespace("http://www.wikidata.org/wiki/Property:")
OL = Namespace("http://openlibrary.org/works/")
ULAN = Namespace("http://vocab.getty.edu/ulan/")
AAT = Namespace("http://vocab.getty.edu/aat/")
PROV = Namespace("http://www.w3.org/ns/prov#")
GEO = Namespace("https://sws.geonames.org/")
# CHANGE remove
SCHEMA = Namespace("https://schema.org/")
base = conf.base

# DATA ENDPOINT AND DIRECTORY
server = sparql.SPARQLServer(conf.myEndpoint)
dir_path = os.path.dirname(os.path.realpath(__file__))
RESOURCE_TEMPLATES = conf.resource_templates
ASK_CLASS = conf.ask_form
TEMPLATE_LIST = conf.template_list

def getValuesFromFields(fieldPrefix, recordData, fields=None, field_type=None):
	""" request form fields by field prefix, check if multiple values are available,
	returns a set of tuples including ID (for the URI) and label of values """
	result_dict = {'type':field_type} if field_type != None else {'type':'URI'}
	results = set()
	for key, value in recordData.items():
		if field_type == 'Textarea':
			# textarea: NLP keywords
			if key.startswith(fieldPrefix+'_Q') and ',' in value and key.split('_')[1] == value.split(',')[0]:
				values = value.split(',', 1)
				results.add(( values[0].strip(), urllib.parse.unquote(values[1]) )) # (id, label)
		else:
			if key.startswith(fieldPrefix+'_') and ',' in value: # multiple values from text box (entities) and URL 
				values = value.split(',', 1)
				results.add(( values[0].strip(), urllib.parse.unquote(values[1]) )) # (id, label)
			elif key == fieldPrefix: # uri from dropdown (single value from controlled vocabulary) and URL
				if fields:
					field = next(field for field in fields if field["id"] == fieldPrefix)
					label = field['values'][value] if value and value != 'None' and 'values' in field else None
					if label:
						results.add(( value, label ))
				elif field_type == 'URL':
					for url in value.split(','):
						results.add(( url.strip(), url.strip() ))
	result_dict['results'] = results
	return result_dict

def getLiteralValuesFromFields(fieldPrefix, recordData):
	""" request form fields by field prefix, check if multiple languages are available,
	returns a set of tuples including textual values and their language """
	result_dict = {'type':'Literal'}
	results = set()
	for key, value in recordData.items():
		if key.startswith(fieldPrefix+'_'):
			lang = key.rsplit('_')[1]
			if lang == 'mainLang':
				result_dict['mainLang'] = value
			elif term._is_valid_langtag(lang):
				results.add((value,lang))
	result_dict['results'] = results
	return result_dict

def getRightURIbase(value):
	return WD+value if value.startswith('Q') else GEO+value if value.isdecimal() else VIAF+value[4:] if value.startswith("viaf") else ''+value if value.startswith("http") else base+value.lstrip().rstrip()


def inputToRDF(recordData, userID, stage, graphToClear=None,tpl_form=None):
	""" transform input data into RDF, upload data to the triplestore, dump data locally """
	print("RECORD DATA:", recordData, "TEMPLATE:", tpl_form)

	# MAPPING FORM / PROPERTIES
	if tpl_form:
		with open(tpl_form) as config_form:
			fields = json.load(config_form)
	else: 
		#should this be deleted? 
		with open(conf.myform) as config_form:
			fields = json.load(config_form)

	# GET THE CLASS ASSOCIATED TO THE TEMPLATE
	with open(TEMPLATE_LIST) as tpl_file:
		tpl_list = json.load(tpl_file)

	resource_class = [t["type"] for t in tpl_list if t["template"] == tpl_form][0]
	# CREATE/MODIFY A NAMED GRAPH for each new record

	recordID = recordData.recordID
	graph_name = recordID
	wd = rdflib.Graph(identifier=URIRef(base+graph_name+'/'))

	# PROVENANCE: creator, contributor, publication stage
	if stage == 'not modified':
		wd.add(( URIRef(base+graph_name+'/'), PROV.wasAttributedTo, URIRef(base+userID) ))
		wd.add(( URIRef(base+userID), RDFS.label , Literal(userID.replace('-dot-','.').replace('-at-', '@') ) ))
	else:
		# modifier
		wd.add(( URIRef(base+graph_name+'/'), PROV.wasInfluencedBy, URIRef(base+userID) ))
		wd.add(( URIRef(base+userID), RDFS.label , Literal(userID.replace('-dot-','.').replace('-at-', '@') ) ))
		# creator
		creatorIRI, creatorLabel = queries.getRecordCreator(graphToClear)
		if creatorIRI is not None and creatorLabel is not None:
			wd.add(( URIRef(base+graph_name+'/'), PROV.wasAttributedTo, URIRef(creatorIRI) ))
			wd.add(( URIRef(creatorIRI), RDFS.label , Literal(creatorLabel ) ))

		# retrieve hidden triples (to be saved) and re-introduce them in the modified named graph
		to_be_saved = queries.saveHiddenTriples(graphToClear, tpl_form)
		if to_be_saved['results']['bindings'] != [{}]:
			for binding in to_be_saved['results']['bindings']:
				subject = URIRef(binding['subject']['value'])
				for predicate_obj, inner_dict in binding.items():
					if predicate_obj.endswith('_property'):
						predicate = URIRef(inner_dict['value'])
						short_predicate_obj = predicate_obj.replace("_property", "")
						obj_value = binding[short_predicate_obj]['value']
						obj_type = binding[short_predicate_obj]['type']
						obj_datatype = binding[short_predicate_obj]['datatype'] if 'datatype' in binding[short_predicate_obj] else ''
						obj = URIRef(obj_value) if obj_type == "uri" else Literal(obj_value, datatype=obj_datatype)
						label = binding[short_predicate_obj + "_label"]['value'] if predicate_obj.replace("_property", "") + "_label" in binding else None
						wd.add((subject, URIRef(predicate), obj))
						print(subject, predicate, obj, label)
						if label:
							wd.add((obj, RDFS.label, Literal(label, datatype="http://www.w3.org/2001/XMLSchema#string")))

		queries.clearGraph(graphToClear)
	wd.add(( URIRef(base+graph_name+'/'), PROV.generatedAtTime, Literal(datetime.datetime.now(),datatype=XSD.dateTime)  ))
	wd.add(( URIRef(base+graph_name+'/'), URIRef('http://dbpedia.org/ontology/currentStatus'), Literal(stage, datatype="http://www.w3.org/2001/XMLSchema#string")  ))

	# GET VALUES FROM FIELDS, MAP THEIR TYPE, TRANSFORM TO RDF
	for res_class in resource_class:
		wd.add(( URIRef(base+graph_name), RDF.type, URIRef(res_class) )) # type of catalogued resource

	# if the user did not specify any disambiguate field
	is_any_disambiguate = ["yes" for field in fields if field['disambiguate'] == 'True']
	if len(is_any_disambiguate) == 0:
		wd.add(( URIRef(base+graph_name+'/'), RDFS.label, Literal("no title") ))

	fields = [input_field for input_field in fields if input_field['hidden'] == 'False']
	for field in fields:
		if field['type'] not in ['KnowledgeExtractor', 'Subtemplate']:
			# URI, Textarea (only text at this stage), Literals
			value = getValuesFromFields(field['id'], recordData, fields=fields) if 'value' in field and field['value'] in ['URI','Place'] \
					else getValuesFromFields(field['id'], recordData, field_type=field['value']) if 'value' in field and field['value'] == 'URL' \
					else getLiteralValuesFromFields(field['id'], recordData) if 'value' in field and field['value'] == 'Literal' else recordData[field['id']]
			# TODO disambiguate as URI, value
			print("VALUE:", value)
			if field["disambiguate"] == 'True': # use the key 'disambiguate' as title of the graph
				main_lang = value['mainLang']
				main_value = [label for label in value['results'] if label[1] == main_lang]
				main_value = list(value['results']) if len(main_value) == 0 else main_value
				main_label = main_value[0][0]
				wd.add(( URIRef(base+graph_name+'/'), URIRef(field['property']), Literal(main_label, lang=main_lang) ))
				wd.add(( URIRef(base+graph_name), RDFS.label, Literal(main_label, lang=main_lang) ))
				wd.add(( URIRef(base+graph_name+'/'), RDFS.label, Literal(main_label, lang=main_lang) ))

			# the main entity has the same URI of the graph but the final /

			if isinstance(value,str) and len(value) >= 1: # data properties
				value = value.replace('\n','').replace('\r','')
				if 'calendar' in field:
					if field['calendar'] == 'Day':
						wd.add((URIRef(base+graph_name), URIRef(field['property']), Literal(value, datatype=XSD.date)))
					elif field['calendar'] == 'Month':
						wd.add((URIRef(base+graph_name), URIRef(field['property']), Literal(value, datatype=XSD.gYearMonth)))
					elif field['calendar'] == 'Year':
						value = value.replace(" A.C.", "") if "A.C." in value else "-"+value.replace(" B.C.", "") if "B.C." in value else value
						value = value if value.startswith("-") else "0000" + value.zfill(4)
						wd.add((URIRef(base+graph_name), URIRef(field['property']), Literal(value, datatype=XSD.gYear)))
				elif field['type'] == 'Multimedia':
					value = "http://"+value if not value.startswith("http") else value
					wd.add(( URIRef(base+graph_name), URIRef(field['property']), URIRef(value)))
				else:
					wd.add(( URIRef(base+graph_name), URIRef(field['property']), Literal(value) ))
			# multiple-values fields
			elif isinstance(value,dict):
				if value['type'] == 'URL': #url
					for URL in value['results']:
						if URL[1] != "":
							valueURL = URL[1] if URL[1].startswith("http") else "http://" + URL[1]
							wd.add(( URIRef(base+graph_name), URIRef(field['property']), URIRef(valueURL) ))
				elif value['type'] == 'URI': #object properties
					rdf_property = SKOS.prefLabel if field['type'] == 'Skos' else RDFS.label
					for entity in value['results']:
						entityURI = getRightURIbase(entity[0]) # Wikidata or new entity 
						wd.add(( URIRef(base+graph_name), URIRef(field['property']), URIRef(entityURI) ))
						wd.add(( URIRef( entityURI ), rdf_property, Literal(entity[1].lstrip().rstrip(), datatype="http://www.w3.org/2001/XMLSchema#string") ))
				elif value['type'] == 'Literal': #multi-language Literals
					for literal in value['results']:
						val, lang = literal
						val = val.replace('\n','').replace('\r','')
						wd.add(( URIRef(base+graph_name), URIRef(field['property']), Literal(val, lang=lang)))
			# now get also the entities associated to textareas (record creation)
			if field['type'] == 'Textarea':
				nlp_keywords = getValuesFromFields(field['id'], recordData, field_type='Textarea')
				for entity in nlp_keywords['results']:
					entityURI = getRightURIbase(entity[0])
					wd.add(( URIRef(base+graph_name), SCHEMA.keywords, URIRef(entityURI) ))
					wd.add(( URIRef( entityURI ), RDFS.label, Literal(entity[1].lstrip().rstrip(), datatype="http://www.w3.org/2001/XMLSchema#string") ))
		# KNOWLEDGE EXTRACTION
		elif field['type']=="KnowledgeExtractor" and "extractions-dict" in recordData:
			# process extraction parameters
			extractions_dict = json.loads(urllib.parse.unquote(recordData["extractions-dict"]))
			extractions_array_unfiltered = extractions_dict[recordID] if recordID in extractions_dict else []
			extractions_array_by_property = extractions_array_unfiltered[field['id']] if field['id'] in extractions_array_unfiltered else {}
			extractions_array = [extraction for extraction in extractions_array_by_property if 'metadata' in extraction and 'type' in extraction['metadata']]

			for extraction in extractions_array:
				extraction_num = str(extraction['internalId'])
				extraction_type = extraction['metadata']['type']
				extraction_url = extraction['metadata']['url']
				extraction_access_keys = False
				if extraction_type == 'api':
					if 'query' in extraction['metadata']:
						encoded_query = ''
						add_symbol = '?'
						for parameter_key,parameter_value in extraction['metadata']['query'].items():
							encoded_query += add_symbol + parameter_key + '=' + parameter_value
							add_symbol = '&'
						extraction_url+=encoded_query
					if 'results' in extraction['metadata']:
						extraction_access_keys = extraction['metadata']['results']
				elif extraction_type == 'sparql':
					query = extraction['metadata']['query'].replace("'","\"")
					encoded_query = urllib.parse.quote(query)
					extraction_url+="?query="+encoded_query
				elif extraction_type == 'file':
					query = extraction['metadata']['query']
					query = query.replace("{", "{{ SERVICE <x-sparql-anything:"+extraction_url+"> {{").replace("}", "}}") if "<x-sparql-anything:" not in query else query
					query = query.replace("'","\"")
					encoded_query = urllib.parse.quote(query)
					extraction_url = conf.sparqlAnythingEndpoint+"?query="+encoded_query

				
				# process extracted keywords
				extracted_keywords = [item for item in recordData if item.startswith("keyword_"+recordID+"_"+field['id']+"-"+extraction_num)]
				print(field["id"], extracted_keywords)
				if len(extracted_keywords) > 0:
					# link the extraction graph to main Record graph
					extraction_graph_name = graph_name + "/extraction-" +field["id"]+"-"+ extraction_num
					wd.add(( URIRef(base+graph_name+'/'), URIRef(field['property']), URIRef(base+extraction_graph_name+'/') ))

					# store the extraction metadata
					queries.clearGraph(base+extraction_graph_name+'/')
					wd_extraction = rdflib.Graph(identifier=URIRef(base+extraction_graph_name+'/'))
					wd_extraction.add(( URIRef(base+extraction_graph_name+'/'), PROV.wasAttributedTo, URIRef(base+userID) ))
					wd_extraction.add(( URIRef(base+extraction_graph_name+'/'), PROV.generatedAtTime, Literal(datetime.datetime.now(),datatype=XSD.dateTime)  ))
					wd_extraction.add(( URIRef(base+extraction_graph_name+'/'), PROV.wasGeneratedBy, URIRef(base+extraction_graph_name)))
					wd_extraction.add(( URIRef(base+extraction_graph_name), PROV.used, URIRef(extraction_url)))
					if extraction_access_keys:
						wd_extraction.add(( URIRef(base+extraction_graph_name), RDFS.comment, Literal(extraction_access_keys)))
					
					# store the extraction output
					for keyword in extracted_keywords:
						label = keyword.replace("keyword_"+recordID+"_"+field['id']+"-"+extraction_num+"_","")
						wd_extraction.add(( URIRef(urllib.parse.unquote(recordData[keyword])), RDFS.label,  Literal(label)))
					
					# save the extraction graph
					wd_extraction.serialize(destination='records/'+recordID+"-extraction-"+field["id"]+"-"+extraction_num+'.ttl', format='ttl', encoding='utf-8')
					server.update('load <file:///'+dir_path+'/records/'+recordID+"-extraction-"+field["id"]+"-"+extraction_num+'.ttl> into graph <'+base+extraction_graph_name+'/>')
		# SUBTEMPLATE
		elif field['type']=="Subtemplate" and field['id'] in recordData:
			if type(recordData[field['id']]) != type([]) and field['id']+"-subrecords" in recordData:
				# get the list of subrecords associated to a 'Subtemplate' field
				subrecords = recordData[field['id']+"-subrecords"].split(",") if recordData[field['id']+"-subrecords"] != "" else []
				for subrecord in subrecords:
					if ";" in subrecord:
						subrecord_id, retrieved_label = subrecord.split(";",1)
					else:
						# process a new subrecord, send its data to the triplestore, and link it to the main record
						subrecord_id = subrecord
						allow_data_reuse = fields if 'dataReuse' in field and field['dataReuse']=='allowDataReuse' else False
						processed_subrecord = process_new_subrecord(recordData,userID,stage,subrecord,supertemplate=None,allow_data_reuse=allow_data_reuse)
						subrecord_id, retrieved_label = processed_subrecord
					wd.add(( URIRef(base+graph_name), URIRef(field['property']), URIRef(base+subrecord_id) ))
					wd.add(( URIRef(base+subrecord_id), RDFS.label, Literal(retrieved_label, datatype="http://www.w3.org/2001/XMLSchema#string")))
			elif type(recordData[field['id']]) == type([]):
				for entity in recordData[field['id']]:
					entity_URI, entity_label = entity
					wd.add(( URIRef(base+graph_name), URIRef(field['property']), URIRef(base+entity_URI) ))
					wd.add(( URIRef(base+entity_URI), RDFS.label, Literal(entity_label, datatype="http://www.w3.org/2001/XMLSchema#string")))

	# get keywords (record modify)
	if stage == 'modified' and any([k for k,v in recordData.items() if k.startswith('keywords')]):
		print("#### recordData",recordData)
		value = getValuesFromFields('keywords', recordData, fields)
		print("#### value:",value)
		for entity in value:
			entityURI = getRightURIbase(entity[0])
			wd.add(( URIRef(base+graph_name), SCHEMA.keywords, URIRef(entityURI) ))
			wd.add(( URIRef( entityURI ), RDFS.label, Literal(entity[1].lstrip().rstrip(), datatype="http://www.w3.org/2001/XMLSchema#string") ))

	# DUMP TTL
	wd.serialize(destination='records/'+recordID+'.ttl', format='ttl', encoding='utf-8')

	# UPLOAD TO TRIPLESTORE
	server.update('load <file:///'+dir_path+'/records/'+recordID+'.ttl> into graph <'+base+graph_name+'/>')

	return 'records/'+recordID+'.ttl'
	
def process_new_subrecord(data, userID, stage, subrecord_id, supertemplate=None, allow_data_reuse=False):
	# prepare a new dict to store data of subrecord-x
	new_record_data = {'recordID': subrecord_id,}
	label = 'No Label!'
	
	# retrieve the template path based on selected class
	subrecord_class = data[subrecord_id+'-class']
	with open(TEMPLATE_LIST) as templates:
		templates_list = json.load(templates)
	subtemplate_path = next(t["template"] for t in templates_list if t["type"]==sorted(subrecord_class.split(";  ")))

	# access the template file
	with open(subtemplate_path) as fields:
		subtemplate = json.load(fields)
	subtemplate = sorted(subtemplate, key=lambda x: x['type'] == 'subtemplate')

	# process the input data related to subrecord-x
	for subtemplate_field in subtemplate:
		if subtemplate_field['hidden'] == 'False':
			subfield_id = subtemplate_field['id']
			rdf_property = subtemplate_field['property']

			# Subtemplate
			if subtemplate_field['type'] == 'Subtemplate':
				key = subfield_id+"_"+subrecord_id
				# Process inner-subrecords and retrieve their ids,labels in order to provide a link to them in the upper-level subrecord
				if key+"-subrecords" in data:
					new_record_data[subfield_id] = [[]]
					data_reuse = subtemplate if 'dataReuse' in subtemplate_field and subtemplate_field['dataReuse']=='allowDataReuse' else False
					for inner_subrecord in data[key+"-subrecords"].split(","):
						if ";" in inner_subrecord:
							processed_subrecord = inner_subrecord.split(";",1)
						else:
							processed_subrecord = process_new_subrecord(data,userID,stage,inner_subrecord,subrecord_id,data_reuse)
						new_record_data[subfield_id][0].append(processed_subrecord) # store the id,label pair inside the subrecord dict

			# Date
			elif subtemplate_field['type'] == 'Date':
				key = subtemplate_field['id']+"_"+subrecord_id
				if key in data:
					new_record_data[subtemplate_field['id']] = data[key]
				elif allow_data_reuse:
					upper_level_field_ids = [field['id'] for field in allow_data_reuse if field['property'] == rdf_property and field['type'] == subtemplate_field['type']]
					if len(upper_level_field_id) > 0:
						upper_level_field_id = upper_level_field_ids[0]
						look_for_id = upper_level_field_id+'_'+supertemplate if supertemplate else upper_level_field_id
						new_record_data[subtemplate_field['id']] = data[look_for_id]
						data[key] = data[look_for_id]

			# Knowledge Extraction
			elif subtemplate_field['type'] == 'KnowledgeExtractor' and 'extractions-dict' in data:
				new_record_data['extractions-dict'] = data['extractions-dict']
				for keyword_key,keyword_value in data.items():
					if keyword_key.startswith('keyword_'+subrecord_id):
						new_record_data[keyword_key]=keyword_value

			# Multiple values fields: Literals or URI
			elif 'value' in subtemplate_field and (subtemplate_field['value'] == 'Literal' or subtemplate_field['value'] in ['URI','URL','Place']):
				keys = [input_id for input_id in data.keys() if input_id.startswith(subtemplate_field['id']+"_") and input_id.endswith("_"+subrecord_id)]
				if len(keys) > 0:
					for key in keys:
						shortened_key = key.rsplit("_",1)[0]
						new_record_data[shortened_key] = data[key]

					# Label: disambiguate field
					if subtemplate_field['disambiguate'] == "True":
						main_lang_input_field = subfield_id+'_mainLang_'+subrecord_id 
						main_lang = data[main_lang_input_field] if main_lang_input_field in data else "No main lang"
						label_input_field = subfield_id+"_"+main_lang+"_"+subrecord_id
						label = data[label_input_field] if label_input_field in data else "No label"
				elif allow_data_reuse:
					upper_level_field_ids = [field['id'] for field in allow_data_reuse if field['property'] == rdf_property and field['type'] == subtemplate_field['type']]
					if len(upper_level_field_ids) > 0:
						upper_level_field_id = upper_level_field_ids[0]
						if supertemplate:
							keys = [input_id for input_id in data.keys() if input_id.startswith(upper_level_field_id+"_") and input_id.endswith("_"+supertemplate)]
						else:
							keys = [input_id for input_id in data.keys() if input_id.startswith(upper_level_field_id+"_")]
						for key in keys:
							cut_number = 1 if supertemplate else 0
							shortened_key = key.rsplit("_",cut_number)[0]
							shortened_key = key.split("_")[1]
							shortened_key = subfield_id+'_'+shortened_key
							new_record_data[shortened_key] = data[key]
							data[shortened_key+'_'+subrecord_id] = data[key]


						# Label: disambiguate field
						if subtemplate_field['disambiguate'] == "True":
							main_lang_input_field = subfield_id+'_mainLang_'+subrecord_id
							main_lang = data[main_lang_input_field] if main_lang_input_field in data else "No main lang"
							label_input_field = upper_level_field_id+"_"+main_lang+"_"+ supertemplate if supertemplate else upper_level_field_id+'_'+main_lang
							with open(TEMPLATE_LIST,'r') as tpl_file:
								tpl_list = json.load(tpl_file)
							disambiguation_label = [t['name'] for t in tpl_list if t['template']==subtemplate_path][0]
							label = data[label_input_field] + " - " + disambiguation_label if label_input_field in data else "No label"
							new_label_input_id = subfield_id + '_' + main_lang
							new_record_data[new_label_input_id] = label


	print("#### DATA:\n",new_record_data)
	store_data = storify(new_record_data)
	grapht_to_clear = None if stage == 'not modified' else base+subrecord_id+"/"
	inputToRDF(store_data,userID,stage,graphToClear=grapht_to_clear,tpl_form=subtemplate_path)
	result = [subrecord_id,label]
	return result