# -*- coding: utf-8 -*-
import conf , os , operator , pprint , ssl , rdflib , json
from SPARQLWrapper import SPARQLWrapper, JSON, POST
from collections import defaultdict
from rdflib import URIRef , XSD, Namespace , Literal
from rdflib.namespace import OWL, DC , DCTERMS, RDF , RDFS
from rdflib.plugins.sparql import prepareQuery
from pymantic import sparql
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


def getRecordsPagination(page, filterRecords=''):
	""" get all the records created by users to list them in the backend welcome page """
	newpage = int(page)-1
	offset = str(0) if int(page) == 1 \
		else str(( int(conf.pagination) *newpage))
	queryRecordsPagination = """
		PREFIX prov: <http://www.w3.org/ns/prov#>
		PREFIX base: <"""+conf.base+""">
		SELECT DISTINCT ?g ?title ?userLabel ?modifierLabel ?date ?stage (GROUP_CONCAT(DISTINCT ?class; SEPARATOR=";  ") AS ?classes)
		WHERE
		{ GRAPH ?g {
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


def getCountings(filterRecords=''):
	countRecords = """
		PREFIX prov: <http://www.w3.org/ns/prov#>
		PREFIX base: <"""+conf.base+""">
		SELECT (COUNT(DISTINCT ?g) AS ?count) ?stage
		WHERE
		{ GRAPH ?g { ?s ?p ?o .
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


def countAll(res_class=None,res_subclasses=None,by_subclass=False,exclude_unpublished=False):
	include_class_list = by_subclass + res_class if res_subclasses != None and res_class != None and by_subclass else res_class
	exclude_class_list = res_subclasses + res_class if res_subclasses != None and res_class != None else res_class if res_class != None else None
	filter_class_exists = "\n".join([f"FILTER EXISTS {{ ?s a <{cls}> }}" for cls in include_class_list]) if include_class_list != None else ""
	filter_class_not_exists = f"FILTER (NOT EXISTS {{ ?s a ?other_class FILTER (?other_class NOT IN ({', '.join([f'<{cls}>' for cls in exclude_class_list])})) }})" if exclude_class_list != None else ""

	exclude = "" if exclude_unpublished is False \
		else "?g <http://dbpedia.org/ontology/currentStatus> ?anyValue . FILTER (isLiteral(?anyValue) && lcase(str(?anyValue))= 'published') ."
	countall = """
		PREFIX prov: <http://www.w3.org/ns/prov#>
		PREFIX base: <"""+conf.base+""">
		SELECT (COUNT(DISTINCT ?g) AS ?count)
		WHERE
		{ GRAPH ?g { ?s ?p ?o .
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
	print("DATA:", data)

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
	
	print("update query:", update_query)
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

def getData(graph,res_template):
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
	res_class = getClass(graph[:-1])
	class_patterns = ".".join(['''?subject a <'''+single_class+'''>''' for single_class in res_class]) 

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
			pattern = ""
			if len(properties_dict[field['property']]) > 1:
				pattern = disambiguate_pattern(properties_dict[field['property']],fields,field['id']) 
			if pattern == "":
				pattern = 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. FILTER (lang(?'+field['id']+')!="")} ' if field['value'] == 'Literal' \
					else 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. FILTER (isURI(?'+field['id']+')) FILTER NOT EXISTS {?'+field['id']+' rdfs:label ?'+field['id']+'_label } FILTER NOT EXISTS { ?'+field['id']+' skos:prefLabel ?'+field['id']+'_label } } ' if field['value'] == 'URL' \
					else 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. FILTER (datatype(?'+field['id']+') = xsd:'+field['value'][0].lower() + field['value'][1:]+') } ' if field['value'] in ['Date', 'gYear', 'gYearMonth'] \
					else 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. ?'+field['id']+' skos:prefLabel ?'+field['id']+'_label .} .' if 'type' in field and field['type'] == 'Skos' \
					else 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. ?'+field['id']+' rdfs:label ?'+field['id']+'_label } .'
			patterns.append(pattern)
	patterns_string = ''.join(patterns)

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
					OPTIONAL {?subject schema:keywords ?keywords . ?keywords rdfs:label ?keywords_label . } }
		}
		'''
	print(queryNGraph)
	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(queryNGraph)
	sparql.setReturnFormat(JSON)
	sparql.setMethod(POST)

	results = sparql.query().convert()

	data = defaultdict(list)
	for result in results["results"]["bindings"]:
		result.pop('subject',None)
		graph_label = result.pop('graph_title',None)
		print("LABEL:", graph_label)
		for k,v in result.items():
			if '_label' not in k and v['type'] == 'literal': # string values
				value = v['value']
				if 'xml:lang' in v:
					value = (v['value'],v['xml:lang'],'mainLang') if v['value']==graph_label['value'] and v['xml:lang']==graph_label['xml:lang'] else (v['value'],v['xml:lang'])
				
				if value not in data[k]:
					data[k].append(value)
			elif v['type'] == 'uri': # uri values

				if k+'_label' in result:
					if conf.base in v['value'] or 'wikidata' in v['value'] or 'geonames' in v['value']:
						uri = v['value'].rsplit('/', 1)[-1]
					elif 'viaf' in v['value']:
						uri = "viaf"+v['value'].rsplit('/', 1)[-1] # Keep "viaf" at the beginning: needed in mapping.py (getRightURIbase)
					else:
						uri = v['value']
					label = [value['value'] for key,value in result.items() if key == k+'_label'][0]
				else:
					uri = v['value']
					label = uri
					#label = [value['value'] if key == k+'_label' else v['value'] for key,value in result.items()][0]

				if compare_sublists([uri,label], data[k]) == False:
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
	props = [(f["property"], f["label"], f["type"], f["value"]) for f in fields if ("browse" in f and f["browse"] == "True") or ("disambiguate" in f and f["disambiguate"] == "True")]
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
	print(q,results)
	subrecords_list = [subrecord['subrecord']['value'] for subrecord in results['results']['bindings']]
	return subrecords_list

def retrieve_extractions(res_uri_list, view=False):
	"""Return a dictionary of Extractions given a list of tuples: [(named_graph_uri, extraction_rdf_property, extraction_field_name)]'
	
	Parameters
	----------
	res_uri_list: list
		a list of uri (Named Graphs) which may contain Knowledge Extractions
	view: bool
		whether to return the extraction_rdf_property and the extraction_field_name for visualization purposes
	"""
	res_dict = {}


	# Retrieve the extraction graphs (URI) for each Record/Subrecord
	for uri, rdf_property, field_name, field_id in res_uri_list:
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
			if view==True:
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
					res_dict[uri_id][field_id][-1]["metadata"]['type'] = 'sparql'
					url, query = link.split("?query=")
					res_dict[uri_id][field_id][-1]["metadata"]['url'] = url
					res_dict[uri_id][field_id][-1]["metadata"]['query'] = query
			
			# Retrieve the keywords populating each extraction graph
			for n in range(len(res_dict[uri_id][field_id])):
				graph_uri = res_dict[uri_id][field_id][n]["graph"]
				idx = graph_uri.split('/extraction-')[-1][:-1]
				res_dict[uri_id][field_id][n]["internalId"] = idx.replace(field_id+"-","")
				retrieve_graph = """PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
					SELECT DISTINCT ?uri ?label WHERE {GRAPH <"""+graph_uri+""">
					{	?uri rdfs:label ?label .  }}"""
				graph_results = hello_blazegraph(retrieve_graph)["results"]["bindings"]
				res_dict[uri_id][field_id][n]["metadata"]['output'] = [{"uri": {"value": urllib.parse.quote(res["uri"]["value"],safe=""), "type":res["uri"]["type"]}, "label": {"value": res["label"]["value"], "type":res["label"]["type"]}} for res in graph_results]
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
		SELECT DISTINCT ?subject ?property ?class ?label
		WHERE {
			?subject ?property <"""+graph_uri+""">.
			?subject rdfs:label ?label .
			?subject a ?class .
		}
	"""
	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(query)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()
	print(results)
	return results

# DATA EXTRACTION form SERVICES

def entity_reconciliation(uri,service):

	# set query params
	base_url = ""
	params = {}
	if service == "wd":
		base_url = "https://wikidata.org/w/api.php" 
		params = {
			"action": "wbsearchentities",
			"search": uri,
			"format": "json",
			"language": "it"
		}
	elif service == "viaf":
		base_url = "https://www.viaf.org/viaf/AutoSuggest"
		params = {
			"query": uri
		}
	elif service == "geonames":
		base_url = "http://api.geonames.org/searchJSON"
		params = {
            "q": uri,
            "username": "palread", 
            "maxRows": 1
        }
	
	# execute the query and retrieve the URI
	try:
		response = requests.get(base_url, params=params)
		response.raise_for_status()  # Check if the request was successful
		data = response.json()  # Parse the JSON response
		print(data)
		if service == "wd" and len(data["search"]) > 0:
			new_uri = data["search"][0]["concepturi"]
		elif service == "viaf" and data["result"] != None:
			new_uri = mapping.VIAF + data["result"][0]["viafid"]
		elif service == "geonames" and len(data["geonames"]) > 0:
			new_uri = mapping.GEO + str(data["geonames"][0]["geonameId"])
		else:
			new_uri = conf.base+str(time.time()).replace('.','-')
		return new_uri
	
	except requests.exceptions.HTTPError as http_err:
		print(f"HTTP error occurred: {http_err}")
	except Exception as err:
		print(f"Other error occurred: {err}")

# GET LATITUDE AND LONGITUDE GIVEN A GEONAMES URI
def geonames_geocoding(geonames_uri):
	uri_id = geonames_uri.replace("https://sws.geonames.org/","")
	search_url = f'http://api.geonames.org/getJSON?geonameId={uri_id}&username=palread'
	response = requests.get(search_url)
	data = response.json()
	print("geonames:", data)
	latitude = data['lat']
	longitude = data['lng']
	return latitude, longitude


def SPARQLAnything(query_str):
	sparql = SPARQLWrapper(conf.sparqlAnythingEndpoint)
	query = """PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
	PREFIX xyz: <http://sparql.xyz/facade-x/data/>
	PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
	PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
	PREFIX sa: <http://w3id.org/sparql-anything#>
	PREFIX ex: <http://example.org/>
	"""+query_str.replace("&lt;", "<").replace("&gt;", ">")

	print(query)
	# Retrieve all results so that user can verify them
	sparql.setQuery(query)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()
	return results