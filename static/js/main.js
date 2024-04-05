
if (graph.length) {var in_graph = "FROM <"+graph+">"} else {var in_graph = ""}
const wd_img = ' <img src="https://upload.wikimedia.org/wikipedia/commons/d/d2/Wikidata-logo-without-paddings.svg" style="width:20px ; padding-bottom: 5px; filter: grayscale(100%);"/>'
const geo_img = '<img src="https://www.geonames.org/img/globe.gif" style="width:20px ; padding-bottom: 5px; filter: grayscale(100%);"/>';
const viaf_img = '<img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Viaf_icon.png" style="width:20px ; padding-bottom: 5px; filter: grayscale(100%);"/>';
$(document).ready(function() {

  // loader
  $(".se-pre-con").fadeOut("slow");

	// disable submit form when pressing return
	$("input[type='text'], input[type='textarea']").on('keyup keypress', function(e) {
	  var keyCode = e.keyCode || e.which;
	  if (keyCode === 13) {
	    e.preventDefault();
	    return false;
	  }
	});

  // message after saving
  $("#save_record").on('click', function(e) {
    e.preventDefault();
    var sel = document.getElementById('res_name');

    if (sel !== undefined) {
      // when selecting the template
      if (sel && sel.value == 'None') {
        Swal.fire({ title: 'choose a template please'});
        setTimeout(function() { document.getElementById('recordForm').submit();}, 500);
      } else {
        // when creating and saving the record
        var check_mandatory = check_mandatory_fields()
        if (check_mandatory) {
          Swal.fire({ title: 'Saved!'});
          if ($('#recordForm').length) {
            var element_id = 'recordForm';
          } else {
            var element_id = 'modifyForm';
          }
          setTimeout(function() { document.getElementById(element_id).submit();}, 500);
        } 
      }
    }
    else {
      // when saving the record
      Swal.fire({ title: 'Saved!'});
      setTimeout(function() { document.getElementById('recordForm').submit();}, 500);
    };
  });

  // check templates' constraints
  $("#updateTemplate").on('click', function(e) {
    e.preventDefault();

    // make sure the primary key is mandatory 
    var primary_key = $('.disambiguate[checked="checked"');
    primary_key.parent().parent().find('input[id*="mandatory"]').attr("checked", "checked");

    // prevent mandatory fields to be hidden 
    var mandatory_fields = $('input[type="checkbox"][id*="mandatory"][checked="checked"]');
    mandatory_fields.each(function() {
      var hidden_field_checkbox = $(this).parent().parent().find('input[type="checkbox"][id*="hidden"]');
      if (hidden_field_checkbox.attr('checked') == 'checked') {
        Swal.fire({ title:"Hidden fields cannot be mandatory"});
        return false;
      }; 
    });

    // save the template in case everything is ok
    Swal.fire({ title: 'Saved!'});
    setTimeout(function() { document.getElementById('templateForm').submit();}, 500);
  });

  // disable forms
  $(".disabled").attr("disabled","disabled");

	// URL detection
  $('.info-url').each(function(element) {
     var str_text = $(this).html();
     var regex = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
     // Replace plain text links by hyperlinks
     var replaced_text = str_text.replace(regex, "<a href='$1' target='_blank'>$1</a>");
     // Echo link
     $(this).html(replaced_text);
  });

	// tooltips
	$('.tip').tooltip();

  // fields without tooltip
  $('.input_or_select').not(':has(.tip)').css("padding-left","3.2em");

  // check prior records and alert if duplicate
  checkPriorRecords('disambiguate');

	// Named Entity Recognition in long texts
  const areas = document.querySelectorAll('#recordForm textarea, #modifyForm textarea');
  var tags = document.createElement('div');
  tags.setAttribute('class','tags-nlp');
  areas.forEach(element => {  element.after(tags); nlpText(element.id); });

  // Suggest vocabularies links
  $("input[type='text'][class*=' vocabularyField ']").each(function() {
    const vocabs_link = [];
    const id = $(this).attr("id");
    var selected_vocabs = $("#"+id).attr("class").split(" ");

    selected_vocabs.forEach(function(vocab_name) {
      if (list_vocabs.includes(vocab_name)) {
        const vocab_name_clean = vocab_name.replace("-", " ");
        console.log(vocab_name);
        const vocab_url = vocab_name_clean + "," + skos_vocabs_json[vocab_name].url;
        vocabs_link.push(vocab_url);
      } 
    });

    const div = $("<div id='" + id + "__vocabsLink' class='suggested-vocabs-div'>");
    if ($(this).prev().length > 0) {
      div.insertBefore($(this).prev());
    } else {
      div.insertBefore($(this));
    }
    div.append("<span style='font-weight:100'>Check available vocabularies:</span></br>");
    
    vocabs_link.forEach(function(link) {
      const name = link.split(",")[0].toUpperCase();
      const url = link.split(",")[1];
      div.append("<a target='_blank' class='vocab_link' href='" + url + "'>" + name + "</a>");
    });
  });  

	// search WD, VIAF, my data, vocabs, years + add URLs 
  $(".main_content").on("click", "input[type='text']", function () { // make the onclick function valid for later generated inputs
		searchID = $(this).attr('id');

    // make the searchresult element available within subforms 
    const searchresult = $('#searchresult').detach();
    if ($(this).closest('.subform_section').length) {
      $(this).closest('.subform_section').prepend(searchresult);
    } else if ($(this).closest('form').length) {
      $(this).closest('form').parent().after(searchresult);
    }

		if ( $(this).hasClass('searchWikidata') ) {
			searchWD(searchID);
		};

    if ( $(this).hasClass('searchGeonames') ) {
			searchGeonames(searchID);
		};

		if ( $(this).hasClass('searchGeneral') ) {
			searchCatalogue('search');
		};

    if ( $(this).hasClass('searchLOV') ) {
			searchLOV(searchID);
		};

    if ( $(this).hasClass('urlField') ) {
			addURL(searchID);
		};

    if ( $(this).hasClass('yearField') ) {
			searchYear(searchID);
		};

    if ( $(this).hasClass('vocabularyField') ) {
			searchVocab(searchID);
		};

    if ( $(this).hasClass('multimediaField')) {
      addMultimedia(searchID);
    }

    if ( $(this).hasClass('websitePreview')) {
      addURL(searchID, iframe=true);
    }

    if ( $(this).attr('subtemplate') != undefined) {
      searchCatalogueByClass(searchID);
    }

	});

  // create preview buttons for multimedia urls (click on MMtag, i.e., MultiMediaTag)
  $(document).on('click', '.MMtag', function () {
    const element = $(this);
    // retrieve the resource url
		var url = decodeURIComponent($(this).attr("data-id"));
    if (!url.startsWith("https://") && !url.startsWith("http://")) {
      url = "https://" + url;
    }
    var mediaType = element.attr('class').replace("MMtag file_", "");
    console.log(mediaType)
    // create a modal preview
    if (mediaType == "image") {
      var modal = $("<div class='modal-previewMM'><span class='previewTitle'>This is a preview of your multimedia file:<br><a href='"+url+"'>"+url+"</a></span><span class='closePreview'></span><img src='" + url + "'></div>");
    } else if (mediaType =="video") {
      var modal = $("<div class='modal-previewMM'><span class='previewTitle'>This is a preview of your multimedia file:<br><a href='"+url+"'>"+url+"</a></span><span class='closePreview'></span><video controls name='media'><source src='" + url + "'></video></div>");
    } else if (mediaType == 'audio') {
      var modal = $("<div class='modal-previewMM'><span class='previewTitle'>This is a preview of your multimedia file:<br><a href='"+url+"'>"+url+"</a></span><span class='closePreview'></span><audio controls><source src='" + url + "'></audio></div>");
    }
    element.after(modal);
    $('#showRight').hide();
    });
  
  // remove modal preview
  $(document).on('click', '.closePreview', function () {
    $(".modal-previewMM").remove();
    $('#showRight').show();
  });

	// remove tag onclick
	$(document).on('click', '.tag', function () {
		$(this).next().remove();
    if ($(this).prev().hasClass("MMtag") || $(this).prev().hasClass("iframePreview")) {
      $(this).prev().remove();
    }
    $(this).remove();

		//colorForm();
	});

	// autoresize textarea
	$('textarea').each(function () {
		this.setAttribute('style', 'height:' + (this.scrollHeight)/2 + 'px;overflow-y:hidden;');
	}).on('input', function () {
		this.style.height = 'auto';
		this.style.height = (this.scrollHeight) + 'px';
	});

  // remove exceding whitespaces in text area
  $('textarea[id*="values__"]').each(function () {
    $(this).val($.trim($(this).val()).replace(/\s*[\r\n]+\s*/g, '\n'));
  });

	// Show documentation in the right sidebar
	if ($('header').hasClass('needDoc')) {
		var menuRight = document.getElementById( 'cbp-spmenu-s2' ),
		showRight = document.getElementById( 'showRight' ),
		body = document.body;
		showRight.onclick = function() {
			classie.toggle( this, 'active' );
			classie.toggle( menuRight, 'cbp-spmenu-open' );
		};
	};

  // hide lookup when creating a record
  $("#lookup").hide();
	// append WD icon to input fields
	$('.searchWikidata').parent().prev().append(wd_img);
  $('.searchGeonames').parent().prev().append(geo_img);
  $('.searchWikidata').parent().prev().append(viaf_img);
  $('.wikiEntity').append(wd_img);
  $('.geoEntity').append(geo_img);
  $('.viafEntity').append(viaf_img); 
	// hide placeholder if filled
	//colorForm();

  // style mandatory fields
  $("[mandatory='True']").parent().prev(".label").append("<span class='mandatory'>*</span>")

	// prevent POST when deleting records
	$('.delete').click(function(e) {
		var result = confirm("Are you sure you want to delete this record?");
		if (result) { } else { e.preventDefault(); return false; };
	});
  // prevent POST when deleting templates
  $('.delete_template').click(function(e) {
		var result = confirm("Are you sure you want to delete the template? You will not be able to create new records with this template. Existing records using this template will not be deleted, but you will not be able to modify them.");
		if (result) { } else { e.preventDefault(); return false; };
	});

  // change select aspect everywhere
  $('section > select').addClass('custom-select');

  // sort alphabetically in EXPLORE
  $('.wrapAllparent').each(function () {
    $(this).append("<section class='accordion-group'></section>");
  });

  // hide intro message in explore section
  $(".opentab").on("click", function(el) {
    $(".intro_explore").hide();
    $("main").css("background-color","#F5F6FA");
  });

	// tooltips
	$('.tip').tooltip();



  $('.tab-content .list').each(function () {
    var letter = $('a', this).text().toUpperCase().charAt(0);
    var encoded_letter = letter;
    var data_target = this.id; // e.g. web_resource_T
    var res_id = data_target.substring(0, data_target.length - 2); // e.g. web_resource
    if (!/[A-Za-z0-9]/.test(letter)) {
      // bootstrap.min.js cannot handle non-alphanumerical characters, including %
      //→ replace them with an encoded string.
      encoded_letter = encodeURIComponent(letter).replace("%", "_");
      data_target = res_id + "_" + encoded_letter;
    } 
    if (!$(this).parent().find('[data-letter="'+ encoded_letter +'"][id="'+ data_target +'"]').length) {
      console.log("here")
      $(this).parent().append('<section data-letter="'+ encoded_letter+'" id="'+ data_target+'" class="collapse toBeWrapped '+res_id+'"></section>');
      $(this).parent().parent().find($('.alphabet')).append('<span data-toggle="collapse" data-target="#'+ data_target+'" aria-expanded="false" aria-controls="'+ encoded_letter+'" class="info_collapse" data-parent="#toc_resources_'+res_id+'">'+ letter +'</span>');
    };
    $(this).parent().find('[data-letter="'+ encoded_letter +'"]').append(this);
    $('.toBeWrapped.'+res_id).find('.accordion-group').append(this);
    $('.toBeWrapped.'+res_id).each(function() {
    if (!$(this).parent().hasClass('accordion-group')) {
      $('.toBeWrapped.'+res_id).wrapAll("<section class='accordion-group'></section>");
    }
    });

  });
  //$(".wrapAllparent").children(".toBeWrapped").wrapAll("<section class='accordion-group'></section>");
  // $('.toBeWrapped').each(function () {
  //   $(this).wrapAll("<section class='accordion-group'></section>");
  // });


  // sort alphabet list
  const alphabets = document.querySelectorAll(`[id^="alphabet"]`);
  alphabets.forEach(element => { sortList(element.id); });

  // focus on click
  $('.resource_collapse').on('click', function (e) {
      $(e.currentTarget).parent('span').addClass('active');
  });

  // close other dropdowns when opening one
  var $myGroup = $('.accordion-group');
  $('.collapse').on('show.bs.collapse', function () {
      $('.resource_collapse').parent('span').removeClass('active');
      $('.info_collapse').removeClass('alphaActive');
      $myGroup.find('.collapse').collapse('hide');
      var id = $(this).attr('id');
      var dropLabel = $('.resource_collapse[data-target="#'+id+'"]');
      dropLabel.parent('span').addClass('active');
      // in browse by name the label of the tab is different
      var alphaLabel = $('.info_collapse[data-target="#'+id+'"]');
      alphaLabel.addClass('alphaActive');
  });

  // show more in EXPLORE
  $(".showMore").hide();

  // trigger tabs in EXPLORE
  var triggerTabList = [].slice.call(document.querySelectorAll('#resource_classes_tab a'))
    triggerTabList.forEach(function (triggerEl) {
      var tabTrigger = new bootstrap.Tab(triggerEl)

      triggerEl.addEventListener('click', function (event) {
        event.preventDefault()
        tabTrigger.show()
      })
    });
  // show related resources in "term" page
  $(".showRes").on("click", {count: $(".showRes").data("count"), uri: $(".showRes").data("uri"), limit_query: $(".showRes").data("limit"), offset_query: $(".showRes").data("offset")}, searchResources);

  // sortable blocks in TEMPLATE setup
  moveUpAndDown() ;

  // remove fields from form TEMPLATE
  $(".trash").click(function(e){
     e.preventDefault();
     $(this).parent().remove();
  });

  // detect URLs in inputs - popup send to wayback machine
  detectInputWebPage("detect_web_page");

  // language tags handling
  $('[lang]').each(function() {
    modify_lang_inputs($(this));
  });

  // multiple languages final visualization
  $('.info-item [xml\\:lang]').each(function(){
    visualize_subrecord_literals($(this));
  })

  // visualize subrecords ('Subtemplate' fields)
  $('.subtemplateField').each(function() {
    visualize_subrecord($(this));
  });

  // display subtemplates ('Subtemplate' fields)
  $("[subtemplate]").each(function() {
    // get the class of the subtemplate and its fields
    var subtemplate_class = $(this).attr("subtemplate");
    var subtemplate_fields = $("[class~='("+subtemplate_class+")']");

    if ($(this).hasClass("oneValue")) {
      // merged subtemplates: hide the 'subtemplate' field then link it to its sub-fields
      $(this).parent().parent().hide();
      $(this).attr('type', 'hidden');
      var sub_tpl_id = $(this).attr('id');
      var form_id = $('.corners form').attr('id'); // either 'recordForm' or 'modifyForm'

      // define a new id (timespan) for the subrecord or retrieve the existing one
      let subform_id = '';
      var now = new Date().valueOf();
      var timespan_id = (now / 1000).toString().replace('.', '-');
      if($(this).next('span').next('.hiddenInput').length) {
        var existing_subform = $(this).next().next().val();
        subform_id = existing_subform.split(',')[0];
      } else {
        subform_id = timespan_id;
      }

      // adapt the subrecord's input fields to the defined schema
      subtemplate_fields.each(function() {
        var base_id = $(this).attr('id').split('_')[0];

        // subrecord's input fields and the main language hidden input must be like: 'inputFieldID_subrecordID'
        if (form_id === 'recordForm') {
          // modify the main language id for primary keys
          if ($(this).hasClass('disambiguate')) {
            var main_lang_input_id = base_id+'_mainLang_'+subform_id;
            $('#'+base_id+'_mainLang').attr('id', main_lang_input_id);      
            $('#'+main_lang_input_id).attr('name',main_lang_input_id);
          }
          // modify sub-fields' ids
          $(this).attr('id', $(this).attr('id')+"_"+subform_id);
          $(this).attr('name', $(this).attr('id'));
          $(this).attr('data-subform',subform_id);
        }

        // modify show_language onclick (literal input fields)
        $('#'+'languages-'+base_id).find('a').each(function() {
          var onclick_attr = $(this).attr('onclick');
          var regex = /'([^"]*)'/g;
          var original_id_extended = onclick_attr.match(regex)[0];
          var original_id = original_id_extended.substring(1, original_id_extended.length-1)
          $(this).attr('onclick', onclick_attr.replace(original_id, original_id+'_'+subform_id));
        });
      });

      // associate the 'Subtemplate' input field to its Subrecord
      var hidden_subrecord_link = $('<input type="hidden" name="'+sub_tpl_id+'-subrecords" value="'+subform_id+'"/>');
      $('#'+form_id).append(hidden_subrecord_link);

      // check if a subrecord is already associated with this 'subtemplate' field and fill the subtemplate with its data
      if(subform_id !== timespan_id) {
        $(this).next().hide();
        $(this).next().next().remove();
        var current_url = window.location.href.split("/");
        var current_action = current_url[current_url.length-1].split("-")[0]; // modify or review
        var request_url = '/'+current_action+"-"+subform_id;
        $.ajax({
          type:'GET',
          url:request_url,
          dataType:"html",
          success:function(data) {
            subtemplate_fields.each(function() {
              var subtemplate_field_id = $(this).attr('id');
              var id_root = subtemplate_field_id.split('_')[0];
              var clone_elements = $(data).find('[id^="'+id_root+'"]').parent();
              let main_lang = '';
              if (clone_elements.find('#'+id_root+'_mainLang').length) { main_lang = clone_elements.find('#'+id_root+'_mainLang').val().toUpperCase()}
              clone_elements.find('input').each(function() {
                clone_id = $(this).attr('name')+'_'+subform_id;
                $(this).attr('name', clone_id);
                $(this).attr('id', clone_id);
                $(this).addClass('subrecord-field');
                $(this).attr('data-subform', subform_id)
              });
              $(this).parent().replaceWith(clone_elements);
              clone_elements.find('[lang]').each(function() {
                modify_lang_inputs($(this));
              });
              clone_elements.parent().find('.main-lang').removeClass('main-lang');
              clone_elements.parent().find('[title="text language: '+main_lang+'"]').addClass('main-lang');
            });
          }
        });
      }
    }
    else {
      // multiple subtemplates 

      // get the class of the subtemplate and hide it, then clone each field before creating a subrecord
      subtemplate_fields.each(function() {
        // mark the original input fields to be easily recognised and retrieved when necessary
        // hide them to not be displayed in the back-end input dictionary
        $(this).addClass('original_subtemplate');
        $(this).parent().parent().hide();
      });
      // get the display name assigned to the 'Subtemplate' field and create a button for adding new subrecords
      var field_name = $(this).parent().prev().text();
      const create_btn = $("<i class='fas fa-plus-circle'></i>");
      create_btn.on('click', function() {
        create_subrecord(subtemplate_class,field_name,create_btn)
      });
      $(this).after(create_btn);
      
      // create hidden fields to store subrecords information when loading a previously created Record (only in modify/review page)
      if ($('.corners form').attr('id') === "modifyForm") {
        var subtemplate_field_id = $(this).attr('id');
        var subrecords = "";
        $('[data-input="'+subtemplate_field_id+'"').each(function() {
          subrecords+=$(this).attr('id')+";"+$(this).text()+",";
        })
        $('#modifyForm').append('<input type="hidden" name="'+subtemplate_field_id+'-subrecords" id="'+subtemplate_field_id+'-subrecords" value="'+subrecords.slice(0,-1)+'">');
      
      }
    }
  });
});

