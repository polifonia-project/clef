# -*- coding: utf-8 -*-
import conf , os , operator , pprint , ssl , rdflib , json
from SPARQLWrapper import SPARQLWrapper, JSON, RDFXML,POST
from collections import defaultdict
from rdflib import URIRef , XSD, Namespace , Literal, Graph
from rdflib.namespace import OWL, DC , DCTERMS, RDF , RDFS
from rdflib.plugins.sparql import prepareQuery
from pymantic import sparql
import json
import utils as u
import urllib.parse
import re
import requests
import time
import mapping

u.reload_config()

ssl._create_default_https_context = ssl._create_unverified_context
server = sparql.SPARQLServer(conf.myEndpoint)
dir_path = os.path.dirname(os.path.realpath(__file__))

def hello_blazegraph(q):
	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(q)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()
	return results


# LIST OF RECORDS IN THE BACKEND


def getRecords(res_class=None,res_subclasses=None):
	""" get all the records created by users to list them in the backend welcome page """
	extended_class_list = res_subclasses + res_class if res_subclasses != None and res_class != None else res_class if res_class != None else None
	filter_class_exists = "\n".join([f"FILTER EXISTS {{ ?s a <{cls}> }}" for cls in res_class]) if res_class != None else ""
	filter_class_not_exists = f"FILTER (NOT EXISTS {{ ?s a ?other_class FILTER (?other_class NOT IN ({', '.join([f'<{cls}>' for cls in extended_class_list])})) }})" if extended_class_list != None else ""

	queryRecords = """
		PREFIX prov: <http://www.w3.org/ns/prov#>
		PREFIX base: <"""+conf.base+""">
		SELECT DISTINCT ?g ?title ?userLabel ?modifierLabel ?date ?stage (GROUP_CONCAT(DISTINCT ?class; SEPARATOR=";  ") AS ?classes)
		WHERE
		{ GRAPH ?g {
			?s ?p ?o . ?s a ?class .
			""" +filter_class_exists+filter_class_not_exists+ """
			OPTIONAL { ?g rdfs:label ?title; prov:wasAttributedTo ?user; prov:generatedAtTime ?date ; <http://dbpedia.org/ontology/currentStatus> ?stage. ?user rdfs:label ?userLabel .
			OPTIONAL {?g prov:wasInfluencedBy ?modifier. ?modifier rdfs:label ?modifierLabel .} }
			OPTIONAL {?g rdfs:label ?title; prov:generatedAtTime ?date ; <http://dbpedia.org/ontology/currentStatus> ?stage . }

			BIND(COALESCE(?date, '-') AS ?date ).
			BIND(COALESCE(?stage, '-') AS ?stage ).
			BIND(COALESCE(?userLabel, '-') AS ?userLabel ).
			BIND(COALESCE(?modifierLabel, '-') AS ?modifierLabel ).
			BIND(COALESCE(?title, 'none', '-') AS ?title ).
			filter not exists {
			  ?g prov:generatedAtTime ?date2
			  filter (?date2 > ?date)
			}

		  }
		  FILTER( str(?g) != '"""+conf.base+"""vocabularies/' )
		}
		GROUP BY ?g ?title ?userLabel ?modifierLabel ?date ?stage
		"""

	records = set()
	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(queryRecords)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()

	for result in results["results"]["bindings"]:
		classes = [cls.strip() for cls in result["classes"]["value"].split("; ")]
		subclasses = [single_class for single_class in classes if single_class not in res_class]
		for subclass in subclasses:
			classes.remove(subclass)
		subclasses = "; ".join(subclasses) if len(subclasses) > 0 else ""
		classes = "; ".join(classes)
		records.add( (result["g"]["value"], result["title"]["value"], result["userLabel"]["value"], result["modifierLabel"]["value"], result["date"]["value"], result["stage"]["value"], classes, subclasses))	
	return records


def getRecordsPagination(page, filterRecords='',userURI=None):
	""" get all the records created by users to list them in the backend welcome page """
	filter_by_user = f"?g prov:wasAttributedTo <{userURI}> ." if userURI else "" 
	newpage = int(page)-1
	offset = str(0) if int(page) == 1 \
		else str(( int(conf.pagination) *newpage))
	queryRecordsPagination = """
		PREFIX prov: <http://www.w3.org/ns/prov#>
		PREFIX base: <"""+conf.base+""">
		SELECT DISTINCT ?g ?title ?userLabel ?modifierLabel ?date ?stage (GROUP_CONCAT(DISTINCT ?class; SEPARATOR=";  ") AS ?classes)
		WHERE
		{ GRAPH ?g {
			"""	+ filter_by_user + """
			?s ?p ?o ; a ?class .
			OPTIONAL { ?g rdfs:label ?title; prov:wasAttributedTo ?user; prov:generatedAtTime ?date ; <http://dbpedia.org/ontology/currentStatus> ?stage. ?user rdfs:label ?userLabel .
				OPTIONAL {?g prov:wasInfluencedBy ?modifier. ?modifier rdfs:label ?modifierLabel .} }
			OPTIONAL {?g rdfs:label ?title; prov:generatedAtTime ?date ; <http://dbpedia.org/ontology/currentStatus> ?stage . }

			BIND(COALESCE(?date, '-') AS ?date ).
			BIND(COALESCE(?stage, '-') AS ?stage ).
			BIND(COALESCE(?userLabel, '-') AS ?userLabel ).
			BIND(COALESCE(?modifierLabel, '-') AS ?modifierLabel ).
			BIND(COALESCE(?title, 'none', '-') AS ?title ).
			filter not exists {
			  ?g prov:generatedAtTime ?date2
			  filter (?date2 > ?date)
			}

		  }
		  """+filterRecords+"""
		  FILTER( str(?g) != '"""+conf.base+"""vocabularies/' )

		}
		GROUP BY ?g ?title ?userLabel ?modifierLabel ?date ?stage
		ORDER BY DESC(?date)
		LIMIT """+conf.pagination+"""
		OFFSET  """+offset+"""
		"""

	records = list()
	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(queryRecordsPagination)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()
	for result in results["results"]["bindings"]:
		records.append( (result["g"]["value"], result["title"]["value"], result["userLabel"]["value"], result["modifierLabel"]["value"], result["date"]["value"], result["stage"]["value"] , result["classes"]["value"].split(";  ") ))

	return records


