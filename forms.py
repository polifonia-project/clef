# -*- coding: utf-8 -*-
import web , datetime , os, time, re, cgi , json, html
from web import form
import conf

class Month(form.Input):
	def get_type(self):
		return "month"

def parse_config_variables(text:str, conf):
	""" Parses and replace the variables in the text by their values from config.

	Parameters
	----------
	text: str
		The input string representing the config
	conf
		The config module

	Returns
	-------
	str
		The same text with the replaced wildards
	"""
	params = {
        '$myEndpoint': conf.myEndpoint,
        '$myPublicEndpoint': conf.myPublicEndpoint
    }
	for k, v in params.items():
		text = text.replace(k, v)
	return text

def get_form(json_form, from_dict=False, subtemplate=False):
	""" read config in 'template-(.*).json' and return a webpy form """
	import io
	if from_dict == False:
		with open(json_form) as config_form:
			# The StringIO wrapper was used to re-use the json.load function
			# without any other change.
			text = config_form.read()
			text = parse_config_variables(text, conf)
			buf = io.StringIO(text)
			buf.seek(0)
			fields = json.load(buf)
	else:
		fields = json_form

	params = ()

	with open(conf.template_list) as tpl_file:
		tpl_list = json.load(tpl_file)

	res_class = [t["type"] for t in tpl_list if t["template"] == json_form]
	res_class = res_class[0] if len(res_class) > 0 else "none"

	for field in fields:
		if 'hidden' in field and field['hidden'] == 'False': # do not include hidden fields
			# all
			myid = field['id']
			description = field['label'] if 'label' in field and len(field['label']) > 0 else 'input'
			pre_a = '<span class="tip" data-toggle="tooltip" data-placement="bottom" title="'
			pre_b = '"><i class="fas fa-info-circle"></i></span>'
			prepend = pre_a+html.escape(field['prepend'])+pre_b if 'prepend' in field and len(field['prepend']) > 0 else ''
			disabled = 'disabled' if 'disabled' in field and field['disabled'] == "True" else ''
			classes = field['class'] if 'class' in field and len(field['class']) > 0 else ''
			if 'vocab' in field:
				for vocab in field['vocab']:
					classes = classes + " " + vocab
			classes = classes+' searchWikidata' if 'searchWikidata' in field and field['searchWikidata'] == 'True' else classes
			classes = classes+' searchGeonames' if 'searchGeonames' in field and field['searchGeonames'] == 'True' else classes
			classes = classes+' urlField' if 'url' in field and field['url'] == 'True' else classes
			classes = classes+' disambiguate' if "disambiguate" in field and field["disambiguate"] == 'True' else classes
			classes = classes+' multimediaField '+ field['multimedia'] if field['type'] == 'Multimedia' else classes
			classes = classes+' vocabularyField' if field['type'] == 'Vocab' else classes
			classes = classes+' oneVocableAccepted' if 'vocables' in field and field['vocables'] == 'oneVocable' else classes
			classes = classes+' websitePreview' if field['type'] == 'WebsitePreview' else classes
			classes = classes+' ('+res_class+') '+disabled
			classes = classes+ ' ' + field['cardinality'] if 'cardinality' in field else classes
			autocomplete = field['cache_autocomplete'] if 'cache_autocomplete' in field and len(field['cache_autocomplete']) > 0 else ''
			mandatory = field['mandatory'] if 'mandatory' in field and field['mandatory'] == 'True' else 'False'

			# text box
			placeholder = field['placeholder'] if 'placeholder' in field else None
			default = field['defaultvalue'] if 'defaultvalue' in field else ''
			# dropdown
			dropdown_values = [(k,v) for k,v in field['values'].items()] if 'values' in field else None

			# Text box
			if field['type'] == 'Textbox' and field['value'] == 'Literal':
				if "disambiguate" in field and field["disambiguate"] == 'True':
					#vpass = form.regexp(r".{0,200}$", 'must be between 1 and 200 characters') # TODO: check the regex (either set it to {0, 200} or remove it in case of Subtemplates' primary keys)
					params = params + (form.Textbox(myid, #vpass,
					type='text',
					description = description,
					id=myid,
					placeholder=placeholder,
					pre = prepend,
					class_= classes,
					value=default,
					mandatory = mandatory,
					lang=conf.mainLang) , )
				else:
					params = params + (form.Textbox(myid,
					type='text',
					description = description,
					id=myid,
					placeholder=placeholder,
					pre = prepend,
					class_= classes,
					value=default,
					mandatory = mandatory,
					lang=conf.mainLang), )

			# Entities, SKOS thesauri, links
			if field['type'] in ['Vocab', 'WebsitePreview'] or (field['type'] == 'Textbox' and field['value'] in ['URL', 'URI']):
				params = params + (form.Textbox(myid,
					description = description,
					id=myid,
					placeholder=placeholder,
					pre = prepend,
					class_= classes,
					value=default,
					mandatory = mandatory), )
				
			# Multimedia Link
			if field['type'] == 'Multimedia':
				params = params + (form.Textbox(myid,
				description = description,
				id=myid,
				pre = prepend,
				class_= classes,
				value=default,
				mandatory = mandatory) , )
				

			# Text box
			if field['type'] == 'Textarea':
				params = params + (form.Textarea(myid,
				description = description,
				id=myid,
				placeholder=placeholder,
				pre = prepend,
				class_= classes,
				value=default,
				mandatory = mandatory,
				lang=conf.mainLang), )

			if field['type'] == 'Date':
				if field['calendar'] == 'Month':
					params = params + (Month(myid,
					description = description,
					id=myid,
					pre = prepend,
					class_= classes,
					mandatory=mandatory), )
				elif field['calendar'] == 'Day':
					params = params + (form.Date(myid,
					description = description,
					id=myid,
					pre = prepend,
					class_= classes,
					mandatory=mandatory), )
				elif field['calendar'] == 'Year':
					params = params + (form.Textbox(myid,
					description = description,
					id=myid,
					pre = prepend,
					class_= classes,
					value=default,
					mandatory=mandatory), )

			if field['type'] == 'Dropdown':
				params = params + (form.Dropdown(myid,
				description = description,
				args=dropdown_values,
				placeholder=placeholder,
				id=myid,
				pre = prepend,
				class_= classes,
				mandatory = mandatory), )

			if field['type'] == 'Checkbox':
				prepend_title = '<section class="checkbox_group_label label col-12">'+description+'</section>'
				i = 0
				params = params + (form.Checkbox(myid+'-'+str(i),
				value=dropdown_values[0][0]+','+dropdown_values[0][1],
				description = dropdown_values[0][1],
				id=myid,
				pre = prepend_title+prepend,
				class_= classes+' checkbox_group',
				checked=False,
				mandatory = mandatory), )

				for value in dropdown_values[1:]:
					i += 1
					params = params + (form.Checkbox(myid+'-'+str(i),
					value=value[0]+','+value[1],
					description = value[1],
					id=myid,
					pre = '',
					class_= classes+' checkbox_group following_checkbox',
					checked=False,
					mandatory = mandatory), )

			# Subtemplate
			if field['type'] == 'Subtemplate':
				resource_class = [t["type"] for t in tpl_list if t["template"] == field['import_subtemplate']][0]
				params = params + (form.Textbox(myid,
					description = description,
					id=myid,
					placeholder=placeholder,
					pre = prepend,
					class_= classes,
					value=default,
					mandatory = mandatory,
					subtemplate = resource_class), ) + get_form(field['import_subtemplate'], subtemplate=True)

	if subtemplate:
		return params
	else: 
		myform = form.Form(*params)
		return myform


searchRecord = form.Form(
	form.Textbox("search",
    	class_="searchWikidata col-md-11",
    	description="Search",
    	autocomplete="off")
)


#searchGeneral = form.Form(
    #form.Textbox("search",
        #class_="searchGeneral",
        #description="search",
        #autocomplete="off")
#)