/////////////////////////
// MULTIPLE LANGUAGES ///
/////////////////////////
function modify_lang_inputs(el) {
  var base_id = $(el).attr('id').split('_')[0];
  const label_section = $(el).parent().prev();

  // check if it's first of type
  if ($(el).is('[lang]:first-of-type')) {
    if (!($(el).hasClass('subrecord-field'))) {
      var new_id = base_id+"_"+$(el).attr('lang');
      $(el).attr('name',new_id);
      $(el).attr('id',new_id);
      var lang = $(el).attr('lang').toUpperCase();
      const languages_list = $('<div id="languages-'+base_id+'"><i class="fas fa-globe" aria-hidden="true" onclick="language_form(this)"></i></div>');
      const first_lang = $('<a class="lang-item selected-lang" title="text language: '+lang+'" onclick="show_lang(\''+new_id+'\')">'+lang+'</a>');

      // primary keys: specify main language
      if ($(el).hasClass('disambiguate')) {
        if ($('#'+base_id+'_mainLang').length == 0) {
          const hidden_main_lang = $('<input type="hidden" id="'+base_id+'_mainLang" name="'+base_id+'_mainLang" value="'+$(el).attr('lang')+'"/>')
          $(el).after(hidden_main_lang);
          first_lang.addClass('main-lang');
        } else if ($('#'+base_id+'_mainLang').val() === $(el).attr('lang')) {
          first_lang.addClass('main-lang');
        }
      }
      languages_list.append(first_lang);
      label_section.append(languages_list);
    }
  } 
  else {
    // language tags handling: other lang (only in modify and review)
    const main_lang = $('#'+base_id+'_mainLang').val();
    var lang = $(el).attr('lang');
    const languages_list = $('#languages-'+base_id);
    const other_lang = $('<a class="lang-item" title="text language: '+lang.toUpperCase()+'" onclick="show_lang(\''+$(el).attr('id')+'\')">'+lang.toUpperCase()+'</a>');
    if ($(el).hasClass('disambiguate') && lang===main_lang) {
      other_lang.addClass('main-lang');
    }
    $(el).hide();
    languages_list.append(other_lang);
    label_section.append(languages_list);
  }
}

function language_form(el) {
  if ($('#lang-form').length > 0) {
    $('#lang-form').remove()
  } else {
    var height = $(el).offset().top + 30 + "px";
    var left = $(el).offset().left - 15 +"px";
    var current_lang = $(el).parent().find('.selected-lang').text().toLowerCase();
    var input = $(el).parent().parent().next().find('textarea, input').filter(':visible');
    var field_id = input.attr('id');

    // set a variable to modify the subrecord's list of fields in case the textbox is part of a subtemplate
    var subform = $('#'+field_id).attr('data-subform');
    var modify_subform = subform ? subform : null
    

    const lang_form = $('<section id="lang-form" data-input="'+field_id+'"></section>');
    const change_language = $('<section class="form_row"><label>Change current language:</label><input type="textbox" class="custom-select" onclick="activate_filter(this)"></input><div class="language-options"></div></section>');
    const add_language = $('<section class="form_row"><label>Add another language:</label><input type="textbox" class="custom-select" placeholder="Select a new language" onclick="activate_filter(this)"><div class="language-options"></input></div></section>')
    const main_lang = $('<section class="form_row"><label>Set this primary language:</label><select class="custom-select"></select></section>');
    main_lang.find('select').on('change', function() {change_main_lang(this,modify_subform)});
    const remove_lang = $('<section class="form_row"><label>Remove current language: </label> <i class="far fa-trash-alt" onclick="remove_current_language(this,'+modify_subform+')"></i></section>');
    remove_lang.on('click', function() {remove_lang(this,modify_subform)});
    $.ajax({
      type: 'GET',
      url: "https://raw.githubusercontent.com/mattcg/language-subtag-registry/master/data/json/registry.json",
      dataType: 'json',
      success: function(data) {
        let languageObjects = [];
        // Loop through the array of objects
        for (let obj of data) {
            // Check if the object has "type": "language"
            if (obj.Type === "language" && !("Deprecated" in obj)) {
              var lang = obj.Description[0];
              var tag = obj.Subtag;

              // prepare the 'Change Language' and 'Add Language' options
              var change_select = $("<a href='#"+tag+"' lang='"+lang+"'>"+lang+" ("+tag+")</a>");
              var add_select = $("<a href='#"+tag+"' lang='"+lang+"'>"+lang+" ("+tag+")</a>");
              change_select.on("click", function() {
                change_current_language(this,modify_subform);
              });
              add_select.on("click", function() {
                console.log(modify_subform)
                add_new_language(this,modify_subform)
              });
              if (tag === current_lang) {
                change_language.find('input').attr('placeholder',lang+' ('+tag+')');
                change_select.addClass('current-lang');
                change_language.find('div').prepend(change_select);
                add_language.find('div').append(add_select);
              } else {
                change_language.find('div').append(change_select);
                add_language.find('div').append(add_select);
              }
            } 
        }
        // hide the input options and append their parent divs to #lang-form
        change_language.find('div').hide();
        add_language.find('div').hide();
        lang_form.append(change_language, add_language);

        // prepare the dropdown for selecting the main language of a primary key input field
        if (input.hasClass('disambiguate')) {
          var current_languages = $(el).parent().find('.lang-item');
          current_languages.each(function() {
            var subtag = $(this).text().toLowerCase();
            var extended_language = change_language.find('[href="#'+subtag+'"]').attr('lang');
            var lang_option = $('<option value="'+subtag+'">'+extended_language+' ('+subtag+')</option>');
            if (subtag == $(el).parent().find('.main-lang').text().toLowerCase()) {
              lang_option.attr('selected', 'selected');
            }
            main_lang.find('select').append(lang_option);
          })
          lang_form.append(main_lang);
        };

        lang_form.append(remove_lang)
        lang_form.css({'top':height, 'left':left});
        $('main').append(lang_form);
      },
      error: function(data) {
        console.log("Resource not available");
      }
    })
  }
}

function activate_filter(el){
  if ($(el).next('div').attr('style') == 'display: none;') {
    $(el).next('div').show();
    $(el).keyup(function(){
      let input_val = $(el).val();
      if (input_val !== '') {
        $(el).next('div').find('a:not([lang*="' + input_val + '"])').hide();
        $(el).next('div').find('a[lang*="' + input_val + '"]').show();
      } else {
        $(el).next('div').find('a').show();
      }
    })
  } else {
    $(el).next('div').hide();
  }
}

function add_new_language(el,record) {
  console.log(record)
  var new_lang = $(el).attr('href').replace("#","");
  var last_lang_id = $(el).parent().parent().parent().attr('data-input');
  const new_lang_input = $('#'+last_lang_id).clone();
  var new_lang_input_id = last_lang_id.split('_')[0] + "_" + new_lang;
  if (record) {new_lang_input_id += '_' + record}
  $('#languages-'+last_lang_id.split('_')[0]).find('.selected-lang').removeClass('selected-lang');
  $('#languages-'+last_lang_id.split('_')[0]).append("<a class='lang-item selected-lang' title='text language: "+new_lang.toUpperCase()+"' onclick='show_lang(\""+new_lang_input_id+"\")'>"+new_lang.toUpperCase()+"</a>");
  new_lang_input.attr('id', new_lang_input_id);
  new_lang_input.attr('name', new_lang_input_id);
  new_lang_input.attr('lang', new_lang);
  new_lang_input.val('');
  $('[id^="'+last_lang_id.split('_')[0]+'"]').hide(); 
  $('#'+last_lang_id).after(new_lang_input);
  $(el).parent().parent().parent().remove();
}

function change_current_language(el,record) {
  var new_lang = $(el).attr('href').replace("#","");
  var id = $(el).parent().parent().parent().attr('data-input');
  var current_lang = $('#languages-'+id.split('_')[0]).find('.selected-lang').eq(0);
  var current_lang_field_id =  id.split('_')[0] +"_"+current_lang.text().toLowerCase();
  if (current_lang.text().toLowerCase() !== new_lang) {
    var new_id = id.split('_')[0] + '_'  + new_lang;
    if (record) {
      new_id += '_' + record;
      current_lang_field_id += '_' + record;
      console.log(current_lang_field_id)
    }
    var title = 'text language: '+new_lang.toUpperCase();
    current_lang.attr('title',title);
    current_lang.attr('onclick','show_lang("'+new_id+'")');
    current_lang.text(new_lang.toUpperCase());
    $('#'+current_lang_field_id).attr('name',new_id);
    $('#'+current_lang_field_id).attr('id',new_id);
    $('#'+new_id).attr('lang',new_lang);
    $(el).parent().parent().parent().remove();

    // check whether this value is the primary key of a subrecord 
    $('[value*="'+id+'"]').each(function() {
      var new_value = $(this).val().replace(id,new_id);
      $(this).val(new_value);
    });
  } 
  if (current_lang.hasClass('main-lang')) {
    var main_lang_id = '#'+id.split('_')[0]+'_mainLang';
    if (record) {
      main_lang_id += '_' + record;
    }
    $(main_lang_id).val(new_lang);
  }
}

function change_main_lang(el,record) {
  var id = $(el).parent().parent().attr('data-input');
  let field_base = id.split('_')[0];
  $('#languages-'+field_base).find('.main-lang').removeClass('main-lang');
  var new_main_lang = $(el).val();
  $('#languages-'+field_base).find('[title="text language: '+new_main_lang.toUpperCase()+'"]').addClass('main-lang');
  $(el).parent().parent().remove();
  var main_lang_input_id = '#'+field_base+'_mainLang';
  if (record) {main_lang_input_id+='_'+record}
  $(main_lang_input_id).val(new_main_lang);
}

function remove_current_language(el,record) {
  var current_field = $(el).parent().parent().attr('data-input');
  let field_base = current_field.split('_')[0];
  var current_lang_tag = $('#languages-'+field_base).find('.selected-lang');
  if (current_lang_tag.next('a').length > 0) {
    current_lang_tag.next('a').addClass('selected-lang');
    var next_lang = current_lang_tag.next('a').text().toLowerCase();
    current_lang_tag.remove();
    $('#'+current_field).remove();
    console.log('#'+field_base+'_'+next_lang)
    $('#'+field_base+'_'+next_lang).show();
  } else if (current_lang_tag.prev('a').length > 0) {
    current_lang_tag.prev('a').addClass('selected-lang');
    var prev_lang = current_lang_tag.prev('a').text().toLowerCase();
    current_lang_tag.remove();
    $('#'+current_field).remove();
    var show_lang_id = '#'+field_base+'_'+prev_lang;
    if (record) {show_lang_id+='_'+record}
    $(show_lang_id).show();
  } else {
    alert('Not allowed. Change current language, instead');
  }
  $('[data-input="'+current_field+'"]').remove();
}

function show_lang(field_id) {
  let field_base = field_id.split('_')[0];
  $('[id^="'+field_base+'_"]').hide();
  $('#'+field_id).show();
  var target_lang = field_id.split('_')[1];
  $('#languages-'+field_base).find('.selected-lang').removeClass('selected-lang');
  console.log('[title="text language: '+target_lang.toUpperCase()+'"]')
  $('#languages-'+field_base).find('[title="text language: '+target_lang.toUpperCase()+'"]').addClass('selected-lang')
}

/////////////////////////
//// SUBRECORDS VIEW ////
/////////////////////////
function visualize_subrecord(el) {
  var hide = el.hasClass('oneValue');
  var subtemplate_values = el.find('p');
  subtemplate_values.each(function() {
    var externalLink = $(this).find('a').eq(0);

  if (!hide) {
    // organize subrecords as an accordion
    $(this).addClass('subtemplateValue')
    $(this).append('<span class="subtamplate"><i class="fa fa-chevron-down" aria-hidden="true"></i></span>')
    externalLink.prepend("<i class='fas fa-external-link-alt'></i>  ")

    // show and hide inner values
    $(this).bind('click', function(e){
      if (!($(e.target).parent().context.localName == "i")) {
        e.preventDefault();
        if ($(e.target).parent().is($(this))) {
          $($(e.target).parent()).find('div').eq(0).toggleClass('hidden-subrecord');
          $(e.target).parent().toggleClass('subtemplateValueOpen');
        }
      }
    })
  } else {
    $(this).parent().hide();
  }

    var calledValue = $(this);
    var calledRecord = externalLink.attr('href').replace("term", "view");
    $.ajax({
      type:'GET',
      url:calledRecord,
      dataType:"html",
      success:function(data) {
          var calledRecordData = $(data).find('.articleBox').find('.col-md-8.row').find('section');
          
          if (!hide) {
            calledRecordData.each(function() {
              var cls = $(this).attr('class');
              var new_cls = cls.replace("col-md-5", "col-md-12")
              $(this).attr('class', new_cls);
              $(this).find('.wikiEntity').append(wd_img);
              $(this).find('.geoEntity').append(geo_img);
              $(this).find('.viafEntity').append(viaf_img);
              $(this).find('[xml\\:lang]').each(function() {
                visualize_subrecord_literals($(this));
              })
            })
            calledValue.append($('<div class="hidden-subrecord"></div>').append(calledRecordData));
          } else {
            calledRecordData.find('.wikiEntity').append(wd_img);
            calledRecordData.find('.geoEntity').append(geo_img);
            calledRecordData.find('.viafEntity').append(viaf_img);
            calledRecordData.find('[xml\\:lang]').each(function() {
              visualize_subrecord_literals($(this));
            })
            calledValue.parent().after(calledRecordData)
          }

          

          var new_values = calledValue.find('.subtemplateField');
          new_values.each(function() {
            visualize_subrecord($(this));
          });

      },
      error:function() {
          console.log("Error: requested resource is not available");
      }
    })
  }); 
}

function visualize_subrecord_literals(el) {
  var lang = $(el).attr('xml:lang');
  const language_item = $('<a class="lang-item">'+lang.toUpperCase()+'</a>');
  if ($(el).prev('p').length != 1) {
    const languages_list = $('<div class="info-language"></div>');
    language_item.addClass('selected-lang');
    $(el).before(languages_list.append(language_item));
  } else {
    $(el).parent().find('.info-language').append(language_item);
    $(el).hide();
  }
  language_item.on('click', function() {
    var new_lang = $(this).text().toLowerCase();
    $(this).parent().parent().find('p').hide();
    $(this).parent().parent().find('p[xml\\:lang="'+new_lang+'"]').show();
    $(this).parent().find('.selected-lang').removeClass('selected-lang');
    $(this).addClass('selected-lang');
  });
}

//////////////
// BACKEND //
//////////////

function validateTemplateClass(form_id) {
  // validate
  var class_name = document.forms[form_id]["class_name"].value;
  var class_uri = document.forms[form_id]["class_uri"].value;
  if (class_name == "" || class_uri == "") {
    alert("Name and URI must be filled out");

    return false;
  } else {
    document.getElementById(form_id).submit();
  }
  // lookup for previous classes
  // redirect to page - modify app py to accept object in Template class

};

////////////////
// ADD RECORD //
////////////////

function colorForm() {
	$('.searchWikidata').each( function() {
		if ($(this).next('span').length > 0) {
			$(this).removeAttr('placeholder');
			$(this).parent().prev('.label').css('color','lightgrey');
			$(this).parent().prev('.label').children('img').css('opacity','0.5');
			$(this).nextAll('span').css('color','lightgrey').css('border-color','lightgrey');

			$($(this).parent().parent()).hover(function(){
				$(this).children().addClass('color_hover');
				$(this).children().children('span').addClass('color_hover').addClass('bkg_hover');
			}, function() {
				$(this).children().removeClass('color_hover');
				$(this).children().children('span').removeClass('color_hover').removeClass('bkg_hover');
			});

		} else {
			$(this).parent().prev('.label').css('color','black');
			$(this).parent().prev('.label').children('img').css('opacity','1');
			$(this).nextAll('span').css('color','black').css('border-color','black');
		};
	});

	$('.freeText').each( function() {
		if ($(this).val().length > 0) {
			$(this).parent().prev('.label').css('color','lightgrey');
			$(this).parent().prev('.label').children('img').css('opacity','0.5');
			$(this).css('color','lightgrey');
			$($(this).parent().parent()).hover(function(){
				$(this).children().addClass('color_hover');
				$(this).children().children().addClass('color_hover');
				}, function() {
					$(this).children().removeClass('color_hover');
					$(this).children().children().removeClass('color_hover');
				});
		} else {
			$(this).parent().prev('.label').css('color','black');
			$(this).parent().prev('.label').children('img').css('opacity','1');
			$(this.value).css('color','black');
		};
	});
};

