# -*- coding: utf-8 -*-
import os
import datetime
import time
import json
import urllib.parse
import web
from web import form, storify
import rdflib
from rdflib import URIRef , XSD, Namespace , Literal
from rdflib.namespace import OWL, DC , DCTERMS, RDF , RDFS
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
TEMPLATE_LIST = conf.template_list

def getValuesFromFields(fieldPrefix, recordData, fields=None, field_type=None):
	""" request form fields by field prefix, check if multiple values are available,
	returns a set of tuples including ID (for the URI) and label of values """
	results = set()
	for key, value in recordData.items():
		if key.startswith(fieldPrefix+'-'): # multiple values from text box (wikidata) + URL 
			values = value.split(',', 1)
			results.add(( values[0].strip(), urllib.parse.unquote(values[1]) )) # (id, label)
		elif key == fieldPrefix and field_type != 'Textarea': # uri from dropdown (single value from controlled vocabulary) + URL
			if fields:
				field = next(field for field in fields if field["id"] == fieldPrefix)
				label = field['values'][value] if value and value != 'None' and 'values' in field else None
				if label:
					results.add(( value, label ))
			elif field_type:
				values = value.split(',')
				for val in values:
					results.add(( val.strip(), val.strip() ))
	return results


def getRightURIbase(value):
	return WD+value if value.startswith('Q') else GEO+value if value.isdecimal() else VIAF+value[4:] if value.startswith("viaf") else ''+value if value.startswith("http") else base+value.lstrip().rstrip()


def inputToRDF(recordData, userID, stage, knowledge_extraction, graphToClear=None,tpl_form=None):
	""" transform input data into RDF, upload data to the triplestore, dump data locally """

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
		if to_be_saved:
			for binding in to_be_saved['results']['bindings']:
				subject = URIRef(binding['subject']['value'])
				for predicate_obj, inner_dict in binding.items():
					if predicate_obj.endswith('_property'):
						predicate = URIRef(inner_dict['value'])
						obj_value = binding[predicate_obj.replace("_property", "")]['value']
						obj_type = binding[predicate_obj.replace("_property", "")]['type']
						obj = URIRef(obj_value) if obj_type == "uri" else Literal(obj_value, datatype="http://www.w3.org/2001/XMLSchema#string")
						label = binding[predicate_obj.replace("_property", "") + "_label"]['value'] if predicate_obj.replace("_property", "") + "_label" in binding else None
						wd.add((subject, URIRef(predicate), obj))
						print(subject, predicate, obj, label)
						if label:
							wd.add((obj, RDFS.label, Literal(label, datatype="http://www.w3.org/2001/XMLSchema#string")))

		queries.clearGraph(graphToClear)
	wd.add(( URIRef(base+graph_name+'/'), PROV.generatedAtTime, Literal(datetime.datetime.now(),datatype=XSD.dateTime)  ))
	wd.add(( URIRef(base+graph_name+'/'), URIRef('http://dbpedia.org/ontology/currentStatus'), Literal(stage, datatype="http://www.w3.org/2001/XMLSchema#string")  ))

	# GET VALUES FROM FIELDS, MAP THEIR TYPE, TRANSFORM TO RDF
	wd.add(( URIRef(base+graph_name), RDF.type, URIRef(resource_class) )) # type of catalogued resource

	# if the user did not specify any disambiguate field
	is_any_disambiguate = ["yes" for field in fields if field['disambiguate'] == 'True']
	if len(is_any_disambiguate) == 0:
		wd.add(( URIRef(base+graph_name+'/'), RDFS.label, Literal("no title") ))

	fields = [input_field for input_field in fields if input_field['hidden'] == 'False']
	for field in fields:
		if field['type'] not in ['KnowledgeExtractor', 'Subtemplate']:
			# URI, Textarea (only text at this stage), Literals
			value = getValuesFromFields(field['id'], recordData, fields) \
					if 'value' in field and field['value'] in ['URI','Place'] else getValuesFromFields(field['id'], recordData, field_type=field['type']) if 'value' in field and field['value'] == 'URL' else recordData[field['id']]
			# TODO disambiguate as URI, value
			if field["disambiguate"] == 'True': # use the key 'disambiguate' as title of the graph
				wd.add(( URIRef(base+graph_name+'/'), URIRef(field['property']), Literal(value) ))
				wd.add(( URIRef(base+graph_name), RDFS.label, Literal(value) ))
				wd.add(( URIRef(base+graph_name+'/'), RDFS.label, Literal(value) ))

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
			elif 'value' in field and field['value'] == 'URL':
				for entity in value:
					if entity[1] != "":
						to_add = entity[1]
						if not to_add.startswith("http"):
							to_add = "http://" + to_add
						wd.add(( URIRef(base+graph_name), URIRef(field['property']), URIRef(to_add) ))
			else: # object properties
				for entity in value:
					entityURI = getRightURIbase(entity[0]) # Wikidata or new entity 
					wd.add(( URIRef(base+graph_name), URIRef(field['property']), URIRef(entityURI) ))
					wd.add(( URIRef( entityURI ), RDFS.label, Literal(entity[1].lstrip().rstrip(), datatype="http://www.w3.org/2001/XMLSchema#string") ))

			# now get also the entities associated to textareas (record creation)
			if field['type'] == 'Textarea':
				value = getValuesFromFields(field['id'], recordData, fields, 'Textarea')
				for entity in value:
					entityURI = getRightURIbase(entity[0])+entity[0]
					wd.add(( URIRef(base+graph_name), SCHEMA.keywords, URIRef(entityURI) ))
					wd.add(( URIRef( entityURI ), RDFS.label, Literal(entity[1].lstrip().rstrip(), datatype="http://www.w3.org/2001/XMLSchema#string") ))
		# KNOWLEDGE EXTRACTION: import graphs
		elif field['type']=="KnowledgeExtractor":
			with open(knowledge_extraction) as extraction_file:
				extraction = json.load(extraction_file)
			imported_graphs = extraction[recordID] if recordID in extraction else []
			# SPARQL import
			for graph in imported_graphs:
				if any(key.startswith("keyword_"+graph['internalID']+"_") for key in recordData):
					extraction_graph_name = graph_name + "/extraction-" + str(graph['internalID'])
					wd.add(( URIRef(base+graph_name+'/'), SCHEMA.keywords, URIRef(base+extraction_graph_name+'/') ))
					wd_extraction = rdflib.Graph(identifier=URIRef(base+extraction_graph_name+'/'))
					wd_extraction.add(( URIRef(base+extraction_graph_name+'/'), PROV.wasAttributedTo, URIRef(base+userID) ))
					wd_extraction.add(( URIRef(base+extraction_graph_name+'/'), PROV.generatedAtTime, Literal(datetime.datetime.now(),datatype=XSD.dateTime)  ))
					for label in recordData:
						start = "keyword_"+graph['internalID']+"_"
						if label.startswith(start):
							wd_extraction.add(( URIRef(urllib.parse.unquote(recordData[label])), RDFS.label,  Literal(label.replace(start, ""))))
					wd_extraction.serialize(destination='records/'+recordID+"-extraction-"+str(graph['internalID'])+'.ttl', format='ttl', encoding='utf-8')
					server.update('load <file:///'+dir_path+'/records/'+recordID+"-extraction-"+str(graph['internalID'])+'.ttl> into graph <'+base+extraction_graph_name+'/>')
		# SUBTEMPLATE
		elif field['type']=="Subtemplate":
			print(recordData[field['id']])
			if type(recordData[field['id']]) != type([]) and field['id']+"-subrecords" in recordData:
				subrecords = recordData[field['id']+"-subrecords"].split(",") if recordData[field['id']+"-subrecords"] != "" else []
				for subrecord in subrecords:
					if ";" in subrecord:
						subrecord_id, retrieved_label = subrecord.split(";",1)
					else:
						subrecord_id = subrecord
						subrecord_template = field['import_subtemplate']
						label_id = find_label(subrecord_template)
						retrieved_label = [recordData[label] for label in recordData[subrecord].split(",") if label == label_id+"__"+subrecord][0] if label_id else field['label']+"-"+subrecord
						process_new_subrecord(recordData,userID,stage,knowledge_extraction,subrecord_template,subrecord)
					wd.add(( URIRef(base+graph_name), URIRef(field['property']), URIRef(base+subrecord_id) ))
					wd.add(( URIRef(base+subrecord_id), RDFS.label, Literal(retrieved_label, datatype="http://www.w3.org/2001/XMLSchema#string")))
			else:
				for entity in recordData[field['id']]:
					entity_URI, entity_label = entity.split(",",1)
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
	