def getCountings(filterRecords='',userURI=None):
	filter_by_user = f"?g prov:wasAttributedTo <{userURI}> ." if userURI else "" 
	countRecords = """
		PREFIX prov: <http://www.w3.org/ns/prov#>
		PREFIX base: <"""+conf.base+""">
		SELECT (COUNT(DISTINCT ?g) AS ?count) ?stage
		WHERE
		{ GRAPH ?g { """+filter_by_user+"""  
				?s ?p ?o .
			}
			?g <http://dbpedia.org/ontology/currentStatus> ?stage .
			"""+filterRecords+"""
			FILTER( str(?g) != '"""+conf.base+"""vocabularies/' ) .

		}
		GROUP BY ?stage
		"""
	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(countRecords)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()
	all, notreviewed, underreview, published = 0,0,0,0
	for result in results["results"]["bindings"]:
		notreviewed = int(result["count"]["value"]) if result["stage"]["value"] == "not modified" else notreviewed
		underreview = int(result["count"]["value"]) if result["stage"]["value"] == "modified" else underreview
		published = int(result["count"]["value"]) if result["stage"]["value"] == "published" else published
		all = notreviewed + underreview + published
	return all, notreviewed, underreview, published


def countAll(res_class=None,res_subclasses=None,by_subclass=False,exclude_unpublished=False,userURI=None):
	include_class_list = by_subclass + res_class if res_subclasses != None and res_class != None and by_subclass else res_class
	exclude_class_list = res_subclasses + res_class if res_subclasses != None and res_class != None else res_class if res_class != None else None
	filter_class_exists = "\n".join([f"FILTER EXISTS {{ ?s a <{cls}> }}" for cls in include_class_list]) if include_class_list != None else ""
	filter_class_not_exists = f"FILTER (NOT EXISTS {{ ?s a ?other_class FILTER (?other_class NOT IN ({', '.join([f'<{cls}>' for cls in exclude_class_list])})) }})" if exclude_class_list != None else ""
	filter_by_user = f"?g prov:wasAttributedTo <{userURI}> ." if userURI else "" 

	exclude = "" if exclude_unpublished is False \
		else "?g <http://dbpedia.org/ontology/currentStatus> ?anyValue . FILTER (isLiteral(?anyValue) && lcase(str(?anyValue))= 'published') ."
	countall = """
		PREFIX prov: <http://www.w3.org/ns/prov#>
		PREFIX base: <"""+conf.base+""">
		SELECT (COUNT(DISTINCT ?g) AS ?count)
		WHERE
		{ GRAPH ?g { """+filter_by_user+""" 
			?s ?p ?o .
			"""+filter_class_exists+filter_class_not_exists+"""
		}
		"""+exclude+"""
			FILTER( str(?g) != '"""+conf.base+"""vocabularies/' && !CONTAINS(STR(?g), "/extraction-")) .
		}
		"""
	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(countall)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()
	alll = results["results"]["bindings"][0]['count']['value']
	return alll

def can_user_edit_graph(graph_id, user_id):
	"""Return True if the given user can still edit the graph.  
	A graph remains editable only as long as no other authors have modified it.  

	Parameters
	----------
	graph_id: str
		the unique identifier of the graph
	user_id: str
		the identifier of the user requesting edit access
	"""
	query = """
		PREFIX prov: <http://www.w3.org/ns/prov#>
		SELECT ?modifier WHERE {
			GRAPH <"""+graph_id+"""> {
				<"""+graph_id+"""> prov:wasInfluencedBy ?modifier .
			}
		}
	"""
	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(query)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()
	if results["results"]["bindings"]:
		modifier = results["results"]["bindings"][0]["modifier"]["value"]
		modifier_id = modifier.replace(conf.base,"").replace('-at-','@').replace('-dot-','.')
		if modifier_id == user_id:
			return True
		else:
			return False
	else:
		return True


# ATLAS - "Other" values
def countAllOtherValues(res_class=None,res_subclasses=None):
	include_class_list = res_class
	exclude_class_list = res_subclasses + res_class
	filter_class_exists = "\n".join([f"FILTER EXISTS {{ ?s a <{cls}> }}" for cls in include_class_list])
	filter_class_not_exists = f"FILTER (NOT EXISTS {{ ?s a ?other_class FILTER (?other_class NOT IN ({', '.join([f'<{cls}>' for cls in exclude_class_list])})) }})"

	countall = """
		PREFIX prov: <http://www.w3.org/ns/prov#>
		PREFIX base: <"""+conf.base+""">
		PREFIX dcterms: <http://purl.org/dc/terms/>
		PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
		SELECT (COUNT(DISTINCT ?g) AS ?count) ?s ?uri ?label
		WHERE
		{ GRAPH ?g { ?s ?p ?o .
			"""+filter_class_exists+"""
				?s dcterms:type ?uri .
  				?uri skos:prefLabel ?label .
			"""+filter_class_not_exists+"""
		}
			FILTER( str(?g) != '"""+conf.base+"""vocabularies/' && !CONTAINS(STR(?g), "/extraction-")) .
		}
		GROUP BY ?s ?uri ?label
	"""
	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(countall)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()
	alll = {}
	records_value = {}
	for val in results["results"]["bindings"]:
		subj = val['s']['value']
		uri = val['uri']['value']
		if uri not in alll:
			alll[uri] = {
				"label": val['label']['value'],
				"count": val['count']['value']
			}
		records_value[subj+"/"] = uri
	return alll, records_value

