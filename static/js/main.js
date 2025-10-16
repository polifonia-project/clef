
if (graph.length) {var inGraph = "FROM <"+graph+">"} else {var inGraph = ""}
const wdImg = '<img src="https://upload.wikimedia.org/wikipedia/commons/d/d2/Wikidata-logo-without-paddings.svg"/>'
const wdImgIcon = '<img src="https://upload.wikimedia.org/wikipedia/commons/d/d2/Wikidata-logo-without-paddings.svg" style="max-width:25px"/>'
const geoImg = '<img src="https://www.geonames.org/img/globe.gif"/ style="max-width:30px">';
const viafImg = '<img src="https://upload.wikimedia.org/wikipedia/commons/0/01/VIAF_icon.svg"/>';
const viafImgIcon = '<img src="https://upload.wikimedia.org/wikipedia/commons/0/01/VIAF_icon.svg" style="max-width:18px"/>'
const orcidImg = '<img src="https://upload.wikimedia.org/wikipedia/commons/1/14/ORCID_logo.svg"/>';
const orcidImgIcon = '<img src="https://upload.wikimedia.org/wikipedia/commons/0/06/ORCID_iD.svg" style="max-width:18px"/>'
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

  // show existing TEMPLATES
  $("#showTemplateClassButton").on('click', function() {
    // show modal
    showTemplates();
  });

  // create a new TEMPLATE
  $("#selectTemplateClassButton").on('click', function() {
    // show modal
    addTemplate();
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
    var primary_key = $('.disambiguate:checked');
    primary_key.parent().parent().find('input[id*="mandatory"]').prop("checked", true);

    // prevent mandatory fields to be hidden 
    var mandatory_fields = $('input[type="checkbox"][id*="mandatory"]:checked');
    mandatory_fields.each(function() {
      var hidden_field_checkbox = $(this).parent().parent().find('input[type="checkbox"][id*="hidden"]');
      if (hidden_field_checkbox.prop('checked')) {
        Swal.fire({ title:"Hidden fields cannot be mandatory"});
        return false;
      } 
    });

    // save action value
    $('<input>').attr({
        type: 'hidden',
        name: 'action',
        value: $(this).val()
    }).appendTo('#templateForm');

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
	$('.tip').tooltip({
    container: 'body'
  });

  // fields without tooltip
  $('.input_or_select').not(':has(.tip)').css("padding-left","3.2em");

  // check prior records and alert if duplicate
  checkPriorRecords('disambiguate');

	// Named Entity Recognition in long texts
  const areas = document.querySelectorAll('#recordForm textarea, #modifyForm textarea');
  areas.forEach(element => {
    const tags = document.createElement('div');
    tags.setAttribute('class','tags-nlp');
    element.after(tags);
  });

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

    if ( $(this).hasClass('searchOrcid') ) {
			searchOrcid(searchID);
		};

    if ( $(this).hasClass('searchWorldcat') ) {
      searchWorldcat(searchID);
    }

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
    var height = $(this).attr("name") == "class_description" ? 60 : (this.scrollHeight)/2;
    var styleAttr= 'height:' + height + 'px;overflow-y:hidden;';
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
		var menuRight = $('#cbp-spmenu-s2'),
        showRight = $('#showRight'),
        tableOfContents = $('#table-of-contents'),
        formSection = $('#form-section'),
        body = $('body');

    // update help button position
    function updateButtonPosition() {
      showRight.hide();
      setTimeout(function () {
        let rect = menuRight[0].getBoundingClientRect();
        showRight.css({ left: rect.left - 39 + 'px' });
        showRight.show();
      }, 300);
    }

		showRight.on('click', function () {
      $('main').toggleClass('documentation-modal');
      menuRight.toggleClass('cbp-spmenu-open');
      var isOpen = menuRight.hasClass('cbp-spmenu-open');
      showRight.html(isOpen ? '<i class="fas fa-times"></i> help' : '<i class="far fa-lightbulb"></i> help');

      // opening animation
      var distance = isOpen ? '-=25.5vw' : '+=25.5vw';
      tableOfContents.animate({ left: distance }, 300);
      formSection.animate({ left: distance }, 300);

      if (isOpen) {
        updateButtonPosition();
        $(window).on('resize scroll', updateButtonPosition);
      } else {
        showRight.css({ left: 'auto' });
        $(window).off('resize scroll', updateButtonPosition);
      }
    });
	};

	// append WD icon to input fields
	$('.searchWikidata').parent().prev().append(wdImg);
  $('.searchWikidata').parent().prev().append(viafImg);
  $('.searchOrcid').parent().prev().append(orcidImg);
  $('.searchGeonames').parent().prev().append(geoImg);
  $('.wikiEntity').append(wdImgIcon);
  $('.geoEntity').append(geoImg);
  $('.orcidEntity').append(orcidImgIcon);
  $('.viafEntity').append(viafImgIcon);
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
    $(this).parent().prev('div').toggleClass('active');
    if (! $(this).find('input').prop('checked')) {
      var inputField = $(this).closest("section").find('input.searchWikidata');
      var id = inputField.attr('id');
      inputField.hide();
      inputField.after($('<span class="manual-entity" data-target="'+id+'">URI</span><input class="col-md-12 manual-entity" id="'+id+'_uri" name="'+id+'_uri" type="text" value="" data-class="'+inputField.attr('data-class')+'" placeholder="https://www.wikidata.org/wiki/Q123">'));
      inputField.next().next().after($('<span class="manual-entity" data-target="'+id+'">Label</span><input class="col-md-12 manual-entity" id="'+id+'_label" name="'+id+'_label" type="text" value="" data-class="'+inputField.attr('data-class')+'" placeholder="September">'));
      inputField.parent().find("input[type='text']").on('keyup keypress', function(e) {
        var keyCode = e.keyCode || e.which;
        if (keyCode === 13) {
          e.preventDefault();
          return false;
        }
      });
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

  // sort alphabetical filters
  $(".alphabet").each(function () {
    var allValues = $(this).parent().find(".list").get();

    allValues.sort(function (a, b) {
      let textA = $(a).find("a").text().toUpperCase(); // Testo di <a> in maiuscolo
      let textB = $(b).find("a").text().toUpperCase();
      return textA.localeCompare(textB); // Confronta alfabeticamente
    });

    $(this).after(allValues);

  })

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
  if (triggerTabList.length > 0) {
    triggerTabList[0].click();
  }
  
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
    } else if ($(this).attr('href').startsWith('http://viaf.org/viaf/')) {
      $(this).parent().append(viafImgIcon);
    } else if ($(this).attr('href').startsWith('https://orcid.org/')) {
      $(this).parent().append(orcidImgIcon);
    }
  })
  // show related resources in "term" page
  $(".showRes").on("click", function() {
    var data = {
        count: $(this).data("count"),
        uri: $(this).data("uri"),
        class: $(this).data("class"),
        subclasses: $(this).data("subclasses"),
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
    $(this).closest(".block_field").remove();
    if ($(this).closest(".block_field").find("select").eq(0).val() === "Subclass") {
      $(this).closest(".block_field").find("[id*='addons'] label > .fa-trash-alt").each(function() {

        // TODO: complete iteration
        $(this).click();
      });
    }
  });

  // language tags handling
  $('form:not(#setupForm) [lang]').each(function() {
    modifyLangInputs($(this));
  });

  // multiple languages final visualization
  $('.info-item [xml\\:lang]').each(function(){
    visualize_subrecord_literals($(this));
  })

  // visualize subrecords ('Subtemplate' fields)
  $('.subtemplateField').each(function() {
    visualize_subrecord($(this));
  });

  $('#recordForm textarea, #modifyForm textarea').each(function() {
    $(this).on('click', nlpText($(this).attr('id')))
  })

  // sort keywords by class (view)
  $('.info-graphic-items').each(function() {
    sortKeywordsByClass(this);
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
function modifyLangInputs(el) {
  var baseId = $(el).attr('id').split('_')[0];

  // check if it's first of type
  if ($(el).is('[lang]:first-of-type')) {

    // add language icon
    $(el).parent().prev().append($('<i class="material-icons" onclick="languageForm(this)">translate</i>'));

    if (!($(el).hasClass('subrecord-field'))) {

      var newId = baseId+"_"+$(el).attr('lang');
      $(el).attr('name',newId);
      $(el).attr('id',newId);
      var lang = $(el).attr('lang').toUpperCase();

      // create a div to store different language tags, then add the first language
      const languagesList = $('<div class="languages-list" id="languages-'+baseId+'"></div>'); 
      const firstLang = $('<a class="lang-item selected-lang" title="text language: '+lang+'" onclick="show_lang(\''+newId+'\')">'+lang+'</a>');

      // primary keys: specify main language
      if ($(el).hasClass('disambiguate')) {

        if ($('#'+baseId+'_mainLang').length == 0) {
          // create a hidden input to store the main language of the field
          const hiddenMainLang = $('<input type="hidden" id="'+baseId+'_mainLang" name="'+baseId+'_mainLang" value="'+$(el).attr('lang')+'"/>')
          $(el).after(hiddenMainLang);
          firstLang.addClass('main-lang');
        } 
        else if ($('#'+baseId+'_mainLang').val() === $(el).attr('lang')) {
          // make the current language the main one
          firstLang.addClass('main-lang');
        }
      }
      languagesList.append(firstLang);
      $(el).before(languagesList);
    }
  } 
  else {

    // language tags handling: other lang, i.e. not the first one (only in modify and review)
    var mainLang = $('#'+baseId+'_mainLang').val();
    var lang = $(el).attr('lang');
    const languagesList = $('#languages-'+baseId);
    const otherLang = $('<a class="lang-item" title="text language: '+lang.toUpperCase()+'" onclick="show_lang(\''+$(el).attr('id')+'\')">'+lang.toUpperCase()+'</a>');
    if ($(el).hasClass('disambiguate') && lang===mainLang) {

      var firstLang = languagesList.find('a:first-child');

      // make this language the main one, then show the corresponding input field
      otherLang.addClass('main-lang');
      otherLang.addClass('selected-lang');
      firstLang.removeClass('selected-lang');
      firstLang.before(otherLang);
      $('#'+baseId+'_'+firstLang.text().toLowerCase()).hide();
      $(el).show();

    } else {

      // add this language as a secondary one, then hide the corresponding input field
      languagesList.append(otherLang);
      $(el).hide();

    }
    $(el).closest("section").prepend(languagesList);
  }
}

function languageForm(el) {
  if ($('#lang-form').length > 0) {
    $('#lang-form').remove();
  } else {
    // set the language form style properties
    var height = $(el).offset().top + 32 + "px";
    var left = $(el).offset().left - 348 +"px";
    var current_lang = $(el).parent().next().find('.selected-lang').text().toLowerCase();
    var input = $(el).parent().next().find('textarea, input').filter(':visible');
    var field_id = input.attr('id');

    // set a variable to modify the subrecord's list of fields in case the textbox is part of a subtemplate
    var subform = input.data('subform');
    var modify_subform = subform ? subform : null
    

    const lang_form = $('<section id="lang-form" data-input="'+field_id+'"></section>');
    const change_language = $('<section class="form_row"><label>Change current language:</label><input type="textbox" class="custom-select" placeholder="Select a new language" onclick="activateFilter(this)"></input><div class="language-options"></div></section>');
    const add_language = $('<section class="form_row"><label>Add another language:</label><input type="textbox" class="custom-select" placeholder="Select a new language" onclick="activateFilter(this)"><div class="language-options"></input></div></section>')
    const main_lang = $('<section class="form_row"><label>Set this field primary language:</label><select class="custom-select"></select></section>');
    main_lang.find('select').on('change', function() {changeMainLang(this,modify_subform)});
    const remove_lang = $('<section class="form_row"><label>Remove current language: </label> <i class="far fa-trash-alt" onclick="removeCurrentLanguage(this,\''+modify_subform+'\')"></i></section>');
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
              change_select.on("click", function(e) {
                e.preventDefault();
                changeCurrentLanguage(this,modify_subform);
              });
              add_select.on("click", function(e) {
                e.preventDefault();
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
          var currentLanguages = $(el).parent().next().find('.lang-item');
          currentLanguages.each(function() {
            var langTag = $(this).text().toLowerCase();
            var extendedLangLabel = change_language.find('[href="#'+langTag+'"]').attr('lang');
            var langOption = $('<option value="'+langTag+'">'+extendedLangLabel+' ('+langTag+')</option>');
            if ($(this).hasClass("main-lang")) {
              langOption.attr('selected', 'selected');
            }
            main_lang.find('select').append(langOption);
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
  var newLang = $(el).attr('href').replace("#",""); // selected lang
  var lastLangInputId = $("#lang-form").data("input"); // last language input id
  var inputBaseId = lastLangInputId.split('_')[0]; // base id of the input field

  const newLangInput = $('#'+lastLangInputId).clone();
  var newLangInputId = inputBaseId + "_" + newLang;
  var languagesDivId = '#languages-'+inputBaseId;
  if (record) {newLangInputId += '_' + record; languagesDivId += '_' + record} // subrecord only
  $(languagesDivId).find('.selected-lang').removeClass('selected-lang');
  $(languagesDivId).append("<a class='lang-item selected-lang' title='text language: "+newLang.toUpperCase()+"' onclick='show_lang(\""+newLangInputId+"\")'>"+newLang.toUpperCase()+"</a>");
  
  newLangInput.attr('id', newLangInputId);
  newLangInput.attr('name', newLangInputId);
  newLangInput.attr('lang', newLang);
  newLangInput.val('');
  if (newLangInput.is('textarea')) {
    newLangInput.on('click', function() {
        nlpText(newLangInputId);
    });
  }

  $('#'+lastLangInputId).hide(); 
  $('#'+lastLangInputId).after(newLangInput);
  $("#lang-form").remove();
}

function changeCurrentLanguage(el,record) {
  var newLang = $(el).attr('href').replace("#",""); // selected new lang
  var lastLangInputId = $("#lang-form").data("input"); // last language input id
  var inputBaseId = lastLangInputId.split('_')[0]; // base id of the input field
  
  let languagesDivId = '#languages-'+inputBaseId; 
  let newLangInputId = inputBaseId + "_" + newLang; // set the new id based on the selected language
  if (record) {newLangInputId += '_' + record; languagesDivId += '_' + record} // subrecord only
  var currentLangTag = $(languagesDivId).find('.selected-lang').eq(0);

  if (currentLangTag.text().toLowerCase() !== newLang) {
    var title = 'text language: '+newLang.toUpperCase();
    currentLangTag.attr('title',title);
    currentLangTag.attr('onclick','show_lang("'+newLangInputId+'")');
    currentLangTag.text(newLang.toUpperCase());
    $('#'+lastLangInputId).attr('name',newLangInputId);
    $('#'+lastLangInputId).attr('id',newLangInputId);
    $('#'+newLangInputId).attr('lang',newLang);
    $("#lang-form").remove();

    // check whether this value is the primary key of a subrecord 
    $('[value*="'+lastLangInputId+'"]').each(function() {
      var newValue = $(this).val().replace(lastLangId,newLangInputId);
      $(this).val(newValue);
    });
  } 
  if (currentLangTag.hasClass('main-lang')) {
    let mainLangInputId = '#'+inputBaseId+'_mainLang';
    if (record) { mainLangInputId += '_' + record; }
    $(mainLangInputId).val(newLang);
  }
  
}

function changeMainLang(el,record) {
  var langForm = $(el).closest("#lang-form");
  var lastLangInputId = langForm.data("input");
  let baseId = lastLangInputId.split('_')[0];
  var newMainLang = $(el).val(); // new selected lang
  langForm.remove();

  // modify the current main language with the new one
  let languagesDivId = '#languages-'+baseId;
  let mainLangInputId = '#'+baseId+'_mainLang'
  if (record) { languagesDivId += '_' + record; mainLangInputId+='_'+record; }
  $(languagesDivId).find('.main-lang').removeClass('main-lang'); 
  $(languagesDivId).find('[title="text language: '+newMainLang.toUpperCase()+'"]').addClass('main-lang');
  $(mainLangInputId).val(newMainLang);
}

function removeCurrentLanguage(el,record) {
  var langForm = $(el).closest("#lang-form");
  var lastLangInputId = langForm.data("input");
  let baseId = lastLangInputId.split('_')[0];
  let languagesDivId = '#languages-'+baseId;
  if (record) { console.log(record); languagesDivId += '_' + record; }

  var currentLangTag = $(languagesDivId).find('.selected-lang'); // get selected lang to remove it
  console.log(currentLangTag)
  if (currentLangTag.hasClass("main-lang")) {
    // cannot change primary language
    alert('Not allowed. Change primary language, instead');
  } else if (currentLangTag.next('a').length > 0 && !currentLangTag.hasClass("main-lang")) {
    // switch to next language then remove current one
    currentLangTag.next('a').addClass('selected-lang');
    var nextLang = currentLangTag.next('a').text().toLowerCase();
    let nextLangInputId = '#'+baseId+'_'+nextLang;
    if (record) {nextLangInputId+='_'+record} 
    currentLangTag.remove();
    $('#'+lastLangInputId).remove();
    $(nextLangInputId).show();
  } else if (currentLangTag.prev('a').length > 0 && !currentLangTag.hasClass("main-lang")) {
    // switch to previous language then remove current one
    currentLangTag.prev('a').addClass('selected-lang');
    var prevLang = currentLangTag.prev('a').text().toLowerCase();
    let prevLangInputId = '#'+baseId+'_'+prevLang;
    if (record) {prevLangInputId+='_'+record} 
    currentLangTag.remove();
    $('#'+lastLangInputId).remove();
    $(prevLangInputId).show();
  } else {
    alert('Not allowed. Change current language, instead');
  }

  // close form
  langForm.remove();
}

function show_lang(fieldId) {
  let baseId = fieldId.split('_')[0];
  let subrecordId = fieldId.split('_').length === 3 ? fieldId.split('_')[2] : "";
  var languagesDivId = subrecordId === "" ? '#languages-'+baseId : '#languages-'+baseId+'_'+subrecordId;
  $('[id^="'+baseId+'_"]').each(function() {
    if (subrecordId !== "" && $(this).attr("id").endsWith(subrecordId)) {
      $(this).hide();      
    } else if (subrecordId === "" && $(this).attr("id").split("_").length === 2) {
      $(this).hide();      
    }
  });
  $('#'+fieldId).show();
  var targetLang = fieldId.split('_')[1];
  $(languagesDivId).find('.selected-lang').removeClass('selected-lang');
  $(languagesDivId).find('[title="text language: '+targetLang.toUpperCase()+'"]').addClass('selected-lang');
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
    $(this).append('<span class="subtemplate"><i class="fa fa-chevron-down" aria-hidden="true"></i></span>')
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
    var calledRecord = externalLink.attr('href').replace("term?id=", "view-");
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
      error:function(err) {
          console.log("Error: requested resource is not available"),
          console.log(err);
      }
    })
  }); 
}

function visualize_subrecord_literals(el) {
  // retrieve the Record Main Language and the Language of the current value
  var recordMainLang = $('h2.articleTitle').attr('xml:lang')
  var lang = $(el).attr('xml:lang');

  // create a language Tag to select this language
  const languageTag = $('<a class="lang-item">'+lang.toUpperCase()+'</a>');
  if ($(el).prev('p').length != 1) {
    const languagesList = $('<div class="info-language"></div>');
    languageTag.addClass('selected-lang');
    $(el).before(languagesList.append(languageTag));
  } else {
    $(el).parent().find('.info-language').append(languageTag);
    $(el).hide();
  }

  // show Value (based on language) on click
  languageTag.on('click', function() {
    var newLang = $(this).text().toLowerCase();
    $(this).parent().parent().find('p').hide();
    $(this).parent().parent().find('p[xml\\:lang="'+newLang+'"]').show();
    $(this).parent().find('.selected-lang').removeClass('selected-lang');
    $(this).addClass('selected-lang');
  });

  // try to activate Main Language
  if (recordMainLang === lang) {
    languageTag.trigger('click'); // Simulate click event
  }
}

//////////////
// BACKEND //
//////////////

function showTemplates() {
  // show modal
  $("#showTemplateClassModal").toggleClass('open-modal');
  $('body').append($("<div class='modal-bg'>"));

  // hide modal
  $("#showTemplateClassModal .fa-times").off('click').on('click', function(e) {
    e.preventDefault();
    $("#showTemplateClassModal").toggleClass('open-modal');
    $("body div.modal-bg").remove();
    return false;
  });
}

function addTemplate(subtemplate=null) {

  // show modal
  $("#selectTemplateClassModal").toggleClass('open-modal');
  $('body').append($("<div class='modal-bg'>"));

  // check class_name
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

  // check class_uri
  $("#selectTemplateClass [name='class_uri']").on('click', function() {
    $(this).off('keyup').on('keyup', function(e) {
      if (e.which == 13 && $(this).val().length > 0) {
        var id = new Date().valueOf().toString();
        $(this).next('section').append("<span class='tag'>"+$(this).val()+"</span><input type='hidden' class='hiddenInput' name='uri_class-"+id+"' value=\""+encodeURIComponent($(this).val())+"\"/>");
        $(this).val('')
      } 
    })
  });

  // hide modal
  $("#selectTemplateClass [value='cancelTemplate'], #selectTemplateClass .fa-times").off('click').on('click', function(e) {
    e.preventDefault();
    $("#selectTemplateClassModal").toggleClass('open-modal');
    $("body div.modal-bg").remove();
    return false;
  });

  // save new template
  $("#selectTemplateClass [value='createTemplate']").on('click', function(e) {
    e.preventDefault();
    validateTemplateClass(subtemplate);
  });
}

function validateTemplateClass(subtemplate) {
  // validate
  var class_name = $("input[name='class_name']").val();
  var class_uris = $('#uri-container').find('input');
  if (class_name == "" || class_uris.length == 0 ) {
    alert("Name and URI must be filled out");
    return false;
  } else if ($("input[name='class_name']").hasClass('error-input')) {
    alert("Check your template Name");
    return false;
  } else if (subtemplate!==null) {
      editSubtemplate(subtemplate);
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
  console.log(event)
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
  } else if (mediaType == 'open-url') {
    window.open(url, '_blank');
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
            if (listTopics.length) {
              $('body').append($("<div class='modal-bg'>"));
              $('main').append($('<section id="modifyNlp" class="open-modal">\
                <section>\
                <span>Extracted kewyords</span>\
              </section>'));
              const table = $('<table id="modifyNlpTable"><tr><th>ENTITY</th><th>CLASS</th></tr></table>');
              for (var i = 0; i < listTopics.length; i++) {

                // query WD for reconciliation
                $.getJSON("https://www.wikidata.org/w/api.php?callback=?", {
                    search: listTopics[i].result,
                    action: "wbsearchentities",
                    language: "en",
                    limit: 5,
                    uselang: "en",
                    format: "json",
                    type: "item",
                    strictlanguage: false
                  },
                  function(data) {
                    console.log(data);

                    // create a custom-select to choose the best result
                    const row = $("<tr>");
                    const customSelect = $("<div class='custom-select custom-select-wrapper'>\
                        <div class='custom-select-trigger'>"+data.search[0].label+"</div>\
                        <div class='custom-options'></div>\
                      </div>");
                    const optionsContainer = customSelect.find(".custom-options");

                    // toggle open/close
                    customSelect.find(".custom-select-trigger").on("click", function() {
                      $(this).siblings(".custom-options").toggle();
                      $(this).closest("tr").siblings("tr").find(".custom-options").hide();
                    });

                    $.each(data.search, function(i, item) {

                      var selected = i === 0; // default value

                      // create custom option
                      const option = $("<div class='custom-option'>");
                      option.append(
                        "<div class='wditem' data-id='" + item.title + "' data-label='" + item.label + "'>\
                          <a class='blue' target='_blank' href='http://www.wikidata.org/entity/" + item.title + "'>" + wdImgIcon + "</a> \
                          <a class='blue'>" + item.label + "</a>" +
                          (item.description ? " - " + item.description : "") +
                        "</div>"
                      );                      
                      if (selected) option.addClass("selected");

                      // select option
                      option.on("click", function() {
                        $(this).siblings().removeClass("selected");
                        $(this).addClass("selected");
                        $(this).closest(".custom-select-wrapper").find(".custom-select-trigger").text(item.label);
                        $(this).closest(".custom-select-wrapper").data("value", item.title);
                        $(this).parent().hide(); // close menu
                      });

                      optionsContainer.append(option);

                    });
                    row.append($("<td>").append(customSelect));

                    // select class based on available extraction classes
                    const selectClass = $("<select class='custom-select'><option value=''>Select from the list</option></select>")
                    if (keywords_classes) {
                      $.each(keywords_classes, function(value, text) {
                        selectClass.append($("<option>", { value: value, text: text }));
                      });
                    }
                    
                    row.append($("<td>").append(selectClass));

                    // append to DOM
                    table.append(row)
                  });
              };

              $("#modifyNlp").append(table)
              $("#modifyNlp").append('<section class="modal-input">\
                      <button class="btn btn-dark" name="action" value="saveKeywords" type="submit">Save</button>\
                      <button class="btn btn-dark discard" value="cancelKeywords" type="submit">Delete</button>\
              </section>');

              $("button[value='saveKeywords']").on('click', function() {
                $("#modifyNlpTable > tbody > tr:gt(0)").each(function() {
                  // retrieve select elements
                  var values = $(this).find(".custom-select");

                  // retrieve wd entity info
                  var selectedEntity = values.eq(0).find(".selected > .wditem");
                  var selectedEntityId = selectedEntity.data("id");
                  var selectedEntityLabel = selectedEntity.data("label");
                  var selectedEntityClass = values.eq(1).val();

                  // append keyword span to DOM
                  $('textarea#'+searchterm).parent().find('.tags-nlp').append('<span class="tag nlp '+selectedEntityId+'" data-input="'+baseID+'" data-id="'+selectedEntityId+'">'+selectedEntityLabel+'</span><input type="hidden" class="hiddenInput '+selectedEntityId+'" name="'+baseID+'_'+selectedEntityId+'" value="'+selectedEntityId+','+encodeURIComponent(selectedEntityLabel)+','+encodeURIComponent(selectedEntityClass)+'"/>');
                
                  // remove modal
                  $(".modal-bg, .open-modal").remove();
                })
              });
              $("button[value='cancelKeywords']").on('click', function() {
                // remove modal
                $(".modal-bg, .open-modal").remove();
              });
            }
            // return something or message
			    }
		    });
		};

	}) );
};