def process_new_subrecord(data, userID, stage, knowledge_extraction, sub_tpl, subrecord_id):
	subrecord_fields = data[subrecord_id].split(",")
	# prepare a new dict to store data of subrecord-x
	new_record_data = {'recordID': subrecord_id,}
	with open(sub_tpl) as fields:
		subtemplate = json.load(fields)
	# process the input data related to subrecord-x
	for subrecord_field in subrecord_fields:
		subrecord_field__base_id = subrecord_field.split("__")[0]

		# check inner subrecords (subrecord-y associated with subrecord-x's 'Subtemplate' field
		if subrecord_field+"-subrecords" in data:
			new_record_data[subrecord_field__base_id] = [[]]
			inner_subtemplate = [key['import_subtemplate'] for key in subtemplate if key['id'] == subrecord_field__base_id][0]
			for inner_subrecord in data[subrecord_field + "-subrecords"].split(","):
				if ";" in inner_subrecord:
					processed_subrecord = inner_subrecord.replace(';', ",", 1)
				else:
					processed_subrecord = process_new_subrecord(data,userID,stage,knowledge_extraction,inner_subtemplate,inner_subrecord)
				new_record_data[subrecord_field__base_id][0].append(processed_subrecord)
		# check single value fields (e.g. Date/Literal)
		elif data[subrecord_field] != "":
			key = subrecord_field.split("__")[0]
			new_record_data[key] = data[subrecord_field]
		# check multiple values fields (e.g. Entities, SKOS Vocabs)
		else:
			multiple_values = [key for key in data if key.startswith(subrecord_field+"-")]
			if multiple_values != []:
				for value in multiple_values:
					new_key = value.split("__")[0] + "-" + value.split("-")[-1]
					new_record_data[new_key] = data[value]
			else:
				new_record_data[subrecord_field.split("__")[0]] = ""

	label = new_record_data[find_label(sub_tpl)]
	print("\nDATA:\n",new_record_data)
	store_data = storify(new_record_data)
	grapht_to_clear = None if stage == 'not modified' else base+subrecord_id+"/"
	inputToRDF(store_data,userID,stage,knowledge_extraction,graphToClear=grapht_to_clear,tpl_form=sub_tpl)
	result = subrecord_id+","+label
	return result

def find_label(tpl):
	# Retrieve the field associated with the Primary Key (i.e., the label) of the Record
	with open(tpl) as tpl_file:
		tpl_fields = json.load(tpl_file)
	fields_id = [field['id'] for field in tpl_fields if field['disambiguate'] == "True"]
	label_field_id = fields_id[0] if fields_id != [] else False
	
	# TODO: add a mechanism to handle potential Templates without a Primary Key in case it's needed
	return label_field_id