def getRecordCreator(graph_name):
	""" get the label of the creator of a record """
	creatorIRI, creatorLabel = None, None
	queryRecordCreator = """
		PREFIX prov: <http://www.w3.org/ns/prov#>
		SELECT DISTINCT ?creatorIRI ?creatorLabel
		WHERE { <"""+graph_name+"""> prov:wasAttributedTo ?creatorIRI .
		?creatorIRI rdfs:label ?creatorLabel . }"""

	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(queryRecordCreator)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()
	for result in results["results"]["bindings"]:
		creatorIRI, creatorLabel = result["creatorIRI"]["value"],result["creatorLabel"]["value"]
	return creatorIRI, creatorLabel


# UPDATE SUBCLASS VALUES TO AVOID INCONSISTENCIES
def updateSubclassValue(data):

	old_uri = urllib.parse.unquote(data.olduri)
	insert_clause = ""
	if "update" in data and data["update"] == "modify":
		new_label = urllib.parse.unquote(data.newlabel)
		new_uri = urllib.parse.unquote(data.newuri)
		insert_clause = """INSERT { 
				GRAPH ?g {
					?s ?p <"""+new_uri+"""> .
					<"""+new_uri+"""> rdfs:label '"""+new_label+"""'^^xsd:string . 
				}
			}"""

	update_query = """PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
		PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

		DELETE {
			GRAPH ?g {
				?s ?p <"""+old_uri+"""> .
				<"""+old_uri+"""> rdfs:label ?oldLabel .
			}
		}
		"""+insert_clause+"""
		WHERE {
			GRAPH ?g {
				?s ?p <"""+old_uri+"""> .
				<"""+old_uri+"""> rdfs:label ?oldLabel .
			}
		}
		"""
	
	try:
		sparql = SPARQLWrapper(conf.myEndpoint)
		sparql.setQuery(update_query)
		sparql.setMethod("POST")
		sparql.query()
	except Exception as e:
		print(f"Error executing update: {e}")
	return None



# REBUILD GRAPH TO MODIFY/REVIEW RECORD
def getClass(res_uri):
	""" get the class of a resource given the URI"""

	q = """ SELECT DISTINCT (GROUP_CONCAT(DISTINCT ?class; SEPARATOR=";  ") AS ?classes)  WHERE {<"""+res_uri+"""> a ?class}"""
	res_class = []
	results = hello_blazegraph(q)
	for result in results["results"]["bindings"]:
		res_class.append(result["classes"]["value"].split(";  "))
	return res_class[0] if len(res_class) > 0 else ""