// delay a function
function throttle(f, delay){
    var timer = null;
    return function(){
        var context = this, args = arguments;
        clearTimeout(timer);
        timer = window.setTimeout(function(){
            f.apply(context, args);
        },
        delay || 300);
    };
};

// search in geonames and my catalogue
function searchGeonames(searchterm) {
	// wikidata autocomplete on keyup
	$('#'+searchterm).keyup(function(e) {
	  $("#searchresult").show();
	  var q = $('#'+searchterm).val();

	  $.getJSON("http://api.geonames.org/searchJSON", {
	      q: q,
        username: "palread",
        maxRows: 10,
	      lang: "en",
	      uselang: "en",
	      format: "json",
	    },
	    function(data) {
	    	  // autocomplete positioning;
	      	var position = $('#'+searchterm).position();
	      	var leftpos = $('.subform_section').length !== 0 ? position.left-35 : position.left+15;
	      	var offset = $('#'+searchterm).offset();
    			var height = $('#'+searchterm).height();
          var top = $('.subform_section').length !== 0 ? offset.top - $('.subform_section').offset().top + height + "px" : offset.top + height + "px";
          var max_width = $('.subform_section').length !== 0 ? '90%' : '600px';
          console.log(max_width);

    			$('#searchresult').css( {
    			    'position': 'absolute',
    			    'margin-left': leftpos+'px',
    			    'top': top,
    			    'z-index':1000,
    			    'background-color': 'white',
    			    'border':'solid 1px grey',
    			    'max-width':max_width,
    			    'border-radius': '4px'
    			});
    	    $("#searchresult").empty();

  	      // catalogue lookup in case nothing is found
  	      if(!data.geonames.length){
  	      	$("#searchresult").append("<div class='wditem noresults'>No matches in Geonames... looking in the catalogue</div>");
  	      	// remove messages after 3 seconds
      			setTimeout(function(){
      			  if ($('.noresults').length > 0) {
      			    $('.noresults').remove();
      			  }
      		  }, 3000);

      			var query = "prefix bds: <http://www.bigdata.com/rdf/search#> select distinct ?s ?o ?desc "+in_graph+" where { ?s rdfs:label ?o . OPTIONAL { ?s rdfs:comment ?desc} . ?o bds:search '"+q+"*' .}"
      			var encoded = encodeURIComponent(query)
      			$.ajax({
      				    type: 'GET',
      				    url: myPublicEndpoint+'?query=' + encoded,
      				    headers: { Accept: 'application/sparql-results+json'},
      				    success: function(returnedJson) {
      				    	// $("#searchresult").empty();
                    console.log(returnedJson);
                    // if (!returnedJson.length) {
        		      	// 			// $("#searchresult").empty();
        					  //   		$("#searchresult").append("<div class='wditem noresults'>No results in Wikidata and catalogue</div>");
        		      	// 			// remove messages after 3 seconds
        						// 		  setTimeout(function(){ if ($('.noresults').length > 0) { $('.noresults').remove(); } }, 3000);
        		      	// };

        						for (i = 0; i < returnedJson.results.bindings.length; i++) {
        							var myUrl = returnedJson.results.bindings[i].s.value;
        							// exclude named graphs from results
        							if ( myUrl.substring(myUrl.length-1) != "/") {
                        var resID = myUrl.substr(myUrl.lastIndexOf('/') + 1)
                        if (returnedJson.results.bindings[i].desc !== undefined) {var desc = '- '+returnedJson.results.bindings[i].desc.value} else {var desc = ''}
        								$("#searchresult").append("<div class='wditem'><a class='blue orangeText' target='_blank' href='view-"+resID+"'><i class='fas fa-external-link-alt'></i></a> <a class='orangeText' data-id=" + returnedJson.results.bindings[i].s.value + "'>" + returnedJson.results.bindings[i].o.value + "</a> " + desc + "</div>");
        							    };
        							};

          						// add tag if the user chooses an item from the catalogue
          						$('a[data-id^="'+base+'"]').each( function() {
          					        $(this).bind('click', function(e) {
          					        	e.preventDefault();
          					        	var oldID = this.getAttribute('data-id').substr(this.getAttribute('data-id').lastIndexOf('/') + 1);
          					        	var oldLabel = $(this).text();
          					        	$('#'+searchterm).after("<span class='tag "+oldID+"' data-input='"+searchterm+"' data-id='"+oldID+"'>"+oldLabel+"</span><input type='hidden' class='hiddenInput "+oldID+"' name='"+searchterm+"-"+oldID+"' value=\" "+oldID+","+encodeURIComponent(oldLabel)+"\"/>");
          					        	$("#searchresult").hide();
          					        	$('#'+searchterm).val('');
          					        });

          					    });

      				    }
      			});
      			// end my catalogue
          };

  	      // fill the dropdown
  	      $.each(data.geonames, function(i, item) {
  	        $("#searchresult").append("<div class='wditem'><a class='blue' target='_blank' href='https://www.geonames.org/"+item.geonameId+"'><i class='fas fa-external-link-alt'></i></a> <a class='blue' data-id='" + item.geonameId + "'>" + item.name + "</a> - " + item.adminName1 + ", "+ item.countryCode+ "</div>");

            // add tag if the user chooses an item from wd
  	      	$('a[data-id="'+ item.geonameId+'"]').each( function() {
  		        $(this).bind('click', function(e) {
  		        	e.preventDefault();
  		        	$('#'+searchterm).after("<span class='tag "+item.geonameId+"' data-input='"+searchterm+"' data-id='"+item.geonameId+"'>"+item.name+"</span><input type='hidden' class='hiddenInput "+item.geonameId+"' name='"+searchterm+"-"+item.geonameId+"' value=\""+item.geonameId+","+encodeURIComponent(item.name)+"\"/>");
  		        	$("#searchresult").hide();
  		        	$('#'+searchterm).val('');
  		        	//colorForm();
  		        });

  		    });
	      });
	  	}
	  );
	});

	// if the user presses enter - create a new entity
	$('#'+searchterm).keypress(function(e) {
	    if(e.which == 13) {
	    	e.preventDefault();
	    	var now = new Date().valueOf();
  			var newID = 'MD'+now;
  			if (!$('#'+searchterm).val() == '') {
  				$('#'+searchterm).after("<span class='tag "+newID+"' data-input='"+searchterm+"' data-id='"+newID+"'>"+$('#'+searchterm).val()+"</span><input type='hidden' class='hiddenInput "+newID+"' name='"+searchterm+"-"+newID+"' value=\""+newID+","+encodeURIComponent($('#'+searchterm).val())+"\"/>");
  			};
  			$("#searchresult").hide();
  	    	$('#'+searchterm).val('');
  	    	//colorForm();
	    };
	});
};

// a function to look for catalogue's records belonging to a desired class 
function searchCatalogueByClass(searchterm) {
  // get the required class
  var resource_class = $('#'+searchterm).attr('subtemplate');

  // get an array of subrecords created within the same webpage and not saved yet:
  // they must belong to the same required class
  var yet_to_save_keys = [];
  var yet_to_save_resources = [];
  $('.disambiguate[class*="' + resource_class + '"]').each(function() {
    yet_to_save_keys.push($(this).val());
    var key_id = $(this).attr('id');
    var subrecord = $('input[type="hidden"][value*="'+key_id+'"]');
    yet_to_save_resources.push(subrecord.attr('id'));
  });
  
  // on key up look for suggestions based on the new input string
  $('#'+searchterm).keyup(function(e) {
    var useful_yet_to_save_keys = yet_to_save_keys.filter(function(value) {
      return value.toLowerCase().includes($('#'+searchterm).val().toLowerCase()) && value.trim() !== '';
    });

    // autocomplete positioning;
    var position = $('#'+searchterm).position();
    var leftpos = $('.subform_section').length !== 0 ? position.left-35 : position.left+15;
    var offset = $('#'+searchterm).offset();
    var height = $('#'+searchterm).height();
    var top = $('.subform_section').length !== 0 ? offset.top - $('.subform_section').offset().top + height + "px" : offset.top + height + "px";
    var max_width = $('.subform_section').length !== 0 ? '90%' : '600px';
    $('#searchresult').css( {
        'position': 'absolute',
        'margin-left': leftpos+'px',
        'top': top,
        'z-index':1000,
        'background-color': 'white',
        'border':'solid 1px grey',
        'max-width':max_width,
        'border-radius': '4px'
    });
	  $("#searchresult").show();

    // prepare the query
	  var query_term = $('#'+searchterm).val();
    var query = "prefix bds: <http://www.bigdata.com/rdf/search#> select distinct ?s ?o where { ?o bds:search '"+query_term+"*'. ?o bds:minRelevance '0.3'^^xsd:double . ?s rdfs:label ?o ; a <"+resource_class+"> .}"
    var encoded = encodeURIComponent(query);

    // send the query request to the catalogue
    $.ajax({
      type: 'GET',
      url: myPublicEndpoint + '?query=' + encoded, 
      headers: { Accept: 'application/sparql-results+json' },
      success: function (returnedJson) {
        $("#searchresult").empty();
        var url = myPublicEndpoint + '?query=' + encoded
        // show results
        if (!returnedJson.results.bindings.length) {
          $("#searchresult").append("<div class='wditem noresults'>No results in catalogue</div>");
          // remove messages after 3 seconds
          setTimeout(function(){ if ($('.noresults').length > 0) { $('.noresults').remove(); } }, 3000);
        } else {
          for (let i = 0; i < returnedJson.results.bindings.length; i++) {
            // get the URL and the label for each retrieved element 
            var myUrl = returnedJson.results.bindings[i].s.value;
            var resID = myUrl.substr(myUrl.lastIndexOf('/') + 1);
            $("#searchresult").append("<div class='wditem fromCatalogue'><a class='blue orangeText' target='_blank' href='view-" + resID + "'><i class='fas fa-external-link-alt'></i></a> <a class='blue orangeText' data-id='" + myUrl + "'>" + returnedJson.results.bindings[i].o.value + "</a></div>");
          }
        }

        // add tag if the user chooses an item from the catalogue
        $('a[data-id^="' + base + '"]').each(function () {
          $(this).bind('click', function (e) {
            e.preventDefault();
            var oldID = this.getAttribute('data-id').substr(this.getAttribute('data-id').lastIndexOf('/') + 1);
            var oldLabel = $(this).text();
            $('#' + searchterm).next('i').after("<span class='tag "+oldID+"' data-input='"+searchterm+"' data-id='"+oldID+"'>"+oldLabel+"</span>");
            $("#searchresult").hide();
            $('#' + searchterm).val('');
            if ($('[name="'+searchterm+'-subrecords"]').length) {
              $('[name="'+searchterm+'-subrecords"]').val($('[name="'+searchterm+'-subrecords"]').val()+","+oldID+";"+oldLabel);
            } else {
              const new_sub = $("<input type='hidden' name='"+searchterm+"-subrecords' value='"+oldID+";"+oldLabel+"'>")
              $('#recordForm').append(new_sub)
            }
          });

        });;

        // once external resources have been added, include newly created resources (yet to be saved)
        for (let j = 0; j < useful_yet_to_save_keys.length; j++) {
          var resource_id = yet_to_save_resources[j];
          var resource_name = useful_yet_to_save_keys[j];
          $('#searchresult').append("<div class='wditem'><a class='blue orangeText' target='"+resource_id+"'>"+resource_name+"</a></div>")
        }

        // add tag if the user chooses an item from yet to save resources
        $('a[target]').each(function () {
          $(this).bind('click', function (e) {
            e.preventDefault();
            var target = $(this).attr('target');
            var label = $(this).text();
            $('#' + searchterm).next('i').after("<span class='tag-subrecord "+resource_class+"' id='"+target+"-tag'>" + label + "</span><i class='far fa-edit' onclick='modify_subrecord("+target+", keep=true)'></i><i class='far fa-trash-alt' onclick='modify_subrecord("+target+", keep=false)'></i>");
            $("#searchresult").hide();
            $('#' + searchterm).val('');
            if ($('[name="'+searchterm+'-subrecords"]').length) {
              $('[name="'+searchterm+'-subrecords"]').val($('[name="'+searchterm+'-subrecords"]').val()+","+target+";"+label);
            } else {
              const new_sub = $("<input type='hidden' name='"+searchterm+"-subrecords' value='"+target+";"+label+"'>")
              $('#recordForm').append(new_sub)
            }
          });

        });
      },
      error: function (error) {
        reject(error);
      }
    });
  })
};

// a function to look through the catalogue while querying Wikidata and VIAF
function searchCatalogueIntermediate(q) {
  return new Promise(function(resolve, reject) {
    var query = "prefix bds: <http://www.bigdata.com/rdf/search#> select distinct ?s ?o "+in_graph+" where { ?o bds:search '"+q+"*'. ?o bds:minRelevance '0.3'^^xsd:double . ?s rdfs:label ?o ; a ?class .}"
    var encoded = encodeURIComponent(query);
    $.ajax({
      type: 'GET',
      url: myPublicEndpoint + '?query=' + encoded,
      headers: { Accept: 'application/sparql-results+json' },
      success: function (returnedJson) {
        // $("#searchresult").empty();
        var url = myPublicEndpoint + '?query=' + encoded
        console.log(url);
        console.log(returnedJson);
        // if (!returnedJson.length) {
        //       // $("#searchresult").empty();
        //       $("#searchresult").append("<div class='wditem noresults'>No results in Wikidata and catalogue</div>");
        //       // remove messages after 3 seconds
        //       setTimeout(function(){ if ($('.noresults').length > 0) { $('.noresults').remove(); } }, 3000);
        // };
        resolve(returnedJson.results.bindings);
      },
      error: function (error) {
        reject(error);
      }
    });
  });
}


// search in wikidata, viaf and my catalogue
function searchWD(searchterm) {
	// wikidata autocomplete on keyup
	$('#'+searchterm).keyup(function(e) {
	  $("#searchresult").show();
	  var q = $('#'+searchterm).val();

	  $.getJSON("https://www.wikidata.org/w/api.php?callback=?", {
	      search: q,
	      action: "wbsearchentities",
	      language: "en",
	      uselang: "en",
	      format: "json",
	      strictlanguage: true,
        limit: 5,
	    },
	    function(data) {
	    	  // autocomplete positioning;
	      	var position = $('#'+searchterm).position();
	      	var leftpos = $('.subform_section').length !== 0 ? position.left-35 : position.left+15;
	      	var offset = $('#'+searchterm).offset();
    			var height = $('#'+searchterm).height();
          var top = $('.subform_section').length !== 0 ? offset.top - $('.subform_section').offset().top + height + "px" : offset.top + height + "px";
          var max_width = $('.subform_section').length !== 0 ? '90%' : '600px';
          console.log(max_width);

    			$('#searchresult').css( {
    			    'position': 'absolute',
    			    'margin-left': leftpos+'px',
    			    'top': top,
    			    'z-index':1000,
    			    'background-color': 'white',
    			    'border':'solid 1px grey',
    			    'max-width':max_width,
    			    'border-radius': '4px'
    			});
    	    $("#searchresult").empty();
          
          // VIAF lookup in case nothing is found in Wikidata
          if (!data.search || !data.search.length) {
            var http = "https://viaf.org/viaf/AutoSuggest?query=" + q + "&callback=?";
            $.getJSON(http, function (viafData) {
              if (viafData.result) {
                // to avoid repetitions of the same element: $("#searchresult").find("[data-id="+item.viafid+"]").length === 0
                $.each(viafData.result, function (i, item) {
                  if ($("#searchresult").find("[data-id="+item.viafid+"]").length === 0 && $("#searchresult > .viafitem").length <5) {
                    $("#searchresult").append("<div class='viafitem'><a class='blue' target='_blank' href='http://www.viaf.org/viaf/" + item.viafid + "'>" + viaf_img + "</a> <a class='blue' data-id='" + item.viafid + "'>" + item.term + "</a> " + "</div>"); // no item.DESCRIPTION!
        
                    // add tag if the user chooses an item from viaf
                    $('a[data-id="' + item.viafid + '"]').each(function () {
                      $(this).bind('click', function (e) {
                        e.preventDefault();
                        var input_name = (searchterm.split('_').length == 2) ? searchterm.split('')[0] + item.viafid + searchterm.split('_')[1] : searchterm + '-' + item.viafid;
                        $('#' + searchterm).after("<span class='tag " + item.viafid + "' data-input='" + searchterm + "' data-id='" + item.viafid + "'>" + item.term + "</span><input type='hidden' class='hiddenInput " + item.viafid + "' name='" + input_name + "' value=\"viaf" + item.viafid + "," + encodeURIComponent(item.term) + "\"/>");
                        $("#searchresult").hide();
                        $('#' + searchterm).val('');
                        //colorForm();
                      });
                    });
                    
                  }
                });
              }
              else if ($('#' + searchterm).val().length > 0) {
                $("#searchresult").append("<div class='wditem noresults'>No matches in Wikidata and VIAF</div>");
                // remove messages after 3 seconds
                setTimeout(function () {
                  if ($('.noresults').length > 0) {
                    $('.noresults').remove();
                  }
                }, 3000);
              }
            });
          } else {
            // fill the dropdown with WD results
            $.each(data.search, function (i, item) {
              $("#searchresult").append("<div class='wditem'><a class='blue' target='_blank' href='http://www.wikidata.org/entity/" + item.title + "'>" + wd_img + "</a> <a class='blue' data-id='" + item.title + "'>" + item.label + "</a> - " + item.description + "</div>");

              // add tag if the user chooses an item from wd
              $('a[data-id="' + item.title + '"]').each(function () {
                $(this).bind('click', function (e) {
                  e.preventDefault();
                  var input_name = (searchterm.split('_').length == 2) ? searchterm.split('_')[0] + "_" + item.title + "_" + searchterm.split('_')[1] : searchterm + '_' + item.title;
                  $('#' + searchterm).after("<span class='tag " + item.title + "' data-input='" + searchterm + "' data-id='" + item.title + "'>" + item.label + "</span><input type='hidden' class='hiddenInput " + item.title + "' name='" + input_name + "' value=\"" + item.title + "," + encodeURIComponent(item.label) + "\"/>");
                  $("#searchresult").hide();
                  $('#' + searchterm).val('');
                  //colorForm();
                });
              });
            });
          }

          // look for the query term in the catalogue (regardless of VIAF and WD results)
          var cataloguePromise = searchCatalogueIntermediate(q)
          cataloguePromise.then(function(catalogueEntries) {
            $(".fromCatalogue").remove(); // to remove previously retrieved elements
            for (i = 0; i < catalogueEntries.length; i++) {
              var myUrl = catalogueEntries[i].s.value;
              console.log(catalogueEntries)
              // exclude named graphs from results
              if (myUrl.substring(myUrl.length - 1) != "/") {
                var resID = myUrl.substr(myUrl.lastIndexOf('/') + 1);
                if (catalogueEntries[i].desc !== undefined) {
                  var desc = '- ' + catalogueEntries[i].desc.value;
                } else {
                  var desc = '';
                }
                if ($("#searchresult div.wditem  a[data-id='" + catalogueEntries[i].s.value + "']").length == 0) {
                  $("#searchresult").append("<div class='wditem fromCatalogue'><a class='blue orangeText' target='_blank' href='view-" + resID + "'><i class='fas fa-external-link-alt'></i></a> <a class='blue orangeText' data-id=" + catalogueEntries[i].s.value + ">" + catalogueEntries[i].o.value + "</a> " + desc + "</div>");
                }
              }
            }
            
            // add tag if the user chooses an item from the catalogue
            $('a[data-id^="' + base + '"]').each(function () {
              $(this).bind('click', function (e) {
                e.preventDefault();
                var oldID = this.getAttribute('data-id').substr(this.getAttribute('data-id').lastIndexOf('/') + 1);
                var oldLabel = $(this).text();
                $('#' + searchterm).after("<span class='tag " + oldID + "' data-input='" + searchterm + "' data-id='" + oldID + "'>" + oldLabel + "</span><input type='hidden' class='hiddenInput " + oldID + "' name='" + searchterm + "-" + oldID + "' value=\" " + oldID + "," + encodeURIComponent(oldLabel) + "\"/>");
                $("#searchresult").hide();
                $('#' + searchterm).val('');
              });

            });
          })

          // end catalogue
          
        })
  });

	// if the user presses enter - create a new entity
	$('#'+searchterm).keypress(function(e) {
	    if(e.which == 13) {
	    	e.preventDefault();
	    	var now = new Date().valueOf();
  			var newID = 'MD'+now;
  			if (!$('#'+searchterm).val() == '') {
  				$('#'+searchterm).after("<span class='tag "+newID+"' data-input='"+searchterm+"' data-id='"+newID+"'>"+$('#'+searchterm).val()+"</span><input type='hidden' class='hiddenInput "+newID+"' name='"+searchterm+"-"+newID+"' value=\""+newID+","+encodeURIComponent($('#'+searchterm).val())+"\"/>");
  			};
  			$("#searchresult").hide();
  	    	$('#'+searchterm).val('');
  	    	//colorForm();
	    };
	});
};