// NLP: display keywords in View
function loadKeywords(graphId, prop) {
  var query = 'SELECT DISTINCT ?keyword ?label WHERE { <'+graphId+'/> <'+prop+'> ?keywordGraph . GRAPH ?keywordGraph { ?keyword rdfs:label ?label } }'
  $.ajax({
    type: 'GET',
    url: myPublicEndpoint + '?query=' + encodeURIComponent(query),
    headers: { Accept: 'application/sparql-results+json; charset=utf-8' },
    success: function(returnedJson) {
      console.log(returnedJson)
      if (returnedJson.results.bindings.length) {
        var section = $(".keywords");
        const subtitle = $('<h4 class="articleSubtitle">Subjects</h4>');
        section.append(subtitle);
        for (let i=0; i<returnedJson.results.bindings.length; i++) {
          var result = returnedJson.results.bindings[i];
          var keywordUri = result.keyword.value;
          var keywordLabel = result.label.value;
          const keyword = $('<p property="'+prop+'">\
              <link property="sameAs" url="'+keywordUri+'"/>\
              <a class="wikiEntity" target="_blank" href="term?id='+keywordUri.split("/")[keywordUri.split("/").length - 1]+'">'+keywordLabel+'</a>\
            </p>');
          keyword.append(wdImgIcon)
          section.append(keyword);
        }

      }
    } 
  });

}