def getData(graph,res_template,res_subclasses=[]):
	""" get a named graph and rebuild results for modifying the record"""

	def compare_sublists(l, lol):
		for sublist in lol:
			temp = [i for i in sublist if i in l]
			if sorted(temp) == sorted(l):
				return True
		return False

	def disambiguate_pattern(properties,fields,k):
		field_k = next(field for field in fields if field['id'] == k)
		pattern = ''
		# disambiguate Textbox > URI and Textbox > Place:
		if field_k['type'] == 'Textbox':
			if field_k['value'] == 'URI':
				if any(field for field in properties if field['type'] == 'Textbox' and field['value'] == 'Place'):
					pattern = 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. ?'+field['id']+' rdfs:label ?'+field['id']+'_label . FILTER(!REGEX(str(?'+field['id']+'),"sws.geonames.org/"))} .'
			elif field_k['value'] == 'Place':
				if any(field for field in properties if field['type'] == 'Textbox' and field['value'] == 'URI'):
					pattern = 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. ?'+field['id']+' rdfs:label ?'+field['id']+'_label . FILTER(REGEX(str(?'+field['id']+'),"sws.geonames.org/"))} .'
		if field_k['value'] == 'URL':
			if field_k['type'] == 'Textbox':
				if any(field for field in properties if field['type'] == 'Multimedia'):
					pattern = 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. FILTER (isURI(?'+field['id']+')) FILTER NOT EXISTS {?'+field['id']+' rdfs:label ?'+field['id']+'_label } FILTER NOT EXISTS { ?'+field['id']+' skos:prefLabel ?'+field['id']+'_label } FILTER(!REGEX(str(?'+field['id']+'), "\\\\.(apng|avif|gif|ico|jpg|jpeg|jfif|pjpeg|pjp|png|svg|webp|mp3|wav|ogg|mp4|ogg|webm)$", "i"))} .'
			elif field_k['type'] == 'Multimedia':
				if any(field for field in properties if field['type'] == 'Textbox' and field['value'] == 'URL'):
					pattern = 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. FILTER (isURI(?'+field['id']+')) FILTER NOT EXISTS {?'+field['id']+' rdfs:label ?'+field['id']+'_label } FILTER NOT EXISTS { ?'+field['id']+' skos:prefLabel ?'+field['id']+'_label } FILTER(REGEX(str(?'+field['id']+'), "\\\\.(apng|avif|gif|ico|jpg|jpeg|jfif|pjpeg|pjp|png|svg|webp|mp3|wav|ogg|mp4|ogg|webm)$", "i"))} .'
		return pattern

	with open(res_template) as config_form:
		fields = json.load(config_form)

	properties_dict = {}
	patterns = []
	keyword_patterns = [] # looking for textareas' keywords
	res_class = getClass(graph[:-1])
	class_patterns = ".".join(['''?subject a <'''+single_class+'''>''' for single_class in res_class])
	check_values = [] # do not remove conf.base to Checkbox, Dropdown and Subclass values

	# check duplicate properties
	for field in fields:
		if field['type'] != 'KnowledgeExtractor':
			if field['property'] in properties_dict:
				properties_dict[field['property']].append(field)
			else:
				properties_dict[field['property']] = [field]

	# add query pattern
	for field in fields:
		if field['type'] != 'KnowledgeExtractor':
			if field['restricted'] == [] or field['restricted'] == ['other'] or any(restriction in field['restricted'] for restriction in res_subclasses) :
				if field['type'] in ['Subclass', 'Dropdown', 'Checkbox']:
					check_values.append(field['id'])
				pattern = ""
				if len(properties_dict[field['property']]) > 1:
					pattern = disambiguate_pattern(properties_dict[field['property']],fields,field['id'])
				if pattern == "":
					pattern = 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. FILTER (lang(?'+field['id']+')!="") }' if field['value'] == 'Literal' \
						else 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. FILTER (isURI(?'+field['id']+')) FILTER NOT EXISTS {?'+field['id']+' rdfs:label ?'+field['id']+'_label } FILTER NOT EXISTS { ?'+field['id']+' skos:prefLabel ?'+field['id']+'_label } } ' if field['value'] == 'URL' \
						else 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. FILTER (datatype(?'+field['id']+') = xsd:'+field['value'][0].lower() + field['value'][1:]+') } ' if field['value'] in ['Date', 'gYear', 'gYearMonth'] \
						else 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. ?'+field['id']+' skos:prefLabel ?'+field['id']+'_label .} .' if 'type' in field and field['type'] == 'Skos' \
						else 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. ?'+field['id']+' rdfs:label ?'+field['id']+'_label } .'
				patterns.append(pattern)

				if field['type'] == 'Textarea':
					keyword_pattern = 'OPTIONAL {<'+graph+'> schema:keywords <'+graph+'extraction-'+field['id']+'/> . GRAPH <'+graph+'extraction-'+field['id']+'/> { ?keywords_'+field['id']+' rdfs:label ?keywords_'+field['id']+'_label . OPTIONAL {?keywords_'+field['id']+' a ?keywords_'+field['id']+'_class } } }'
					keyword_patterns.append(keyword_pattern)

	patterns_string = ''.join(patterns)
	keyword_patterns_string = ''.join(keyword_patterns)

	queryNGraph = '''
		PREFIX base: <'''+conf.base+'''>
		PREFIX schema: <https://schema.org/>
		PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
		SELECT DISTINCT *
		WHERE { <'''+graph+'''> rdfs:label ?graph_title ;
								<http://dbpedia.org/ontology/currentStatus> ?stage
				GRAPH <'''+graph+'''>
				{	'''+class_patterns+'''.
					'''+patterns_string+'''
				}
		}
		'''
	
	keywords_query = '''
		PREFIX base: <'''+conf.base+'''>
		PREFIX schema: <https://schema.org/>
		PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
		SELECT DISTINCT *
		WHERE { <'''+graph+'''> rdfs:label ?graph_title ;
								<http://dbpedia.org/ontology/currentStatus> ?stage .
				'''+keyword_patterns_string+'''
		}
	'''

	sparql = SPARQLWrapper(conf.myEndpoint)

	# first query
	print(queryNGraph)
	sparql.setQuery(queryNGraph)
	sparql.setReturnFormat(JSON)
	sparql.setMethod(POST)
	results = sparql.query().convert()
	results_bindings = results.get("results", {}).get("bindings", [])

	# second query 
	print(keywords_query)
	sparql.setQuery(keywords_query)
	sparql.setReturnFormat(JSON)
	sparql.setMethod(POST)
	keywords = sparql.query().convert()
	keywords_bindings = keywords.get("results", {}).get("bindings", [])

	data = defaultdict(list)
	for result in results_bindings + keywords_bindings:
		result.pop('subject',None)
		graph_label = result.pop('graph_title',None)
		for k,v in result.items():
			if '_label' not in k and v['type'] == 'literal': # string values
				value = v['value']
				if 'xml:lang' in v:
					value = (v['value'],v['xml:lang'],'mainLang') if v['value']==graph_label['value'] and v['xml:lang']==graph_label['xml:lang'] else (v['value'],v['xml:lang'])
				
				if value not in data[k]:
					data[k].append(value)
			elif v['type'] == 'uri': # uri values

				if k+'_label' in result:
					if (conf.base in v['value'] and k not in check_values) or 'wikidata' in v['value'] or 'geonames' in v['value']:
						uri = v['value'].rsplit('/', 1)[-1]
					elif 'viaf' in v['value']:
						uri = "viaf"+v['value'].rsplit('/', 1)[-1] # Keep "viaf" at the beginning: needed in mapping.py (getRightURIbase)
					elif 'orcid' in v['value']:
						uri = "orcid"+v['value'].rsplit('/', 1)[-1] # Keep "orcid" at the beginning: needed in mapping.py (getRightURIbase)
					else:
						uri = v['value']
					label = [value['value'] for key,value in result.items() if key == k+'_label'][0]
				else:
					uri = v['value']
					label = uri
					#label = [value['value'] if key == k+'_label' else v['value'] for key,value in result.items()][0]

				if compare_sublists([uri,label], data[k]) == False:
					if k+'_class' in result:
						print(k+'_class')
						uri_class = result[k+'_class']['value']
						print("uri_class:", uri_class)
						data[k].append([uri,label,uri_class])
					else:
						data[k].append([uri,label])
	print("############ data",data)
	return data


# BROWSE ENTITY (VOCAB TERMS; NEW ENTITIES MENTIONED IN RECORDS)

