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


def inputToRDF(recordData, userID, stage, knowledge_extraction, graphToClear=None,tpl_form=None, subrecords_dict=None):
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

		# retrieve hidden triples (to be saved) and re-introduce them in the named graph
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
			# check potential duplications:
			#doubled_values = check_double_subrecords(recordData) if not doubled_values else doubled_values

			# handle imported entities from catalogue (not newly created ones)
			imported_entities = [field_id for field_id in recordData if field_id.startswith(field['id']+"-") and "," in recordData[field_id]]
			for imported_entity in imported_entities:
				imported_entity_id, imported_entity_label = recordData[imported_entity].split(',')
				imported_entity_label = urllib.parse.unquote(imported_entity_label)
				entityURI = getRightURIbase(imported_entity_id) 
				print(entityURI)
				wd.add(( URIRef(base+graph_name), URIRef(field['property']), URIRef(entityURI) ))
				wd.add(( URIRef( entityURI ), RDFS.label, Literal(imported_entity_label.lstrip().rstrip(), datatype="http://www.w3.org/2001/XMLSchema#string") ))
			subrecords = process_subrecords(recordData, field['id']) if not subrecords_dict else subrecords_dict
			print("#### surbrecords:", subrecords)
			if field['id'] in subrecords:
				for subrecord_idx, subrecord in subrecords[field['id']].items():
					ct = datetime.datetime.now()
					ts = ct.timestamp()
					ID = str(ts).replace('.', '-')
					subrecord['recordID'] = ID
					label = find_label(field['import_subtemplate'], subrecord, field['label'])
					inputToRDF(storify(subrecord),userID,stage,knowledge_extraction,tpl_form=field['import_subtemplate'],subrecords_dict=subrecord)
					wd.add(( URIRef(base+graph_name), URIRef(field['property']), URIRef(base+ID) ))
					wd.add(( URIRef(base+ID), RDFS.label, Literal(label, datatype="http://www.w3.org/2001/XMLSchema#string")))


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

def check_double_subrecords(data):
	results_dict = {
		'targets': {},
		'pointers' : {},
	}
	for key, value in data.items():
		if value.startswith("target-"):
			split_key = key.split("__")
			new_key = split_key[0] + "__" + split_key[-1]
			split_value = value.replace("target-", "").split("__")
			new_value = split_value[0] + "__" + split_value[-1]
			results_dict['targets'][new_value] = new_key
			results_dict['pointers'][new_key] = new_value
	return results_dict




# convert the dict of inputs into a series of nested dictionaries to be parsed as single records
def process_subrecords(data, id, created_subrecords=None):
    results = {}
    subrecords = [key for key in data if key.startswith(id+"__") and not data[key].startswith("target-")] if created_subrecords == None else created_subrecords

    for subrecord in subrecords:
        subrecord_split = subrecord.split('__')
        prefix, num = subrecord_split[0], subrecord_split[-1]
        if prefix not in results:
            results[prefix] = { num: {} }  
        else:
            results[prefix][num] = {}
        add_results = {}
        subrecord_fields = data[subrecord].split(',')
        for key in subrecord_fields:
            if data[key].startswith("target-"):
                add_results[key.replace("target-", "").split('__')[0]] = {key.split('__')[-1] : process_subrecords(data, data[key].replace("target-", "")) }
            elif data[key] != "":
                add_results[key.split('__')[0]] = data[key]
            else:
                multiple_values_fields = [import_key for import_key in data.keys() if import_key.startswith(key + "-")]
                for imported_value in multiple_values_fields:
                    new_key = imported_value.split('__')[0] + "-" + imported_value.split('-')[-1]
                    add_results[new_key] = data[imported_value]
                inner_subrecords = [item for item in data.keys() if item.startswith(key + "__") and not data[item].startswith("target-") ]
                if inner_subrecords:
                    add_results[key.split('__')[0]] = process_subrecords(data, key, inner_subrecords)[key.split('__')[0]]
                
            results[prefix][num] = add_results

    if not subrecords and data[id] != "":
        for el in data[id].split(','):
            imported_resources = [field_id for field_id in data if field_id.startswith(el+"-")]
            for imported_res in imported_resources:
                results[imported_res.split('__')[0]+"-"+imported_res.split("-")[-1]] = data[imported_res]
            results[el.split('__')[0]] = data[el]

    return results


def find_label(tpl, subrecord, alternative_label):
	print(tpl)
	# Retrieve the field associated with the Primary Key (i.e., the label) of the Record
	with open(tpl) as tpl_file:
		tpl_fields = json.load(tpl_file)
	label_field_id = [field['id'] for field in tpl_fields if field['disambiguate'] == "True"][0]

	# Add a mechanism to handle potential Templates without a Primary Key (e.g. the primary key has been set to "hidden")
	label = subrecord[label_field_id] if label_field_id in subrecord else alternative_label+"-"+subrecord['recordID']
	return label