function sortKeywordsByClass(elem) {
  console.log("here")
  var classesArray = [];
  var sectionsObj = {};

  var section = $(elem).closest("section");
  var keywords = section.find("a");
  keywords.each(function() {
    var kwClass = $(this).data("class") !== "" ? $(this).data("class") : "Thing";
    if (classesArray.includes(kwClass)) {
      sectionsObj[kwClass].push($(this).closest("span"));
    } else {
      sectionsObj[kwClass] = [$(this).closest("span")];
      classesArray.push(kwClass);
    }
  });
  console.log(sectionsObj)
  Object.keys(sectionsObj).forEach(function(key) {
    var innerSection = $("<section style='border-bottom: 1px solid #aaa; max-height: 400px; overflow-y: scroll; margin-bottom: 2em;'></section>");
    sectionsObj[key].forEach(function(el) {
      innerSection.append(el);
    });

    var outerSection = $("<section></section>");
    outerSection.append("<h3 class='articleSubtitle'>" + key + "</h3>");
    outerSection.append(innerSection);

    section.append(outerSection);
  });

}


// lookup when creating new records
function checkPriorRecords(elem) {
  $('.' + elem).on('click', function() {
    $(this).off('keyup').on('keyup', function(e) {
      var inputElem = $(this);
      var q = inputElem.val();
      var classes = inputElem.data('class') ? inputElem.data('class').split("; ") : [];
      var res_class = '';

      classes.forEach(function(cls) {
        if (cls.trim() !== '') {
          res_class += ' a <' + cls.trim() + '> ; ';
        }
      });

      var query = "prefix bds: <http://www.bigdata.com/rdf/search#> select distinct ?s (sample(str(?o)) as ?label) "+inGraph+" where { ?s "+res_class+" rdfs:label ?o . ?o bds:search '"+q+"' .} GROUP BY ?s LIMIT 5";
      var encoded = encodeURIComponent(query);

      var tooltip_save = $('<span class="lookup-records" \
        data-toggle="popover" \
        data-container="body"></span>');

      $.ajax({
        type: 'GET',
        url: myPublicEndpoint + '?query=' + encoded,
        headers: { Accept: 'application/sparql-results+json; charset=utf-8' },
        success: function(returnedJson) {
          if (!returnedJson.results.bindings.length) {
            $(".popover").remove();
            tooltip_save.remove();
          } else {
            $(".popover").remove();
            tooltip_save.remove();

            let suggestRecords = "";
            for (i = 0; i < returnedJson.results.bindings.length; i++) {
              var myUrl = returnedJson.results.bindings[i].s.value;
              if (myUrl.substring(myUrl.length - 1) !== "/") {
                var resID = myUrl.substr(myUrl.lastIndexOf('/') + 1);
                suggestRecords += "<div class='wditem'><a class='blue orangeText' target='_blank' href='view-" + resID + "'><i class='fas fa-external-link-alt'></i></a> <a class='orangeText' data-id='" + myUrl + "'>" + returnedJson.results.bindings[i].label.value + "</a></div>";
              }
            }

            var arrow = $('<div class="arrow"></div>');
            inputElem.parent().prepend(tooltip_save);
            inputElem.parent().prepend(arrow);
            $(inputElem).popover('dispose').popover({
              html: true,
              title: "<h4>We already have some resources that match with yours.</h4>",
              content: "<p>If this is the case, consider suggesting a different resource!</p>" + suggestRecords,
              placement: "bottom",
              container: 'body'
            }).popover('show');

            $('.popover').find('.popover-header').append('<span class="close-btn">&times;</span>');
            $('.popover .close-btn').on('click', function() {
              $('.popover').popover('dispose');
            });
          }
        }
      });
    });
  });
}

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