def get_URI_label(uri):
	""" look for the URI label """
	select_label = """PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
	SELECT DISTINCT ?label WHERE {
		<"""+uri+"""> (rdfs:label | skos:prefLabel) ?label
	} 
	"""
	label = next((lab["label"]["value"] for lab in hello_blazegraph(select_label)["results"]["bindings"]), "No label")
	return label

def describe_term(name):
	""" ask if the resource exists, then describe it."""
	ask = """ASK { ?s ?p <""" +name+ """> .}"""
	results = hello_blazegraph(ask)
	if results["boolean"] == True: # new entity
		describe = """DESCRIBE <"""+name+ """>"""
		print("describe:", describe)
		return hello_blazegraph(describe)
	else: # vocab term
		ask = """ASK { ?s ?p ?o .
				filter( regex( str(?o), '"""+name+"""$' ) )
				}"""
		results = hello_blazegraph(ask)
		if results["boolean"] == True:
			describe = """DESCRIBE ?o
				WHERE { ?s ?p ?o .
				filter( regex( str(?o), '/"""+name+"""$' ) ) .
				filter( regex( str(?o), '^"""+conf.base+"""' ) ) . }"""

			return hello_blazegraph(describe)
		else:
			return None

def describe_extraction_term(name):
	""" ask if the resource exists as an extracted keyword, then describe it."""
	ask = """ASK WHERE {
		GRAPH ?extractionGraph {
			<"""+name+"""> ?p ?o .
		}
		?graph ?link ?extractionGraph .
	}""" 
	results = hello_blazegraph(ask)
	if results["boolean"] == True: # extracted URI
		describe = """SELECT DISTINCT ?graph WHERE {
			GRAPH ?extractionGraph {
				<"""+name+"""> ?p ?o .
			}
			?graph ?link ?extractionGraph .
		}"""
		return hello_blazegraph(describe)

# EXPLORE METHODS

def getBrowsingFilters(res_template_path):
	with open(res_template_path) as config_form:
		fields = json.load(config_form)
	props = [
		(
			f["property"],
			f["label"],
			f["type"],
			f["value"],
			f.get("values", ""),
			f["restricted"]
		)
		for f in fields
		if ("browse" in f and f["browse"] == "True")
		or ("disambiguate" in f and f["disambiguate"] == "True")
	]
	return props

def getExtractionProperties(res_template_path):
	with open(res_template_path) as config_form:
		fields = json.load(config_form)
	props = {
		f["property"]: f["label"]
		for f in fields
		if ("type" in f and f["type"] == "KnowledgeExtractor")
	}
	return props

# GRAPH methods

def deleteRecord(graph):
	""" delete a named graph and related record """
	if graph:
		q = """PREFIX schema: <https://schema.org/> SELECT DISTINCT ?extraction WHERE {<"""+graph+"""> schema:keywords ?extraction}"""
		results = hello_blazegraph(q)
		res_extraction = [result["extraction"]["value"] for result in results["results"]["bindings"]]
		res_extraction.append(graph)
		for to_clear in res_extraction:
			clearGraph = ' CLEAR GRAPH <'+to_clear+'> '
			deleteGraph = ' DROP GRAPH <'+to_clear+'> '
			sparql = SPARQLWrapper(conf.myEndpoint)
			sparql.setQuery(clearGraph)
			sparql.method = 'POST'
			sparql.query()
			sparql.setQuery(deleteGraph)
			sparql.method = 'POST'
			sparql.query()


def clearGraph(graph):
	if graph:
		q = """PREFIX schema: <https://schema.org/> SELECT DISTINCT ?extraction WHERE {<"""+graph+"""> schema:keywords ?extraction}"""
		results = hello_blazegraph(q)
		res_extraction = [result["extraction"]["value"] for result in results["results"]["bindings"]]
		res_extraction.append(graph)
		for to_clear in res_extraction:
			clearGraph = ' CLEAR GRAPH <'+to_clear+'> '
			sparql = SPARQLWrapper(conf.myEndpoint)
			sparql.setQuery(clearGraph)
			sparql.method = 'POST'
			sparql.query()


def get_subrecords(rdf_property,record_name):
	"""Return a list of sub-Records given the super-Record id and their linking property
	
	Parameters
	----------
	rdf_property: str
		a string representing the uri of the property linking the super-Record to the sub-Record
	graph_name: str
		a string representing the id of the super-Record Graph
	"""
	q = """PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> 
		SELECT DISTINCT ?subrecord WHERE { GRAPH <"""+conf.base+record_name+'/'+"""> {
			<"""+conf.base+record_name+"""> <"""+rdf_property+"""> ?subrecord .
		}} """
	results = hello_blazegraph(q)

	subrecords_list = [subrecord['subrecord']['value'] for subrecord in results['results']['bindings']]
	return subrecords_list

