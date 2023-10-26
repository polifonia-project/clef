# -*- coding: utf-8 -*-
import conf , os , operator , pprint , ssl , rdflib , json
from SPARQLWrapper import SPARQLWrapper, JSON
from collections import defaultdict
from rdflib import URIRef , XSD, Namespace , Literal
from rdflib.namespace import OWL, DC , DCTERMS, RDF , RDFS
from rdflib.plugins.sparql import prepareQuery
from pymantic import sparql
import utils as u
import urllib.parse

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


def getRecords(res_class=None):
	""" get all the records created by users to list them in the backend welcome page """
	class_restriction = "" if res_class is None else "?s a <"+res_class+"> ."

	queryRecords = """
		PREFIX prov: <http://www.w3.org/ns/prov#>
		PREFIX base: <"""+conf.base+""">
		SELECT DISTINCT ?g ?title ?userLabel ?modifierLabel ?date ?stage ?class
		WHERE
		{ GRAPH ?g {
			?s ?p ?o . ?s a ?class .
			""" +class_restriction+ """
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
		"""

	records = set()
	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(queryRecords)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()

	for result in results["results"]["bindings"]:
		records.add( (result["g"]["value"], result["title"]["value"], result["userLabel"]["value"], result["modifierLabel"]["value"], result["date"]["value"], result["stage"]["value"], result["class"]["value"] ))
	return records


def getRecordsPagination(page, filterRecords=''):
	""" get all the records created by users to list them in the backend welcome page """
	newpage = int(page)-1
	offset = str(0) if int(page) == 1 \
		else str(( int(conf.pagination) *newpage))
	queryRecordsPagination = """
		PREFIX prov: <http://www.w3.org/ns/prov#>
		PREFIX base: <"""+conf.base+""">
		SELECT DISTINCT ?g ?title ?userLabel ?modifierLabel ?date ?stage ?class
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
		records.append( (result["g"]["value"], result["title"]["value"], result["userLabel"]["value"], result["modifierLabel"]["value"], result["date"]["value"], result["stage"]["value"] , result["class"]["value"] ))

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


def countAll(res_class=None, exclude_unpublished=False):
	class_restriction = "" if res_class is None else "?s a <"+res_class+"> ."
	exclude = "" if exclude_unpublished is False \
		else "?g <http://dbpedia.org/ontology/currentStatus> ?anyValue . FILTER (isLiteral(?anyValue) && lcase(str(?anyValue))= 'published') ."
	countall = """
		PREFIX prov: <http://www.w3.org/ns/prov#>
		PREFIX base: <"""+conf.base+""">
		SELECT (COUNT(DISTINCT ?g) AS ?count)
		WHERE
		{ GRAPH ?g { ?s ?p ?o .
			"""+class_restriction+"""
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


# TRIPLE PATTERNS FROM THE FORM



# REBUILD GRAPH TO MODIFY/REVIEW RECORD
def getClass(res_uri):
	""" get the class of a resource given the URI"""

	q = """ SELECT DISTINCT ?class WHERE {<"""+res_uri+"""> a ?class}"""
	res_class = []
	results = hello_blazegraph(q)
	for result in results["results"]["bindings"]:
		res_class.append(result["class"]["value"])
	return res_class[0] if len(res_class) > 0 else ""

def getData(graph,res_template):
	""" get a named graph and rebuild results for modifying the record"""
	with open(res_template) as config_form:
		fields = json.load(config_form)

	res_class = getClass(graph[:-1])
	# Added new types of values: URL, Date, gYearMonth
	patterns = [ 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'.}. '  if field['value'] in ['Literal','Date','gYearMonth','gYear','URL'] else 'OPTIONAL {?subject <'+field['property']+'> ?'+field['id']+'. ?'+field['id']+' rdfs:label ?'+field['id']+'_label .} .' for field in fields if 'value' in field]
	patterns_string = ''.join(patterns)

	queryNGraph = '''
		PREFIX base: <'''+conf.base+'''>
		PREFIX schema: <https://schema.org/>
		SELECT DISTINCT *
		WHERE { <'''+graph+'''> rdfs:label ?graph_title ;
								<http://dbpedia.org/ontology/currentStatus> ?stage
				GRAPH <'''+graph+'''>
				{	?subject a <'''+res_class+'''> .
					'''+patterns_string+'''
					OPTIONAL {?subject schema:keywords ?keywords . ?keywords rdfs:label ?keywords_label . } }
		}
		'''
	sparql = SPARQLWrapper(conf.myEndpoint)
	sparql.setQuery(queryNGraph)
	sparql.setReturnFormat(JSON)
	results = sparql.query().convert()

	def compare_sublists(l, lol):
		for sublist in lol:
			temp = [i for i in sublist if i in l]
			if sorted(temp) == sorted(l):
				return True
		return False

	data = defaultdict(list)
	for result in results["results"]["bindings"]:
		result.pop('subject',None)
		result.pop('graph_title',None)
		for k,v in result.items():
			if '_label' not in k and v['type'] == 'literal': # string values
				if v['value'] not in data[k]: # unique values
					data[k].append(v['value'])
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


def describeTerm(name):
	""" ask if the resource exists, then describe it."""
	ask = """ASK { ?s ?p <""" +conf.base+name+ """> .}"""
	results = hello_blazegraph(ask)
	if results["boolean"] == True: # new entity
		describe = """DESCRIBE <"""+conf.base+name+ """>"""
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

def retrieve_extractions(res_uri):
	q = """PREFIX schema: <https://schema.org/> SELECT DISTINCT ?extraction WHERE {<"""+res_uri+"""/> schema:keywords ?extraction}"""
	results = hello_blazegraph(q)
	res_extraction = []
	for result in results["results"]["bindings"]:
		res_extraction.append(result["extraction"]["value"])
	res_dict = {}
	for extraction in res_extraction:
		id = extraction.split("-")[-1].replace("/", "")
		retrieve_graph = """PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
			SELECT DISTINCT ?uri ?label WHERE {GRAPH <"""+extraction+""">
			{	?uri rdfs:label ?label .  }}"""
		graph_results = hello_blazegraph(retrieve_graph)["results"]["bindings"]
		res_dict[id] = [{"uri": urllib.parse.unquote(res["uri"]["value"]), "label": res["label"]["value"]} for res in graph_results]
	if len(res_dict) > 0:
		with open(conf.knowledge_extraction, 'r') as ke_file:
			ke_dict = json.load(ke_file)
		next_id = max(ke_dict[res_uri.split("/")[-1]], key=lambda x: int(x["internalID"]))
		res_dict['next_id'] = int(next_id['internalID']) + 1
	return res_dict