// search bar menu
function searchCatalogue(searchterm) {
  $('#'+searchterm).keyup(function(e) {
    $("#searchresultmenu").show();
    var q = $('#'+searchterm).val();
    var query = "prefix bds: <http://www.bigdata.com/rdf/search#> select distinct ?s ?o "+in_graph+" where { ?o bds:search '"+q+"*'. ?o bds:minRelevance '0.3'^^xsd:double . ?s rdfs:label ?o ; a ?class .}"
    var encoded = encodeURIComponent(query)
    if (q == '') { $("#searchresultmenu").hide();}
    $.ajax({
          type: 'GET',
          url: myPublicEndpoint+'?query=' + encoded,
          headers: { Accept: 'application/sparql-results+json; charset=utf-8'},
          success: function(returnedJson) {
            $("#searchresultmenu").empty();
            // autocomplete positioning
  	      	var position = $('#'+searchterm).position();
  	      	var leftpos = position.left;
  	      	var offset = $('#'+searchterm).offset();
      			var height = $('#'+searchterm).height();
      			var width = $('#'+searchterm).width();
      			var top = offset.top + height + 14 + "px";
      			var right = offset.left + "px";

      			$('#searchresultmenu').css( {
      			    'position': 'absolute',
      			    'margin-right': leftpos+'px',
      			    'top': top,
                'left': right,
      			    'z-index':1000,
      			    'background-color': 'white',
      			    'border':'solid 1px grey',
      			    'max-width':'600px',
      			    'border-radius': '4px'
      			});
      	    $("#searchresultmenu").empty();

            if (!returnedJson.length) {
                  $("#searchresultmenu").empty();
                  var nores = "<div class='wditem noresults'>Searching...</div>";
                  $("#searchresultmenu").append(nores);
                  // remove messages after 1 second
                  setTimeout(function(){
                    if ($('.noresults').length > 0) {
                      $('.noresults').remove();
                      }
                    }, 1000);
            };

            for (i = 0; i < returnedJson.results.bindings.length; i++) {
              var myUrl = returnedJson.results.bindings[i].s.value;
              // exclude named graphs from results
              if ( myUrl.substring(myUrl.length-1) != "/") {
                var resID = myUrl.substr(myUrl.lastIndexOf('/') + 1)
                $("#searchresultmenu").append("<div class='wditem'><a class='blue orangeText' target='_blank' href='view-"+resID+"'><i class='fas fa-external-link-alt'></i> " + returnedJson.results.bindings[i].o.value + "</a></div>");
                  };
              };

          }
    });
  });
}

// search a rdf property in LOV
function searchLOV(searchterm) {
	$('#'+searchterm).off('keyup').on('keyup',function(e) {
	  var q = $('#'+searchterm).val();
    var searchres_div = $('#'+searchterm).next().attr('id');
    if (q === '') {
      $("#"+searchres_div).empty();
    } else {
      $("#"+searchres_div).show();
      $.ajax({
        type: 'GET',
        url: "https://lov.linkeddata.es/dataset/lov/api/v2/term/autocomplete?q="+q+"&type=property",
        success: function(data) {
            // autocomplete positioning
            var position = $('#'+searchterm).position();
            var leftpos =  position.left + 15 - $('#'+searchterm).parent().parent().position().left;
            var offset = $('#'+searchterm).offset();
            var height = $('#'+searchterm).height();
            var width = $('#'+searchterm).width();
            var top = offset.top + height - 294 + "px";
            var right = offset.left + width + "px";

            $('#'+searchres_div).css( {
                'position': 'absolute',
                'margin-left': leftpos+'px',
                'top': top,
                'z-index':1000,
                'background-color': 'white',
                'border':'solid 1px grey',
                'max-width':'600px',
                'border-radius': '4px'
            });
            $("#"+searchres_div).empty();

            // fill the dropdown
            $.each(data.results, function(i, item) {
              $("#"+searchres_div).append("<div class='wditem'><a href='"+item.uri+"' target='_blank' class='blue' data-id='" + item.prefixedName + "'>" + item.prefixedName + "</a> - " + item.uri + "</div>");

              // add tag if the user chooses an item from wd
              $('a[data-id="'+ item.prefixedName+'"]').each( function() {
                $(this).bind('click', function(e) {
                  e.preventDefault();
                  $("#"+searchres_div).hide();
                  $('#'+searchterm).val(item.uri);
                });

            });
          });
        }


      });
    }
	});
};

// addURL:URL value in textbox field + create iframe previews
function addURL(searchterm, iframe=false) {
  $('#'+searchterm).keypress(function(e) {    

    let regexURL = /(http|https)?(:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/;
    
    if(e.which == 13 || e.which == 44) { // 44 code for commas
      e.preventDefault();
      var now = new Date().valueOf();
      var newID = 'MD'+now;
      // check the input value against the regex
      if ($('#'+searchterm).val().length > 0 && regexURL.test($('#'+searchterm).val()) ) {
        // generate iframe if requested 
        if (iframe) {
          $('#'+searchterm).after("<span class='tag "+newID+"' data-input='"+searchterm+"' data-id='"+newID+"'>"+$('#'+searchterm).val()+"</span><input type='hidden' class='hiddenInput "+newID+"' name='"+searchterm+"-"+newID+"' value=\""+newID+","+encodeURIComponent($('#'+searchterm).val())+"\"/>");
          if (!$('#'+searchterm).val().startsWith("https://") && !$('#'+searchterm).val().startsWith("http://")) {
            var url = "https://" + $('#'+searchterm).val();
          } else {
            var url = $('#'+searchterm).val();
          }
          $('#'+searchterm).after("<iframe allow='autoplay' class='col-md-11 iframePreview' src='"+url+"' crossorigin></iframe>");
        }
        else {
          $('#'+searchterm).after("<span class='tag "+newID+"' data-input='"+searchterm+"' data-id='"+newID+"'>"+$('#'+searchterm).val()+"</span><input type='hidden' class='hiddenInput "+newID+"' name='"+searchterm+"-"+newID+"' value=\""+newID+","+encodeURIComponent($('#'+searchterm).val())+"\"/>");
        }
      }
      else if ($('#'+searchterm).val().length > 0 && !regexURL.test($('#'+searchterm).val()) ) {
        alert('Insert a valid URL');
      }
      $('#'+searchterm).val('');
        //colorForm();
    };
  });
}

// searchYear: gYear Value in Date Field
function searchYear(searchYear) {
  $('#'+searchYear).keyup(function(e) {
    // input values must be digits (47 → 58), backspace (8), enter (13)
    if ((e.which > 47 && e.which < 58) || e.which == 8 || e.which == 13) {
      $("#searchresult").show();

      var position = $('#'+searchYear).position();
      var leftpos = position.left+80;
      var offset = $('#'+searchYear).offset();
      var height = $('#'+searchYear).height();
      var width = $('#'+searchYear).width();
      var top = offset.top + height + "px";
      var right = offset.left + width + "px";

      $('#searchresult').css( {
          'position': 'absolute',
          'margin-left': leftpos+'px',
          'top': top,
          'z-index':1000,
          'background-color': 'white',
          'border':'solid 1px grey',
          'max-width':'600px',
          'border-radius': '4px',
          'max-height': '300px',
          'overflow-y': 'auto'
      });
      $("#searchresult").empty();

      let options = []; // create an empty array to be populated with the 'year' options
      let inputYearString = $('#'+searchYear).val();
      // remove 'A.C.' or 'B.C.', if present, when the user presses backspace
      if (e.which == 8 && (inputYearString.includes("A.C") || inputYearString.includes("B.C"))) {
        var expression = / [AB].C/i;
        var regex = new RegExp(expression);
        var newValue = inputYearString.replace(regex, "");
        $('#'+searchYear).val(newValue);
        inputYearString = newValue;
      }
      // generate options for numbers containing 2→4 digits
      if (inputYearString.length > 1 && inputYearString.length < 5) {
        let inputYear = parseInt(inputYearString);
        options.push(inputYearString); // suggests the input value
        if (inputYear >= 10 && inputYear < 21) { 
          // suggests numbers from 100 to 999 (two input digits requested)
          for (let i=0; i<100; i++) {
            options.push(inputYearString+parseInt(i));
          }
        } else if (inputYear >= 100 && inputYear < 206) { 
          // suggest numbers from 1000 to 2050 (three input digits requested)
          for (let i=0; i<10; i++) {
            options.push(inputYearString+parseInt(i));
          }
        }
      // generate options after one digit 'd' has been inserted (available options: 'd A.C.', 'd B.C.')
      } else if (inputYearString.length == 1) {
        options.push(inputYearString);
      } else if (inputYearString.length > 4) {
        $("#searchresult").hide();
        $('#'+searchYear).val(inputYearString.substring(0, 4));
        alert("Year out of range");
      } else {
        $("#searchresult").hide();
      }
      // add the options to a scrollable list and add a tag in case a year has been clicked
      if (inputYearString.length > 0) {
        $.each(options, function(i, item) {
          $("#searchresult").append("<div class='yearOptions'><a data-id='"+item+"B.C.'>"+item+" B.C.</a></div>")
          $("#searchresult").append("<div class='yearOptions'><a data-id='"+item+"A.C.'>"+item+" A.C.</div>")

          $('a[data-id="'+ item +'B.C."], a[data-id="'+ item +'A.C."]').each(function () {
            $(this).bind('click', function (e) {
              e.preventDefault();
              $("#searchresult").hide();
              $('#' + searchYear).val($(this).text());
            });
          });
        });
      }
    } else {
      var newlength = $('#'+searchYear).val().length - 1;
      $('#'+searchYear).val($('#'+searchYear).val().substring(0, newlength));
      alert("Only digit accepted")
    }
  })
}

// search through SKOS vocabularies
function searchVocab(searchterm) {
  /* Some JS variables have been specified in the HTML pages record.html, modify.html:
  var skos_vocabs_json = a JSON object containing all the information about each vocabulary;
  var list_vocabs = an array conatining the name of each vocabulary in the JSON object
  */
  $('#' + searchterm).keyup(function(e) {
    if ($('#' + searchterm).val().length > 1) {
      $("#searchresult").hide();
      var requests = []; // prepare an array to collect all the requests to the selected vocabs' endpoints
      var vocabs_array = []; // prepare an array to access the results returned by the query
      var skos_vocabs = $('#' + searchterm).attr('class').split(/\s+/); // SELECTED vocabs are specified as classes of the input field
      skos_vocabs.forEach(function(item) {
        if (list_vocabs.includes(item)) {
          if (skos_vocabs_json[item].type == "API") {
            // retrieve the parameters of the request to properly call the API
            var json_parameters = Object.assign({}, skos_vocabs_json[item].parameters);
            // get the keys of the parameters object: the first key (keys[0]) must be associated with the query-term (i.e., input value)
            var keys = Object.keys(json_parameters);
            json_parameters[keys[0]] = $('#' + searchterm).val() + "*"; 
            console.log(json_parameters);
            const request = $.getJSON(skos_vocabs_json[item].endpoint, json_parameters);
            requests.push(request);
            // specify how to access the results of the query
            vocabs_array.push(item);
          } else if (skos_vocabs_json[item].type == "SPARQL") {
            // the string 'QUERY-TERM' inside the query must be replaced with the input value; special charachters must be checked 
            var query = (skos_vocabs_json[item].query).replace("QUERY-TERM", ("^" + $('#' + searchterm).val())).replace("&gt;", ">").replace("&lt;", "<").replace(/&quot;/g, '"');
            var request_parameters = {
              type: 'GET',
              url: '/sparqlanything?q=' + encodeURIComponent(query)
            }
            console.log(request_parameters);
            const request = $.ajax(request_parameters);
            requests.push(request);
            // specify how to access the results of the query
            vocabs_array.push(item);
          }

        }
      });

      Promise.all(requests)
        .then(function(results) {
          const options = []; // array to include ALL the resulting terms of ALL the queries
          console.log(results); // results = ALL the resulting objects of ALL the queries
          results.forEach(function(data, index) {
            console.log(data) // the resulting object of a query
            var path = skos_vocabs_json[vocabs_array[index]].results ;
            var main_path = path.array.split(".");
            let result = data;
            main_path.forEach(key => {
              result = result[key];
            });

            result.forEach(function(res) {
              // extract a label for each term
              let label_path = path.label.split(".");
              let label = res;
              label_path.forEach(key => {
                label = label[key];
              });
              // extract the URI value for each term
              let uri_path = path.uri.split(".");
              let uri = res;
              uri_path.forEach(key => {
                uri = uri[key];
              });
              let add = uri + "," + label + "," + vocabs_array[index];
              options.push(add);
            });
          });

          $("#searchresult").show();

          // autocomplete positioning;
	      	var position = $('#'+searchterm).position();
	      	var leftpos = $('.subform_section').length !== 0 ? position.left-25 : position.left+80;
	      	var offset = $('#'+searchterm).offset();
    			var height = $('#'+searchterm).height();
          var top = $('.subform_section').length !== 0 ? offset.top - $('.subform_section').offset().top + height + "px" : offset.top + height + "px";
          var max_width = $('.subform_section').length !== 0 ? '90%' : '600px';
          console.log(max_width);

    			$('#searchresult').css( {
    			    'position': 'absolute',
    			    'margin-left': leftpos+'px',
    			    'top': top,
    			    'z-index':1000,
    			    'background-color': 'white',
    			    'border':'solid 1px grey',
    			    'max-width':max_width,
    			    'border-radius': '4px'
    			});
          $("#searchresult").empty();
          options.forEach(function(option) {
            // each option (i.e., retrieved term) has this structure: URI,LABEL,VOCABULARY
            const resource_uri = option.split(",");
            var uri = resource_uri.shift(); 
            var vocabulary = resource_uri.pop();
            var label = resource_uri.join(","); // Join is needed for labels containing ","

            // how to display the vocabulary name: e.g., 'vocab-one' → 'VOCAB ONE'
            if (vocabulary.includes("-")) {
              var vocabulary_noun = vocabulary.replace("-", " ").toUpperCase();
            } else {
              var vocabulary_noun = vocabulary.toUpperCase();
            }
            // create a list of options
            $("#searchresult").append("<div class='vocableitem'><a class='blue' data-id='"+uri+"'>"+label+"</a> - "+vocabulary_noun+"</div>")

            $('a[data-id="'+ uri +'"]').each(function () {
              $(this).bind('click', function (e) {
                e.preventDefault();
                if (!skos_vocabs.includes("oneVocableAccepted") || $('#' + searchterm).nextAll("span").length == 0) {
                  $('#' + searchterm).after("<span class='tag " + uri + "' data-input='" + searchterm + "' data-id='" + uri + "'>" + label+" - "+vocabulary_noun + "</span><input type='hidden' class='hiddenInput " + uri + "' name='" + searchterm + "-" + uri + "' value=\"" + uri + "," + label + " - " + vocabulary_noun + "\"/>");
                }
                else if (skos_vocabs.includes("oneVocableAccepted") && $('#' + searchterm).nextAll("span").length > 0) {
                  alert("Only one term is accepted!");
                }
                $("#searchresult").hide();
                $('#' + searchterm).val("");
              });
            });
          });

        })
        .catch(function(error) {
          console.error('Ajax Error:', error);
        });
    } else { $("#searchresult").hide();}
  });
}

// multiple multimedia Links 
function addMultimedia(searchterm) {
  $('#'+searchterm).keypress(function(e) {    
    let regexURL = /(http|https)?(:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z0-9]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/;
    let imageFormats = ["apng", "avif", "gif", "ico", "jpg", "jpeg", "jfif", "pjpeg", "pjp", "png", "svg", "webp"];
    let audioFormats = ["mp3", "wav", "ogg"];
    let videoFormats = ["mp4", "ogg", "webm"];
    if(e.which == 13 || e.which == 44) { // 44 code for , 
      e.preventDefault();
      var now = new Date().valueOf();
      var newID = 'MM'+now; // id for multimedia tags


      if ($('#'+searchterm).val().length > 0 && regexURL.test($('#'+searchterm).val()) ) {
        // IMAGE
        if ($('#'+searchterm).hasClass("Image") && stringEndsWith($('#'+searchterm).val(), imageFormats)) {
          $('#'+searchterm).after("<div class='multimediaTag "+newID+"'></div>");
          $('.multimediaTag.'+newID).prepend("<span class='tag "+newID+"' data-input='"+searchterm+"' data-id='"+newID+"'>"+$('#'+searchterm).val()+"</span><input type='hidden' class='hiddenInput "+newID+"' name='"+searchterm+"-"+newID+"' value=\""+newID+","+encodeURIComponent($('#'+searchterm).val())+"\"/>");
          $('.multimediaTag.'+newID).prepend("<span class='MMtag file_image' data-id='"+encodeURIComponent($('#'+searchterm).val())+"'><i class='fas fa-eye'></i></span>");
        } // AUDIO
        else if ($('#'+searchterm).hasClass("Audio") && stringEndsWith($('#'+searchterm).val(), audioFormats)) {
          $('#'+searchterm).after("<div class='multimediaTag "+newID+"'></div>");
          $('.multimediaTag.'+newID).prepend("<span class='tag "+newID+"' data-input='"+searchterm+"' data-id='"+newID+"'>"+$('#'+searchterm).val()+"</span><input type='hidden' class='hiddenInput "+newID+"' name='"+searchterm+"-"+newID+"' value=\""+newID+","+encodeURIComponent($('#'+searchterm).val())+"\"/>");
          $('.multimediaTag.'+newID).prepend("<span class='MMtag file_audio' data-id='"+encodeURIComponent($('#'+searchterm).val())+"'><i class='fas fa-eye'></i></span>");
        } // VIDEO
        else if ($('#'+searchterm).hasClass("Video") && stringEndsWith($('#'+searchterm).val(), videoFormats)) {
          $('#'+searchterm).after("<div class='multimediaTag "+newID+"'></div>");
          $('.multimediaTag.'+newID).prepend("<span class='tag "+newID+"' data-input='"+searchterm+"' data-id='"+newID+"'>"+$('#'+searchterm).val()+"</span><input type='hidden' class='hiddenInput "+newID+"' name='"+searchterm+"-"+newID+"' value=\""+newID+","+encodeURIComponent($('#'+searchterm).val())+"\"/>");
          $('.multimediaTag.'+newID).prepend("<span class='MMtag file_video' data-id='"+encodeURIComponent($('#'+searchterm).val())+"'><i class='fas fa-eye'></i></span>");
        } 
        else {
          alert('Invalid File Format');
        }
      }
      else if ($('#'+searchterm).val().length > 0 && !regexURL.test($('#'+searchterm).val()) ) {
        alert('Insert a valid URL');
      }
      $('#'+searchterm).val('');
        //colorForm();
    };
  });
}

// check whether the input url $('#'+searchterm).val() ends with a valid format
function stringEndsWith(string, formatList) {
  for (var i = 0; i < formatList.length; i++) {
    var character = formatList[i];
    if (string.endsWith(character)) {
      return true;
    }
  }
  return false;
}

// NLP
function nlpText(searchterm) {
	$('textarea#'+searchterm).keypress( throttle(function(e) {
	  	if(e.which == 13) {
	  		//$('textarea#'+searchterm).parent().parent().append('<div class="tags-nlp col-md-9"></div>');
			$(this).next('.tags-nlp').empty();
			var textNLP = $('#'+searchterm).val();
			var encoded = encodeURIComponent(textNLP)

      // call CLEF api (spacy)
      $.ajax({
			    type: 'GET',
			    url: 'nlp?q=' + encoded,
			    success: function(listTopics) {
            console.log(listTopics);
            for (var i = 0; i < listTopics.length; i++) {
              console.log("listTopics[i]",listTopics[i]);
      				// query WD for reconciliation
      				$.getJSON("https://www.wikidata.org/w/api.php?callback=?", {
      			      search: listTopics[i].result,
      			      action: "wbsearchentities",
      			      language: "en",
      			      limit: 1,
      			      uselang: "en",
      			      format: "json",
      			      strictlanguage: true,
      			    },
      			    function(data) {
                  console.log(data);
      			    	$.each(data.search, function(i, item) {
      				        $('textarea#'+searchterm).next('.tags-nlp').append('<span class="tag nlp '+item.title+'" data-input="'+searchterm+'" data-id="'+item.title+'">'+item.label+'</span><input type="hidden" class="hiddenInput '+item.title+'" name="'+searchterm+'-'+item.title+'" value="'+item.title+','+encodeURIComponent(item.label)+'"/>');
      			    	});
      			    });
      			};

            // return something or message
			    }
		    });
		};

	}) );
};

// lookup when creating new records
function checkPriorRecords(elem) {
  $('.'+elem).keyup(function(e) {
	  $("#lookup").show();
	  var q = $('.'+elem).val();
    var classes = $(this).attr('class');
    var expression =  /\(([^)]+)\)/i;
    var regex = new RegExp(expression);
    if (classes.match(regex)) {
      var res_class = ' a <'+classes.match(regex)[1]+'> ; ';
    } else {var res_class = ''};
    var query = "prefix bds: <http://www.bigdata.com/rdf/search#> select distinct ?s ?o "+in_graph+" where { ?s "+res_class+" rdfs:label ?o . ?o bds:search '"+q+"' .} LIMIT 5"
    var encoded = encodeURIComponent(query);

    $.ajax({
  	    type: 'GET',
  	    url: myPublicEndpoint+'?query=' + encoded,
  	    headers: { Accept: 'application/sparql-results+json; charset=utf-8'},
  	    success: function(returnedJson) {
  	    	$("#lookup").empty();
  			  if (!returnedJson.results.bindings.length) {
          //$("#lookup").append("<h3>We found the following resources that are similar to the one you mention.</h3>")
    			} else {
            $("#lookup").append("<div>We already have some resources that match with yours. If this is the case, consider suggesting a different resource!</div>")
            for (i = 0; i < returnedJson.results.bindings.length; i++) {

                // exclude named graphs from results
                var myUrl = returnedJson.results.bindings[i].s.value;
                if ( myUrl.substring(myUrl.length-1) != "/") {
                  var resID = myUrl.substr(myUrl.lastIndexOf('/') + 1)
                  $("#lookup").append("<div class='wditem'><a class='blue orangeText' target='_blank' href='view-"+resID+"'><i class='fas fa-external-link-alt'></i></a> <a class='orangeText' data-id=" + returnedJson.results.bindings[i].s.value + "'>" + returnedJson.results.bindings[i].o.value + "</a></div>");
                };
            };
            $("#lookup").append("<span id='close_section' class='btn btn-dark'>Ok got it!</span>")
            // close lookup suggestions
            $('#close_section').on('click', function() {
              var target = $(this).parent();
              target.hide();
            });
    			};
  	    }
  	});

  });
};