def retrieve_extractions(res_uri_list, view=False):
	"""Return a dictionary of Extractions given a list of tuples: [(named_graph_uri, extraction_rdf_property, extraction_field_name, extraction_field_classes)]'
	
	Parameters
	----------
	res_uri_list: list
		a list of uri (Named Graphs) which may contain Knowledge Extractions
	view: bool
		whether to return the extraction_rdf_property and the extraction_field_name for visualization purposes
	"""
	res_dict = {}


	# Retrieve the extraction graphs (URI) for each Record/Subrecord
	for uri, rdf_property, field_name, field_id, field_classes in res_uri_list:
		uri_id = uri.replace(conf.base,'')[:-1]
		query_var_id = uri.rsplit('/',2)[1].replace('-','_')
		query_pattern = """<"""+uri+"""> <"""+rdf_property+"""> ?extraction_graph_"""+query_var_id+"""."""+\
			""" ?extraction_graph_"""+query_var_id+""" prov:wasGeneratedBy ?extraction_entity_"""+query_var_id+\
			""" . ?extraction_entity_"""+query_var_id+""" prov:used ?extraction_link_"""+query_var_id+\
			""" . OPTIONAL { ?extraction_entity_"""+query_var_id+""" rdfs:comment ?extraction_comment_"""+query_var_id+"""}"""

		q = """PREFIX schema: <https://schema.org/> PREFIX prov: <http://www.w3.org/ns/prov#> SELECT DISTINCT * WHERE {""" +query_pattern+ """}"""
		results = hello_blazegraph(q)

		if len(results["results"]["bindings"]) > 0:
			if uri_id in res_dict:
				res_dict[uri_id][field_id] = []
			else:
				res_dict[uri_id] = {field_id : []}

			# TODO : CHECK THE FOLLOWING IF STATEMENT
			if view:
				res_dict[uri_id+'_view'] = {
					'property': rdf_property,
					'field_name': field_name
				}

			pattern = re.compile(r'<x-sparql-anything:(.*?)>')

			for result in results["results"]["bindings"]:
				# retrieve the extraction metadata
				metadata = {
					'graph': '',
					'link': '',
					'comment': ''
				}

				for k, v in result.items():
					if k.startswith('extraction_graph_'):
						metadata['graph'] = v['value']
					elif k.startswith('extraction_link_'):
						metadata['link'] = urllib.parse.unquote(v['value'])
					elif k.startswith('extraction_comment'):
						metadata['comment'] = v['value']

				# Store the metadata to allow their re-use
				graph = metadata['graph']
				link = metadata['link']
				comment = metadata['comment']

				res_dict[uri_id][field_id].append({"graph":graph, "metadata": {}})
				

				# Api metadata
				if comment:
					res_dict[uri_id][field_id][-1]["metadata"]['results'] = json.loads(comment.replace("'",'"'))
					res_dict[uri_id][field_id][-1]["metadata"]['type'] = 'api'
					url, parameters = link.rsplit('?', 1)
					query = {p.split("=")[0]: p.split("=")[1] for p in parameters.split("&")}
					res_dict[uri_id][field_id][-1]["metadata"]['url'] = url
					res_dict[uri_id][field_id][-1]["metadata"]['query'] = query
				
				# File metadata
				elif link.startswith(conf.sparqlAnythingEndpoint):
					res_dict[uri_id][field_id][-1]["metadata"]['type'] = 'file'
					query = link.split("?query=")[1]
					url_match = pattern.search(query)
					if url_match:
						url = url_match.group(1)
					else:
						url = ''
					res_dict[uri_id][field_id][-1]["metadata"]['url'] = url
					res_dict[uri_id][field_id][-1]["metadata"]['query'] = query

				# Sparql metadata
				else:
					url, query = link.split("?query=") if len(link.split("?query=")) == 2 else "", link.replace("?query=", "")
					res_dict[uri_id][field_id][-1]["metadata"]['type'] = 'sparql'
					res_dict[uri_id][field_id][-1]["metadata"]['url'] = url
					if view:
						res_dict[uri_id][field_id][-1]["metadata"]['query'] = query
					else:
						res_dict[uri_id][field_id][-1]["metadata"]['query'] = query.replace("'", "\\'").replace('"', "'")
			
			# Retrieve the keywords populating each extraction graph
			for n in range(len(res_dict[uri_id][field_id])):
				graph_uri = res_dict[uri_id][field_id][n]["graph"]
				idx = graph_uri.split('/extraction-')[-1][:-1]
				res_dict[uri_id][field_id][n]["internalId"] = idx.replace(field_id+"-","")
				retrieve_graph = """PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
					SELECT DISTINCT ?uri ?label ?class WHERE {GRAPH <"""+graph_uri+""">
					{	?uri rdfs:label ?label .  
						OPTIONAL { ?uri a ?class }
					}}"""
				graph_results = hello_blazegraph(retrieve_graph)["results"]["bindings"]

				# find class for extracted entities
				entity_class = next((result.get("class", {}).get("value") 
					for result in graph_results if result.get("class", {}).get("value") is not None ), "None")
				if view and entity_class != "None":
					extraction_classes = u.get_keywords_classes(view)
					res_dict[uri_id][field_id][n]["metadata"]["class"] = { "uri" : entity_class.strip() , "label" : extraction_classes[entity_class].strip()}
				else:
					res_dict[uri_id][field_id][n]["metadata"]["class"] = entity_class

				if view:
					res_dict[uri_id][field_id][n]["metadata"]['output'] = [{"uri": {"value": urllib.parse.quote(res["uri"]["value"],safe="").strip(), "type":res["uri"]["type"]}, "label": {"value": res["label"]["value"].strip(), "type":res["label"]["type"]}} for res in graph_results]
				else:
					res_dict[uri_id][field_id][n]["metadata"]['output'] = [{"uri": {"value": res["uri"]["value"].strip(), "type":res["uri"]["type"]}, "label": {"value": res["label"]["value"].strip(), "type":res["label"]["type"]}} for res in graph_results]
	if not view:
		res_dict = json.dumps(res_dict, ensure_ascii=False)
	print(res_dict)
	return res_dict

