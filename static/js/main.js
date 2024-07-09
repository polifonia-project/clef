
if (graph.length) {var inGraph = "FROM <"+graph+">"} else {var inGraph = ""}
const wdImg = '<img src="https://upload.wikimedia.org/wikipedia/commons/d/d2/Wikidata-logo-without-paddings.svg"/>'
const wdImgIcon = '<img src="https://upload.wikimedia.org/wikipedia/commons/d/d2/Wikidata-logo-without-paddings.svg" style="max-width:25px"/>'
const geoImg = '<img src="https://www.geonames.org/img/globe.gif"/ style="max-width:30px">';
const viafImg = '<img src="https://upload.wikimedia.org/wikipedia/commons/0/01/VIAF_icon.svg"/>';
const viafImgIcon = '<img src="https://upload.wikimedia.org/wikipedia/commons/0/01/VIAF_icon.svg" style="max-width:18px"/>'
const wikidataEndpoint = "https://query.wikidata.org/sparql"
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

  // create a new TEMPLATE
  $("#selectTemplateClassButton").on('click', function() {
    // show modal
    $("#selectTemplateClassModal").toggleClass('open-modal');
    $('body').append($("<div class='modal-bg'>"));
  });

  /* check class_name */
  $("#selectTemplateClass [name='class_name']").on('click', function() {
    // show error message in case a name is already in use
    var templatesNames = templatesObject.map(obj => obj.name.toLowerCase());
    $(this).off('keyup').on('keyup', function() {
      $(this).removeClass('error-input');
      $(this).next('.error-message').remove();
      var val = $(this).val();
      if (templatesNames.includes(val.toLowerCase())) {
        $(this).addClass('error-input');
        $(this).after($('<span class="error-message"><i class="fas fa-exclamation-triangle"></i>This name is already in use. Try a new one</span>'))
      } 
    })
    
  });

  /* check class_uri */
  $("#selectTemplateClass [name='class_uri']").on('click', function() {
    $(this).off('keyup').on('keyup', function(e) {
      if (e.which == 13 && $(this).val().length > 0) {
        var id = new Date().valueOf().toString();
        $(this).next('section').append("<span class='tag'>"+$(this).val()+"</span><input type='hidden' class='hiddenInput' name='uri_class-"+id+"' value=\""+encodeURIComponent($(this).val())+"\"/>");
        $(this).val('')
      } 
    })
  });

  /* remove template creation modal */
  $("#selectTemplateClass [value='cancelTemplate'], #selectTemplateClass .fa-times").on('click', function(e) {
    e.preventDefault();
    $("#selectTemplateClassModal").toggleClass('open-modal');
    $("body div.modal-bg").remove();
    return false;
  });

  /* save new template */
  $("#selectTemplateClass [value='createTemplate']").on('click', function(e) {
    e.preventDefault();
    validateTemplateClass();
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
        var check_mandatory = checkMandatoryFields()
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

  // table of contents 
  $('section.label.col-12').each(function() {
    var section = $(this);
    var itemTitle = $(this).text();
    var listItem = $("<li>"+itemTitle+"</li>");
    listItem.on('click', function() {
      $('html, body').animate({
        scrollTop: section.parent().offset().top - 100
      }, 800);
    })
    $('.fields-list').append(listItem); 
  })

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
  areas.forEach(element => {  element.after(tags); });

  // Textbox > URL: suggestion
  const textboxURL = document.querySelectorAll('#recordForm input.urlField, #modifyForm input.urlField, #recordForm input.multimediaField, #modifyForm input.multimediaField, #recordForm input.websitePreview, #modifyForm input.websitePreview, #recordForm input.searchWikidata, #modifyForm input.searchWikidata');
  textboxURL.forEach(element => {
    var suggestionTags = document.createElement('div');
    suggestionTags.setAttribute('class','tags-url');
    const parent = element.parentNode;
    if (element.className.includes('multimediaField')) {
      const previousURLS = Array.from(parent.querySelectorAll('.multimediaTag'));
      previousURLS.forEach(tag => {
        tag.remove();
        suggestionTags.appendChild(tag);
      });
    } else {
      const previousURLS = Array.from(parent.querySelectorAll('span.tag, input.hiddenInput'));
      previousURLS.forEach(tag => {
        tag.remove();
        suggestionTags.appendChild(tag);
      });
    };
    element.after(suggestionTags.cloneNode(true));
  });

  // Suggest vocabularies links
  $("input[type='text'].searchSkos").each(function() {
    let vocabs_link = [];
    var id = $(this).attr("id");

    // check which SKOS vocabularies have been associated with the input field
    if (id in query_templates) {
      var selected_vocabs = query_templates[id];
      selected_vocabs.forEach(function(obj, idx) {
        var vocab_name = Object.keys(obj)[0]
        var vocab_name_clean = vocab_name.replace("-", " ");
        var vocab_link = vocab_name_clean + "," + obj[vocab_name].url;
        vocabs_link.push(vocab_link);
      });
    }

    // create a div to store the shortcuts to Thesauri
    const div = $("<div id='" + id + "__vocabsLink' class='suggested-vocabs-div'>");
    if ($(this).prev().length > 0) {
      div.insertBefore($(this).prev());
    } else {
      div.insertBefore($(this));
    }
    
    // create a shortcut for each vocabulary
    vocabs_link.forEach(function(link) {
      const name = link.split(",")[0].toUpperCase();
      const url = link.split(",")[1];
      div.append("<a target='_blank' class='vocab-link' href='" + url + "'>" + name + "</a>");
    });
  });  

	// search WD, VIAF, my data, vocabs, years + add URLs 
  $(".main_content").on("click", "input[type='text']", function () { // make the onclick function valid for later generated inputs
		searchID = $(this).attr('id');

		if ( $(this).hasClass('searchWikidata') && $(this).hasClass('wikidataConstraint') && $(this).hasClass('catalogueConstraint')) {
      searchWDCatalogueAdvanced(searchID);
    } else if ( $(this).hasClass('searchWikidata') && !($(this).hasClass('wikidataConstraint')) && !($(this).hasClass('catalogueConstraint')) ) {
			searchWD(searchID);
		} else if ( $(this).hasClass('searchWikidata') && $(this).hasClass('wikidataConstraint')) {
			searchWDAdvanced(searchID);
		} else if ( $(this).hasClass('searchWikidata') && $(this).hasClass('catalogueConstraint')) {
			searchCatalogueAdvanced(searchID);
		};

    if ( $(this).hasClass('searchGeonames') ) {
			searchGeonames(searchID);
		};

    if ( $(this).hasClass('searchSkos') ) {
			searchSkos(searchID);
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

    if ( $(this).hasClass('multimediaField')) {
      addMultimedia(searchID);
    }

    if ( $(this).hasClass('websitePreview')) {
      addURL(searchID, iframe=true);
    }

    if ( $(this).hasClass('manual-entity')) {
      addManualEntity(searchID);
    }

    if ( $(this).attr('data-subform') != undefined && $(this).hasClass('disambiguate')) {
      searchCatalogueByClass(searchID);
    }

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
    var styleAttr= 'height:' + (this.scrollHeight)/2 + 'px;overflow-y:hidden;';
    if (this.classList.contains('hiddenInput')) { styleAttr += 'display:none;'}
		this.setAttribute('style', styleAttr);
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
	$('.searchWikidata').parent().prev().append(wdImg);
  $('.searchWikidata').parent().prev().append(viafImg);
  $('.searchGeonames').parent().prev().append(geoImg);
  $('.wikiEntity').append(wdImgIcon);
  $('.geoEntity').append(geoImg);
  $('.viafEntity').append(viafImg); 
  // append Entity Autocompletion toggle switch to input fields
  $('.searchWikidata').parent().append($('<div class="autocompletion-container">\
    <span class="toggle-comment">Autocompletion</span>\
    <label class="switch">\
      <input type="checkbox" checked>\
      <span class="slider round"></span>\
    </div>\
  </label>'))
  // generate input fields for Entities manual definition
  $('input~.autocompletion-container .switch').on('click', function() {
    console.log($(this).parent().prev())
    $(this).parent().prev('div').toggleClass('active');
    if (! $(this).find('input').prop('checked')) {
      var inputField = $(this).parent().prev().prev('.searchWikidata');
      var id = inputField.attr('id');
      inputField.hide();
      inputField.after($('<span class="manual-entity" data-target="'+id+'">URI</span><input class="col-md-12 manual-entity" id="'+id+'_uri" name="'+id+'_uri" type="text" value="" data-class="'+inputField.attr('data-class')+'" placeholder="https://www.wikidata.org/wiki/Q123">'));
      inputField.next().next().after($('<span class="manual-entity" data-target="'+id+'">Label</span><input class="col-md-12 manual-entity" id="'+id+'_label" name="'+id+'_label" type="text" value="" data-class="'+inputField.attr('data-class')+'" placeholder="September">'));

    } else {
      var inputField = $(this).parent().parent().find('.searchWikidata');
      var id = inputField.attr('id');
      console.log(inputField,id)
      $('span.manual-entity[data-target="'+id+'"], span.manual-entity[data-target="'+id+'"]+input.manual-entity').remove();
      inputField.show();

    }
  })
	// hide placeholder if filled
	//colorForm();

  // style mandatory fields
  $("[data-mandatory='True']").parent().prev(".label").find('.title').append("<span class='mandatory'>*</span>")

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
      $(this).parent().append('<section data-letter="'+ encoded_letter+'" id="'+ data_target+'" class="collapse toBeWrapped '+res_id+'"></section>');
      $(this).parent().parent().find($('.alphabet')).append('<span data-toggle="collapse" data-target="#'+ data_target+'" aria-expanded="false" aria-controls="'+ encoded_letter+'" class="info_collapse" data-parent="#toc_resources_'+res_id+'">'+ letter +'</span>');
    };
    $(this).parent().find('[data-letter="'+ encoded_letter +'"]').append(this);
    $('.toBeWrapped.'+res_id).each(function() {
    console.log(res_id)
    if (!$(this).parent().hasClass('accordion-group')) {
      $(this).wrapAll("<section class='accordion-group'></section>");

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
  
  // alternate inverse entities navigation in "view" page
  $(".inverse-properties-tabs .nav-item a").on('click', function () {
    if (! $(this).hasClass('active')) {
      $(".inverse-properties-tabs .nav-item a").toggleClass("active");
      $(".inverse-section").hide();
      var openTab = $(this).attr("id");
      console.log("#inverse-section-"+openTab)
      $("#inverse-section-"+openTab).show();
    }
  });
  
  // show entity icons in "term" page
  $("h3.articleSubtitle + a").each(function() {
    if ($(this).attr('href').startsWith('http://www.wikidata.org/entity/')) {
      $(this).parent().append(wdImgIcon);
    } else if ($(this).attr('href').startsWith('https://sws.geonames.org/')) {
      $(this).parent().append(geoImg);
    } else if ($(this).attr('href').startsWith('http://www.viaf.org/viaf/')) {
      $(this).parent().append(viafImgIcon);
    }
  })
  // show related resources in "term" page
  $(".showRes").on("click", function() {
    var data = {
        count: $(this).data("count"),
        uri: $(this).data("uri"),
        class: $(this).data("class"),
        limit_query: $(this).data("limit"),
        offset_query: $(this).data("offset")
    };
    searchResources({ data: data }, $(this));
  });
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

  $('textarea').each(function() {
    $(this).on('click', nlpText($(this).attr('id')))
  })

});

$(window).on('resize', function() {
  
  $('.tips-div').each(function() {
    var target = $(this).attr('data-target');
    var yasqeObj = $('#'+target+'>.yasqe');
    var offset = yasqeObj.offset();
    var left = offset.left;
    var top = offset.top;
    var width = yasqeObj.width()+1;
    var height = yasqeObj.height();

    $(this).css({
      left: left+"px",
      top: top+"px",
      width: width+"px",
      height: height+"px",
      position: "absolute",
      "z-index": "5",
      "background-color": "white",
      border: "1px solid #D1D1D1",
    })
  })
});




/////////////////////////
// MULTIPLE LANGUAGES ///
/////////////////////////
function modify_lang_inputs(el) {
  var base_id = $(el).attr('id').split('_')[0];


  // check if it's first of type
  if ($(el).is('[lang]:first-of-type')) {
    $(el).parent().prev().append($('<i class="material-icons" onclick="language_form(this)">translate</i>'));

    if (!($(el).hasClass('subrecord-field'))) {
      var new_id = base_id+"_"+$(el).attr('lang');
      $(el).attr('name',new_id);
      $(el).attr('id',new_id);
      var lang = $(el).attr('lang').toUpperCase();
      const languages_list = $('<div class="languages-list" id="languages-'+base_id+'"></div>');
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
      $(el).before(languages_list);
    }
  } 
  else {

    // language tags handling: other lang (only in modify and review)
    const main_lang = $('#'+base_id+'_mainLang').val();
    var lang = $(el).attr('lang');
    const languages_list = $('#languages-'+base_id);
    const other_lang = $('<a class="lang-item" title="text language: '+lang.toUpperCase()+'" onclick="show_lang(\''+$(el).attr('id')+'\')">'+lang.toUpperCase()+'</a>');
    if ($(el).hasClass('disambiguate') && lang===main_lang) {
      var first_lang = languages_list.find('i').next('a');
      other_lang.addClass('main-lang');
      other_lang.addClass('selected-lang');
      first_lang.removeClass('selected-lang');
      first_lang.before(other_lang);
      $('#'+base_id+'_'+first_lang.text().toLowerCase()).hide();
      $(el).show();
    } else {
      languages_list.append(other_lang);
      $(el).hide();
    }
    label_section.append(languages_list);
  }
}

function language_form(el) {
  if ($('#lang-form').length > 0) {
    $('#lang-form').remove()
  } else {
    var height = $(el).offset().top + 32 + "px";
    var left = $(el).offset().left - 13 +"px";
    var current_lang = $(el).parent().next().find('.selected-lang').text().toLowerCase();
    var input = $(el).parent().next().find('textarea, input').filter(':visible');
    var field_id = input.attr('id');

    // set a variable to modify the subrecord's list of fields in case the textbox is part of a subtemplate
    var subform = $('#'+field_id).attr('data-subform');
    var modify_subform = subform ? subform : null
    

    const lang_form = $('<section id="lang-form" data-input="'+field_id+'"></section>');
    const change_language = $('<section class="form_row"><label>Change current language:</label><input type="textbox" class="custom-select" placeholder="Select a new language" onclick="activateFilter(this)"></input><div class="language-options"></div></section>');
    const add_language = $('<section class="form_row"><label>Add another language:</label><input type="textbox" class="custom-select" placeholder="Select a new language" onclick="activateFilter(this)"><div class="language-options"></input></div></section>')
    const main_lang = $('<section class="form_row"><label>Set this field primary language:</label><select class="custom-select"></select></section>');
    main_lang.find('select').on('change', function() {change_main_lang(this,modify_subform)});
    const remove_lang = $('<section class="form_row"><label>Remove current language: </label> <i class="far fa-trash-alt" onclick="removeCurrentLanguage(this,'+modify_subform+')"></i></section>');
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
                changeCurrentLanguage(this,modify_subform);
              });
              add_select.on("click", function() {
                console.log(modify_subform)
                addNewLanguage(this,modify_subform)
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
          var current_languages = $(el).parent().next().find('.lang-item');
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

function activateFilter(el){
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

function addNewLanguage(el,record) {
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
  if (new_lang_input.is('textarea')) {
    new_lang_input.on('click', function() {
        nlpText(new_lang_input_id);
    });
  }


  $('[id^="'+last_lang_id.split('_')[0]+'"]').hide(); 
  $('#'+last_lang_id).after(new_lang_input);
  $(el).parent().parent().parent().remove();
}

function changeCurrentLanguage(el,record) {
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

function removeCurrentLanguage(el,record) {
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
              $(this).find('.wikiEntity').append(wdImgIcon);
              $(this).find('.geoEntity').append(geoImg);
              $(this).find('.viafEntity').append(viafImg);
              $(this).find('[xml\\:lang]').each(function() {
                visualize_subrecord_literals($(this));
              })
            })
            calledValue.append($('<div class="hidden-subrecord"></div>').append(calledRecordData));
          } else {
            calledRecordData.find('.wikiEntity').append(wdImgIcon);
            calledRecordData.find('.geoEntity').append(geoImg);
            calledRecordData.find('.viafEntity').append(viafImg);
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

function validateTemplateClass() {
  // validate
  var class_name = $("input[name='class_name']").val();
  var class_uris = $('#uri-container').find('input');
  if (class_name == "" || class_uris.length == 0 ) {
    alert("Name and URI must be filled out");

    return false;
  } else if ($("input[name='class_name']").hasClass('error-input')) {
    console.log("B")
    alert("Check your template Name");

    return false;
  } else {
    document.getElementById('selectTemplateClass').submit();
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


//////////////////////////////
// Query services functions //
//////////////////////////////

// Ancillary function: call VIAF API
function callViafAPI(querySubstring, doneCallback){
  var requestUrl = "https://viaf.org/viaf/AutoSuggest?query=" + querySubstring + "&callback=?";
  $.getJSON(requestUrl, doneCallback);
}

// Ancillary function: make a SPARQL query (Wikidata/catalogue, for advanced search only)
function makeSPARQLQuery( endpointUrl, sparqlQuery, doneCallback ) {
	var settings = {
		headers: { 
      Accept: 'application/sparql-results+json'},
		data: { query: sparqlQuery }
	};
	return $.ajax( endpointUrl, settings ).then( doneCallback );
}

// Ancillary function: set #searchresult div position (css)
function setSearchResult(searchterm){
  var offset = $('#'+searchterm).offset();
  var leftpos = offset.left+15;
  var height = $('#'+searchterm).height();
  var width = $('#'+searchterm).width();
  var top = offset.top + height + 15 + "px";

  $('#searchresult').css( {
      'position': 'absolute',
      'margin-left': leftpos+'px',
      'top': top,
      'z-index':1000,
      'background-color': 'white',
      'border':'solid 1px grey',
      'max-width':'600px',
      'max-height': '300px',
      'overflow-y': 'auto'
  });
  $("#searchresult").empty();
}

// SEARCH GEONAMES
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
          var offset = $('#'+searchterm).offset();
	      	var leftpos = offset.left+15;
    			var height = $('#'+searchterm).height();
          var top = offset.top + height + 15 + "px";
          var max_width = '600px';


    			$('#searchresult').css( {
    			    'position': 'absolute',
    			    'margin-left': leftpos+'px',
    			    'top': top,
    			    'z-index':1000,
    			    'background-color': 'white',
    			    'border':'solid 1px grey',
    			    'max-width':max_width,
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

      			var query = "prefix bds: <http://www.bigdata.com/rdf/search#> select distinct ?s ?o ?desc "+inGraph+" where { ?s rdfs:label ?o . OPTIONAL { ?s rdfs:comment ?desc} . ?o bds:search '"+q+"*' .}"
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
          					        	$('#'+searchterm).after("<span class='tag "+oldID+"' data-input='"+searchterm+"' data-id='"+oldID+"'>"+oldLabel+"</span><input type='hidden' class='hiddenInput "+oldID+"' name='"+searchterm+"_"+oldID+"' value=\" "+oldID+","+encodeURIComponent(oldLabel)+"\"/>");
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
  		        	$('#'+searchterm).after("<span class='tag "+item.geonameId+"' data-input='"+searchterm+"' data-id='"+item.geonameId+"'>"+item.name+"</span><input type='hidden' class='hiddenInput "+item.geonameId+"' name='"+searchterm+"_"+item.geonameId+"' value=\""+item.geonameId+","+encodeURIComponent(item.name)+"\"/>");
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

// SEARCH CATALOGUE
// search bar menu
function searchCatalogue(searchterm) {
  $('#'+searchterm).keyup(function(e) {
    $("#searchresultmenu").show();
    var q = $('#'+searchterm).val();
    var query = "prefix bds: <http://www.bigdata.com/rdf/search#> select distinct ?s ?o "+inGraph+" where { ?o bds:search '"+q+"*'. ?o bds:minRelevance '0.3'^^xsd:double . ?s rdfs:label ?o ; a ?class .}"
    var encoded = encodeURIComponent(query)
    if (q == '') { $("#searchresultmenu").hide();}
    $.ajax({
          type: 'GET',
          url: myPublicEndpoint+'?query=' + encoded,
          headers: { Accept: 'application/sparql-results+json; charset=utf-8'},
          success: function(returnedJson) {
            $("#searchresultmenu").empty();
            // autocomplete positioning
  	      	setSearchResult(searchterm);

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
};

// search catalogue through advanced triple patterns
function searchCatalogueAdvanced(searchterm) {
  let newSparqlQuery = "";
  var rawQuery = query_templates[searchterm];
  var sparqlQuery =  rawQuery.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll(/&quot;/g, '"');
  var endpointUrl = myPublicEndpoint;

  $('#'+searchterm).off('keyup').on('keyup', function() {
    $("#searchresult").show();
    setSearchResult(searchterm);
    $("#searchresult").empty();

    var value = $('#'+searchterm).val().toLowerCase();
    newSparqlQuery = sparqlQuery.replace("insertQueryTerm",value);

    if (value.length>0) {
      makeSPARQLQuery( endpointUrl, newSparqlQuery, function( data ) {
        $("#searchresult").empty();
        data.results.bindings.forEach(function(obj,idx) {
          let idSplit = obj.item.value.split('/');
          var catalogueId = idSplit[idSplit.length-1];
          if ($('#searchresult [data-id="'+catalogueId+'"]').length == 0) {
            var newItemDiv = $('<div class="wditem"><a class="blue" target="_blank" href="'+obj.item.value+'"><i class="fas fa-external-link-alt"></i></a> <a class="blue" data-id="'+catalogueId+'">'+obj.itemLabel.value+'</a></div>');
            newItemDiv.find('[data-id]').bind('click', function(e) {
              e.preventDefault();
              var oldID = $(this).attr('data-id').substr(this.getAttribute('data-id').lastIndexOf('/') + 1);
              var oldLabel = $(this).text();
              $('#' + searchterm).next('.tags-url').append("<span class='tag " + oldID + "' data-input='" + searchterm + "' data-id='" + oldID + "'>" + oldLabel + "</span><input type='hidden' class='hiddenInput " + oldID + "' name='" + searchterm + "-" + oldID + "' value=\" " + oldID + "," + encodeURIComponent(JSON.stringify(obj)) + "\"/>");
              $("#searchresult").hide();
              $('#' + searchterm).val('');
            });
            $("#searchresult").append(newItemDiv);
          };
        });
        if ($("#searchresult div").length == 0 && value.length <= 3){
          $("#searchresult").append('<div class="wditem">No matches found: try to type more characters</div>')
        } else if ($("#searchresult div").length == 0){
          $("#searchresult").append('<div class="wditem">No matches found</div>')
        };

      });
    }
  });

}

// search catalogue's records belonging to a desired class 
function searchCatalogueByClass(searchterm) {
  
  // get the required class
  var resource_class = $('#'+searchterm).attr('data-class');
  var resource_classes = resource_class.split(';').map(cls => cls.trim()).filter(cls => cls !== "");
  var class_triples = resource_classes.map(cls => `?s a <${cls}> .`).join(" ");
  var filter_clause = `FILTER NOT EXISTS { ?s a ?otherClass . FILTER (?otherClass NOT IN (${resource_classes.map(cls => `<${cls}>`).join(", ")})) }`;
  
  // other ids
  var dataSubform = $("#"+searchterm).attr('data-subform');
  var subrecordBase = $("[data-subtemplate='"+resource_class+"']").attr('id');

  // get an array of subrecords created within the same webpage and not saved yet:
  // they must belong to the same required class
  var yet_to_save_keys = [];
  var yet_to_save_resources = [];
  console.log('.disambiguate[data-class="' + resource_class + '"]:not([data-subform="'+dataSubform+'"])')
  $('.disambiguate[data-class="' + resource_class + '"]:not([data-subform="'+dataSubform+'"]').each(function() {
    yet_to_save_keys.push($(this).val());
    var key_id = $(this).attr('id');
    var subrecord = $('input[type="hidden"][value*="'+key_id+'"]');
    yet_to_save_resources.push(subrecord.attr('id'));
  });
  
  // on key up look for suggestions based on the new input string
  $('#'+searchterm).off('keyup').on('keyup', function(e) {
    var useful_yet_to_save_keys = yet_to_save_keys.filter(function(value) {
      return value.toLowerCase().includes($('#'+searchterm).val().toLowerCase()) && value.trim() !== '';
    });

    // autocomplete positioning;
    var offset = $('#'+searchterm).offset();
    var leftpos = offset.left+15;
    var height = $('#'+searchterm).height();
    var top = offset.top + height + 15 + "px";
    var max_width = '600px';
    $('#searchresult').css( {
        'position': 'absolute',
        'margin-left': leftpos+'px',
        'top': top,
        'z-index':1000,
        'background-color': 'white',
        'border':'solid 1px grey',
        'max-width':max_width,
    });
	  $("#searchresult").show();

    // prepare the query
	  var query_term = $('#'+searchterm).val();
    var query = "prefix bds: <http://www.bigdata.com/rdf/search#> select distinct ?s ?o where { ?o bds:search '"+query_term+"*'. ?o bds:minRelevance '0.3'^^xsd:double . ?s rdfs:label ?o . "+class_triples+filter_clause+"}";
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
            console.log($(this))
            e.preventDefault();
            var oldID = this.getAttribute('data-id').substr(this.getAttribute('data-id').lastIndexOf('/') + 1);
            var oldLabel = $(this).text();
            $("#searchresult").hide();

            var subform = $('#' + searchterm).parent().parent().parent().parent();
            var subformHeading = subform.find('h4');
            toggleSubform(subformHeading);
            subformHeading.attr('onclick','');
            subformHeading.html(oldLabel+"<section class='buttons-container'>\
              <button class='btn btn-dark delete' title='delete-subrecord' onclick='cancel_subrecord(event,"+$(this).parent()+")'>\
                <i class='far fa-trash-alt'></i>\
              </button>\
              </section>");

            if ($('[name="'+subrecordBase+'-subrecords"]').length) {
              $('[name="'+subrecordBase+'-subrecords"]').val($('[name="'+subrecordBase+'-subrecords"]').val()+","+oldID+";"+oldLabel);
            } else {
              const new_sub = $("<input type='hidden' name='"+subrecordBase+"-subrecords' value='"+oldID+";"+oldLabel+"'>")
              $('#recordForm, #modifyForm').append(new_sub)
            }
          });

        });;

        // once external resources have been added, include newly created resources (yet to be saved)
        for (let j = 0; j < useful_yet_to_save_keys.length; j++) {
          var resource_id = yet_to_save_resources[j];
          var resource_name = useful_yet_to_save_keys[j];
          $('#searchresult').append("<div class='wditem'><a class='blue orangeText unsaved' target='"+resource_id+"'>"+resource_name+"</a></div>")
        }

        // add tag if the user chooses an item from yet to save resources
        $('.unsaved a[target]').each(function () {
          $(this).bind('click', function (e) {
            e.preventDefault();
            var target = $(this).attr('target');
            var label = $(this).text();
            $("#searchresult").hide();

            var subform = $('#' + searchterm).parent().parent().parent().parent();
            var subformHeading = subform.find('h4');
            toggleSubform(subformHeading);
            subformHeading.attr('onclick','');
            subformHeading.html(label+"<section class='buttons-container'>\
              <button class='btn btn-dark delete' title='delete-subrecord' onclick='cancel_subrecord(event,"+$(this).parent()+")'>\
                <i class='far fa-trash-alt'></i>\
              </button>\
              </section>");
            
            if ($('[name="'+subrecordBase+'-subrecords"]').length) {
              $('[name="'+subrecordBase+'-subrecords"]').val($('[name="'+subrecordBase+'-subrecords"]').val()+","+target+";"+label);
            } else {
              const new_sub = $("<input type='hidden' name='"+subrecordBase+"-subrecords' value='"+target+";"+label+"'>")
              $('#recordForm, #modifyForm').append(new_sub)
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
    var query = "prefix bds: <http://www.bigdata.com/rdf/search#> select distinct ?s ?o "+inGraph+" where { ?o bds:search '"+q+"*'. ?o bds:minRelevance '0.3'^^xsd:double . ?s rdfs:label ?o ; a ?class .}"
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

// SEARCH WIKIDATA (includes SEARCH VIAF)
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
          var height = $('#'+searchterm).height();
          var offset = $('#'+searchterm).offset();
	      	var leftpos = offset.left+15;
          var top = offset.top + height + 15 + "px";
          var max_width = '600px';
          console.log(max_width);

    			$('#searchresult').css( {
    			    'position': 'absolute',
    			    'margin-left': leftpos+'px',
    			    'top': top,
    			    'z-index':1000,
    			    'background-color': 'white',
    			    'border':'solid 1px grey',
    			    'max-width':max_width,
    			});
    	    $("#searchresult").empty();
          
          // VIAF lookup in case nothing is found in Wikidata
          if (!data.search || !data.search.length) {
            callViafAPI(q, function (viafData) {
              if (viafData.result) {
                // to avoid repetitions of the same element: $("#searchresult").find("[data-id="+item.viafid+"]").length === 0
                $.each(viafData.result, function (i, item) {
                  if ($("#searchresult").find("[data-id="+item.viafid+"]").length === 0 && $("#searchresult > .viafitem").length <5) {
                    $("#searchresult").append("<div class='viafitem'><a class='blue' target='_blank' href='http://www.viaf.org/viaf/" + item.viafid + "'>" + viafImgIcon + "</a> <a class='blue' data-id='" + item.viafid + "'>" + item.term + "</a> " + "</div>"); // no item.DESCRIPTION!
        
                    // add tag if the user chooses an item from viaf
                    $('a[data-id="' + item.viafid + '"]').each(function () {
                      $(this).bind('click', function (e) {
                        e.preventDefault();
                        var input_name = (searchterm.split('_').length == 2) ? searchterm.split('')[0] + item.viafid + searchterm.split('_')[1] : searchterm + '-' + item.viafid;
                        $('#' + searchterm).next('div').append("<span class='tag " + item.viafid + "' data-input='" + searchterm + "' data-id='" + item.viafid + "'>" + item.term + "</span><input type='hidden' class='hiddenInput " + item.viafid + "' name='" + input_name + "' value=\"viaf" + item.viafid + "," + encodeURIComponent(item.term) + "\"/>");
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
              $("#searchresult").append("<div class='wditem'><a class='blue' target='_blank' href='http://www.wikidata.org/entity/" + item.title + "'>" + wdImgIcon + "</a> <a class='blue' data-id='" + item.title + "'>" + item.label + "</a> - " + item.description + "</div>");

              // add tag if the user chooses an item from wd
              $('a[data-id="' + item.title + '"]').each(function () {
                $(this).bind('click', function (e) {
                  e.preventDefault();
                  var input_name = (searchterm.split('_').length == 2) ? searchterm.split('_')[0] + "_" + item.title + "_" + searchterm.split('_')[1] : searchterm + '_' + item.title;
                  $('#' + searchterm).next('div').append("<span class='tag " + item.title + "' data-input='" + searchterm + "' data-id='" + item.title + "'>" + item.label + "</span><input type='hidden' class='hiddenInput " + item.title + "' name='" + input_name + "' value=\"" + item.title + "," + encodeURIComponent(item.label) + "\"/>");
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
                $('#' + searchterm).next('div').append("<span class='tag " + oldID + "' data-input='" + searchterm + "' data-id='" + oldID + "'>" + oldLabel + "</span><input type='hidden' class='hiddenInput " + oldID + "' name='" + searchterm + "_" + oldID + "' value=\" " + oldID + "," + encodeURIComponent(oldLabel) + "\"/>");
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
  				$('#'+searchterm).next('.tags-url').append("<span class='tag "+newID+"' data-input='"+searchterm+"' data-id='"+newID+"'>"+$('#'+searchterm).val()+"</span><input type='hidden' class='hiddenInput "+newID+"' name='"+searchterm+"-"+newID+"' value=\""+newID+","+encodeURIComponent($('#'+searchterm).val())+"\"/>");
  			};
  			$("#searchresult").hide();
  	    	$('#'+searchterm).val('');
  	    	//colorForm();
	    };
	});
};

// search Wikidata with SPARQL patterns
function searchWDAdvanced(searchterm) {
  let newSparqlQuery = "";
  var rawQuery = query_templates[searchterm];
  var sparqlQuery =  rawQuery.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll(/&quot;/g, '"');
  var endpointUrl = wikidataEndpoint;
  
  $('#'+searchterm).off('keyup').on('keyup', function() {
    $("#searchresult").show();
    setSearchResult(searchterm);
    var value = $('#'+searchterm).val().toLowerCase();
    newSparqlQuery = sparqlQuery.replace("insertQueryTerm",value);


    if (value.length>0) {
      makeSPARQLQuery( endpointUrl, newSparqlQuery, function( data ) {
        $("#searchresult").empty();
        data.results.bindings.forEach(function(obj,idx) {
          let idSplit = obj.item.value.split('/');
          var wdId = idSplit[idSplit.length-1];
          var newItemDiv = $('<div class="wditem"><a class="blue" target="_blank" href="'+obj.item.value+'">'+wdImgIcon+'</a> <a class="blue" data-id="'+wdId+'">'+obj.itemLabel.value+'</a> - '+obj.itemDescription.value+'</div>');
          newItemDiv.find('[data-id]').bind('click', function(e) {
            e.preventDefault();
            var oldID = $(this).attr('data-id').substr(this.getAttribute('data-id').lastIndexOf('/') + 1);
            var oldLabel = $(this).text();
            $('#' + searchterm).next('.tags-url').append("<span class='tag " + oldID + "' data-input='" + searchterm + "' data-id='" + oldID + "'>" + oldLabel + "</span><input type='hidden' class='hiddenInput " + oldID + "' name='" + searchterm + "_" + oldID + "' value=\" " + oldID + "," + encodeURIComponent(JSON.stringify(obj)) + "\"/>");
            $("#searchresult").hide();
            $('#' + searchterm).val('');
          });
          $("#searchresult").append(newItemDiv);
        });
        if (!data.results.bindings.length){
          $("#searchresult").append('<div class="wditem">No matches in Wikidata: try to type more characters</div>');

          // search for results in VIAF and CATALOGUE in case no result is returned by WD:
          // VIAF:
          callViafAPI(value, function(viafData) {
            if (viafData.result) {
              // to avoid repetitions of the same element: $("#searchresult").find("[data-id="+item.viafid+"]").length === 0
              $.each(viafData.result, function (i, item) {
                if ($("#searchresult").find("[data-id="+item.viafid+"]").length === 0 && $("#searchresult > .viafitem").length <5) {
                  $("#searchresult").append("<div class='viafitem'><a class='blue' target='_blank' href='http://www.viaf.org/viaf/" + item.viafid + "'>" + viafImgIcon + "</a> <a class='blue' data-id='" + item.viafid + "'>" + item.term + "</a> " + "</div>"); // no item.DESCRIPTION!
      
                  // add tag if the user chooses an item from viaf
                  $('a[data-id="' + item.viafid + '"]').each(function () {
                    $(this).bind('click', function (e) {
                      e.preventDefault();
                      var input_name = (searchterm.split('_').length == 2) ? searchterm.split('')[0] + item.viafid + searchterm.split('_')[1] : searchterm + '-' + item.viafid;
                      $('#' + searchterm).next('.tags-url').append("<span class='tag " + item.viafid + "' data-input='" + searchterm + "' data-id='" + item.viafid + "'>" + item.term + "</span><input type='hidden' class='hiddenInput " + item.viafid + "' name='" + input_name + "' value=\"viaf" + item.viafid + "," + encodeURIComponent(item.term) + "\"/>");
                      $("#searchresult").hide();
                      $('#' + searchterm).val('');
                    });
                  });
                  
                }
              });
            }
          });
          // CATALOGUE:
          var catalogueSearchPromise = searchCatalogueIntermediate(value)
          catalogeRequest = catalogueSearchPromise.then(function(catalogueData) {
            $(".fromCatalogue").remove(); // to remove previously retrieved elements
            $.each(catalogueData, function (i, item) {
              var myUrl = item.s.value;
              // exclude named graphs from results
              if (myUrl.substring(myUrl.length - 1) != "/") {
                var resID = myUrl.substr(myUrl.lastIndexOf('/') + 1);
                if (item.desc !== undefined) {
                  var desc = '- ' + catalogueEntries[i].desc.value;
                } else {
                  var desc = '';
                }
                if ($("#searchresult div.wditem  a[data-id='" + item.s.value + "']").length == 0) {
                  $("#searchresult").append("<div class='wditem fromCatalogue'><a class='blue orangeText' target='_blank' href='view-" + resID + "'><i class='fas fa-external-link-alt'></i></a> <a class='blue orangeText' data-id=" + item.s.value + ">" + item.o.value + "</a> " + desc + "</div>");
                }
              }
            });
            
            // add tag if the user chooses an item from the catalogue
            $('a[data-id^="' + base + '"]').each(function () {
              $(this).bind('click', function (e) {
                e.preventDefault();
                var oldID = this.getAttribute('data-id').substr(this.getAttribute('data-id').lastIndexOf('/') + 1);
                var oldLabel = $(this).text();
                $('#' + searchterm).next('.tags-url').append("<span class='tag " + oldID + "' data-input='" + searchterm + "' data-id='" + oldID + "'>" + oldLabel + "</span><input type='hidden' class='hiddenInput " + oldID + "' name='" + searchterm + "-" + oldID + "' value=\" " + oldID + "," + encodeURIComponent(oldLabel) + "\"/>");
                $("#searchresult").hide();
                $('#' + searchterm).val('');
              });

            });
          })
        }
      });
    }
    
  });
}

// search for entities through SPARQL triple patterns in Wikidata and Catalogue
function searchWDCatalogueAdvanced(searchterm){
  let newSparqlQueryWD = "";
  let newSparqlQueryCatalogue = "";
  var rawQueryWD = query_templates[searchterm]['wikidata'];
  var rawQueryCatalogue = query_templates[searchterm]['catalogue'];
  var sparqlQueryWD =  rawQueryWD.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll(/&quot;/g, '"');
  var sparqlQueryCatalogue =  rawQueryCatalogue.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll(/&quot;/g, '"');
  
  $('#'+searchterm).off('keyup').on('keyup', function() {
    $("#searchresult").show();
    setSearchResult(searchterm);
    var value = $('#'+searchterm).val().toLowerCase();
    newSparqlQueryWD = sparqlQueryWD.replace("insertQueryTerm",value);
    newSparqlQueryCatalogue = sparqlQueryCatalogue.replace("insertQueryTerm",value);

    if (value.length>0) {
      $("#searchresult").empty();
      requestWD = makeSPARQLQuery( myPublicEndpoint.replace('/sparql','/wd'), newSparqlQueryWD, function( data ) {
        data.results.bindings.forEach(function(obj,idx) {
          let idSplit = obj.item.value.split('/');
          var wdId = idSplit[idSplit.length-1];
          var newItemDiv = $('<div class="wditem"><a class="blue" target="_blank" href="'+obj.item.value+'">'+wdImgIcon+'</a> <a class="blue" data-id="'+wdId+'">'+obj.itemLabel.value+'</a> - '+obj.itemDescription.value+'</div>');
          newItemDiv.find('[data-id]').bind('click', function(e) {
            e.preventDefault();
            var oldID = $(this).attr('data-id').substr(this.getAttribute('data-id').lastIndexOf('/') + 1);
            var oldLabel = $(this).text();
            $('#' + searchterm).next('.tags-url').append("<span class='tag " + oldID + "' data-input='" + searchterm + "' data-id='" + oldID + "'>" + oldLabel + "</span><input type='hidden' class='hiddenInput " + oldID + "' name='" + searchterm + "_" + oldID + "' value=\" " + oldID + "," + encodeURIComponent(JSON.stringify(obj)) + "\"/>");
            $("#searchresult").hide();
            $('#' + searchterm).val('');
          });
          $("#searchresult").append(newItemDiv);
        });
        // call VIAF API in case no result is available in WD
        if (!data.search || !data.search.length) {
          callViafAPI(value, function (viafData) {
            if (viafData.result && $('#'+searchterm).val().toLowerCase() === value && $("#searchresult div").length === 0) {
              // to avoid repetitions of the same element: $("#searchresult").find("[data-id="+item.viafid+"]").length === 0
              $.each(viafData.result, function (i, item) {
                if ($("#searchresult").find("[data-id="+item.viafid+"]").length === 0 && $("#searchresult > .viafitem").length <5) {
                  $("#searchresult").append("<div class='viafitem'><a class='blue' target='_blank' href='http://www.viaf.org/viaf/" + item.viafid + "'>" + viafImg + "</a> <a class='blue' data-id='" + item.viafid + "'>" + item.term + "</a> " + "</div>"); // no item.DESCRIPTION!
      
                  // add tag if the user chooses an item from viaf
                  $('a[data-id="' + item.viafid + '"]').each(function () {
                    $(this).bind('click', function (e) {
                      e.preventDefault();
                      var input_name = (searchterm.split('_').length == 2) ? searchterm.split('')[0] + item.viafid + searchterm.split('_')[1] : searchterm + '-' + item.viafid;
                      $('#' + searchterm).next('.tags-url').append("<span class='tag " + item.viafid + "' data-input='" + searchterm + "' data-id='" + item.viafid + "'>" + item.term + "</span><input type='hidden' class='hiddenInput " + item.viafid + "' name='" + input_name + "' value=\"viaf" + item.viafid + "," + encodeURIComponent(item.term) + "\"/>");
                      $("#searchresult").hide();
                      $('#' + searchterm).val('');
                      //colorForm();
                    });
                  });
                };
              });
            }
          });
        };
      });
      requestCatalogue = makeSPARQLQuery( myPublicEndpoint, newSparqlQueryCatalogue, function( data ) {
        data.results.bindings.forEach(function(obj,idx) {
          let idSplit = obj.item.value.split('/');
          var catalogueId = idSplit[idSplit.length-1];
          if ($('#searchresult [data-id="'+catalogueId+'"]').length == 0) {
            var newItemDiv = $('<div class="wditem"><a class="blue" target="_blank" href="'+obj.item.value+'"><i class="fas fa-external-link-alt"></i></a> <a class="blue" data-id="'+catalogueId+'">'+obj.itemLabel.value+'</a></div>');
            newItemDiv.find('[data-id]').bind('click', function(e) {
              e.preventDefault();
              var oldID = $(this).attr('data-id').substr(this.getAttribute('data-id').lastIndexOf('/') + 1);
              var oldLabel = $(this).text();
              $('#' + searchterm).next('.tags-url').append("<span class='tag " + oldID + "' data-input='" + searchterm + "' data-id='" + oldID + "'>" + oldLabel + "</span><input type='hidden' class='hiddenInput " + oldID + "' name='" + searchterm + "-" + oldID + "' value=\" " + oldID + "," + encodeURIComponent(JSON.stringify(obj)) + "\"/>");
              $("#searchresult").hide();
              $('#' + searchterm).val('');
            });
            $("#searchresult").append(newItemDiv);
          };
        });
      });

    };
  });
}

// add a manually defined entity
function addManualEntity(searchterm) {
  var baseId = searchterm.replace('_uri','').replace('_label','');
  console.log(baseId)
  

  $('#'+searchterm).keypress(function(e) {
    console.log(e.which)
    console.log(uri, label)
    var uri = $("#"+baseId+'_uri').val()
    var label = $("#"+baseId+'_label').val()
    if (e.which == 13 && uri != '' && label != '') {
      console.log(uri, label)
      
      e.preventDefault();
      console.log("ciao")
      console.log($("#"+baseId+'_label').next())
      $("#"+baseId+'_label').next().append($("<span class='tag " + label + "' data-input='" + baseId + "' data-id='" + label + "'>" + label + "</span><input type='hidden' class='hiddenInput " + label + "' name='" + baseId + "_" + uri + "' value=\" " + uri + "," + encodeURIComponent(label) + "\"/>"))
    } else if (e.which == 13 && (uri == '' || label == '')) {
      alert('Please, provide a label and a URI')
    }
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
            var top = offset.top + height - 275 + "px";
            var right = offset.left + width + "px";

            $('#'+searchres_div).css( {
                'position': 'absolute',
                'margin-left': leftpos+'px',
                'top': top,
                'z-index':1000,
                'background-color': 'white',
                'border':'solid 1px grey',
                'max-width':'600px',
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
  console.log(iframe)
  var itemTable
  if ($("table.url-table[data-input='"+searchterm+"']").length === 0) {
    itemTable = $("<table class='url-table' data-input='"+searchterm+"'>\
      <thead>\
        <tr>\
          <th>URL</th>\
          <th>Actions</th>\
        </tr>\
      <tbody>\
      </tbody>\
    </table>");
  } else {
    itemTable = $("table.url-table[data-input='"+searchterm+"']");
  }

  $('#'+searchterm).off('keyup').on('keyup', function(e) { 

    let regexURL = /(http|https)?(:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/;
    
    if(e.which == 13 || e.which == 44) { // 44 code for commas
      e.preventDefault();
      var now = new Date().valueOf();
      var newID = 'MD'+now;
      // check the input value against the regex
      if ($('#'+searchterm).val().length > 0 && regexURL.test($('#'+searchterm).val()) ) {
        // generate iframe if requested 
        if (iframe) {
          var url;
          if (!$('#'+searchterm).val().startsWith("https://") && !$('#'+searchterm).val().startsWith("http://")) {
            url = "https://" + $('#'+searchterm).val();
          } else {
            url = $('#'+searchterm).val();
          }
          itemTable.find('tbody').append($("<tr>\
            <td><span class='"+newID+"' data-input='"+searchterm+"' data-id='"+newID+"'><a href='"+url+"'>"+$('#'+searchterm).val()+"</a></span><input type='hidden' class='hiddenInput "+newID+"' name='"+searchterm+"_"+newID+"' value=\""+newID+","+encodeURIComponent(url)+"\"/></td>\
            <td>\
              <button class='btn btn-dark delete' title='delete-iframe' onclick='deleteUrlInput(this)'><i class='far fa-trash-alt'></i></button>\
              <button class='btn btn-dark' title='expand-iframe' onclick='expandUrlInput(event, this)'><i class='fa fa-expand'></i></button>\
            </td>\
          </tr>"));
          $('#'+searchterm).next('.tags-url').prepend(itemTable);
        }
        else {
          itemTable.find('tbody').append($("<tr>\
            <td><span class='"+newID+"' data-input='"+searchterm+"' data-id='"+newID+"'><a href='"+$('#'+searchterm).val()+"'>"+$('#'+searchterm).val()+"</a></span><input type='hidden' class='hiddenInput "+newID+"' name='"+searchterm+"_"+newID+"' value=\""+newID+","+encodeURIComponent($('#'+searchterm).val())+"\"/></td>\
            <td>\
              <button class='btn btn-dark delete' title='delete-url' onclick='deleteUrlInput(this)'><i class='far fa-trash-alt'></i></button>\
              <button class='btn btn-dark' title='open-url' onclick='expandUrlInput(event, this)'><i class='fa fa-expand'></i></button>\
            </td>\
          </tr>"));
          $('#'+searchterm).next('.tags-url').append(itemTable);        
        }

        // popover Wayback Machine
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

        $('#'+searchterm).parent().append(tooltip_save);
        $('#'+searchterm).parent().append(tooltip_saved);
        $(".savetheweb").popover({
          html: true,
          title : "<h4>Need to save a source for the future?</h4>",
          content: "<p>If you have a web page that is important to you, \
          we can save it using the \
          <a target='_blank' href='https://archive.org/web/'>Wayback Machine</a></p>\
          <p>Shall we?</p>\
          <button onclick=saveTheWeb('"+$('#'+searchterm).val()+"') class='btn btn-dark'>yes</button> \
          <button onclick=destroyPopover() class='btn btn-dark'>Maybe later</button>\
          <p></p>",
          placement: "bottom",
        }).popover('show');

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
function searchSkos(searchterm) {

  $('#' + searchterm).keyup(function(e) {
    if ($('#' + searchterm).val().length > 1) {
      $("#searchresult").hide();
      var requests = []; // prepare an array to collect all the requests to the selected thesauri's endpoints
      var results_array = []; // prepare an array to access the results returned by the query
      var vocabs_array = []; // prepare an array to store the selected thesauri's names

      var skos_vocabs = query_templates[searchterm]; // look at the back-end app for query_templates
      skos_vocabs.forEach(function(obj, idx) {
        // isolate each SKOS resource associated with the input field and prepare an ajax request
        var vocabulary_name = Object.keys(obj)[0]
        if (obj[vocabulary_name].type == "API") {

          // retrieve the parameters of the request to properly call the API
          var query_parameters = Object.assign({}, obj[vocabulary_name].parameters);
          // get the keys of the parameters object: the first key (keys[0]) must be associated with the query-term (i.e., input value)
          var keys = Object.keys(query_parameters);
          query_parameters[keys[0]] = $('#' + searchterm).val() + "*"; 
          const request = $.getJSON(obj[vocabulary_name].endpoint, query_parameters);

          requests.push(request);
          results_array.push(obj[vocabulary_name].results);
          vocabs_array.push(vocabulary_name);
          
        } else if (obj[vocabulary_name].type == "SPARQL") {

          // the string 'QUERY-TERM' inside the query must be replaced with the input value; special charachters must be checked 
          var query = (obj[vocabulary_name].query).replace("QUERY-TERM", ("^" + $('#' + searchterm).val())).replace("&gt;", ">").replace("&lt;", "<").replace(/&quot;/g, '"');
          var request_parameters = {
            type: 'GET',
            url: '/sparqlanything?q=' + encodeURIComponent(query)
          }
          const request = $.ajax(request_parameters);

          requests.push(request);
          results_array.push(obj[vocabulary_name].results);
          vocabs_array.push(vocabulary_name);

        }
      });

      Promise.all(requests)
        .then(function(results) {
          const options = []; // array to include ALL the resulting terms of ALL the queries
          console.log(results); // results = ALL the resulting objects of ALL the queries
          results.forEach(function(data, index) {
            console.log(data) // the resulting object of a query
            var path = results_array[index];
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
	      	var offset = $('#'+searchterm).offset();
	      	var leftpos = offset.left+15;
    			var height = $('#'+searchterm).height();
          var top = offset.top + height + 15 + "px";
          var max_width = '600px';

    			$('#searchresult').css( {
    			    'position': 'absolute',
    			    'margin-left': leftpos+'px',
    			    'top': top,
    			    'z-index':1000,
    			    'background-color': 'white',
    			    'border':'solid 1px grey',
    			    'max-width':max_width,
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
                  $('#' + searchterm).after("<span class='tag " + uri + "' data-input='" + searchterm + "' data-id='" + uri + "'>" + label+" - "+vocabulary_noun + "</span><input type='hidden' class='hiddenInput " + uri + "' name='" + searchterm + "_" + uri + "' value=\"" + uri + "," + label + " - " + vocabulary_noun + "\"/>");
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
  var itemTable
  if ($("table.url-table[data-input='"+searchterm+"']").length === 0) {
    itemTable = $("<table class='url-table' data-input='"+searchterm+"'>\
      <thead>\
        <tr>\
          <th>URL</th>\
          <th>Actions</th>\
        </tr>\
      <tbody>\
      </tbody>\
    </table>");
  } else {
    itemTable = $("table.url-table[data-input='"+searchterm+"']");
  }

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
          itemTable.find('tbody').append($("<tr>\
            <td><span class='"+newID+"' data-input='"+searchterm+"' data-id='"+newID+"'><a href='"+$('#'+searchterm).val()+"'>"+$('#'+searchterm).val()+"</a></span><input type='hidden' class='hiddenInput "+newID+"' name='"+searchterm+"_"+newID+"' value=\""+newID+","+encodeURIComponent($('#'+searchterm).val())+"\"/></td>\
            <td>\
              <button class='btn btn-dark delete' title='delete-image' onclick='deleteUrlInput(this)'><i class='far fa-trash-alt'></i></button>\
              <button class='btn btn-dark' title='expand-image' onclick='expandUrlInput(event, this)'><i class='fa fa-expand'></i></button>\
            </td>\
          </tr>"));
          $('#'+searchterm).next('.tags-url').prepend(itemTable);
        } // AUDIO
        else if ($('#'+searchterm).hasClass("Audio") && stringEndsWith($('#'+searchterm).val(), audioFormats)) {
          itemTable.find('tbody').append($("<tr>\
            <td><span class='"+newID+"' data-input='"+searchterm+"' data-id='"+newID+"'><a href='"+$('#'+searchterm).val()+"'>"+$('#'+searchterm).val()+"</a></span><input type='hidden' class='hiddenInput "+newID+"' name='"+searchterm+"_"+newID+"' value=\""+newID+","+encodeURIComponent($('#'+searchterm).val())+"\"/></td>\
            <td>\
              <button class='btn btn-dark delete' title='delete-audio' onclick='deleteUrlInput(this)'><i class='far fa-trash-alt'></i></button>\
              <button class='btn btn-dark' title='expand-audio' onclick='expandUrlInput(event, this)'><i class='fa fa-expand'></i></button>\
            </td>\
          </tr>"));
          $('#'+searchterm).next('.tags-url').prepend(itemTable);
        } // VIDEO
        else if ($('#'+searchterm).hasClass("Video") && stringEndsWith($('#'+searchterm).val(), videoFormats)) {
          itemTable.find('tbody').append($("<tr>\
            <td><span class='"+newID+"' data-input='"+searchterm+"' data-id='"+newID+"'><a href='"+$('#'+searchterm).val()+"'>"+$('#'+searchterm).val()+"</a></span><input type='hidden' class='hiddenInput "+newID+"' name='"+searchterm+"_"+newID+"' value=\""+newID+","+encodeURIComponent($('#'+searchterm).val())+"\"/></td>\
            <td>\
              <button class='btn btn-dark delete' title='delete-video' onclick='deleteUrlInput(this)'><i class='far fa-trash-alt'></i></button>\
              <button class='btn btn-dark' title='expand-video' onclick='expandUrlInput(event, this)'><i class='fa fa-expand'></i></button>\
            </td>\
          </tr>"));
          $('#'+searchterm).next('.tags-url').prepend(itemTable);
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

// delete URLs input values
function deleteUrlInput(el) {
  if ($(el).parent().parent('tr').parent('tbody').find('tr').length === 1) {
    $(el).parent().parent('tr').parent('tbody').parent('table').remove();
  } else {
    $(el).parent().parent('tr').remove();
  }
  return false
}

// expand URLs input value 
function expandUrlInput(event, el) {
  event.preventDefault();
  // retrieve the resource url
  var url = $(el).parent().parent('tr').find('span').text();
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    url = "https://" + url;
  }

  var mediaType = $(el).attr('title').replace("expand-", "");
  console.log(mediaType)
  // create a modal preview
  if (mediaType == "image") {
    var modal = $("<div class='modal-previewMM'><span class='previewTitle'>This is a preview of your multimedia file:<br><a href='"+url+"'>"+url+"</a></span><span class='closePreview'></span><img src='" + url + "'></div>");
  } else if (mediaType =="video") {
    var modal = $("<div class='modal-previewMM'><span class='previewTitle'>This is a preview of your multimedia file:<br><a href='"+url+"'>"+url+"</a></span><span class='closePreview'></span><video controls name='media'><source src='" + url + "'></video></div>");
  } else if (mediaType == 'audio') {
    var modal = $("<div class='modal-previewMM'><span class='previewTitle'>This is a preview of your multimedia file:<br><a href='"+url+"'>"+url+"</a></span><span class='closePreview'></span><audio controls><source src='" + url + "'></audio></div>");
  } else if (mediaType == 'iframe') {
    var modal = $("<div class='modal-previewMM'><span class='previewTitle'>This is a preview of your website:<br><a href='"+url+"'>"+url+"</a></span><span class='closePreview'></span><iframe  src='" + url + "'></iframe></div>");
  }
  $(el).after(modal);
  $('#showRight').hide();
  return false;
};

// NLP
function nlpText(searchterm) {
  var lang = searchterm.split('_')[1];
  var baseID = searchterm.split('_')[0];
	$('textarea#'+searchterm).keypress( throttle(function(e) {
	  	if(e.which == 13) {
	  		//$('textarea#'+searchterm).parent().parent().append('<div class="tags-nlp col-md-9"></div>');
			$(this).next('.tags-nlp').empty();
			var textNLP = $('#'+searchterm).val();
			var encoded = encodeURIComponent(textNLP)

      // call CLEF api (spacy)
      $.ajax({
			    type: 'GET',
			    url: 'nlp?q=' + encoded + '&lang=' + lang,
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
      				        $('textarea#'+searchterm).parent().find('.tags-nlp').append('<span class="tag nlp '+item.title+'" data-input="'+baseID+'" data-id="'+item.title+'">'+item.label+'</span><input type="hidden" class="hiddenInput '+item.title+'" name="'+baseID+'_'+item.title+'" value="'+item.title+','+encodeURIComponent(item.label)+'"/>');
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
    var query = "prefix bds: <http://www.bigdata.com/rdf/search#> select distinct ?s ?o "+inGraph+" where { ?s "+res_class+" rdfs:label ?o . ?o bds:search '"+q+"' .} LIMIT 5"
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
function searchResources(event, element) {
  var uri = event.data.uri;
  var count = event.data.count;
  var resClass = event.data.class;
  var offsetQuery = parseInt(event.data.offset_query, 10);
  var limitQuery = parseInt(event.data.limit_query, 10);
  console.log(offsetQuery,limitQuery)
  
  var classes = JSON.parse(resClass.replace(/'/g, '"'));
  let typePatterns = classes.map(cls => `?o rdf:type <${cls}> .`).join(" ");
  let filterNotExists = `
      FILTER NOT EXISTS {
          ?o rdf:type ?otherClass .
          FILTER(?otherClass NOT IN (${classes.map(cls => `<${cls}>`).join(", ")}))
      }
  `;
  
  var query;
  
  if (offsetQuery === 0) {
      query = `select distinct ?o ?label ${inGraph} where { ?o ?p <${uri}> ; rdfs:label ?label . ${typePatterns} ${filterNotExists} } ORDER BY ?o LIMIT ${limitQuery}`;
  } else {
      query = `select distinct ?o ?label ${inGraph} where { ?o ?p <${uri}> ; rdfs:label ?label . ${typePatterns} ${filterNotExists} } ORDER BY ?o OFFSET ${offsetQuery} LIMIT ${limitQuery}`;
  }
  
  var encoded = encodeURIComponent(query);
  $.ajax({
      type: 'GET',
      url: myPublicEndpoint + '?query=' + encoded,
      headers: { Accept: 'application/sparql-results+json; charset=utf-8'},
      success: function(returnedJson) {
          if (!returnedJson.results.bindings.length) {
              $("[data-class='" + resClass + "'] + br + .related-resources").append("<div class='wditem noresults'>No more resources</div>");
          } else {
              for (let i = 0; i < returnedJson.results.bindings.length; i++) {
                  var myUrl = returnedJson.results.bindings[i].o.value;
                  // exclude named graphs from results
                  if (myUrl.substring(myUrl.length - 1) !== "/") {
                      var resID = myUrl.substr(myUrl.lastIndexOf('/') + 1);
                      var newItem = $("<div id='" + resID + "' class='wditem'><a class='blue orangeText' target='_blank' href='view-" + resID + "'><i class='fas fa-external-link-alt'></i></a> <span class='orangeText' data-id='" + myUrl + "'>" + decodeURIComponent(unescape(returnedJson.results.bindings[i].label.value)) + "</span></div>").hide();
                      $(element).parent().find('.related-resources').prepend(newItem);
                      newItem.show('slow');
                  }
              }
          }
      }
  });
  
  // update offset query
  offsetQuery += limitQuery;
  $(element).data('offset', offsetQuery);
  if (offsetQuery >= count) {
      $(element).hide();
      //$(".hideRes").show();
  } else {
    $(element).html("show more");
  }
}


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
    var query = "select distinct ?o ?oLabel (COUNT(?s) AS ?count) "+inGraph+" where { GRAPH ?g { ?s <"+prop+"> ?o. "+class_restriction+" ?o rdfs:label ?oLabel . } ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER( str(?stage) != 'not modified' ) } GROUP BY ?o ?oLabel ORDER BY DESC(?count) lcase(?oLabel)";
  } else if ((typeProp=='Date' || typeProp=='gYear' || typeProp=='gYearMonth') && typeField == 'Date')  {
    var query = "select distinct ?o (COUNT(?s) AS ?count) "+inGraph+" where { GRAPH ?g { ?s <"+prop+"> ?o. "+class_restriction+" } ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER( str(?stage) != 'not modified' ) } GROUP BY ?o ORDER BY DESC(?count) lcase(?o)";
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
    var query = "select distinct ?s ?sLabel "+inGraph+" where { GRAPH ?g { ?s <"+prop+"> <"+val+">; rdfs:label ?sLabel . "+class_restriction+" } ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER( str(?stage) != 'not modified' ) } ORDER BY ?sLabel"
  } else {
    var val = '"'+$(el).data("value")+ '"^^xsd:'+typeProp.charAt(0).toLowerCase() + typeProp.slice(1);
    var query = "select distinct ?s ?sLabel "+inGraph+" where { GRAPH ?g { ?s <"+prop+"> "+val+"; rdfs:label ?sLabel . "+class_restriction+" } ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER( str(?stage) != 'not modified' ) } ORDER BY ?sLabel"
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
      <option value='Skos' "+is_selected('Skos',field)+">Vocabulary (SKOS)</option>\
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
      skos_labels = skos_labels + "<label for='skos"+i+"__"+temp_id+"'>"+skos_vocabs[i].toUpperCase()+"<input type='checkbox' id='skos"+i+"__"+temp_id+"' name='skos"+i+"__"+temp_id+"' value='"+skos_vocabs[i]+"'></label></br>";
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

  var field_subtemplate_import = "<section class='row'>\
    <label class='col-md-3'>IMPORT TEMPLATES<br><span class='comment'>end-users can use templates among selected ones</span></label>\
    <section class='col-md-8 import-section'>"+generateCheckboxes(importableTemplates, temp_id)+"</section>\
  </section>";

  var field_check_subtemplate = "<section class='row' style='display:none'>\
    <label class='col-md-3'></label>\
    <input type='button' class='("+res_type+") btn btn-dark check_subtemplate' value='Open subtemplate' onclick='edit_subtemplate(this)'></input>\
  </section>"

  var field_cardinality = "<section class='row'>\
    <label class='col-md-3'>CARDINALITY <br><span class='comment'>expected values</span></label>\
    <section class='col-md-8'>\
      <label for='oneValue__"+temp_id+"'>\
        Single use of subtemplate\
        <input type='radio' id='oneValue__"+temp_id+"' name='cardinality__"+temp_id+"' value='oneValue' checked>\
      </label><br>\
      <label for='multipleValues__"+temp_id+"'>\
        Multiple uses of subtemplate\
        <input type='radio' id='multipleValues__"+temp_id+"' name='cardinality__"+temp_id+"' value='multipleValues'>\
      </label><br>\
    </section>\
  </section>";

  var field_data_inheritance = "<section class='row'>\
    <label class='col-md-3'>DATA INHERITANCE <br><span class='comment'>use upper level record data to auto-fill subtemplate fields with same property</span></label>\
    <section class='col-md-8'>\
      <label for='allowDataReuse__"+temp_id+"'>\
        Allow data inheritance\
        <input type='radio' id='allowDataReuse__"+temp_id+"' name='dataReuse__"+temp_id+"' value='allowDataReuse' checked>\
      </label><br>\
      <label for='denyDataReuse__"+temp_id+"'>\
        Deny data inheritance\
        <input type='radio' id='denyDataReuse__"+temp_id+"' name='dataReuse__"+temp_id+"' value='denyDataReuse'>\
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
  else if (field =='Skos') { contents += field_available_vocabularies + accepted_values_vocabularies + field_placeholder + field_mandatory + field_hide + field_browse ; }
  else if (field =='Multimedia') { contents += field_multimedia + field_placeholder + field_mandatory + field_hide; }
  else if (field =='WebsitePreview') { contents += field_placeholder + field_mandatory + field_hide; }
  else if (field =='Subtemplate') { contents = field_type + field_name + field_prepend + field_property + field_subtemplate_import + field_subtemplate_name + field_subtemplate_class + field_check_subtemplate + field_cardinality + field_data_inheritance + field_mandatory + field_hide + field_browse + open_addons; }
  else if (field =='KnowledgeExtractor') {
    if ($("select option:selected[value='KnowledgeExtractor']").length > 0) {
      alert("Max. 1 Knowledge Extraction field allowed");
      return;
    }
    contents = field_type + field_name + field_prepend + field_property + open_addons;
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

function generateCheckboxes(importableTemplates, fieldId) {
  let result = "";
  for (const [key, value] of Object.entries(importableTemplates)) {
    var id = key.replace('resource_templates/','').replace('.json','');
    var fullId = id + "__" + fieldId;
    var label = "<label for='"+fullId+"'>";
    var openTemplate = "<a target='_blank' href='/"+id+"'><i class='fas fa-external-link-alt'></i></a>  "+value.toUpperCase();
    var input = "<input type='checkbox' id='"+fullId+"' name='"+fullId+"' value='"+key+"'></label><br>";
    result+=label+openTemplate+input
  }
  result += "<label class='add-option'>CREATE NEW TEMPLATE <i class='fas fa-plus-circle' onclick='addTemplate(this)'></i></label>"
  return result;
}

function import_subtemplate(el) {
  var requested_template = el.value;
  var requested_name = el.options[el.selectedIndex].text;
  var name_field = $(el).parent().next().find('input[type="text"]').eq(0);
  var class_field = $(el).parent().next().next().find('input[type="text"]').eq(0);
  var edit_field = $(el).parent().next().next().next().find('input[type="button"]').eq(0);
  console.log(edit_field)
  $(name_field).parent().show();
  $(class_field).parent().show();
  // make fields not modifiable unless creating a new subtemplate
  name_field.attr("disabled", true); 
  class_field.attr("disabled", true);
 
  if (requested_template !== "CreateNewSubtemplate") {
    // hide new template button
    edit_field.parent().show();
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
    edit_field.parent().show();
  }
  
}

function edit_subtemplate(el) {
  var class_field = $(el).parent().prev().find('input').val();
  var name_field = $(el).parent().prev().prev().find('input').val();
  var template_name = $(el).parent().prev().prev().prev().find('select').val();
  if (class_field==='' || name_field==='') {
    alert("Please, specify a label and a class");
  } else if (template_name ==="CreateNewSubtemplate") {
    var modified_cls = name_field.toLowerCase().replaceAll(" ", "_");
    var url = "/template-" + modified_cls;
    var class_list = '';
    var classes = class_field.split("; ");
    for (let i = 0; i < classes.length; i++) { 
      let new_class = "&uri_class_" + i + "=" + encodeURIComponent(classes[i]); 
      class_list += new_class;
    }

    console.log(class_list)

    console.log(url);
    $.ajax({
      type: 'POST',
      url: '/welcome-1?action=createTemplate'+class_list+'&class_name='+encodeURIComponent(name_field),
      success: function(data) {
        setTimeout(function() { window.open(url, "_blank") }, 500);
      }
    })
  } else {
    var modified_cls = name_field.toLowerCase().replaceAll(" ", "_");
    var url = "/template-" + modified_cls;
    setTimeout(function() { window.open(url, "_blank") }, 500);
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

    // YASQE editor for SPARQL query patterns
    if (el.value == 'URI') {
      var field_SPARQL_constraint = $("<section class='row'>\
        <label class='col-md-3'>SPARQL CONSTRAINTS <br><span class='comment'>select a service to modify, or add a constraint (optional)</span></label>\
        <select class='custom-select col-md-8' name='service__"+temp_id+"'>\
          <option value='None'>Select a service</option>\
          <option value='WD'>Wikidata</option>\
          <option value='catalogue'>This catalogue SPARQL endpoint</option>\
        </select>\
      </section>");
      field_SPARQL_constraint.find('select').on('change', function() {
        // generate a SPARQL editor instance
        SPARQL_constraint_editor(el,this,temp_id);
      });
      $(el).parent().after(field_SPARQL_constraint);
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


// generate an instance of the YASQE editor to introduce a new SPARQL query constraint
function SPARQL_constraint_editor(field,el,temp_id,reset=false) {
  var select_input = $(el);
  let endpoint = "";
  let value_to_set = "";
  var selected_option = select_input.val();

  // hide existing YASQE editors
  $(el).parent().find('div[id*="'+temp_id+'"]').hide();


  // set the editor parameters based on the selected service:
  // no service selected
  if (selected_option === 'None') {
    return null
  }
  // wikidata
  if (selected_option === 'WD') {
    endpoint = wikidataEndpoint;
    var id = $(field).attr('id').split('__')[0] + '__wikidataConstraint__' + temp_id;
    if ($('[name="'+id+'"]').length>0 && reset==false) {
      value_to_set = $('[name="'+id+'"]').val().replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll(/&quot;/g, '"');;
    } else {
      value_to_set = `SELECT ?item ?itemLabel ?itemDescription WHERE {
    ?item wdt:P31 wd:Q5 .
    ?item wdt:P106 wd:Q2526255 .
    SERVICE wikibase:mwapi {
        bd:serviceParam wikibase:endpoint "www.wikidata.org";
          wikibase:api "EntitySearch";
          mwapi:search "insertQueryTerm";
          mwapi:language "en". #choose language
        ?item wikibase:apiOutputItem mwapi:item.
    }
    SERVICE wikibase:label {bd:serviceParam wikibase:language "en".}
}`
    }
  }
  // catalogue 
  if (selected_option === 'catalogue') {
    endpoint = myPublicEndpoint
    var id = $(field).attr('id').split('__')[0] + '__catalogueConstraint__' + temp_id;
    if ($('[name="'+id+'"]').length>0 && reset==false) {
      value_to_set = $('[name="'+id+'"]').val().replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll(/&quot;/g, '"');;
    } else {
      value_to_set = `PREFIX bds: <http://www.bigdata.com/rdf/search#> 
SELECT DISTINCT * WHERE { 
  ?item rdfs:label ?itemLabel . 
  ?item rdf:type ?itemClass .
  ?itemLabel bds:search "insertQueryTerm*" . 
  OPTIONAL { ?item rdfs:comment ?desc } . 
}`
    }
  };

  var cls = selected_option + "_" + id;
  // retrieve the previously created yasqe editor if available else create a new one
  if ($('.'+cls).length > 0) {
    $('.'+cls).show();
  } else { 
    // set the HTML environment for the YASQE editor and add buttons
    var field_constraints = $("<div class='col-md-12 "+cls+"' id='yasqe_"+cls+"'></div>");
    var button_save = $("<span class='comment'>Save constraint: <i class='fas fa-save'></i></span>");
    var button_delete = $("<span class='comment'>Remove constraint: <i class='far fa-trash-alt'></i></span>");
    var button_reset = $("<span class='comment'>Reset constraint: <i class='fas fa-redo'></i></span>");
    var button_help = $("<span class='comment'>Help: <i class='far fa-lightbulb'></i></span>");

    // save the SPARQL constraint on click
    button_save.find('i').on('click', function() {
      // generate an hidden input to store the query constraints:
      // retrieve the query from the YASQE editor and set it as the value of the hidden input
      var value = yasqe_to_hidden_field(this, keep=true);

      // modify the hidden input in case it already exists else create a new one
      if ($('[name="'+id+'"]').length >0) {
        $('[name="'+id+'"]').val(value);
      } else {
        const new_hidden_field = $("<textarea class='hiddenInput' style='display: none;' name='"+id+"'></textarea>");
        new_hidden_field.val(value);
        select_input.after(new_hidden_field);
      }
      // reset the dropdown to its first option ('value="None"')
      select_input.find('option:first').prop('selected', true);
    });

    // delete the SPARQL constraint on click
    button_delete.find('i').on('click', function() {
      $(this).parent().parent().parent().remove();
      $('[name="'+id+'"]').remove();
    });

    // refresh the SPARQL constraint and get back to the default value
    button_reset.find('i').on('click', function() {
      $(this).parent().parent().parent().remove();
      $('[name="'+id+'"]').remove();
      SPARQL_constraint_editor(field,el,temp_id,reset=true);
    });

    // get some tips
    button_help.find('i').on('click', function() {
      var buttonsDiv = $(this).parent().parent();
      var goBackButton = $("<span class='comment'>Go back to editor: <i class='fas fa-undo'></i></span>");
      goBackButton.find('i').on('click', function() {
        $('.tips-div').remove();
        buttonsDiv.find('span').show();
        $(this).parent().remove();
      })
      buttonsDiv.find('span').hide();
      buttonsDiv.append(goBackButton);


      // create a new div to show the tips and anchor it to the .yasqe div
      const yasqeObj = $(this).parent().parent().prev();
      var offset = yasqeObj.offset();
      var left = offset.left;
      var top = offset.top;
      var width = yasqeObj.width()+1;
      var height = yasqeObj.height();

      const newDiv = $('<div class="tips-div" data-target="yasqe_'+cls+'"></div>');
      newDiv.css({
        left: left+"px",
        top: top+"px",
        width: width+"px",
        height: height+"px",
        position: "absolute",
        "z-index": "5",
        "background-color": "white",
        border: "1px solid #D1D1D1",
      })

      // retrieve the tips
      $.getJSON("./static/json/help.json", function(data) {
        const wikidataTipsObj = data.wikidataConstraint;
        $.each(wikidataTipsObj, function(pageNumber, pageContent) {

          // create a clone of the model div and populate it with HTML content
          let cloneDiv = newDiv.clone();
          cloneDiv.html(pageContent);

          // set the clone div attributes and css properties
          $(cloneDiv).attr('data-number', pageNumber.replace('page',''));
          if (pageNumber !== 'page1') {
            $(cloneDiv).hide();
          } else {
            $(cloneDiv).addClass('active-page');
          }
          $('body').append(cloneDiv);
        });

        $('.tips-div[data-target="yasqe_'+cls+'"]').each(function() {
          var prevButton = $('<i class="fas fa-caret-left"></i>');
          var nextButton = $('<i class="fas fa-caret-right"></i>');

          // previous page
          prevButton.on('click', function() {
            var currentPage = $('.tips-div.active-page[data-target="yasqe_'+cls+'"]').attr('data-number');
            var newPageNumber = parseInt(currentPage)-1;
            var targetPage = $('.tips-div[data-target="yasqe_'+cls+'"][data-number="'+newPageNumber+'"]');
            $('.tips-div.active-page[data-target="yasqe_'+cls+'"]').hide();
            $('.tips-div.active-page[data-target="yasqe_'+cls+'"]').removeClass('active-page');
            targetPage.show();
            targetPage.addClass('active-page');
          });

          // next page
          nextButton.on('click', function() {
            console.log('c')
            var currentPage = $('.tips-div.active-page[data-target="yasqe_'+cls+'"]').attr('data-number');
            console.log(currentPage)

            var newPageNumber = parseInt(currentPage)+1;
            var targetPage = $('.tips-div[data-target="yasqe_'+cls+'"][data-number="'+newPageNumber+'"]');
            $('.tips-div.active-page[data-target="yasqe_'+cls+'"]').hide();
            $('.tips-div.active-page[data-target="yasqe_'+cls+'"]').removeClass('active-page');
            targetPage.show();
            targetPage.addClass('active-page');
          });
          
          if ($(this).prev('div').length>0) {
            $(this).append(prevButton)
          };
          if ($(this).next('div').length>0) {
            $(this).append(nextButton)
          };
        })

      });

    });
    // end of tips section

    select_input.after(field_constraints);

    // complete the creation of the YASQE editor
    var yasqe = YASQE(document.getElementById("yasqe_"+cls), {
      sparql: {
        showQueryButton: false,
        endpoint: endpoint,
      }
    });
    yasqe.setValue(value_to_set);
    $('.'+cls).append('<div class="yasqe-buttons"></div>');
    $('.'+cls+' .yasqe-buttons').append(button_save, button_delete, button_reset, button_help);
  }
}

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
  <div id='yasqe' style='margin-left:1em; width: 66.7%'></div>\
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
  var yasqe = YASQE($('section.skos_vocab_generator #yasqe'), {
    sparql: {
      showQueryButton: false,
      endpoint: myPublicEndpoint,
    }
  });
  yasqe.setValue("SELECT DISTINCT ?label ?uri \nWHERE {?uri ?p ?label} \nLIMIT 10");
  yasqe.setSize(width='100%',height='200px');
}

function save_vocab(element) {
  // access the section containing the list of available vocabularies
  var vocabs_section = $(element).parent().parent().children().eq(0).find(".col-md-8").eq(0);

  // extract a label, a url, a query, and an endpoint to store a new vocab
  var label = $('#vocabLabel').val();
  var url = $('#vocabUrl').val();
  var query = yasqe_to_hidden_field($(element).parent());
  console.log(query)
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

function yasqe_to_hidden_field(el,keep=false) {
  let value = '';
  var yasqe_div = $(el).parent().parent().parent();
  var yasqe_lines = yasqe_div.find('.CodeMirror-code>div');
  yasqe_lines.each(function() {
    var tokens = $(this).find('pre span span');
    tokens.each(function() {
      if (!$(this).hasClass('cm-ws')) {
        value+= $(this).text();
      } else {
        value+=' ';
      }
    });
    value += '\n';
  });
  if (keep===false){ yasqe_div.remove(); } else { yasqe_div.hide(); }
  return value
}

//////////////////////////////
//// KNOWLEDGE EXTRACTION ////
//////////////////////////////

/* Knowledge Extraction input field handling */

// generate extraction input field (during form loading)
function generateExtractionField(resId, subtemplate=null) {
  // retrieve field's description and name
  var resIndex = extractorsArray.indexOf(resId);
  resIndex = resIndex === -1 ? 0 : resIndex;
  var fieldName = extractorsNames[resIndex];
  var fieldDescription = extractorsPrepend[resIndex];

  // predefined HTML node (extraction input field)
  var extractionRow = $('<section class="form_row block_field import-form">\
  <section class="label col-12">\
    <span class="tip" data-toggle="tooltip" data-placement="bottom" title="" data-original-title="'+fieldDescription+'"><i class="fas fa-info-circle"></i></span>\
    <span class="title">'+fieldName+'</span>\
  </section>\
  <section class="col-md-12 col-sm-12 col-lg-12" style="padding-left:3.2em;padding-right: 3.2em;">\
    <table class="hidden extraction-table">\
      <thead>\
        <tr>\
          <th>Extractions</th>\
          <th>Actions</th>\
        </tr>\
      </thead>\
      <tbody></tbody>\
    </table>\
    <span class="imported_graphs add-span" id="imported-graphs-'+resId+'" onclick="generateExtractor(\'imported-graphs-'+resId+'\')"><i class="material-icons">playlist_add</i><span> Extract Entities</span></span>\
  </section>\
  </section>');

  // add the extraction node to the form
  if (subtemplate===null) {
    subtemplate = $('#recordForm .homeheading, #modifyForm .homeheading');
  }
  console.log(subtemplate)
  subtemplate.append(extractionRow);

  // retrieve previously generated extraction graphs
  if (resId in extractionsObj) {
    for (let i=0; i<extractionsObj[resId].length; i++) {
      var extractionId = extractionsObj[resId][i].internalId;
      var extractionResults = extractionsObj[resId][i].metadata.output;
      if (extractionResults.length > 0) {
        generateExtractionTagList(subtemplate,resId, extractionResults, resId+'-'+extractionId);
      }
    }
  }
}

// generate tags from previously extracted URI-label pairs
function generateExtractionTagList(subtemplate,recordId,results,id) {
  // delete previously retrieved entities if any
  $("#graph-"+id).remove();
  // if new results exist, create a new list item to collect each retrieved URI,label pair in the form of a tag (containing an hidden input)
  const table = $(subtemplate).find('#imported-graphs-'+recordId).prev('table');
  table.find('tbody').append($("<tr>\
    <td id='graph-"+id+"'></td>\
    <td>\
      <button class='btn btn-dark delete' title='delete-extraction' onclick='deleteExtractor(\""+id+"\")'><i class='far fa-trash-alt'></i></button>\
      <button class='btn btn-dark' title='modify-extraction' onclick='modifyExtractor(event,\""+recordId+"\", \""+id+"\")'><i class='far fa-edit'></i></button>\
    </td>\
  </tr>"));
  

  for (let idx = 0; idx < results.length; idx++) {
    for (const key in results[idx]) {

      if (results[idx][key].type === "literal" && !results[idx][key].value.startsWith("https://") && !results[idx][key].value.startsWith("http://")) {
        var label = results[idx][key].value;
      } else if (results[idx][key].type === "uri" || results[idx][key].value.startsWith("https://") || results[idx][key].value.startsWith("http://")) {
        var uri = results[idx][key].value;
      }
    }
    table.find("#graph-" + id).append("<span class='tag' data-id='" + uri + "'>" + label + "</span><input type='hidden' name='keyword_"+id+"_"+label+"' value='"+encodeURIComponent(uri)+"'/>");
  }
  table.removeClass('hidden');
}

/* Generate, Delete, Modify extraction module */ 

// generate the extraction form within the extraction input field
function generateExtractor(ul,modifyId=null) {
  // update the extraction count within the extractions Object
  var extractorId = ul.replace('imported-graphs-','');
  let extractionInternalId;

  if (modifyId === null) {
    // generate new internal Id (sequential numbering) for the extraction
    if (extractorId in extractionsObj) {

      // get the number of extractions
      var extractionArray = extractionsObj[extractorId];
      var extractionLength = extractionArray.length;
      var lastExtractionInternalId = extractionArray[extractionLength-1].internalId;
      extractionInternalId = parseInt(lastExtractionInternalId) + 1;

      // initialiaze a new sub-Object to store information about the novel extraction
      const newExtractionObj = { "internalId": extractionInternalId };
      newExtractionObj["metadata"] = {}; 

      // append the sub-Object to the extractions Array
      extractionsObj[extractorId].push(newExtractionObj);

    } else {
      // initialize an Array of extractions Objects within the main extractionsObject
      extractionInternalId = 1;
      extractionsObj[extractorId] = [{"internalId": extractionInternalId, "metadata": {}}];
    }
  } else {
    // reuse the existing internal id when modifying an extraction
    extractionInternalId = modifyId
  }

  // create a select element containing the options to perform the extraction
  var extractor = $("<section class='block_field col-md-12'>\
    <section class='row'>\
      <label class='col-md-12' style='text-align: left !important; margin-left: 5px'>EXTRACTOR TYPE</label>\
      <select onchange='addExtractionForm(this,\""+extractorId+"\",\""+extractionInternalId+"\")'class='custom-select' id='extractor' name='extractor'>\
        <option value='None'>Select</option>\
        <option value='api'>API</option>\
        <option value='sparql'>SPARQL</option>\
        <option value='file'>Static File</option>\
      </select>\
    </section>\
    <section class='row extractor-0'>\
      <input id='sparql-back0' class='btn btn-dark extractor-0' style='margin-left:20px' value='Back' onClick='prevExtractor(\"block_field\", \"form_row\", true,\""+extractorId+'-'+extractionInternalId+"\")'>\
    </section>\
  </section>");
  $('.import-form .col-md-12').append(extractor);
  console.log(extractor)
  $('#'+ul).hide();
};

// remove all the information related to the deleted extraction graph
function deleteExtractor(id) {
  // remove key entities (hidden input fields) from DOM
  var hiddenInput = $("#recordForm, #modifyForm").find('[type="hidden"][name*="'+id+'-"]');
  hiddenInput.remove();
  $('#graph-'+id).remove();

  // remove the extraction information from the extractions' Object
  var splitId = id.split("-");
  var recordId = splitId[0]+"-"+splitId[1]
  var extractionNum = splitId[2]
  extractionsObj[recordId] = extractionsObj[recordId].filter(obj => obj.internalId != parseInt(extractionNum));
}

function modifyExtractor(event,record,id) {
  event.preventDefault();
  // look for the extraction information within the extractions Object
  var extractionNumber = parseInt(id.replace(record,'').replace('-',''));
  var extractions = extractionsObj[record];
  const extraction = extractions.find(obj => obj.internalId == extractionNumber);
  const extractionParameters = extraction ? extraction["metadata"] : undefined;
  const extractorType = extractionParameters.type

  // hide the extraction table row
  if ($("#graph-"+id).parent().parent().find('tr').length == 1) {
    $("#graph-"+id).parent().parent().parent().addClass('hidden');
  }
  $("#graph-"+id).parent().remove();

  
  // generate the form for the extraction
  generateExtractor("imported-graphs-"+record,extractionNumber);
  var extractor = $('#extractor');
  extractor.val(extractorType);
  addExtractionForm(extractor,record,extractionNumber);

  // fill the extraction form with previously provided values
  if (extractorType == 'api') {
    const url = extractionParameters.url;
    const query = extractionParameters.query;
    const results = extractionParameters.results;

    // set the URL
    $('#ApiUrl').val(url);
    // set the query 
    for (const [key, value] of Object.entries(query)) {
      const addButton = $('.add-parameter');
      generateExtractionParameter(addButton);
      const newParameterDiv = addButton.prev('.api-query-parameter').find('input');
      newParameterDiv.eq(0).val(key);
      newParameterDiv.eq(1).val(value);
    }
    // set the results' keys
    $('.api-results-parameter input[value]').each(function() {
      console.log($(this))
      $(this).next().val(results[$(this).val().toLowerCase()]);
    })
    
  } else if (extractorType == 'sparql' || extractorType == 'file') {
    const url = extractionParameters.url;
    const query = extractionParameters.query;

    // set the URL
    $('#SparqlUrl, #FileUrl').val(url);

    // set the SPARQL query
    $('#yasqe > .yasqe').remove();
    var yasqe = YASQE(document.getElementById("yasqe"), {
      sparql: {
        showQueryButton: false,
      }
    });
    yasqe.setValue(query);
    
  }
}

/* Extraction Form */

// create a new form based on the selected option (API, SPARQL, static file)
function addExtractionForm(element,extractorId,extractionInternalId) {
  if ($('.block_field.col-md-12').length > 0) {
    $('.block_field.col-md-12 section').not(":first").remove();
  }
  var extractionId = extractorId+'-'+extractionInternalId.toString(); // it will be used to create hidden inputs later
  var extractionType = $(element).find(":selected").val(); // selected option (API, SPARQL, or static file)

  $('.block_field .extractor-1, .block_field hr').remove() // remove previously created forms (in case the user changes the selected option)
  if (extractionType == 'api') {
    var form = $("<hr><section class='row extractor-1'>\
    <label class='col-md-12' style='text-align: left !important; margin-left: 5px'>API access point<br><span class='comment'>url of the API</span></label>\
    <input type='text' id='ApiUrl' placeholder='e.g.: https://exampleApi.org/search'></input>\
    </section>\
    <section class='row extractor-1'>\
      <label class='col-md-12' style='text-align: left !important; margin-left: 5px'>QUERY PARAMETERS<br><span class='comment'>write one value per row</span></label>\
      <div class='extraction-form-div'>\
        <span class='extraction-form-label'>KEY</span><span class='extraction-form-label'>VALUE</span>\
      </div>\
      <p class='extractor-comment'>No parameters available: add a new one</p><span class='add-parameter'>Add new <i class='fas fa-plus'></i></span>\
    </section>\
    <section class='row extractor-1'>\
      <label class='col-md-12' style='text-align: left !important; margin-left: 5px'>RESULT DICTIONARY<br><span class='comment'>write one value per row</span></label>\
      <div class='extraction-form-div'>\
        <span class='extraction-form-label'>KEY</span><span class='extraction-form-label'>VALUE</span>\
      </div>\
      <div class='extraction-form-div api-results-parameter'>\
        <input type='text' class='extraction-form-input' value='Array'><input type='text' class='extraction-form-input'>\
      </div>\
      <div class='extraction-form-div api-results-parameter'>\
        <input type='text' class='extraction-form-input' value='URI'><input type='text' class='extraction-form-input'>\
      </div>\
      <div class='extraction-form-div api-results-parameter'>\
        <input type='text' class='extraction-form-input' value='Label'><input type='text' class='extraction-form-input'>\
      </div>\
    </section>\
    ")
  } else if (extractionType == 'sparql') {
    var form = $("<hr><section class='row extractor-1'>\
    <label class='col-md-12' style='text-align: left !important; margin-left: 5px'>SPARQL endpoint<br><span class='comment'>url of the endpoint</span></label>\
    <input type='text' id='SparqlUrl' placeholder='e.g.: https://exampleSparql.org/sparql'></input>\
    </section>\
    <section class='row extractor-1'>\
    <label class='col-md-12' style='text-align: left !important; margin-left: 5px'>QUERY<br><span class='comment'>a sparql query to be performed</span></label>\
    <div id='yasqe' class='col-md-12' data-id='"+extractionId+"'>\
    </section>");
  } else if (extractionType == 'file') {
    var form = $("<hr><section class='row extractor-1'>\
    <label class='col-md-12' style='text-align: left !important; margin-left: 5px'>FILE URL<br><span class='comment'>a URL to an external resource (a .json or .csv file)</span></label>\
    <input type='text' id='FileUrl' placeholder='http://externalResource.csv'></input>\
    </section>\
    <section class='row extractor-1'>\
    <label class='col-md-12' style='text-align: left !important; margin-left: 5px'>QUERY<br><span class='comment'>a sparql query to be performed</span></label>\
    <div id='yasqe' class='col-md-12' data-id='"+extractionId+"'>\
    </section>");
  } else {
    var form = "";
  }

  // navigation button
  var buttons = $("<section class='row extractor-1'>\
    <input id='"+extractionType+"-back-1' class='btn btn-dark extractor-1' style='margin-left:20px' value='Back' onClick='prevExtractor(\"extractor-1\", \"form_row\", true,\""+extractionId+"\")'>\
    <input id='"+extractionType+"-next-1' class='btn btn-dark extractor-1' style='margin-left:20px' value='Next' onClick='nextExtractor(this, \""+extractionId+"\", \""+extractionType+"\")'>\
  </section>");
  
  // add event listener to form buttons
  form.find('.add-parameter').on('click', function() {
    generateExtractionParameter(this);
  });
  
  // add the new form to the webpage and show YASQE editor when needed
  $(element).closest('.row').after(buttons).after(form);
  if (extractionType == 'sparql' || extractionType == 'file') {
    var yasqe = YASQE(document.getElementById("yasqe"), {
      sparql: {
        showQueryButton: false,
      }
    });
  }

  $('.extraction_documentation').show();
  $('.extraction_documentation section').hide();
  $('.extraction_documentation_'+extractionType).show();
}

// parse the extraction parameters and send requests
function nextExtractor(element, id, type) {
  // retrieve extractor Id and extraction count
  var splitId = id.split('-');
  var extractionCount = parseInt(splitId[2]);
  var extractorId = splitId[0]+'-'+splitId[1];

  // retrieve YASQE query (type=='file'/'sparql')
  let query = "";
  let newLine = "";
  var yasqeQueryRows = $('[data-id="'+id+'"]').find('.CodeMirror-code>div');
  yasqeQueryRows.each(function() {
    var tokens = $(this).find('pre span span');
    query+=newLine
    tokens.each(function() {
      query += $(this).hasClass('cm-ws') ? ' ' : $(this).text();
      newLine="\n";
    });
    
  });
  
  // collect all the query information and store it into an Object
  const objectItem = {};
  if (type == "api") {
    objectItem["type"] = "api";
    objectItem["url"] = $('#ApiUrl').val();
    var queryParameters = getExtractionParameters('query',element);
    var resultsParameters = getExtractionParameters('results',element);

    if (queryParameters !== false && resultsParameters !== false) {
      objectItem["query"] = queryParameters
      objectItem["results"] = resultsParameters
    } else {
      alert("Please, check your parameters before proceeding");
      return null
    }
    console.log(objectItem);
  } else if (type == "sparql") {
    objectItem["type"] = "sparql";
    objectItem["url"] = $('#SparqlUrl').val();
    objectItem["query"] = query;
  } else if (type == "file") {
    objectItem["type"] = "file";
    objectItem["url"] = $('#FileUrl').val();
    objectItem["query"] = query;
  }

  if (type == "api") {
    // API QUERY:
    $.getJSON(objectItem["url"], objectItem["query"],
	    function(data) {
        // show the query results in a table
        var bindings = showExtractionResult(data,type,id,objectItem);
        objectItem["output"] = bindings;
      }).error(function(jqXHR, textStatus, errorThrown) {
         alert(("error: check your parameters"))
      })
  } else if (type == "file" || type == 'sparql') {
    // FILE QUERY and SPARQL QUERY:
    objecItem = callSparqlanything(objectItem,id,type);
  }

  // add the extraction information, including the results, to the Extractions Object
  var metadataObj = extractionsObj[extractorId].find(obj => obj.internalId == extractionCount);
  metadataObj["metadata"] = objectItem;

  // scroll top
  $('html, body').animate({
    scrollTop: $(element).parent().parent().offset().top - 100
  }, 800);
}

// go back to the previous Extraction page to modify query parameters / hide the Extraction form
function prevExtractor(toHide, toShow, remove=false, id=null) {
  $('.'+toHide).hide();
  $('.'+toShow).filter(function() {
    return $(this).find('.original-subtemplate').length === 0;
  }).show();
  if (remove) {

    // find the Extractions List and access the results dict inside the Extractions Object
    const extractionListId = id.split('-').slice(0, 2).join('-');
    const extractionNumber = parseInt(id.split('-')[2]);
    const extractionItem = extractionsObj[extractionListId].find(obj => obj.internalId == extractionNumber)
    if ('output' in extractionItem.metadata) {
      var results = extractionItem.metadata.output;

      // if results exist, create a new list item to collect each retrieved URI,label pair in the form of a tag (containing an hidden input)
      if (results.length>0) {
        generateExtractionTagList($('#imported-graphs-'+extractionListId).parent(),extractionListId,results,id);
      }
    }

    console.log("c",extractionListId)
    // hide the Extraction documentation and the Extraction form, then show the list of Extractions
    $('.extraction_documentation').hide();
    $('#imported-graphs-'+extractionListId).next().remove();
    $('#imported-graphs-'+extractionListId).parent().parent().next('.block_field').hide();
    $('#imported-graphs-'+extractionListId).show();
  }  
}

/* API */

// generate a couple of input fields to add a query parameter
function generateExtractionParameter(element, label=null) {
  // hide the comment "no paramaters available"
  if ($(element).prev('.extractor-comment').length>0) {
    $(element).prev('.extractor-comment').hide();
  }
  // add a new couple (key,value) of input fields 
  var newParameterDiv = $("<div class='extraction-form-div api-query-parameter'>\
    <input type='text' class='extraction-form-input'><input type='text' class='extraction-form-input'>\
    <i class='fas fa-times' onclick='removeExtractionParameter(this)'></i>\
  </div>");
  $(element).before(newParameterDiv);
}

// remove a couple of input fields from query parameters
function removeExtractionParameter(element) {
  var parentDiv = $(element).parent().parent();
  $(element).parent().remove();
  if (parentDiv.find('.extraction-form-input').length === 0) {
    parentDiv.find('.extractor-comment').show();
  }
}

// get parameters for API query
function getExtractionParameters(type,element) {
  var extractionForm = $(element).parent().parent();
  var extractionQueryParameters = extractionForm.find('.api-'+type+'-parameter');
  var parametersObj = new Object();
  var hasEmptyParameter = false;

  extractionQueryParameters.each(function() {
    console.log($(this).find('input').eq(0));

    var parameterKey = $(this).find('input').eq(0).val();
    var parameterValue = $(this).find('input').eq(1).val();

    if (parameterKey !== '' && parameterValue !== '') {
      if (type=='results') {
        parameterKey = parameterKey.toLowerCase();
      }
      parametersObj[parameterKey] = parameterValue;
    } else {
      hasEmptyParameter = true;
      return false
    }
  });

  if (hasEmptyParameter) {
    return false;
  } else {
    return parametersObj; 
  }
}

/* SPARQL, File */

// call back-end API to perform SPARQL.Anything queries
function callSparqlanything(objecItem, id, type) {
  var q = objecItem.query;
  var endpoint = objecItem.url;

  // modify the query to make it ready for SPARQL.Anything
  var encoded;
  if (type === 'file') {
    encoded = encodeURIComponent(q.includes("<x-sparql-anything:"+endpoint+">") ? q : q.replace("{", "{ SERVICE <x-sparql-anything:"+endpoint+"> {").replace("}", "}}"));
  } else if (type === 'sparql') {
    encoded = q.includes("SERVICE") ? encodeURIComponent(q) : encodeURIComponent(q.replace("{", "{ SERVICE <" + endpoint + "> {").replace("}", "}}"));
  };

  // send the query to the back-end API and parse the results
  $.ajax({
    type: 'GET',
    url: '/sparqlanything?q=' + encoded,
    success: function(resultsJsonObject) {
      // show results inside a table
      var bindings = showExtractionResult(resultsJsonObject,type,id);
      objecItem['output'] = resultsJsonObject.results.bindings
      return objecItem;
    },
    error: function() {
      alert(("error: check your parameters"))
    }
  });
}

/* Results handling */

function showExtractionResult(jsonData,type,id,objectItem=null) {
  // base module
  let bindings = [];
  const resultSection = $("<section class='extractor-2'></section");
  const resultTable = $('<table border="1"></table>');

  // store the results as a JSON object following the SPARQL response structure
  if (type==='api') {
    resultTable.append("<tr><th>LABEL</th><th>URI</th></tr>");

    // set the results paths
    var jsonResults = objectItem["results"];
    var mainPath = jsonResults.array.split(".");
    let resultsArray = jsonData;
    mainPath.forEach(key => {
      resultsArray = resultsArray[key];
    });
    
    resultsArray.forEach(function(res) {
      // extract a label for each term
      let labelPath = jsonResults.label.split(".");
      let label = res;
      labelPath.forEach(key => {
        label = label[key];
      });
      // extract the URI value for each term
      let uriPath = jsonResults.uri.split(".");
      let uri = res;
      uriPath.forEach(key => {
        uri = uri[key];
      });
      
      // create a new table row, append it to the table, and store each term information
      var resultTableRow = $('<tr><td>' + label + '</td><td>' + uri + '</td></tr>');
      resultTable.append(resultTableRow);
      bindings.push({"uri": {'value':uri, 'type':'uri'}, 'label': {'value':label, 'type':'literal'}});
    });
  } else if (type==='sparql' || type==='file') {

    var labels = jsonData.head.vars
    var tr = $('<tr></tr>');
    for (var i = 0; i < labels.length; i++) {
      var th = $('<th>' + labels[i] + '</th>');
      tr.append(th);
    }
    resultTable.append(tr);

    bindings = jsonData.results.bindings
    for (let idx=0; idx<bindings.length; idx++){
      var result = bindings[idx];
      var resultTableRow = $('<tr></tr>');
      for (let i=0; i<labels.length; i++){
        var label = labels[i];
        if (result[label].value.startsWith("https://") || result[label].value.startsWith("http://")) {
          var item = "<a href='"+result[label].value+"' target='_blank'>"+result[label].value+"</a>";
        } else {
          var item = result[label].value;
        }
        var td = $('<td>' + item + '</td>')
        resultTableRow.append(td);
      }
      resultTable.append(resultTableRow)
    }
  }
  resultSection.append(resultTable);

  // manage navigation buttons and results pagination
  var buttonList = "<section class='row extractor-2'>\
    <input id='api-back2' class='btn btn-dark extractor-2' style='margin-left:20px' value='Back' onClick='prevExtractor(\"extractor-2\", \"extractor-1\")'>\
    <input id='api-next2' class='btn btn-dark extractor-2' style='margin-left:20px' value='Import' onClick='prevExtractor(\"extractor-2\", \"form_row\", true,\""+ id+"\")'>\
  </section>";
  $('.extractor-1').hide();
  $('.import-form.block_field .block_field').append(resultSection);
  $('.import-form.block_field .block_field').append(buttonList);
  if (bindings.length > 25) {extractorPagination(bindings)};

  return bindings
}

function extractorPagination(results) {
  var length = results.length;
  var remainder = length%25;
  if (remainder > 0) {
    var total = Math.floor(length/25) + 1;
  } else {
    var total = Math.floor(length/25);
  }
  if (length > 25) {
    var hide_results = $('.extractor-2').find('tr').slice(25, length);
    hide_results.addClass('hidden-result');
  }
  var page_section = $('<section class="pagination row justify-content-md-center justify-content-lg-center extractor-2"></section>')
  for (let n=0; n<total;n++) {
    var page_n = n + 1
    var button=$('<input id="page_'+page_n+'" class="btn btn-dark extractor-2" value="'+page_n+'" onClick="changeResultsPage(\''+page_n+'\', \''+length+'\')">');
    page_section.append(button)
  }
  $('.block_field').append(page_section);
}

function changeResultsPage(page_n, length) {
  var starting_result = 25 * (parseInt(page_n)-1);
  console.log(page_n, starting_result)

  $('.extractor-2').find('tr').addClass('hidden-result');
  if (length >= starting_result+25) {
    var show_results = $('.extractor-2').find('tr').slice(starting_result, starting_result+25);
  } else {
    var show_results = $('.extractor-2').find('tr').slice(starting_result, length);
  }
  show_results.removeClass('hidden-result');
  $('.extractor-2').find('th').parent().removeClass('hidden-result');
  window.scrollTo(0, 0);
}

/* END KNOWLEDGE EXTRACTION */


// TODO: bring it to the right position within this file
function checkMandatoryFields(subrecordButton=false){
  var isValid = true;
  
  if (subrecordButton) { var fields = $(subrecordButton).parent().parent().find('[data-mandatory="True"]:visible'); } else { var fields = $('[data-mandatory="True"]:visible'); }
  fields.each(function() {
    if ($(this).val() === '' && !$('[data-input="'+$(this).attr('id')+'"]').length) {
      console.log($(this));
      /* in principle, the header could be changed through the back-end application. 
      However, this would cause the loss of all inserted values. */
      if (subrecordButton) { alert("Check Mandatory Fields!")}
      else { $('header').find('h3').eq(0).text("The form is not valid, please check mandatory fields") }
      window.scrollTo(0, 0);
      isValid = false;
    }
  })

  if (typeof extractionsObj !== 'undefined' && $('#extractions-dict').length === 0) {
    var objToString = encodeURIComponent(JSON.stringify(extractionsObj)); 
    $('#recordForm, #modifyForm').append('<input id="extractions-dict" name="extractions-dict" type="hidden" value="'+objToString+'">');
  } else if (typeof extractionsObj !== 'undefined' && $('#extractions-dict').length > 0) {
    var objToString = encodeURIComponent(JSON.stringify(extractionsObj)); 
    $('#recordForm, #modifyForm').find('#extractions-dict').attr('value',objToString);
  }

  return isValid;

}