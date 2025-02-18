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

def get_form(json_form, from_dict=False, supertemplate=False, processed_templates=[]):
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
	res_class = ";  ".join(res_class[0]) if len(res_class) > 0 else "none"
	processed_templates.append(json_form)

	for field in fields:
		if 'hidden' in field and field['hidden'] == 'False': # do not include hidden fields
			# all
			myid = field['id']
			description = field['label'] if 'label' in field and len(field['label']) > 0 else 'input'
			pre_a = '<span class="tip" data-toggle="tooltip" data-placement="bottom" title="'
			pre_b = '"><i class="fas fa-info-circle"></i></span>'
			prepend = pre_a+html.escape(field['prepend'])+pre_b if 'prepend' in field and len(field['prepend']) > 0 else ''
			classes = field['class'] if 'class' in field and len(field['class']) > 0 else ''
			if 'skos' in field:
				for vocabulary in field['skos']:
					classes = classes + " " + vocabulary
			classes = classes+' searchWikidata' if 'searchWikidata' in field and field['searchWikidata'] == 'True' else classes
			classes = classes+' searchOrcid' if 'searchOrcid' in field and field['searchOrcid'] == 'True' else classes
			classes = classes+' searchGeonames' if 'searchGeonames' in field and field['searchGeonames'] == 'True' else classes
			classes = classes+' searchSkos' if 'searchSkos' in field and field['searchSkos'] == 'True' else classes
			classes = classes+' wikidataConstraint' if 'wikidataConstraint' in field else classes
			classes = classes+' catalogueConstraint' if 'catalogueConstraint' in field else classes
			classes = classes+' urlField' if 'url' in field and field['url'] == 'True' else classes
			classes = classes+' disambiguate' if "disambiguate" in field and field["disambiguate"] == 'True' else classes
			classes = classes+' multimediaField '+ field['multimedia'] if field['type'] == 'Multimedia' else classes
			classes = classes+' vocabularyField' if field['type'] == 'Skos' else classes
			classes = classes+' oneVocableAccepted' if 'vocables' in field and field['vocables'] == 'oneVocable' else classes
			classes = classes+' websitePreview' if field['type'] == 'WebsitePreview' else classes
			classes = classes+' disabled' if 'disabled' in field and field['disabled'] == "True" else classes
			classes = classes+' '+field['cardinality'] if 'cardinality' in field else classes
			classes = classes+' '+field['dataReuse'] if 'dataReuse' in field else classes
			classes = classes+' original-template'
			autocomplete = field['cache_autocomplete'] if 'cache_autocomplete' in field and len(field['cache_autocomplete']) > 0 else ''
			rdf_property = field['property'] if 'property' in field else ''
			mandatory = field['mandatory'] if 'mandatory' in field and field['mandatory'] == 'True' else 'False'
			# subclass restriction
			subclass_restriction = " ".join(field['restricted']) if 'restricted' in field and field['restricted'] != "None" else ''
			is_subclass_field = 'True' if field['type'] == 'Subclass' else ''

			# text box
			placeholder = field['placeholder'] if 'placeholder' in field else None
			default = field['defaultvalue'] if 'defaultvalue' in field else ''
			# dropdown
			dropdown_values = [(k,v) for k,v in field['values'].items()] if 'values' in field else None
			# subtemplate
			data_supertemplate = 'True' if supertemplate else 'None'


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
					lang=conf.mainLang,
					data_property = rdf_property,
					data_mandatory = mandatory,
					data_class=res_class,
					data_subclass=subclass_restriction,
					data_supertemplate=data_supertemplate) , )
				else:
					params = params + (form.Textbox(myid,
					type='text',
					description = description,
					id=myid,
					placeholder=placeholder,
					pre = prepend,
					class_= classes,
					value=default,
					lang=conf.mainLang,
					data_property = rdf_property,
					data_mandatory = mandatory,
					data_class=res_class,
					data_subclass=subclass_restriction,
					data_supertemplate=data_supertemplate), )

			# Entities, SKOS thesauri, links
			if field['type'] in ['Skos', 'WebsitePreview'] or (field['type'] == 'Textbox' and field['value'] in ['URL', 'URI', 'Place', 'Researcher']):
				params = params + (form.Textbox(myid,
					description = description,
					id=myid,
					placeholder=placeholder,
					pre = prepend,
					class_= classes,
					value=default,
					data_property = rdf_property,
					data_mandatory = mandatory,
					data_class=res_class,
					data_subclass=subclass_restriction,
					data_supertemplate=data_supertemplate), )
				
			# Multimedia Link
			if field['type'] == 'Multimedia':
				params = params + (form.Textbox(myid,
				description = description,
				id=myid,
				placeholder=placeholder,
				pre = prepend,
				class_= classes,
				value=default,
				data_property = rdf_property,
				data_mandatory = mandatory,
				data_class=res_class,
				data_subclass=subclass_restriction,
				data_supertemplate=data_supertemplate) , )

			# Text box
			if field['type'] == 'Textarea':
				params = params + (form.Textarea(myid,
				description = description,
				id=myid,
				placeholder=placeholder,
				pre = prepend,
				class_= classes,
				value=default,
				lang=conf.mainLang,
				data_property = rdf_property,
				data_mandatory = mandatory,
				data_class=res_class,
				data_subclass=subclass_restriction,
				data_supertemplate=data_supertemplate), )

			if field['type'] == 'Date':
				if field['calendar'] == 'Month':
					params = params + (Month(myid,
					description = description,
					id=myid,
					pre = prepend,
					class_= classes,
					data_property = rdf_property,
					data_mandatory = mandatory,
					data_class=res_class,
					data_subclass=subclass_restriction,
					data_supertemplate=data_supertemplate), )
				elif field['calendar'] == 'Day':
					params = params + (form.Date(myid,
					description = description,
					id=myid,
					pre = prepend,
					class_= classes,
					data_property = rdf_property,
					data_mandatory = mandatory,
					data_class=res_class,
					data_subclass=subclass_restriction,
					data_supertemplate=data_supertemplate), )
				elif field['calendar'] == 'Year':
					params = params + (form.Textbox(myid,
					description = description,
					id=myid,
					pre = prepend,
					class_= classes,
					value=default,
					data_property = rdf_property,
					data_mandatory = mandatory,
					data_class=res_class,
					data_subclass=subclass_restriction,
					data_supertemplate=data_supertemplate), )

			if field['type'] == 'Dropdown':
				params = params + (form.Dropdown(myid,
				description = description,
				args=dropdown_values,
				placeholder=placeholder,
				id=myid,
				pre = prepend,
				class_= classes,
				data_property = rdf_property,
				data_mandatory = mandatory,
				data_class=res_class,
				data_subclass=subclass_restriction,
				data_supertemplate=data_supertemplate), )

			if field['type'] in ['Checkbox', 'Subclass']:
				prepend_title = '<section class="checkbox_group_label label col-12">'+prepend+"\n"+'<span class="title">'+description+'</span></section>'
				i = 0
				params = params + (form.Checkbox(myid+'-'+str(i),
				value=dropdown_values[0][0]+','+dropdown_values[0][1],
				description = dropdown_values[0][1],
				id=myid,
				pre = prepend_title,
				class_= classes+' checkbox_group',
				checked=False,
				data_property = rdf_property,
				data_mandatory = mandatory,
				data_class=res_class,
				data_subclassck = is_subclass_field,
				data_subclass=subclass_restriction,
				data_supertemplate=data_supertemplate), )

				for value in dropdown_values[1:]:
					i += 1
					params = params + (form.Checkbox(myid+'-'+str(i),
					value=value[0]+','+value[1],
					description = value[1],
					id=myid,
					pre = '',
					class_= classes+' checkbox_group following_checkbox',
					checked=False,
					data_property = rdf_property,
					data_mandatory = mandatory,
					data_class=res_class,
					data_subclassck = is_subclass_field,
					data_subclass=subclass_restriction,
					data_supertemplate=data_supertemplate), )

			# Subtemplate
			if field['type'] == 'Subtemplate':
				dropdown_templates = []
				for imported_template in field['import_subtemplate']:
					template_dict = next(t for t in tpl_list if t["template"] == imported_template)
					resource_class = template_dict['type']
					resource_class_string = ";  ".join(resource_class)
					resource_name = template_dict['name']
					dropdown_templates.append((resource_class_string,resource_name))
					params = params + get_form(imported_template, supertemplate=True, processed_templates=processed_templates) if imported_template not in processed_templates else params
				params = params + (form.Dropdown(myid,
				description = description,
				args=dropdown_templates,
				placeholder=placeholder,
				id=myid,
				pre = prepend,
				class_= classes,
				data_property = rdf_property,
				data_mandatory = mandatory,
				data_class=res_class,
				data_subclass=subclass_restriction,
				data_subtemplate=myid,
				data_supertemplate=data_supertemplate), )

	if supertemplate:
		return params
	else: 
		myform = form.Form(*params)
		return myform


searchRecord = form.Form(
	form.Textbox("search",
    	class_="searchWikidata col-md-12",
    	description="Search",
    	autocomplete="off")
)


#searchGeneral = form.Form(
    #form.Textbox("search",
        #class_="searchGeneral",
        #description="search",
        #autocomplete="off")
#)
