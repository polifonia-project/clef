# -*- coding: utf-8 -*-
import json
from pymantic import sparql
import conf , os , rdflib
from rdflib import URIRef , XSD, Namespace , Literal
from rdflib.namespace import RDFS
import utils as u

u.reload_config()

server = sparql.SPARQLServer(conf.myEndpoint)
dir_path = os.path.dirname(os.path.realpath(__file__))

def import_vocabs():
	""" get all controlled vocabularies and uploads to the triplestore"""
	with open(conf.template_list,'r') as tpl_file:
		tpl_list = json.load(tpl_file)

	for t in tpl_list:
		with open(t["template"],'r') as tpl_file:
			fields = json.load(tpl_file)
			list_vocab = [field['values'] for field in fields if 'values' in field]
			if len(list_vocab) > 0:
				vocab = rdflib.Graph()
				for dict_vocab in list_vocab:
					for uri,label in dict_vocab.items():
						vocab.add(( URIRef( uri), RDFS.label, Literal(label) ))

				vocab.serialize(destination='vocabs/vocabs.ttl', format='ttl', encoding='utf-8')
				server.update('load <file:///'+dir_path+'/vocabs/vocabs.ttl> into graph <'+conf.base+'vocabularies/>')