def saveHiddenTriples(graph, tpl):
	with open(tpl) as template:
		fields = json.load(template)

	results = {'results': {'bindings': [{}]}}
	hidden_fields = [field for field in fields if field['hidden'] == 'True']
	patterns = [ 'OPTIONAL {?subject <'+hidden_field['property']+'> ?'+hidden_field['id']+'. ?subject ?'+hidden_field['id']+'_property ?'+hidden_field['id']+'}. '  if hidden_field['value'] in ['Literal','Date','gYearMonth','gYear','URL'] else 'OPTIONAL {?subject <'+hidden_field['property']+'> ?'+hidden_field['id']+'. ?'+hidden_field['id']+' rdfs:label ?'+hidden_field['id']+'_label . ?subject ?'+hidden_field['id']+'_property ?'+hidden_field['id']+'}.' for hidden_field in hidden_fields if 'value' in hidden_field and hidden_field['hidden'] == 'True']
	if patterns != []:
		patterns_string = ''.join(patterns)
		queryNGraph = '''
			PREFIX base: <'''+conf.base+'''>
			PREFIX schema: <https://schema.org/>
			SELECT DISTINCT *
			WHERE {
					GRAPH <'''+graph+'''>
					{
						'''+patterns_string+'''
					}
			}
			'''
		sparql = SPARQLWrapper(conf.myEndpoint)
		sparql.setQuery(queryNGraph)
		sparql.setReturnFormat(JSON)
		results = sparql.query().convert()
	print(results)
	return results

def get_records_from_object(graph_uri):
	query = """
		SELECT DISTINCT ?subject ?property ?label 
       	(GROUP_CONCAT(DISTINCT ?class; separator="; ") AS ?classes)
		WHERE {
			GRAPH ?graph {
				?subject ?property <"""+graph_uri+""">.
				?subject rdfs:label ?label.
				?subject a ?class.
			}
		}
		GROUP BY ?graph ?subject ?property ?label
	"""

	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(query)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()
	print(results)
	return results

# DATA EXTRACTION form SERVICES

def entity_reconciliation(uri,service,find,secondary_service="viaf",language="en"):

	# set query
	base_url = ""
	params = {}
	if service == "wd":

		# set headers
		base_url = "https://wikidata.org/w/api.php"
		headers = { 
			"Accept": "application/json",
			"User-Agent": "ATLAS/1.0 (https://github.com/dh-atlas/app; mailto:sebastiano.giacomin2@unibo.it)"
		}

		# set params
		if find == "uri":
			params = {
				"action": "wbsearchentities",
				"search": uri,
				"format": "json",
				"language": language,
			}
		elif find == "label":
			params = {
				"action": "wbgetentities",
				"ids": uri.rsplit("/", 1)[1],
				"format": "json",
				"languages": language
			}

	elif service == "viaf":

		# set headers
		headers = {
			"Accept": "application/json",
			"Accept-Encoding": "deflate, br, identity",
			"User-Agent": "Mozilla/5.0 (compatible; VIAFbot/1.0)",
		}

		# set params
		if find == "uri":
			base_url = "https://www.viaf.org/viaf/AutoSuggest"
			params = {"query": uri}
		elif find == "label":
			base_url = f"https://viaf.org/viaf/{uri}/viaf.json"
			params = {}
		
	elif service == "geonames":

		# set params
		if find == "uri":
			base_url = "http://api.geonames.org/searchJSON"
			params = {
				"q": uri,
				"username": "palread", 
				"maxRows": 1
			}
		elif find == "label":
			base_url = "http://api.geonames.org/getJSON"
			params = {
				"geonameId": uri,
				"username": "palread"
			}
	
	if find == "uri":
		# execute the query and retrieve the URI
		try:
			response = requests.get(base_url, params=params, headers=headers)
			response.raise_for_status()  # Check if the request was successful
			data = response.json()  # Parse the JSON response
			print(data)
			if service == "wd":
				if len(data["search"]) > 0:
					new_uri = data["search"][0]["concepturi"]
				elif language == "en":
					new_uri = entity_reconciliation(uri,"wd",language="it")
				elif secondary_service:
					new_uri = entity_reconciliation(uri,secondary_service)
			elif service == "viaf" and data["result"] != None:
				new_uri = mapping.VIAF + data["result"][0]["viafid"]
			elif service == "geonames" and len(data["geonames"]) > 0:
				new_uri = mapping.GEO + str(data["geonames"][0]["geonameId"])
			else:
				new_uri = conf.base+str(time.time()).replace('.','-')
			return new_uri
		
		except requests.exceptions.HTTPError as http_err:
			print(f"HTTP error occurred: {http_err}")
			new_uri = conf.base+str(time.time()).replace('.','-')
			return new_uri
		except Exception as err:
			print(f"Other error occurred: {err}")
			new_uri = conf.base+str(time.time()).replace('.','-')
			return new_uri
		
	elif find == "label":
		# execute the query and retrieve the Label
		try:
			response = requests.get(base_url, params=params, headers=headers)
			response.raise_for_status()
			data = response.json()
			print(data)

			if service == "wd":
				entity_id = uri.rsplit("/", 1)[1]
				labels = data["entities"][entity_id]["labels"]
				if language in labels:
					return labels[language]["value"]
				elif "en" in labels:  # fallback to english
					return labels["en"]["value"]
				else:
					return list(labels.values())[0]["value"]  # first available language

			elif service == "viaf":
				if "mainHeadings" in data and "data" in data["mainHeadings"]:
					return data["mainHeadings"]["data"]["text"]
				elif "name" in data:
					return data["name"]
				else:
					return None

			elif service == "geonames":
				return data.get("name")

		except Exception as err:
			print(f"Error occurred: {err}")
			return "No label"


# GET LATITUDE AND LONGITUDE GIVEN A GEONAMES URI
def geonames_geocoding(geonames_uri):
	uri_id = geonames_uri.replace("https://sws.geonames.org/","")
	search_url = f'http://api.geonames.org/getJSON?geonameId={uri_id}&username=palread'
	response = requests.get(search_url)
	data = response.json()
	latitude = data['lat']
	longitude = data['lng']
	return latitude, longitude