// set the webpage to display a new subform
function replace_existing_subforms() {
  if ($('.subform_section').length) {
    $('.subform_section').each(function () {
      var right_css = parseInt($(this).css('right'));
      $(this).css('right', (right_css + 30) + "%");
    });
  } else {
    $('body').after("<div class='modal-previewMM'></div>");
  }
}

// create subrecords
function create_subrecord(resource_class, field_name, el, subform_id=null ) {

  // prepare a new subrecord id 
  if (!subform_id) {
    var now = new Date().valueOf();
    subform_id = (now / 1000).toString().replace('.', '-');
  }
  var form_id = $('.corners').eq(0).find('form').eq(0).attr('id'); // either 'recordForm' or 'modifyForm'
  replace_existing_subforms();

  // prepare the new subrecord form
  const subrecord_section = $("<section class='subform_section col-md-12 col-sm-4'></section>");
  const subrecord_form = $("<section class='subform' id='"+subform_id+"-form' data-target='"+subform_id+"'></section>");
  subrecord_form.append($("<h2 class='articleTitle' style='font-size:3em'>"+field_name+"</h2>"));

  // create a clone for each input belonging to the requested (sub-)template
  $("[class~='("+resource_class+")'][class~='original_subtemplate']").each(function() {
    // CREATE A CLONE ELEMENT
    const clone_element = $(this).parent().parent().clone();
    clone_element.attr("style", "display: block"); // make it visible
    clone_element.find('input').attr('data-subform',subform_id); // associate the input field with the subrecord id
    clone_element.find('input').removeClass('original_subtemplate');
    // associate proper identifiers to input fields belonging to the subrecord form
    var input_id = clone_element.find('input:not([type="hidden"])').attr('id');
    console.log(input_id)
    clone_element.find('input:not([type="hidden"])').attr('id', input_id+"_"+subform_id.toString());
    clone_element.find('input:not([type="hidden"])').attr('name', input_id+"_"+subform_id.toString());

    // SET LITERAL INPUT FIELDS
    if (clone_element.find('[lang]').length>0) {
      var literal_input = clone_element.find('[lang]');
      var language_list_section = literal_input.parent().prev();
      language_list_section.find('a').each(function() {
        var onclick_attr = $(this).attr('onclick');
        var regex = /'([^"]*)'/g;
        var original_id_extended = onclick_attr.match(regex)[0];
        var original_id = original_id_extended.substring(1, original_id_extended.length-1)
        $(this).attr('onclick', onclick_attr.replace(original_id, original_id+'_'+subform_id));
      });
    }
    // add a main-lang hidden input in case of primary key
    if (clone_element.find('input.disambiguate').next('[type="hidden"]').length > 0) {
      var primary_key_lang_id = clone_element.find('input.disambiguate').next('[type="hidden"]').attr('id');
      clone_element.find('input[type="hidden"]').attr('id', primary_key_lang_id+"_"+subform_id.toString());
      clone_element.find('input[type="hidden"]').attr('name', primary_key_lang_id+"_"+subform_id.toString());
    }
    
    // SET SUBTEMPLATE FIELDS '+' BUTTON
    clone_element.find('[subtemplate]').each(function(){
      var subtemplate_class = $(this).attr('subtemplate');
      var field_name = $(this).parent().prev().text();
      var add_subrecord_btn = $(this).next('i');
      add_subrecord_btn.on('click', function(){
        create_subrecord(subtemplate_class,field_name,add_subrecord_btn);
      })
    })

    console.log($('[name="'+input_id+'_'+subform_id+'-subrecords"]'))

    // retrieve previously provided values in case they are available (i.e., modify subrecords):
    let clone_element_values = [];
    // a) single value 
    if ($('#'+form_id+' #'+input_id+"_"+subform_id).length >0) {
      const to_be_modified = $('#'+form_id+' #'+input_id+'_'+subform_id);
      clone_element.find('input').val(to_be_modified.val());
    } 
    // b) multiple values
    if ($('#'+form_id+' [name^="'+input_id+'_"][name$="_'+subform_id+'"]:not([name="'+input_id.split('_')[0]+'_'+subform_id+'"])').length >0) {
      var imported_values = $('#'+form_id+' [name^="'+input_id.split('_')[0]+'_"][name$="_'+subform_id+'"]:not([name="'+input_id.split('_')[0]+'_'+subform_id+'"])');
      clone_element.find('.label div a').remove();
      if ($('#'+input_id).hasClass('searchWikidata') || $('#'+input_id).hasClass('searchVocab') || $('#'+input_id).hasClass('searchGeonamaes')) {
        imported_values.each(function(){
            // imported values and URIs
            var value = $(this).val();
            var code = value.split(",")[0];
            var label = decodeURIComponent(value.split(",")[1]);
            var imported_value_span = $("<span class='tag "+code+"' data-input='"+input_id+'__'+subform_id+"' data-id='"+code+"'>"+label+"</span>");
            clone_element_values.push(imported_value_span);
            clone_element_values.push($(this));
            $(this).remove();
        });
      } else {
        imported_values.each(function(){
          // multiple-lang literal values
          clone_element_values.push($(this));
          clone_element.find('input').remove();
          if($(this).attr('lang') != undefined) {
            let lang = $(this).attr('lang');
            const new_lang_item = $('<a class="lang-item" title="text language: '+lang.toUpperCase()+'" onclick="show_lang(\''+$(this).attr('id')+'\')">'+lang+'</a>');
            clone_element.find('div').append(new_lang_item);
          } else {
            let main_lang = $(this).val();
            clone_element.find('div a[title="text language: '+main_lang.toUpperCase()+'"]').addClass('main-lang');
          }       
        });
        clone_element.find('div a').eq(0).addClass('selected-lang');
        clone_element_values[0].show();
        console.log(clone_element_values)
      }
    } 
    // c) subrecords
    if ($('[name="'+input_id+'_'+subform_id+'-subrecords"]').length>0) {
      // retrieve subrecords
      var subrecords = $('[name="'+input_id+'_'+subform_id+'-subrecords"]').val().split(',');
      console.log(subrecords)
      var subtemplate_field_id = $(this).attr('name').replace('-subrecords', '');
      console.log($('#'+subtemplate_field_id).attr('class'))
      var subrecord_cls = $('#'+subtemplate_field_id).attr('subtemplate')
      for (let i=0; i<subrecords.length;i++){
        var code = subrecords[i];
        let label = "";
        if (subrecords[i].includes(";")) {
          code = subrecords[i].split(";")[0];
          label = subrecords[i].split(";")[1];
        } else {          
          var subrecord_label_field = $('.original_subtemplate.disambiguate[class*="('+subrecord_cls+')"]');
          console.log(subrecord_label_field)
          if (subrecord_label_field.length > 0) {
            var main_lang = $('#'+subrecord_label_field.attr('id').split('_')[0] + '_mainLang_' + code).val();
            console.log('#'+subrecord_label_field.attr('id').split('_')[0] + '_mainLang_' + code)
            label = $('#'+subrecord_label_field.attr('id').split('_')[0]+'_'+main_lang+'_'+code).val();
            console.log('#'+subrecord_label_field.attr('id').split('_')[0]+'_'+main_lang+'_'+code)
            console.log(label)
          }
        }
        var subrecord_value_span = $("<span class='tag-subrecord "+subrecord_cls+"' id='"+code+"-tag'>"+label+"</span>")
        var modify_button = $('<i class="far fa-edit" onclick="modify_subrecord(`'+code+'`, keep=true)"></i>')
        var delete_button = $('<i class="far fa-trash-alt" onclick="modify_subrecord(`'+code+'`, keep=false)"></i>')
        clone_element_values.push(subrecord_value_span, modify_button, delete_button);
      }
    
    }
    clone_element.find('.input_or_select').eq(0).append(clone_element_values);
    subrecord_form.append(clone_element);
  })

  // save or cancel subrecord (buttons)
  const subrecord_buttons = $("<section class='row subform_buttons buttonsSection'></section>");
  const save_subrecord_btn = $("<input id='subrecord_save' class='btn btn-dark' style='margin-left:20px' value='Add'>");
  const cancel_subrecord_btn = $("<input id='subrecord_cancel' class='btn btn-dark' style='margin-left:20px' value='Cancel'>");

  console.log(el)
  // SAVE SUBRECORD
  save_subrecord_btn.on('click', function(e) {
    // generate a tag
    var is_valid = check_mandatory_fields(this);
    if (is_valid) {
      var label_field = subrecord_form.find('.disambiguate').eq(0);
      var label_main_lang = $('#'+label_field.attr('id').replace(label_field.attr('lang'), 'mainLang')).val();
      var tag_label = subrecord_form.find('.disambiguate[lang="'+label_main_lang+'"]').val() || (field_name + "-" + subform_id);
      
      // store all the input ids to be associated with a subrecord
      // append those inputs to the main record form to pass their values to the back-end application
      let subinputs = [];
      subrecord_form.find('input:not(.btn)').each(function() {
        $('#'+form_id).append($(this));
        $(this).hide();
        if ($(this).attr('id') !== undefined) {
          if($(this).attr('lang')!== undefined) {
            console.log($(this).attr('id').split('_')[0]+"_"+$(this).attr('id').split('_')[2]);
            subinputs.push($(this).attr('id').split('_')[0]+"_"+$(this).attr('id').split('_')[2]); // field_id + "_" + subrecord_id
          } else {
            subinputs.push($(this).attr('id'));
          }
        };
      });
      el.after("<br/><span id='"+subform_id+"-tag' class='tag-subrecord "+resource_class+"'>" + tag_label + "</span><i class='far fa-edit' onclick='modify_subrecord(\""+subform_id+"\", keep=true)'></i><i class='far fa-trash-alt' onclick='modify_subrecord(\""+subform_id+"\", keep=false)'></i>");

      // for each subtemplate field, create an hidden input value including a list of related subrecords
      // this is needed to streamline the creation of records (back-end application)
      var subrecord_base = $("[subtemplate='"+resource_class+"']").attr('id'); // the 'id' of the 'subtemplate' field (within the main record)
      var created_subrecords = $('[name="'+subrecord_base+'-subrecords"]');
      if (created_subrecords.length) {
          var to_extend_value = created_subrecords.val();
          if (!created_subrecords.val().split(',').includes(subform_id)) {
            created_subrecords.val(to_extend_value + "," + subform_id);
          }
      } else {
          const new_sub = $("<input type='hidden' name='"+$("[subtemplate='"+resource_class+"']").attr('id')+"-subrecords' value='"+subform_id+"'>");
          $('#'+form_id).append(new_sub);
      }
      // hide_subform
      cancel_subrecord(this);
    }
  });
  
  // CANCEL SUBRECORD
  cancel_subrecord_btn.on('click', function(e) {
    // hide_subform
    cancel_subrecord(this);
  });
  
  subrecord_buttons.append(cancel_subrecord_btn, save_subrecord_btn);
  subrecord_form.append(subrecord_buttons);
  subrecord_section.append(subrecord_form);
  $('.main_content').eq(0).prepend(subrecord_section); 
}