///////////////
// TERM PAGE //
///////////////

// search catalogue resources on click and offset
function searchResources(event, element) {
  var uri = event.data.uri;
  var count = event.data.count;
  var resClass = event.data.class;
  var resSubclasses = event.data.subclasses;
  var offsetQuery = parseInt(event.data.offset_query, 10);
  var limitQuery = parseInt(event.data.limit_query, 10);
  console.log(offsetQuery,limitQuery)
  
  var classes = JSON.parse(resClass.replace(/'/g, '"'));
  var subclasses = (typeof resSubclasses === "string") 
    ? JSON.parse(resSubclasses.replace(/'/g, '"')) 
    : resSubclasses;
  let acceptedClasses = [...classes, ...subclasses];

  let typePatterns = classes.map(cls => `?o rdf:type <${cls}> .`).join(" ");
  let filterNotExists = `
      FILTER NOT EXISTS {
          ?o rdf:type ?otherClass .
          FILTER(?otherClass NOT IN (${acceptedClasses.map(cls => `<${cls}>`).join(", ")}))
      }
  `;
  
  var query = `SELECT DISTINCT ?o (STR(?label) AS ?label_str) ${inGraph} WHERE { 
        {
          GRAPH ?graph { ?o rdfs:label ?label . ${typePatterns} ${filterNotExists} . }
          ?graph ?link ?extractionGraph .
          GRAPH ?extractionGraph { <${uri}> ?p ?oInExtractionGraph . }
        }
          UNION 
        {
          GRAPH ?graph2 {?o ?p2 <${uri}> ; rdfs:label ?label . ${typePatterns} ${filterNotExists}} .
        } 
      }`
  if (offsetQuery === 0) {
    query += `ORDER BY ?o LIMIT ${limitQuery}`;
  } else {
    query += `ORDER BY ?o OFFSET ${offsetQuery} LIMIT ${limitQuery}`;
  }

  console.log(query);
  
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
                      var newItem = $("<div id='" + resID + "' class='wditem'><a class='blue orangeText' target='_blank' href='view-" + resID + "'><i class='fas fa-external-link-alt'></i></a> <span class='orangeText' data-id='" + myUrl + "'>" + decodeURIComponent(unescape(returnedJson.results.bindings[i].label_str.value)) + "</span></div>").hide();
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
const sparqlQueue = [];
let sparqlRunning = false;

// run next query
function runNextQuery() {
  if (sparqlRunning || sparqlQueue.length === 0) return;
  sparqlRunning = true;

  const { query, elemID, prop, typeProp, typeField, elemClass, elemSubclass, extractionClasses } = sparqlQueue.shift();

  $.ajax({
    type: 'GET',
    url: myPublicEndpoint + '?query=' + encodeURIComponent(query),
    headers: { Accept: 'application/sparql-results+json' },
    success: function(returnedJson) {
      processQueryResults(returnedJson, elemID, prop, typeProp, typeField, elemClass, elemSubclass, extractionClasses);
    },
    error: function(err) {
      console.error("Errore SPARQL:", err);
    },
    complete: function() {
      sparqlRunning = false;
      runNextQuery(); // lancia la prossima query
    }
  });
}

// add query to the queries queue
function enqueueSparqlQuery(query, elemID, prop, typeProp, typeField, elemClass='', elemSubclass='', extractionClasses=null) {
  sparqlQueue.push({ query, elemID, prop, typeProp, typeField, elemClass, elemSubclass, extractionClasses });
  runNextQuery();
}

// get property value: generate a queue of ajax queries
function getPropertyValue(elemID, prop, typeProp, typeField, elemClass='', elemSubclass='', extractionClasses=null) {
  let class_restriction = '';
  if (elemClass.length) class_restriction = `?s a <${elemClass}> . `;
  if (elemSubclass.length) {
    if (!elemSubclass.startsWith("other")) {
      class_restriction += `?s a <${elemSubclass}> . `;
    } else if (elemSubclass === "other" || elemSubclass === "other-all") {
      class_restriction += `FILTER NOT EXISTS { ?s a ?otherType . FILTER (?otherType != <${elemClass}>) } `;
    }
  }

  let query;
  if ((typeProp === 'URI' || typeProp === 'Place' || typeProp === 'URL') &&
      ['Textbox','Dropdown','Checkbox','Subtemplate','Subclass'].includes(typeField)) {
    query = `select ?o (SAMPLE(?oLabel) AS ?oLabel) (COUNT(?s) AS ?count) ${inGraph} where { GRAPH ?g { ?s <${prop}> ?o. ${class_restriction} ?o rdfs:label ?oLabel . } ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER(str(?stage) != 'not modified') } GROUP BY ?o ORDER BY DESC(?count)`;
  } else if (typeProp === 'URI' && typeField === 'Skos') {
    var addReplace = typeField === 'Skos' ? 'REPLACE(STR(?oLabel), " - .*?$", "")' : '';
    query = `select ?o (SAMPLE(${addReplace}) AS ?oLabel) (COUNT(?s) AS ?count) ${inGraph} where { GRAPH ?g { ?s <${prop}> ?o. ${class_restriction} ?o <http://www.w3.org/2004/02/skos/core#prefLabel> ?oLabel . } ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER(str(?stage) != 'not modified') } GROUP BY ?o ORDER BY DESC(?count)`;
  } else if (['Date','gYear','gYearMonth'].includes(typeProp) && typeField === 'Date') {
    query = `select distinct ?o (COUNT(?s) AS ?count) ${inGraph} where { GRAPH ?g { ?s <${prop}> ?o. ${class_restriction} } ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER(str(?stage) != 'not modified') } GROUP BY ?o ORDER BY DESC(?count) lcase(?o)`;
  } else if (typeField === 'KnowledgeExtractor') {
    query = `select distinct ?o ?oLabel ?class (COUNT(?s) AS ?count) ${inGraph} where { GRAPH ?g { ?g <${prop}> ?extractionGraph. ${class_restriction} } GRAPH ?extractionGraph { ?o rdfs:label ?oLabel . OPTIONAL {?o a ?class}} ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER(str(?stage) != 'not modified') } GROUP BY ?o ?oLabel ?class ORDER BY DESC(?count) lcase(?oLabel)`;
  } else {
    query = "none";
  }

  if (query !== "none") {
    enqueueSparqlQuery(query, elemID, prop, typeProp, typeField, elemClass, elemSubclass, extractionClasses);
  }
}

// process ajax query results
function processQueryResults(returnedJson, elemID, prop, typeProp, typeField, elemClass, elemSubclass, extractionClasses) {
  const len = 10;
  console.log(returnedJson);
  const allresults = [];
  const results = [];
  const countresults = [];

  returnedJson.results.bindings.forEach((binding) => {
    const res = binding.o.value;
    let resLabel;
    let xsdProp = false;

    if (!['Date','gYear','gYearMonth'].includes(typeProp)) {
      resLabel = binding.oLabel.value;
    } else if (typeProp === 'gYear') {
      resLabel = parseInt(binding.o.value);
      xsdProp = typeProp;
    } else {
      resLabel = binding.o.value;
      xsdProp = typeProp;
    }

    const count = parseInt(binding.count.value);
    if (countresults.length < 5 || ["Subclass","Dropdown"].includes(typeField)) {
      countresults.push({count, label: resLabel});
    }

    let extractionClass = "";
    let knowledgeExtractor = "";
    if (typeField === 'KnowledgeExtractor' && extractionClasses != "") {
      extractionClass = `data-extraction-class='${binding.class.value}'`;
      knowledgeExtractor = "fieldType='KnowledgeExtractor'";
    }

    const result = `<button onclick=getRecordsByPropValue(this,'.${elemID}results','${elemClass}','${elemSubclass}','${xsdProp}',${knowledgeExtractor}) id='${res}' class='queryGroup' data-property='${prop}' data-value='${res}' aria-expanded='false' aria-controls='${elemID}results' class='info_collapse' ${extractionClass}>${resLabel} (${count})</button>`;
    if (!allresults.includes(result)) {
      allresults.push(result);
      results.push($(result).hide());
      $(`#${elemID}`).append($(result).hide());
    }
  });

  // showMore
  if (results.length > len) {
    $("#"+elemID).find("button:lt("+len+")").show('smooth');
    $("#"+elemID).next(".showMore").show();
    let counter = 1;
    $("#"+elemID).next(".showMore").off("click").on("click", function() {
      ++counter;
      const limit = counter*len+len;
      $("#"+elemID).find("button:lt("+limit+")").show('smooth')
      
      // hide showMore if no button is hidden
      const allButtons = $("#"+elemID).find('button');
      const allVisible = allButtons.length > 0 && allButtons.filter(':visible').length === allButtons.length;
      if (allVisible) {
        $("#"+elemID).next(".showMore").hide()
      };
    });
  } else if (results.length > 0 && results.length <= len) {
    $("#"+elemID).find("button:not(.showMore)").show('smooth');
  }

  if (extractionClasses) {
    for (const [key, value] of Object.entries(extractionClasses)) {
      const extractedEntitiesByClass = $(`#${elemID}`).find(`[data-extraction-class='${key}']`);
      if (extractedEntitiesByClass.length) {
        const groupEntity = $(`<section style='margin-bottom: 1.5em'><h4>${value}</h4></section>`);
        extractedEntitiesByClass.detach().appendTo(groupEntity);
        $(`#${elemID}`).append(groupEntity);
      }
    }
  }

  /* // generate mini-charts
  if (!$(`#${elemID}-chart`).length) {
    $("#"+elemID).closest(".change_background").find(".col-md-4").eq(0).append($(`<div id='${elemID}-chart' class='mini-chart'></div>`));
  } else {
    $(`#${elemID}-chart`).replaceWith($(`<div id='${elemID}-chart' class='mini-chart'></div>`));
  }
  $("#"+elemID).closest(".change_background").css({minHeight: "95vh", maxHeight: "130vh", overflow: "scroll"});

  if (["Dropdown","Subclass"].includes(typeField)) {
    piechart(elemID+"-chart","label","count","True",countresults,true);
  } else if (countresults.length) {
    barchart(elemID+"-chart","label","count",countresults,true);
  } */
}


// get all extracted key enitities
function getKeywordsValue(elemID, elemClass, extractionClasses, extractionProperties, elemSubclass='') {
  console.log(elemSubclass)
  $('.extraction-class').remove();
  if (elemClass.length) {var class_restriction = "?s a <"+elemClass+"> . "} else {var class_restriction = ''};
  if (elemSubclass.length) {
    if (!elemSubclass.startsWith("other")) { class_restriction += "?s a <"+elemSubclass+"> . "; }
    // ATLAS only - filters for "Other" values
    else if (elemSubclass === "other" || elemSubclass === "other-all") { class_restriction += "FILTER NOT EXISTS { ?s a ?otherType . FILTER (?otherType != <"+elemClass+">) }" } 
  };
  var query = "select distinct ?o ?oLabel ?class (COUNT(?s) AS ?count) "+inGraph+" where { GRAPH ?g { ?g ?prop ?extractionGraph. "+class_restriction+" ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER( str(?stage) != 'not modified' ) } GRAPH ?extractionGraph { ?o rdfs:label ?oLabel . OPTIONAL {?o a ?class}} ?g <http://dbpedia.org/ontology/currentStatus> ?stage .     FILTER(CONTAINS(STR(?extractionGraph), 'extraction')) } GROUP BY ?o ?oLabel ?class ORDER BY DESC(?count) lcase(?oLabel)";
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
          var countresults = [];
          for (i = 0; i < returnedJson.results.bindings.length; i++) {
            var res = returnedJson.results.bindings[i].o.value;
            var resLabel = returnedJson.results.bindings[i].oLabel.value;
            var count = returnedJson.results.bindings[i].count.value;
            if (countresults.length < 5) {countresults.push({count: parseInt(count), label: resLabel });}

            var extractionClass = returnedJson.results.bindings[i].class ? "data-extraction-class='"+returnedJson.results.bindings[i].class.value+"'" : "data-extraction-class=''";
            var knowledgeExtractor = "fieldType='KnowledgeExtractor'";
            var result = "<button onclick=getRecordsByPropValue(this,'."+elemID+"results','"+elemClass+"','','"+JSON.stringify(extractionProperties)+"',"+knowledgeExtractor+") id='"+res+"' class='queryGroup' data-value='"+res+"' aria-expanded='false' aria-controls='"+elemID+"results' class='info_collapse' "+extractionClass+">"+resLabel+" ("+count+")</button>";
            if (allresults.indexOf(result) === -1) {
              allresults.push(result);
              results.push($(result).hide());
              $("#"+elemID).append($(result).hide());
            };
          };

          // group extracted entities by class (KNOWLEDGE EXTRACTOR only)
          if (extractionClasses) {
            console.log(extractionClasses)
            for (const [key, value] of Object.entries(extractionClasses)) {
              var extractedEntitiesByClass = $("#"+elemID).find("[data-extraction-class='"+key+"']");
              if (extractedEntitiesByClass.length) {
                const groupEntity = $("<section class='extraction-class' data-class='"+key+"' style='margin-bottom: 1.5em'><h4>"+value+"</h4></section>");
                $("#"+elemID).append(groupEntity);
                extractedEntitiesByClass.detach().appendTo(groupEntity);
                

                // show first batch
                if (extractedEntitiesByClass.length > len) {
                  groupEntity.find("button:lt("+len+")").show('smooth');
                  groupEntity.append($('<button class="showMore" type="button" data-counter="1">show more</button>'));
                
                  // show more based on var len
                  groupEntity.find(".showMore").on("click", function() {
                    var counter = $(this).data("counter");
                    ++counter;
                    var offset = counter*len;
                    var limit = offset+len;
                    console.log(counter, offset, limit);
                    groupEntity.find("button:lt("+limit+")").show('smooth');
                    groupEntity.find(".showMore").data("counter", counter);
                  }); 
                } else if (extractedEntitiesByClass.length > 0 && extractedEntitiesByClass.length <= len) {
                  groupEntity.find("button:not(.showMore)").show('smooth');
                };
              }
            }
          } else {
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
          }
          
          /* // prepare charts
          if (! ($("#"+elemID+"-chart").length)) {
            $("#"+elemID).closest(".change_background").find(".col-md-4").eq(0).append($("<div id='"+elemID+"-chart' class='mini-chart'></div>"));
          } else {
            $("#"+elemID+"-chart").replaceWith($("<div id='"+elemID+"-chart' class='mini-chart'></div>"));
          } 
          $("#"+elemID).closest(".change_background").css({minHeight: "95vh"})
          console.log(countresults)
          barchart(elemID+"-chart","label","count",countresults,true); */


        } // end function

  });
}

// get records by value and property in EXPLORE
function getRecordsByPropValue(el, resElem, elemClass='', elemSubclass='', typeProp=false, fieldType=null) {
  const $el = $(el);
  const $res = $(resElem);

  $('button.queryGroup').not($el).removeClass('alphaActive');
  if ($el.hasClass('alphaActive')) return;
  $el.addClass('alphaActive');

  if (!$res.hasClass('show')) {
    $res.collapse('show');
  }

  $res.empty();
  const resTop = $res.offset().top;
  const resBottom = resTop + $res.outerHeight();
  const viewportTop = $(window).scrollTop();
  const viewportBottom = viewportTop + $(window).height();
  if (resBottom > viewportBottom || resTop < viewportTop) {
    $('html, body').animate({
      scrollTop: resTop - ($(window).height() / 2) + ($res.outerHeight() / 2)
    }, 600);
  }

  let class_restriction = '';
  if (elemClass.length) { class_restriction = "?s a <"+elemClass+"> . "; }
  if (elemSubclass.length) { class_restriction += "?s a <"+elemSubclass+"> . "; }

  const prop = $el.data("property");
  let query = '';
  let val = $el.data("value");

  if (fieldType === 'KnowledgeExtractor') {
    query = "select distinct ?s ?sLabel ?prop "+inGraph+" where { GRAPH ?g { ?g ?prop ?extractionGraph . BIND(IRI(SUBSTR(STR(?g), 1, STRLEN(STR(?g)) - 1)) AS ?s) ?s rdfs:label ?sLabel . "+class_restriction+"  } GRAPH ?extractionGraph{ <"+val+"> rdfs:label ?entity } ?g <http://dbpedia.org/ontology/currentStatus> ?stage .  } ORDER BY ?sLabel";
  } else if (typeProp === 'false') {
    query = "select distinct ?s ?sLabel "+inGraph+" where { GRAPH ?g { ?s <"+prop+"> <"+val+">; rdfs:label ?sLabel . "+class_restriction+" } ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER( str(?stage) != 'not modified' ) } ORDER BY ?sLabel";
  } else {
    val = '"'+val+'"^^xsd:'+typeProp.charAt(0).toLowerCase() + typeProp.slice(1);
    query = "select distinct ?s ?sLabel "+inGraph+" where { GRAPH ?g { ?s <"+prop+"> "+val+"; rdfs:label ?sLabel . "+class_restriction+" } ?g <http://dbpedia.org/ontology/currentStatus> ?stage . FILTER( str(?stage) != 'not modified' ) } ORDER BY ?sLabel";
  }

  console.log(query);
  const encoded = encodeURIComponent(query);

  $.ajax({
    type: 'GET',
    url: myPublicEndpoint+'?query=' + encoded,
    headers: { Accept: 'application/sparql-results+json'},
    beforeSend: function() {
      $res.html("<p class='loading'>Loading Records...</p>");
    },
    success: function(returnedJson) {
      $res.empty();
      for (let i = 0; i < returnedJson.results.bindings.length; i++) {
        const res = returnedJson.results.bindings[i].s.value;
        const resID = res.substr(res.lastIndexOf('/') + 1);
        const resLabel = returnedJson.results.bindings[i].sLabel.value;
        const record = $("<section><a href='view-"+resID+"'>"+resLabel+"</a></section>");
        if (returnedJson.results.bindings[i].prop) {
          const propDict = JSON.parse(typeProp);
          const propUri = returnedJson.results.bindings[i].prop.value;
          const propLabel = propUri in propDict ? propDict[propUri] : "";
          if (propLabel.length) {
            record.append("<span class='tip' data-toggle='tooltip' data-placement='bottom' title='' data-original-title='"+propLabel+"'><i class='fas fa-info-circle'></i></span>");
          }
        }
        $res.append(record);
        $('.tip').tooltip();
      }
    }
  });
}



function filterBySubclass(btn) {
  let subclassURI = $(btn).attr("value");
  var tab = $(btn).closest(".articleBox");
  tab.find("[data-target]").show();
  tab.find(".hidden").removeClass("hidden");

  // show subclass-restricted filters
  $("section[data-subclass*='"+subclassURI+"']").show();
  $("section[data-subclass]").not("[data-subclass*='" + subclassURI + "']").not("[data-subclass='']").hide();

  // active filter button
  $(btn).siblings().removeClass("active");
  $("#other-filters button").removeClass("active");
  $(btn).addClass("active");

  // hide "other" filters (for ATLAS only)
  if (! subclassURI.startsWith("other")) {

    // hide excluded alphabet filters
    if (subclassURI !== "") {
      console.log(subclassURI)
      tab.find(".list > a.resource_collapse[data-subclass]").each(function() {
        if (! $(this).data("subclass").split("; ").includes(subclassURI)) {
          $(this).parent().addClass("hidden");
          if ($(this).closest(".toBeWrapped").find(".list:not(.hidden)").length == 0) {
            var target = $(this).parent().attr("id");
            $("[data-target='#"+target+"']").hide();
          }
        }
      });
    }
  } else {
    console.log(subclassURI)
    // show "other" filters (for ATLAS only)
    if (subclassURI === "other") {
      tab.find(".list > a.resource_collapse[data-subclass]").each(function() {
        console.log(subclassURI, $(this).data("subclass"))
        if ($(this).data("subclass") !== "") {
          $(this).parent().addClass("hidden");
          if ($(this).closest(".toBeWrapped").find(".list:not(.hidden)").length == 0) {
            var target = $(this).parent().attr("id");
            $("[data-target='#"+target+"']").hide();
          }
        }
      });
    }
  }

  // generate new property-value filters
  var scripts = tab.find("script");
  $(".resultAccordion .collapse").empty();
  $(".collapse.show").toggleClass("show");
  scripts.each(function() {
    $(this).parent().find(".indexURI").empty();
    let scriptContent = $(this).html();
    scriptContent = scriptContent.replace(
        /(get(?:KeywordsValue|PropertyValue))\s*\(([^)]*)\)/g,
        '$1($2, "'+subclassURI+'")'
    );
    console.log(scriptContent)
    let dynamicFunction = new Function(scriptContent);
    dynamicFunction();
  })
}


// Alerts

function showLoadingPopup(title, text, allowCancel = false) {
  var footer = allowCancel ? '<button id="cancelBtn" class="swal2-confirm swal2-styled">Cancel</button>' : '';

  return Swal.fire({
    title: title,
    text: text,
    showConfirmButton: false,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
    footer: footer
  });
}

function showErrorPopup(title, text) {
  Swal.fire({ 
    title: title,
    text: text,
    icon: "error"
  });
}

function showAutoCloseTimerPopup(title, text) {
  Swal.fire({ 
    title: title,
    text: text,
    icon: "success",
    timer: 1500,
    timerProgressBar: true,
  });
}


function hidePopup() {
  Swal.close();
}