def SPARQLAnything(query_str,endpoint=None):
	def prepare_query(query, endpoint_wrap=False):
		if endpoint_wrap and endpoint:
			query = query.replace('{', '{ SERVICE <'+endpoint+'>', 1) 
			idx = query.rfind('}')
			if idx != -1:
				query = query[:idx] + '}}' + query[idx+1:]
		return query_prefixes + query.replace("&lt;", "<").replace("&gt;", ">")
	

	results = {}
	query_prefixes = """PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
		PREFIX xyz: <http://sparql.xyz/facade-x/data/>
		PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
		PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
		PREFIX sa: <http://w3id.org/sparql-anything#>
		PREFIX ex: <http://example.org/>
	"""
	if "SERVICE <x-sparql-anything:>" in query_str:
		
		sparql = SPARQLWrapper(conf.sparqlAnythingEndpoint)
		sparql.setMethod(POST)
		sparql.setReturnFormat(JSON)  # o "json", a seconda del tipo di query
		query_str.replace("&lt;", "<").replace("&gt;", ">")
		sparql.setQuery(query_str)
		results = sparql.query().convert()
		return results
	elif "SERVICE" in query_str or not endpoint:
		# Use default endpoint
		sparql = SPARQLWrapper(conf.sparqlAnythingEndpoint)
		query = prepare_query(query_str)
	else:
		try:
			# Use specified endpoint
			sparql = SPARQLWrapper(endpoint)
			query = prepare_query(query_str)
		except Exception as e:
			# Use SPARQL Anything
			sparql = SPARQLWrapper(conf.sparqlAnythingEndpoint)
			query = prepare_query(query_str,endpoint_wrap=True) 

	print(query)
	sparql.setQuery(query)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()
	return results

def getChartData(chart):

	if chart["type"] == "map":
		query_results = hello_blazegraph(chart["query"])["results"]["bindings"]
		stats_result = []
		for result in query_results:
			if "geonames" in result:
				geonames = result["geonames"]["value"]
				lat, long = geonames_geocoding(geonames)
				i = 0
				while i < int(result["count"]["value"]):
					stats_result.append({
						"label" : result["label"]["value"],
						"latitude": lat,
						"longitude": long
					})
					i += 1
		results = stats_result
	elif chart["type"] == "chart":
		stats_query = chart["query"]
		x_var, x_name = chart["x-var"], chart["x-name"]
		x_var = x_var.replace("?","")
		y_var, y_name = chart["y-var"], chart["y-name"]
		y_var = y_var.replace("?","")
		query_results = hello_blazegraph(stats_query)
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
		results = stats_result
	elif chart["type"] == "counter":
		results = []
		for counter in chart["counters"]:
			counter_query = counter["query"]
			try:
				query_results = hello_blazegraph(counter_query)
				count_result = [result["count"]["value"] for result in query_results["results"]["bindings"]]
				count = int(count_result[0]) if len(count_result) > 0 else 0
			except Exception as e:
				count = 0
			results.append(count)
	elif chart["type"] == "timeline":
		query_results = hello_blazegraph(chart["query"])["results"]["bindings"]
		lookup = {}
		for result in query_results:
			time = result["time"]["value"].rsplit("/",1)[-1]
			uri = result["g"]["value"][:-1] 
			label = result["label"]["value"]
			if time in lookup:
				lookup[time]["uri"].append(uri)
				lookup[time]["label"].append(label)
			else:
				lookup[time] = {"uri":[uri], "label":[label], "time":time}
		results = list(lookup.values())
	elif chart["type"] == "network":
		query_results = hello_blazegraph(chart["query"])["results"]["bindings"]
		tot_value = 0
		tree = {"name": chart["mainClass"], "children": []}
		class_map = {}

		for row in query_results:
			class_name = row["classLabel"]["value"]
			label = row.get("label", {}).get("value", row["entity"]["value"])
			count = int(row["count"]["value"])
			tot_value += count

			# Create category
			if class_name not in class_map:
				class_map[class_name] = {"name": class_name, "children": [], "value": count}
				tree["children"].append(class_map[class_name])
			else:
				class_map[class_name]["value"] += count

			# Add entity
			class_map[class_name]["children"].append({
				"name": label,
				"value": count
			})

		tree["value"] = tot_value		
		results = tree
		
	print("results:", results)
	return results

# GET RECORDS' SERIALIZATIONS	
def get_serialization_file(format, graph_id):
	from rdflib import Graph
	from SPARQLWrapper import SPARQLWrapper, RDFXML
	base_graph = conf.base + graph_id
	graphs = [base_graph]
	serialized_graphs = []

	# find extraction graphs
	find_extraction_graphs = f"""
	SELECT DISTINCT ?graph 
	WHERE {{
		GRAPH <{base_graph}/> {{
			<{base_graph}/> ?extractionProp ?graph .
		}} GRAPH ?graph {{ ?s ?p ?o }} 
	}}
	"""
	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(find_extraction_graphs)
	sparql.setReturnFormat(JSON)
	extraction_graphs = sparql.query().convert()
	for extraction_graph in extraction_graphs["results"]["bindings"]:
		graphs.append(extraction_graph["graph"]["value"][:-1])


	# retrieve all graphs
	for graph_uri in graphs:
		query = f"""
		CONSTRUCT {{
			?s ?p ?o
		}}
		WHERE {{
			GRAPH <{graph_uri}/> {{
				?s ?p ?o 
			}}
		}}
		"""

		sparql = SPARQLWrapper(conf.myEndpoint)
		sparql.setQuery(query)
		sparql.setReturnFormat(RDFXML)
		results = sparql.query().convert() 
		serialize_format = {
			'ttl': 'turtle',
			'jsonld': 'json-ld',
			'rdf': 'xml'
		}

		serialized_graphs.append(results.serialize(format=serialize_format.get(format, 'turtle')))
	return serialized_graphs