// CANCEL SUBRECORD (before adding it to #recordForm)
function cancel_subrecord(subrecord_section) {
  if ($('.subform_section').length > 1) {
    $('.subform_section').each(function () {
      var right_css = parseInt($(this).css('right'));
      $(this).css('right', 'calc('+right_css+'px -  30%)');
    });
  } else {
    $('.modal-previewMM').remove();
  }
  $('main form').append($('#searchresult'));
  $(subrecord_section).closest('.subform_section').remove();
};

// DELETE or MODIFY SUBRECORD (after it has been added to #recordForm)
function modify_subrecord(sub_id, keep) {
  console.log(sub_id);
  console.log( $('[name*="-subrecords"][value*="'+sub_id+'"'))
  var original_subtemplate_id = $('[name*="-subrecords"][value*="'+sub_id+'"').attr('name').replace("-subrecords", "");
  var original_subtemplate_class = $('#'+original_subtemplate_id).attr('subtemplate');
  console.log(original_subtemplate_class, sub_id)

  if (!keep) {
    // remove all inputs
    var subrecords_list_str = $('[name$="-subrecords"][value*='+sub_id+'"]');
    var subrecords_list_arr = subrecords_list_str.split(',');
    var idx = subrecords_list_arr.indexOf(sub_id);
    var new_list = subrecords_list_arr.splice(idx, 1);
    subrecords_list.val(new_list.join(','));
  }
  else {
    // recreate subrecord_section
    var field_name = $('#'+sub_id+'-tag').parent().prev().text();
    var el = $('#'+sub_id+'-tag').prevAll('.fa-plus-circle').first();
    console.log(el)
    create_subrecord(original_subtemplate_class,field_name,el,subform_id=sub_id);
  }
  $('#'+sub_id+'-tag').next('i').remove();
  $('#'+sub_id+'-tag').next('i').remove();
  $('#'+sub_id+'-tag').remove();
  $('#'+sub_id).remove();
}

function delete_inner_subrecord(inner_inputs) {
  for (let i = 0; i < inner_inputs.length; i++) {
    if ($("#"+inner_inputs[i]).attr('subtemplate')) {
      console.log(inner_inputs[i])
      var recursion_inputs = $("[id*="+inner_inputs[i]+"__]");
      console.log(recursion_inputs)
      if (recursion_inputs.length) {
        for (let y = 0; y < recursion_inputs.length; y++) {
          delete_inner_subrecord($(recursion_inputs[y]).val().split(","));
        }
      }
    }
    $("[id*="+inner_inputs[i]+"]").remove();
  }
}

////////////////////
// PUBLISH RECORD //
///////////////////

// spot a uri in the field and pop up the request to send to wayback machine
function detectInputWebPage(input_elem) {
  // if the element includes an input text
  var input_field = $('.'+input_elem).children("input");

  var tooltip_save = '<span class="savetheweb" \
    data-toggle="popover" \
    data-container="body"\
    data-offset="0,75%">\
    </span>';

    var tooltip_saved = '<span class="savedtheweb" \
      data-toggle="popover" \
      data-container="body"\
      data-offset="0,75%">\
      </span>';

  if (input_field.length) {
      input_field.each(function() {
        if ( !$(this).hasClass("disable_popover") ) {
          $(this).on("blur",  function() {
            var input_val = $(this).val();
            var expression = /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|^https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/gi;
            var regex = new RegExp(expression);
            if (input_val.match(regex)) {
              $(this).parent().append(tooltip_save);
              $(this).parent().append(tooltip_saved);
              $(".savetheweb").popover({
                html: true,
                title : "<h4>Need to save a source for the future?</h4>",
                content: "<p>If you have a web page that is important to you, \
                we can save it using the \
                <a target='_blank' href='https://archive.org/web/'>Wayback Machine</a></p>\
                <p>Shall we?</p>\
                <button onclick=saveTheWeb('"+input_val+"') class='btn btn-dark'>yes</button> \
                <button onclick=destroyPopover() class='btn btn-dark'>Maybe later</button>\
                <p></p>",
                placement: "bottom",
              }).popover('show');



            }
          });
        };

      });
  };
};

// destroy popovers for wayback machine
function destroyPopover(el='savetheweb') {
  $("."+el).popover('hide');

}

// call an internal api to send a post request to Wayback machine
function saveTheWeb(input_url) {
  console.log(input_url);
  $(".savetheweb").popover('hide');
  $(".savedtheweb").popover({
    html: true,
    title : "<span onclick=destroyPopover('savedtheweb')>x</span><h4>Thank you!</h4>",
    content: "<p>We sent a request to the Wayback machine.</p>",
    placement: "bottom",
  }).popover('show');

  $.ajax({
    type: 'GET',
    url: "/savetheweb-"+encodeURI(input_url),
    success: function(returnedJson) {
      console.log(returnedJson);
    }
  });


}


///////////////
// TERM PAGE //
///////////////

// search catalogue resources on click and offset
function searchResources(event) {
  var uri = event.data.uri;
  var count = event.data.count;
  var offset_query = event.data.offset_query;
  var limit_query = event.data.limit_query;

  if (offset_query == "0") {
    var query = "select distinct ?o ?label "+in_graph+" where { ?o ?p <"+uri+"> ; rdfs:label ?label . } ORDER BY ?o LIMIT "+limit_query+" "
  } else {
    var query = "select distinct ?o ?label "+in_graph+" where { ?o ?p <"+uri+"> ; rdfs:label ?label . } ORDER BY ?o OFFSET "+offset_query+" LIMIT "+limit_query+" "
  }
  var encoded = encodeURIComponent(query)
  $.ajax({
        type: 'GET',
        url: myPublicEndpoint+'?query=' + encoded,
        headers: { Accept: 'application/sparql-results+json; charset=utf-8'},
        success: function(returnedJson) {
          if (!returnedJson.results.bindings.length) {
            $(".relatedResources").append("<div class='wditem noresults'>No more resources</div>");
          } else {
            for (i = 0; i < returnedJson.results.bindings.length; i++) {
              var myUrl = returnedJson.results.bindings[i].o.value;
              // exclude named graphs from results
              if ( myUrl.substring(myUrl.length-1) != "/") {
                var resID = myUrl.substr(myUrl.lastIndexOf('/') + 1)
                var newItem = $("<div id='"+resID+"' class='wditem'><a class='blue orangeText' target='_blank' href='view-"+resID+"'><i class='fas fa-external-link-alt'></i></a> <span class='orangeText' data-id=" + returnedJson.results.bindings[i].o.value + "'>" + decodeURIComponent( unescape(returnedJson.results.bindings[i].label.value)) + "</span></div>").hide();
                $(".relatedResources").prepend(newItem);
                newItem.show('slow');
                };
              };
          };
        }
  });
  // update offset query
  var offset_query = offset_query+limit_query ;
  $(".showRes").html("show more");
  event.data.offset_query = offset_query;
  if (event.data.offset_query > count) {
    $(".showRes").hide();
    //$(".hideRes").show();
  }
};


//////////////
// EXPLORE //
//////////////

// sort alphabetically
function sortList(ul) {
  var ul = document.getElementById(ul);

  Array.from(ul.getElementsByTagName("span"))
    .sort((a, b) => a.textContent.localeCompare(b.textContent))
    .forEach(span => ul.appendChild(span));
};


// get values by property in EXPLORE page, e.g. creators
function getPropertyValue(elemID, prop, typeProp, typeField, elemClass='') {
  if (elemClass.length) {var class_restriction = "?s a <"+elemClass+"> . "} else {var class_restriction = ''};
  // TODO extend for vocabulary terms
  if ((typeProp == 'URI' || typeProp == 'Place' || typeProp == 'URL') && (typeField == 'Textbox' || typeField == 'Dropdown'|| typeField == 'Checkbox' || typeField == 'Vocab') ) {
    var query = "select distinct ?o ?oLabel (COUNT(?s) AS ?count) "+in_graph+" where { GRAPH ?g { ?s <"+prop+"> ?o. "+class_restriction+" ?o rdfs:label ?oLabel . } ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER( str(?stage) != 'not modified' ) } GROUP BY ?o ?oLabel ORDER BY DESC(?count) lcase(?oLabel)";
  } else if ((typeProp=='Date' || typeProp=='gYear' || typeProp=='gYearMonth') && typeField == 'Date')  {
    var query = "select distinct ?o (COUNT(?s) AS ?count) "+in_graph+" where { GRAPH ?g { ?s <"+prop+"> ?o. "+class_restriction+" } ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER( str(?stage) != 'not modified' ) } GROUP BY ?o ORDER BY DESC(?count) lcase(?o)";
  } else {var query = "none"};

  const len = 10;
  var encoded = encodeURIComponent(query);
  console.log(query);
  $.ajax({
        type: 'GET',
        url: myPublicEndpoint+'?query=' + encoded,
        headers: { Accept: 'application/sparql-results+json'},
        success: function(returnedJson) {
          console.log(returnedJson);
          var allresults = [];
          var results = [];
          for (i = 0; i < returnedJson.results.bindings.length; i++) {
            var res = returnedJson.results.bindings[i].o.value;
            if (typeProp != 'Date' && typeProp != 'gYear' && typeProp != 'gYearMonth') {
              var resLabel = returnedJson.results.bindings[i].oLabel.value;
              var xsdProp = false;
            } else if (typeProp == 'gYear') {
              var resLabel = parseInt(returnedJson.results.bindings[i].o.value);
              var xsdProp = typeProp;
            } else {
              var resLabel = returnedJson.results.bindings[i].o.value;
              var xsdProp = typeProp;
            }
            var count = returnedJson.results.bindings[i].count.value;
            var result = "<button onclick=getRecordsByPropValue(this,'."+elemID+"results','"+elemClass+"','"+xsdProp+"') id='"+res+"' class='queryGroup' data-property='"+prop+"' data-value='"+res+"' data-toggle='collapse' data-target='#"+elemID+"results' aria-expanded='false' aria-controls='"+elemID+"results' class='info_collapse'>"+resLabel+" ("+count+")</button>";
            if (allresults.indexOf(result) === -1) {
              allresults.push(result);
              results.push($(result).hide());
              $("#"+elemID).append($(result).hide());
            };


          };

          // show more in EXPLORE
          if (results.length > len) {
            // show first batch
            $("#"+elemID).find("button:lt("+len+")").show('smooth');
            $("#"+elemID).next(".showMore").show();

            // show more based on var len
            let counter = 1;
            $("#"+elemID).next(".showMore").on("click", function() {
              ++counter;
              var offset = counter*len;
              var limit = offset+len;
              console.log(counter, offset, limit);
              $("#"+elemID).find("button:lt("+limit+")").show('smooth');
            });

          } else if (results.length > 0 && results.length <= len) {
            $("#"+elemID).find("button:not(.showMore)").show('smooth');
          };

        } // end function

  });

};

// get records by value and property in EXPLORE
function getRecordsByPropValue(el, resElem, elemClass='', typeProp=false) {
  if (elemClass.length) {var class_restriction = "?s a <"+elemClass+"> . "} else {var class_restriction = ''};
  $(el).toggleClass("alphaActive");
  if ($(resElem).length) {$(resElem).empty();}
  var prop = $(el).data("property");
  console.log(prop);
  if (typeProp == 'false') {
    var val = $(el).data("value");
    var query = "select distinct ?s ?sLabel "+in_graph+" where { GRAPH ?g { ?s <"+prop+"> <"+val+">; rdfs:label ?sLabel . "+class_restriction+" } ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER( str(?stage) != 'not modified' ) } ORDER BY ?sLabel"
  } else {
    var val = '"'+$(el).data("value")+ '"^^xsd:'+typeProp.charAt(0).toLowerCase() + typeProp.slice(1);
    var query = "select distinct ?s ?sLabel "+in_graph+" where { GRAPH ?g { ?s <"+prop+"> "+val+"; rdfs:label ?sLabel . "+class_restriction+" } ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER( str(?stage) != 'not modified' ) } ORDER BY ?sLabel"
  }
  console.log(query);
  var encoded = encodeURIComponent(query);
  $.ajax({
        type: 'GET',
        url: myPublicEndpoint+'?query=' + encoded,
        headers: { Accept: 'application/sparql-results+json'},
        success: function(returnedJson) {
          for (i = 0; i < returnedJson.results.bindings.length; i++) {
            var res = returnedJson.results.bindings[i].s.value;
            var resID = res.substr(res.lastIndexOf('/') + 1)
            var resLabel = returnedJson.results.bindings[i].sLabel.value;
            $(resElem).append("<section><a href='view-"+resID+"'>"+resLabel+"</a></section>");
          };
        }
  });
};


//////////////
// TEMPLATE //
//////////////

// update index of fields in template page (to store the final order)
function updateindex() {
  $('.sortable .block_field').each(function(){
    var idx = $(".block_field").index(this);
    $(this).attr( "data-index", idx );
    var everyChild = this.getElementsByTagName("*");
    for (var i = 0; i< everyChild.length; i++) {
      var childid = everyChild[i].id;
      var childname = everyChild[i].name;
      if (childid != undefined) {
        if (!isNaN(+childid.charAt(0))) { everyChild[i].id = idx+'__'+childid.split(/__(.+)/)[1]}
        else {everyChild[i].id = idx+'__'+childid;}
      };
      if (childname != undefined) {
        if (!isNaN(+childname.charAt(0))) { everyChild[i].name = idx+'__'+childname.split(/__(.+)/)[1]}
        else {everyChild[i].name = idx+'__'+childname;}
      };

      if (everyChild[i].id.includes("property")) {
        searchLOV(everyChild[i].id);
      };
    };
  });
};

// move blocks up/down when clicking on arrow
function moveUpAndDown() {
  var selected=0;
  var itemlist = $('.sortable');
  var nodes = $(itemlist).children();
  var len=$(itemlist).children().length;
  // initialize index
  updateindex();

  $(".sortable .block_field").click(function(){
      selected= $(this).index();
  });

  $(".up").click(function(e){
   e.preventDefault();
   if(selected>0) {
        jQuery($(itemlist).children().eq(selected-1)).before(jQuery($(itemlist).children().eq(selected)));
        selected=selected-1;
        updateindex();
      };

  });

  $(".down").click(function(e){
     e.preventDefault();
    if(selected < len) {
        jQuery($(itemlist).children().eq(selected+1)).after(jQuery($(itemlist).children().eq(selected)));
        selected=selected+1;
        updateindex();
      };
  });


};

// if field type is selected
function is_selected(st, field) {
  if (st == field) {return "selected='selected'"} else {return ""};
};

// add new field in template
// backend_file argument is currently used to load the information about the available SKOS vocabularies
function add_field(field, res_type, backend_file=null) {
  console.log(field);
  var contents = "";
  var temp_id = Date.now().toString(); // to be replaced with label id before submitting
  console.log(temp_id)
  var field_type = "<section class='row'>\
    <label class='col-md-3'>FIELD TYPE</label>\
    <select onchange='change_fields(this)' class='col-md-8 ("+res_type+") custom-select' id='type__"+temp_id+"' name='type__"+temp_id+"'>\
      <option value='None'>Select</option>\
      <option value='Textbox' "+is_selected('Textbox',field)+">Textbox (text values or name of entities)</option>\
      <option value='Textarea' "+is_selected('Textarea',field)+">Textarea (long textual descriptions)</option>\
      <option value='Dropdown' "+is_selected('Dropdown',field)+">Dropdown (select one value from a list)</option>\
      <option value='Checkbox' "+is_selected('Checkbox',field)+">Checkbox (multiple choice)</option>\
      <option value='Date' "+is_selected('Date',field)+">Date (select a day/month/year)</option>\
      <option value='Multimedia' "+is_selected('Multimedia',field)+">Multimedia (audio, image, video)</option>\
      <option value='Vocab' "+is_selected('Vocab',field)+">Vocabulary (SKOS)</option>\
      <option value='WebsitePreview' "+is_selected('WebsitePreview',field)+">Website Preview (iframe)</option>\
      <option value='KnowledgeExtractor' "+is_selected('KnowledgeExtractor',field)+">Knowledge Extraction</option>\
      <option value='Subtemplate' "+is_selected('Subtemplate',field)+">Subtemplate</option>\
    </select>\
  </section>";

  var field_name = "<section class='row'>\
    <label class='col-md-3'>DISPLAY NAME</label>\
    <input type='text' id='label__"+temp_id+"' class='col-md-8' name='label__"+temp_id+"'/>\
  </section>";

  var field_prepend = "<section class='row'>\
    <label class='col-md-3'>DESCRIPTION <br><span class='comment'>a short explanation of the expected value</span></label>\
    <textarea id='prepend__"+temp_id+"' class='col-md-8 align-self-start' name='prepend__"+temp_id+"'></textarea>\
  </section>";

  var field_property = "<section class='row'>\
    <label class='col-md-3'>RDF PROPERTY <br><span class='comment'>start typing to get suggestions from LOV</span></label>\
    <input type='text' id='property__"+temp_id+"' class='col-md-8 searchLOV' name='property__"+temp_id+"'/>\
  <div id='searchresult'></div></section> ";

  var field_value = "<section class='row'>\
    <label class='col-md-3'>VALUE TYPE</label>\
    <select class='col-md-8 ("+res_type+") custom-select' id='value__"+temp_id+"' name='value__"+temp_id+"' onchange='add_disambiguate("+temp_id+",this)'>\
      <option value='None'>Select</option>\
      <option value='Literal'>Free text (Literal)</option>\
      <option value='URI'>Entity (URI from Wikidata, VIAF, or catalogue)</option>\
      <option value='Place'>Location (from geonames)</option>\
      <option value='URL'>URL</option>\
    </select>\
  </section>";

  var field_calendar = "<section class='row'>\
    <label class='col-md-3'>CALENDAR TYPE</label>\
    <select class='col-md-8 ("+res_type+") custom-select' id='calendar__"+temp_id+"' name='calendar__"+temp_id+"'>\
      <option value='None'>Select</option>\
      <option value='Day'>Full Date</option>\
      <option value='Month'>Month and Year</option>\
      <option value='Year'>Year</option>\
    </select>\
  </section>";

  if (backend_file != null) {
    var skos_vocabs = backend_file.split("//");
    var skos_labels = "";
    for (let i = 0; i < skos_vocabs.length; i++) {
      skos_labels = skos_labels + "<label for='vocab"+i+"__"+temp_id+"'>"+skos_vocabs[i].toUpperCase()+"<input type='checkbox' id='vocab"+i+"__"+temp_id+"' name='vocab"+i+"__"+temp_id+"' value='"+skos_vocabs[i]+"'></label></br>";
    }
  } else {
    var skos_labels = "";
  }
  var field_available_vocabularies = "<section class='row'>\
    <label class='col-md-3'>VOCABULARIES LIST</label>\
    <section class='col-md-8'>"+skos_labels+"\
    <label class='add_vocabulary_button'>ADD A NEW VOCABULARY <i class='fas fa-plus-circle' onclick='add_skos_vocab(this)'></i></label>\
    </section>\
  </section>";

  var accepted_values_vocabularies =  "<section class='row'>\
    <label class='col-md-3'>NUMBER OF VOCABLES</label>\
    <section class='col-md-8'>\
      <label for='oneVocable__"+temp_id+"'>\
        Single vocable\
        <input type='radio' id='oneVocable__"+temp_id+"' name='vocables__"+temp_id+"' value='oneVocable' checked>\
      </label><br>\
      <label for='multipleVocables__"+temp_id+"'>\
        Multiple vocables\
        <input type='radio' id='multipleVocables__"+temp_id+"' name='vocables__"+temp_id+"' value='multipleVocables'>\
      </label><br>\
    </section>\
  </section>";

  var field_multimedia = "<section class='row'>\
    <label class='col-md-3'>MULTIMEDIA TYPE</label>\
    <select class='col-md-8 ("+res_type+") custom-select' id='multimedia__"+temp_id+"' name='multimedia__"+temp_id+"'>\
      <option value='None'>Select</option>\
      <option value='Audio'>Audio</option>\
      <option value='Image'>Image</option>\
      <option value='Video'>Video</option>\
      <option value='Audio Image Video'>All</option>\
    </select>\
  </section>";

  var field_placeholder = "<section class='row'>\
    <label class='col-md-3'>PLACEHOLDER <br><span class='comment'>an example value to be shown to the user (optional)</span></label>\
    <input type='text' id='placeholder__"+temp_id+"' class='col-md-8 align-self-start' name='placeholder__"+temp_id+"'/>\
  </section>";

  var field_values = "<section class='row'>\
    <label class='col-md-3'>VALUES <br><span class='comment'>write one value per row in the form uri, label</span></label>\
    <textarea id='values__"+temp_id+"' class='col-md-8 values_area align-self-start' name='values__"+temp_id+"'></textarea>\
  </section>";

  var field_browse = "<section class='row'>\
    <label class='col-md-11 col-sm-6' for='browse__"+temp_id+"'>use this value as a filter in <em>Explore</em> page</label>\
    <input type='checkbox' id='browse__"+temp_id+"' name='browse__"+temp_id+"'>\
  </section>";
  
  var field_extractor = "<section class='row'>\
    <label class='col-md-3'>KNOWLEDGE EXTRACTOR</label>\
    <p class='col-md-8'>A Knowledge Extractor will be available during the record's creation</p>\
  </section>";

  var field_mandatory = "<section class='row'>\
    <label class='col-md-11 col-sm-6' for='mandatory__"+temp_id+"'>make this value mandatory</label>\
    <input type='checkbox' id='mandatory__"+temp_id+"' name='mandatory__"+temp_id+"'>\
  </section>";

  var field_hide = "<section class='row'>\
    <label class='col-md-11 col-sm-6' for='hidden__"+temp_id+"'>hide this field from the front-end view</label>\
    <input type='checkbox' id='hidden__"+temp_id+"' name='hidden__"+temp_id+"' onclick='hide_field(this)'>\
  </section>";

  var field_subtemplate_name = "<section class='row' style='display:none'>\
    <label class='col-md-3' for='subtemplate_name__"+temp_id+"'>TEMPLATE NAME</label>\
    <input type='text' id='subtemplate_name__"+temp_id+"' class='col-md-8 align-self-start' name='subtemplate_name__"+temp_id+"' disabled>\
  </section>";

  var field_subtemplate_class = "<section class='row' style='display:none'>\
    <label class='col-md-3' for='subtemplate_class__"+temp_id+"'>OWL CLASS</label>\
    <input type='text' id='subtemplate_class__"+temp_id+"' class='col-md-8 align-self-start' name='subtemplate_class__"+temp_id+"' disabled>\
  </section>";

  // TODO: show imported template fields
  /* var field_subtemplate_fields = "<section class='row'>\
    <label class='col-md-3' for='subtemplate_fields__"+temp_id+"'>FIELDS</label>\
    <input type='text' id='subtemplate_class__"+temp_id+"' class='col-md-8 align-self-start' name='subtemplate_class__"+temp_id+"' disabled>\
  </section>"; */

  var field_subtemplate_import = "<section class='row'>\
    <label class='col-md-3'>IMPORT A TEMPLATE</label>\
    <select class='col-md-8 ("+res_type+") custom-select' id='import_subtemplate__"+temp_id+"' name='import_subtemplate__"+temp_id+"' onchange='import_subtemplate(this)'>"+importable_templates+"</select>\
  </section>";

  var field_check_subtemplate = "<section class='row' style='display:none'>\
    <label class='col-md-3'></label>\
    <input type='button' class='("+res_type+") btn btn-dark check_subtemplate' value='Edit subtemplate' onclick='edit_subtemplate(this)'></input>\
  </section>"

  var field_cardinality = "<section class='row'>\
    <label class='col-md-3'>CARDINALITY <br><span class='comment'>expected values</span></label>\
    <section class='col-md-8'>\
      <label for='oneValue__"+temp_id+"'>\
        Merge templates\
        <input type='radio' id='oneValue__"+temp_id+"' name='cardinality__"+temp_id+"' value='oneValue' checked>\
      </label><br>\
      <label for='multipleValues__"+temp_id+"'>\
        Combine templates\
        <input type='radio' id='multipleValues__"+temp_id+"' name='cardinality__"+temp_id+"' value='multipleValues'>\
      </label><br>\
    </section>\
  </section>";

  var open_addons = "<section id='addons__"+temp_id+"'>";
  var close_addons = "</section>";
  var up_down = '<a href="#" class="up"><i class="fas fa-arrow-up"></i></a> <a href="#" class="down"><i class="fas fa-arrow-down"></i></a><a href="#" class="trash"><i class="far fa-trash-alt"></i></a>';

  contents += field_type + field_name + field_prepend + field_property + open_addons;
  if (field =='Textbox') { contents += field_value + field_placeholder + field_mandatory + field_hide; }
  else if (field =='Textarea') { contents += field_placeholder + field_mandatory + field_hide; }
  else if (field =='Date') { contents += field_calendar + field_mandatory + field_hide + field_browse ; }
  else if (field =='Vocab') { contents += field_available_vocabularies + accepted_values_vocabularies + field_placeholder + field_mandatory + field_hide + field_browse ; }
  else if (field =='Multimedia') { contents += field_multimedia + field_placeholder + field_mandatory + field_hide; }
  else if (field =='WebsitePreview') { contents += field_placeholder + field_mandatory + field_hide; }
  else if (field =='Subtemplate') { contents = field_type + field_name + field_prepend + field_property + field_subtemplate_import + field_subtemplate_name + field_subtemplate_class + field_check_subtemplate + field_cardinality + field_mandatory + field_hide + field_browse + open_addons; }
  else if (field =='KnowledgeExtractor') {
    if ($("select option:selected[value='KnowledgeExtractor']").length > 0) {
      alert("Max. 1 Knowledge Extraction field allowed");
      return;
    }
    contents = field_type + field_extractor + open_addons;
  }
  else {contents += field_values + field_mandatory + field_hide + field_browse; };
  contents += close_addons + up_down;
  $(".sortable").append("<section class='block_field'>"+contents+"</section>");
  updateindex();
  moveUpAndDown() ;

  $(".trash").click(function(e){
     e.preventDefault();
     $(this).parent().remove();
  });
};

function import_subtemplate(el) {

  var requested_template = el.value;
  var requested_name = el.options[el.selectedIndex].text;
  var name_field = $(el).parent().next().find('input').eq(0);
  var class_field = $(el).parent().next().next().find('input').eq(0);
  var edit_field = $(el).parent().next().next().next();
  $(name_field).parent().show();
  $(class_field).parent().show();
  // make fields not modifiable unless creating a new subtemplate
  name_field.attr("disabled", true); 
  class_field.attr("disabled", true);
 
  if (requested_template !== "CreateNewSubtemplate") {
    // hide new template button
    edit_field.hide();
    // import an existing template
    var encoded_template = encodeURIComponent(requested_template.replace("resource_templates/", ""));
    var url = window.location.href.split("/");
    var url_tpl = url[url.length-1];
    var url_request = '/'+url_tpl+'?template=' + encoded_template;
    $.ajax({
      type: 'GET',
      url: url_request,
      datatype: 'text',
      success: function(result_json) {
        var results = result_json.substring(1, result_json.length - 1).split(", ", 2);
        var resource_class = results[0].replaceAll("'", ""), resource_template = results[1];
        name_field.val(requested_name);
        class_field.val(resource_class);
      },
      error: function(xhr, status, error) {
        console.error("AJAX error:", error);
      }
    });
  } else {
    // create a new subtemplate
    name_field.attr("disabled", false); // re-activate disabled input fields
    class_field.attr("disabled", false); 
    name_field.focus(); // autofocus the name input field
    name_field.val(""); class_field.val(""); // make the fields empty
    edit_field.show();
  }
  
}

function edit_subtemplate(el) {
  var class_field = $(el).parent().prev().find('input').val();
  var name_field = $(el).parent().prev().prev().find('input').val();
  if (class_field==='' || name_field==='') {
    alert("Please, specify a label and a class");
  } else {
    var modified_cls = name_field.toLowerCase().replaceAll(" ", "_");
    var url = "/template-" + modified_cls;
    console.log(url);
    $.ajax({
      type: 'POST',
      url: '/welcome-1?action=createTemplate&class_uri='+encodeURIComponent(class_field)+'&class_name='+encodeURIComponent(name_field),
      success: function(data) {
        setTimeout(function() { window.open(url, "_blank") }, 500);
      }
    })
  }
}

// if value == literal add disambiguate checkbox
function add_disambiguate(temp_id, el) {
  var field_disambiguate = "<section class='row'>\
    <label class='left col-md-11 col-sm-6' for='disambiguate__"+temp_id+"'>use this value as primary label (e.g. book title)</label>\
    <input class='disambiguate' onClick='disable_other_cb(this)' type='checkbox' id='disambiguate__"+temp_id+"' name='disambiguate__"+temp_id+"'>\
    </section>";

  var field_browse = "<section class='row'>\
    <label class='col-md-11 col-sm-6' for='browse__"+temp_id+"'>use this value as a filter in <em>Explore</em> page</label>\
    <input type='checkbox' id='browse__"+temp_id+"' name='browse__"+temp_id+"'>\
  </section>";

  if (el.value == 'Literal') {
      $("input[id*='browse__"+temp_id+"']").parent().remove();
      $(el).parent().parent().append(field_disambiguate);
      updateindex();
      moveUpAndDown() ;
  } else if (el.value == 'URI' || el.value == 'URL') {
    if ($("input[id*='disambiguate__"+temp_id+"']") != undefined) {
      $("input[id*='browse__"+temp_id+"']").parent().remove();
      $("section[id*='addons__"+temp_id+"']").after(field_browse);
      $("input[id*='disambiguate__"+temp_id+"']").parent().remove();
    } else { $("section[id*='addons__"+temp_id+"']").after(field_browse); }
    if (el.value == 'URI') {
      var field_SPARQL_constraint = $("<section class='row'>\
        <label class='col-md-3'>SPARQL CONSTRAINTS <br><span class='comment'>add constraints to narrow the search query</span></label>\
        <select class='custom-select col-md-8'>\
          <option value='None'>Select a service</option>\
          <option value='WD'>Wikidata</option>\
          <option value='catalogue'>This catalogue SPARQL endpoint</option>\
        </select>\
        <textarea placeholder='SELECT Distinct' disabled='true' style='display: none;'></textarea>\
      </section>");
      field_SPARQL_constraint.find('select').on('change', function() {
        let fake_object = "";
        var selected_option = $(this).val();
        if (selected_option === 'WD') {
          fake_object = "?wd_entity"
        } 
        var field_constraints = $("<div class='col-md-12' id='yasqe'></div>")
        $(this).after(field_constraints);
        var yasqe = YASQE(document.getElementById("yasqe"), {
          sparql: {
            showQueryButton: false,
            endpoint: myPublicEndpoint,
            requestMethod: "POST" // TODO: this does not work with GET
          }
        });
        yasqe.setValue("SELECT DISTINCT * WHERE {?s ?p "+fake_object+"} LIMIT 10");
      })
      $(el).parent().next().after(field_SPARQL_constraint);
      console.log($('.yasqe_buttons'))
      $('.yasqe_buttons').remove();
    }

    updateindex();
    moveUpAndDown() ;
  } else if (el.value == 'Place') {
    $("input[id*='disambiguate__"+temp_id+"']").parent().remove();
    $("input[id*='browse__"+temp_id+"']").parent().remove();
    $("section[id*='addons__"+temp_id+"']").after(field_browse);
    updateindex();
    moveUpAndDown() ;
  }

};

// if one disambiguate is checked, disable others
function disable_other_cb(ckType) {
  var ckName = document.getElementsByClassName('disambiguate');
  var checked = document.getElementById(ckType.id);

    if (checked.checked) {
      for(var i=0; i < ckName.length; i++){
          ckName[i].checked = false;
          // if(!ckName[i].checked){ ckName[i].disabled = true; }
          // else{ ckName[i].disabled = false;}
      }
      checked.checked = true;
    }
    else {
      for(var i=0; i < ckName.length; i++){
        ckName[i].disabled = false;
      }
    }

  // make the field mandatory
  var mandatory_checkbox_id = ckType.id.replace("disambiguate", "mandatory");
  console.log(mandatory_checkbox_id)
  $('#'+mandatory_checkbox_id).prop('checked', true); 
};

// make hidden fields recognisable
function hide_field(el) { 
  var checked = document.getElementById(el.id);
  if (checked.checked == true) {
    $("#"+el.id).closest('.block_field').css('opacity', 0.6);
  } else {
    $("#"+el.id).closest('.block_field').css('opacity', 1);
  }
}

// when changing field type, change the form
function change_fields(sel) {
  var new_field_type = sel.value;
  var block_field = $(sel).parent().parent();

  var idx = sel.id;
  var preserve_data_index = idx.split("__")[0]; // get the data-index value 
  var temp_id = idx.substr(idx.lastIndexOf("__")).replace('__', '');

  var regExp = /\(([^)]+)\)/;
  var matches = regExp.exec(sel.classList.value);
  var res_type = matches[1];

  // create a new field, associate it with a variable (new_field_block), assign it the correct data-index attr
  add_field(new_field_type, res_type, available_skos_vocabularies);
  const new_field_block = $('.sortable .block_field:last-child');
  var new_field_block_idx = new_field_block.attr('data-index');
  new_field_block.attr('data-index', preserve_data_index);

  // get the sections of the substited field to preserve previously inserted values 
  // (e.g.: Display name, RDF property, etc.) based on common labels, i.e. common inputs.
  // each input field is associated with a section and a label.
  const previous_field_sections = block_field.find("> section"); 
  const previous_field_labels = previous_field_sections.map(function() {
    return $(this).find("label:first-child").text();
  }).get();
  
  // check the elements which make up the input fields of the new field:
  // in case the element (the section's label) already exists in the substituted field, reuse it
  // otherwise, keep the new input fields and associate them with the right index and identifier
  new_field_block.find("section, a, label").each(function() {
    const label = $(this).find("label:first-child").text();
    const index = previous_field_labels.indexOf(label);
    console.log(index, label);
    if (index !== -1 && index !== 0) {
      // N.B.: index = -1 means that an input field included in the original field form is not included in the new one.
      // N.B.: index = 0 refers to the <select> element to change the field. If included it would show the previous field value.
      const replacementSection = previous_field_sections.eq(index).clone();
      $(this).replaceWith(replacementSection);
    } else {
      // fix the id/name attributes of the main sections (i.e. $('section.row'))
      var new_section_id = $(this).attr('id');
      var previous_id = new_section_id.replace(new_field_block_idx, preserve_data_index);
      $(this).attr('id', previous_id);
      $(this).attr('name', previous_id);
      
      // fix the id/name attributes of nested elements
      $(this).find('[id^="' + new_field_block_idx + '__"]').each(function() {
        const newId = $(this).attr('id').replace(new_field_block_idx + '__', preserve_data_index + '__');
        if (newId.split("__").length === 3) {
          const updatedId = newId.replace(newId.split("__")[2], temp_id);
          $(this).attr('id', updatedId);
        } else {
          $(this).attr('id', newId);
        }
      });

      $(this).find('[name^="' + new_field_block_idx + '__"]').each(function() {
        const newName = $(this).attr('name').replace(new_field_block_idx + '__', preserve_data_index + '__');
        if (newName.split("__").length === 3) {
          const updatedName = newName.replace(newName.split("__")[2], temp_id);
          $(this).attr('name', updatedName);
        } else {
          $(this).attr('name', newName);
        }
      });

    }
  });

  block_field.replaceWith(new_field_block);
};

// add_SKOS_vocab: allow users to add a new SKOS vocabulabury with sparql endpoint

function add_skos_vocab(element) {
  $(element).closest('label').hide(); // remove the button "Add a new vocabulary"

  // generate the form
  var form = "<section class='row skos_vocab_generator'>\
  <label class='col-md-3'><span class='comment'>label for the new vocabulary</span></label>\
  <input type='text' id='vocabLabel' class='col-md-8' placeholder='e.g.: Example-label'></input>\
  </section>\
  <section class='row skos_vocab_generator'>\
  <label class='col-md-3'><span class='comment'>vocabulary's webpage</span></label>\
  <input type='text' id='vocabUrl' class='col-md-8' placeholder='e.g.: https://exampleSKOS.org'></input>\
  </section>\
  <section class='row skos_vocab_generator'>\
  <label class='col-md-3'><span class='comment'>SPARQL query to get a label (?label) and a uri (?uri) for each vocable</span></label>\
  <textarea id='vocabQuery' rows='5' placeholder='e.g.: select distinct ?label ?uri where' class='col-md-8'>select distinct ?label ?uri where {\n\n      ... ADD QUERY CONSTRAINTS  ...    \n\nFILTER(REGEX(?label, \"QUERY-TERM\", \"i\")) } LIMIT 100</textarea>\
  </section>\
  <section class='row skos_vocab_generator'>\
  <label class='col-md-3'><span class='comment'>SPARQL query endpoint</span></label>\
  <input type='text' id='vocabEndpoint' placeholder='e.g.: https://exampleSKOS.org/sparql#' class='col-md-8'></input>\
  </section>\
  <section class='row skos_vocab_generator'>\
  <label class='col-md-3'></label>\
  <input id='save_skos' class='btn btn-dark' style='margin-left:20px' value='Add Vocabulary' onClick='save_vocab(this)'>\
  </section>"
  $(element).closest('.row').after(form);
}

function save_vocab(element) {
  // access the section containing the list of available vocabularies
  var vocabs_section = $(element).parent().parent().children().eq(0).find(".col-md-8").eq(0);

  // extract a label, a url, a query, and an endpoint to store a new vocab
  var label = $('#vocabLabel').val();
  var url = $('#vocabUrl').val();
  var query = encodeURIComponent($('#vocabQuery').val());
  var endpoint = $('#vocabEndpoint').val();
  // combine the pieces of information together and check whether some info is missing
  var infoArray = [label, url, query, endpoint];
  var infoTogether = infoArray.join("__"); 
  if (check_input_form(infoArray)) {
    return null
  };

  // get the number of available vocabs (defined in template.html as a string)
  var i = available_skos_vocabularies.split("//").length+1;
  available_skos_vocabularies += "//" + label;
  console.log(i);
  // get the 'for' attribute of the label for the first vocab of the list (e.g.: "vocab6__1690443665556") 
  // to retrieve the id number of the field (e.g.: "1690443665556")
  var temp_id_list = vocabs_section.find("label").eq((1)).attr('for').split("__");
  var temp_id = temp_id_list[temp_id_list.length - 1];
  // get the index of the field in the template
  var idx = parseInt(vocabs_section.find("label").eq((1)).attr('id'));
  console.log(i, temp_id, idx);

  // generate a new checkbox to select the vocabulary and add it at the end of the list
  var new_voc = "<label class='newVocab' for='vocab"+i+"__"+temp_id+"'>"+label.toUpperCase()+"<input type='checkbox' id='"+idx+"__vocab"+i+"__"+temp_id+"' name='"+idx+"__vocab"+i+"__"+temp_id+"' value='"+infoTogether+"' checked></label></br>";
  var lastChild = vocabs_section.children().last();
  lastChild.prev().after(new_voc);

  // delete the form
  $('.skos_vocab_generator').remove(); 
  $('.add_vocabulary_button').show();
};

function check_input_form(input_array) {
  // check the name of the newly imported vocabulary (available_skos_vocabularies is defined in template.html)
  if (available_skos_vocabularies.toUpperCase().split("//").includes(input_array[0].toUpperCase())) {
    alert('A vocabulary named '+input_array[0]+' already exists: choose a new label');
    return true;
  } 
  // check missing information
  for (let i=0; i<input_array.length; i++) {
    if (input_array[i] == "") {
      var missing_datum = $('.skos_vocab_generator').eq(i).find('.comment').eq(0).text();
      alert('Insert a '+ missing_datum);
      return true;
    } 
  }
};



////////////////////
//// EXTRACTION ////
////////////////////

// extraction form
function extraction_form(element) {
  $('.homeheading').eq(0).attr('class', 'homeheading col-md-12 col-lg-12 col-sm-12');
  $('.homeheading.col-md-4.col-sm-4.col-lg-4').hide();
  // create a select element containing the options to perform the extraction
  var extractor = $("<section class='block_field col-md-12'>\
    <section class='row'>\
      <label class='col-md-3'>EXTRACTOR TYPE</label>\
      <select onchange='add_extractor(this)'class='col-md-8' id='extractor' name='extractor'>\
        <option value='None'>Select</option>\
        <option value='api'>API</option>\
        <option value='sparql'>SPARQL</option>\
        <option value='file'>Static File</option>\
      </select>\
    </section>\
    <section class='row extractor_1'>\
      <input id='sparql_back0' class='btn btn-dark extractor_0' style='margin-left:20px' value='Back' onClick='prev_extractor(\"block_field\", \"form_row\", true)'>\
    </section>\
  </section>");
  $(extractor).insertAfter('.import_form');
  $('.import_form').hide();
  $('.form_row').hide();
};


// create a form based on the selected option (API, SPARQL, static file)
function add_extractor(element) {
  if ($('.block_field.col-md-12').length > 0) {
    $('.block_field.col-md-12 section').not(":first").remove();
  }
  var id = extraction_number.toString(); // it will be used to create hidden inputs later
  extraction_number++; 
  var selected = $(element).find(":selected").val(); // selected option (API, SPARQL, or static file)
  console.log(selected);
  $('.extractor_1').remove(); // remove previously created forms (in case the user changes the selected option)
  if (selected == 'api') {
    var form = "<section class='row extractor_1'>\
    <label class='col-md-3'>API access point<br><span class='comment'>url of the API</span></label>\
    <input type='text' id='ApiUrl' class='col-md-8' placeholder='e.g.: https://exampleApi.org/search'></input>\
    </section>\
    <section class='row extractor_1'>\
    <label class='col-md-3'>QUERY PARAMETERS<br><span class='comment'>write one value per row in the form key, value</span></label>\
    <textarea id='ApiQuery' placeholder='query,query-term' class='col-md-8'></textarea>\
    </section>\
    <section class='row extractor_1'>\
    <label class='col-md-3'>RESULT DICTIONARY<br><span class='comment'>write one value per row in the form key, value (i.e. URI/label,path to the URI/label)</span></label>\
    <textarea id='ApiResults' placeholder='uri,json_results.results.bindings.uri\nlabel,json_results.results.bindings.label,' class='col-md-8'></textarea>\
    </section>";
  } else if (selected == 'sparql') {
    var form = "<section class='row extractor_1'>\
    <label class='col-md-3'>SPARQL endpoint<br><span class='comment'>url of the endpoint</span></label>\
    <input type='text' id='SparqlUrl' class='col-md-8' placeholder='e.g.: https://exampleSparql.org/sparql'></input>\
    </section>\
    <section class='row extractor_1'>\
    <label class='col-md-3'>QUERY<br><span class='comment'>a sparql query to be performed</span></label>\
    <textarea id='SparqlQuery' placeholder='select distinct ?uri ?label where { ... }' class='col-md-8'></textarea>\
    </section>";
  } else if (selected == 'file' || selected == 'Select') {
    var form = "<section class='row extractor_1'>\
    <label class='col-md-3'>FILE URL<br><span class='comment'>a URL to an external resource (a .json or .csv file)</span></label>\
    <input type='text' id='FileUrl' placeholder='http://externalResource.csv' class='col-md-8'></input>\
    </section>\
    <section class='row extractor_1'>\
    <label class='col-md-3'>SPARQL.ANYTHING QUERY<br><span class='comment'>a Sparql.Anything query to retrieve results</span></label>\
    <textarea id='FileQuery' placeholder='SELECT ?uri ?label WHERE {\n?uri ... \n?label ...}' class='col-md-8'></textarea>\
    </section>";
  }
  var buttons = "<section class='row extractor_1'>\
  <input id='"+selected+"_back1' class='btn btn-dark extractor_1' style='margin-left:20px' value='Back' onClick='prev_extractor(\"extractor_1\", \"form_row\", true)'>\
  <input id='"+selected+"_next1' class='btn btn-dark extractor_1' style='margin-left:20px' value='Next' onClick='next_extractor(this, "+id+", \""+selected+"\")'>\
  </section>"
  // add the new form to the webpage
  $(element).closest('.row').after(form+buttons);

  $('.extraction_documentation').show();
  $('.extraction_documentation section').hide();
  $('.extraction_documentation_'+selected).show();
}

function prev_extractor(to_hide, to_show, remove=false, id=null) {
  $('.'+to_hide).hide();
  $('.'+to_show).show();
  if (remove) {
    const button = $('.import_form').eq(0);
    if (id && $('#query_result_' + id).length>0) {
      button.find(".imported_graphs").prepend($("<li id='graph-"+id+"'><label>Extraction Graph:  <i class='fas fa-trash' onclick='delete_extractor("+id+")'></i></label><br></li>"));
      var results = JSON.parse($('#query_result_' + id).val()).results.bindings;
      for (let idx = 0; idx < results.length; idx++) {
        for (const key in results[idx]) {
          console.log(results[idx][key]);

          if (results[idx][key].type === "literal" && !results[idx][key].value.startsWith("https://") && !results[idx][key].value.startsWith("http://")) {
            var label = results[idx][key].value;
          } else if (results[idx][key].type === "uri" || results[idx][key].value.startsWith("https://") || results[idx][key].value.startsWith("http://")) {
            var uri = results[idx][key].value;
          }
        }
        button.find("#graph-" + id).append("<span class='tag' data-id='" + uri + "'>" + label + "</span><input type='hidden' name='keyword_"+id+"_"+label+"' value='"+encodeURIComponent(uri)+"'/>");
      }
    }
    $('.block_field.col-md-12').replaceWith(button);
    button.show();
    $('.homeheading').eq(0).attr('class', 'homeheading col-md-8 col-lg-8 col-sm-8');
    $('.homeheading.col-md-4.col-sm-4.col-lg-4').show();
    $('.extraction_documentation').hide();
  }  
}

function delete_extractor(id) {
  if ($('#recordForm').length >0) {
    var element_id = '#recordForm';
  } else {
    var element_id = '#modifyForm';
  }
  var hidden_input = $(element_id).find('[type="hidden"][name*="'+id+'-"]');
  hidden_input.each(function(index, item) {
      $(item).remove();
  })
  $('#graph-'+id).remove();
}

function extractor_pagination(results) {
  var length = results.length;
  var remainder = length%25;
  if (remainder > 0) {
    var total = Math.floor(length/25) + 1;
  } else {
    var total = Math.floor(length/25);
  }
  if (length > 25) {
    var hide_results = $('.extractor_2').find('tr').slice(25, length);
    hide_results.addClass('hidden-result');
  }
  var page_section = $('<section class="pagination row justify-content-md-center justify-content-lg-center extractor_2"></section>')
  for (let n=0; n<total;n++) {
    var page_n = n + 1
    var button=$('<input id="page_'+page_n+'" class="btn btn-dark extractor_2" value="'+page_n+'" onClick="change_results_page(\''+page_n+'\', \''+length+'\')">');
    page_section.append(button)
  }
  $('.block_field').append(page_section);
}

function change_results_page(page_n, length) {
  var starting_result = 25 * (parseInt(page_n)-1);
  console.log(page_n, starting_result)

  $('.extractor_2').find('tr').addClass('hidden-result');
  if (length >= starting_result+25) {
    var show_results = $('.extractor_2').find('tr').slice(starting_result, starting_result+25);
  } else {
    var show_results = $('.extractor_2').find('tr').slice(starting_result, length);
  }
  show_results.removeClass('hidden-result');
  $('.extractor_2').find('th').parent().removeClass('hidden-result');
  window.scrollTo(0, 0);
}

function call_sparqlanything(encoded, id, element_id, type) {
  console.log(encoded)
  $.ajax({
    type: 'GET',
    url: '/sparqlanything?q=' + encoded,
    success: function(result_json) {
      console.log(result_json);
      $(element_id).prepend("<input type='hidden' name='"+id+"-RESULTS' value='"+JSON.stringify(result_json)+"' id='query_result_"+id+"'>");
      var labels = result_json.head.vars;
      var result_sec = $("<section class='extractor_2'></section");
      var result_table = $('<table border="1"></table>');

      var tr = $('<tr></tr>');
      for (var i = 0; i < labels.length; i++) {
        var th = $('<th>' + labels[i] + '</th>');
        tr.append(th);
      }
      result_table.append(tr);

      for (let res_idx=0; res_idx<result_json.results.bindings.length; res_idx++){
        var result = result_json.results.bindings[res_idx];
        console.log(result)
        var result_tr = $('<tr></tr>');
        for (let i=0; i<labels.length; i++){
          var label = labels[i];
          if (result[label].value.startsWith("https://") || result[label].value.startsWith("http://")) {
            var item = "<a href='"+result[label].value+"' target='_blank'>"+result[label].value+"</a>";
          } else {
            var item = result[label].value;
          }
          var td = $('<td>' + item + '</td>')
          result_tr.append(td);
        }
        result_table.append(result_tr)
      }
      result_sec.append(result_table);
      $('.extractor_1').hide();
      $('.block_field').append(result_sec);
      if (result_json.results.bindings.length > 25) {extractor_pagination(result_json.results.bindings)};
      var buttons = "<section class='row "+type+"_form extractor_2'>\
        <input id='"+type+"_back2' class='btn btn-dark extractor_2' style='margin-left:20px' value='Back' onClick='prev_extractor(\"extractor_2\", \"extractor_1\")'>\
        <input id='"+type+"_next2' class='btn btn-dark extractor_2' style='margin-left:20px' value='Import' onClick='prev_extractor(\"extractor_2\", \"form_row\", true,\""+ id+"\")'>\
      </section>";
      $('.block_field').append(buttons);
      
    },
    error: function() {
      alert(("error: check your parameters"))
    }
  });
}

function string_to_json(input_string) {
  const rows = input_string.split('\n');
  const json_output = {};
  
  for (const row of rows) {
    const [key, val] = row.split(',');
    const k = key.trim();
    const v = val.trim();
    json_output[k] = v;
  }
  
  return json_output
}

function next_extractor(element, id, type) {
  if ($('#recordForm').length >0) {
    var element_id = '#recordForm';
  } else {
    var element_id = '#modifyForm';
  }

  const object_item = {};
  if (type == "api") {
    object_item["-TYPE"] = "api";
    object_item["-URL"] = $('#ApiUrl').val();
    object_item["-QUERY"] = $('#ApiQuery').val().replace(/"/g, '\\"');
    object_item["-RESULTS"] = $('#ApiResults').val();
  } else if (type == "sparql") {
    object_item["-TYPE"] = "sparql";
    object_item["-URL"] = $('#SparqlUrl').val();
    object_item["-QUERY"] = $('#SparqlQuery').val();
  } else if (type == "file") {
    object_item["-TYPE"] = "file";
    object_item["-URL"] = $('#FileUrl').val();
    object_item["-QUERY"] = $('#FileQuery').val();
  }
  console.log(object_item, type)
  Object.entries(object_item).forEach(([key, value]) => {
    $(element_id).prepend("<input type='hidden' name='"+id+key+"' value='"+value+"'/>");
  });

  if (type == "api") {
    var json_query = string_to_json(object_item["-QUERY"]);
    $.getJSON(object_item["-URL"], json_query,
	    function(data) {

        var json_results = string_to_json(object_item["-RESULTS"])
        var main_path = json_results.array.split(".");
        let results_array = data;
        main_path.forEach(key => {
          results_array = results_array[key];
        });
        
        var result_sec = $("<section class='extractor_2'></section");
        var result_table = $('<table border="1"><tr><th>LABEL</th><th>URI</th></tr></table>');
        const bindings = [];
        results_array.forEach(function(res) {
          // extract a label for each term
          let label_path = json_results.label.split(".");
          let label = res;
          label_path.forEach(key => {
            label = label[key];
          });
          // extract the URI value for each term
          let uri_path = json_results.uri.split(".");
          let uri = res;
          uri_path.forEach(key => {
            uri = uri[key];
          });
          
          // create a variable to store all the relevant information about each term
          var result_tr = $('<tr><td>' + label + '</td><td>' + uri + '</td></tr>');
          result_table.append(result_tr)

          bindings.push({"uri": {'value':uri, 'type':'uri'}, 'label': {'value':label, 'type':'literal'}})
        });
        const json_output = {'results': {'bindings': bindings}};
        result_sec.append(result_table);


        $('.extractor_1').hide();
        $('.block_field').append(result_sec);
        var handling_list = "<section class='row extractor_2'>\
        <input id='api_back2' class='btn btn-dark extractor_2' style='margin-left:20px' value='Back' onClick='prev_extractor(\"extractor_2\", \"extractor_1\")'>\
        <input id='api_next2' class='btn btn-dark extractor_2' style='margin-left:20px' value='Import' onClick='prev_extractor(\"extractor_2\", \"form_row\", true,\""+ id+"\")'>\
        </section>";
        $('.block_field').append(handling_list);
      }).error(function(jqXHR, textStatus, errorThrown) {
         alert(("error: " + jqXHR.responseText))
      })

  } else if (type == "file") {

    if (object_item["-QUERY"].includes("<x-sparql-anything:"+object_item["-URL"]+">") && object_item["-QUERY"].includes("SERVICE")) {
      call_sparqlanything(encodeURIComponent(object_item["-QUERY"]), id, element_id, type);
    } else {
      call_sparqlanything(encodeURIComponent(object_item["-QUERY"].replace("{", "{ SERVICE <x-sparql-anything:"+object_item["-URL"]+"> {").replace("}", "}}")), id, element_id, type);
    }
  } else if (type == "sparql") {
    if (object_item["-QUERY"].includes("SERVICE")) {
      call_sparqlanything(encodeURIComponent(object_item["-QUERY"]), id, element_id, type);
    } else {
      call_sparqlanything(encodeURIComponent(object_item["-QUERY"].replace("{", "{ SERVICE <"+object_item["-URL"]+"> {").replace("}", "}}")), id, element_id, type);
    }
  }
}


// TODO: bring it to the right position within this file
function check_mandatory_fields(subrecord_btn=false){
  var is_valid = true;
  
  if (subrecord_btn) { var fields = $(subrecord_btn).parent().parent().find('[mandatory="True"]'); } else { var fields = $('[mandatory="True"]:not(.original_subtemplate)'); }
  fields.each(function() {
    if ($(this).val() === '' && !$('[data-input="'+$(this).attr('id')+'"]').length) {
      console.log($(this));
      /* in principle, the header could be changed through the back-end application. 
      However, this would cause the loss of all inserted values. */
      if (subrecord_btn) { alert("Check Mandatory Fields!")}
      else { $('header').find('h3').eq(0).text("The form is not valid, please check mandatory fields") }
      window.scrollTo(0, 0);
      is_valid = false;
    }
  })
  return is_valid;
}