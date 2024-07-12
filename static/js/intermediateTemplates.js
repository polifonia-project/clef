/* intermediateTemplates.js
---------------------------- 
this file contains the js code devoted to the proper
management of the Intermediate Templates feature. 
*/

/////////////////////////
/// SUBTEMPLATE FIELD ///
/////////////////////////

// Start setting Subtemplates' fields
$(document).ready(function() {

    // display subtemplates input fields
    $("[data-subtemplate][data-supertemplate='None']").each(function() {
        // this code applies only to first-level subtemplates
        // i.e.: subtemplates input fields within subrecords are not made ready in advance
        var dataSubtemplate = $(this).attr('data-subtemplate');        
        var subtemplateFields = $("[data-supertemplate='"+dataSubtemplate+"']");
        console.log(subtemplateFields)
        subtemplateFields.addClass('original-subtemplate');
        subtemplateFields.parent().parent().hide();
        prepareSubtemplateForms($(this));
    });

    $("[data-supertemplate]:not([data-supertemplate='None'], [data-subtemplate])").each(function() {
        // this code applies only to first-level subtemplates
        // i.e.: subtemplates input fields within subrecords are not made ready in advance
        $(this).addClass('original-subtemplate');
        $(this).parent().parent().hide();
    });
    

})

// Make Subtemplates' fields available
function prepareSubtemplateForms(element) {
    console.log($(element))
    $(element).hide();
    var subtemplateFieldId = $(element).attr('id');
    var oneValue = $(element).hasClass('oneValue');
    var allowDataReuse = $(element).hasClass('allowDataReuse');

    // get the display name assigned to the 'Subtemplate' field and prepare a button for adding new subrecords
    var fieldName = $(element).parent().prev().text();
    const createSubrecordBtn = $('<span class="add-span"><i class="material-icons">playlist_add</i><span> Define a new'+fieldName+'</span></span>');
    createSubrecordBtn.on('click', function() {
      createSubrecord(subtemplateFieldId,fieldName,createSubrecordBtn,dataReuse=allowDataReuse)
    });
    

    if (oneValue) {
        // Max. 1 subrecord

        // set a new Id to be associated to the new subrecord
        let subformId;
        var now = new Date().valueOf();
        var timespanId = (now / 1000).toString().replace('.', '-');

        // reuse existing Id in Modify/Review stage
        if($(element).next('span').next('.hiddenInput').length) {
        var existingSubform = $(element).next().next().val();
        subformId = existingSubform.split(',')[0];
        } else {
        subformId = timespanId;
        } 

        // add the createSubrecordBtn to the field section, generate a subrecord form, then remove the button
        $(element).after(createSubrecordBtn);
        createSubrecord(subtemplateFieldId,fieldName,createSubrecordBtn,allowDataReuse,subformId,"oneValue");
        createSubrecordBtn.remove();

        // link the subrecord id to the "Subtemplate" type field
        var hiddenSubrecordLink = $('<input type="hidden" name="'+subtemplateFieldId+'-subrecords" value="'+subformId+'"/>');
        $('#modifyForm, #recordForm').append(hiddenSubrecordLink);
  
    } else {
        // Unlimited subrecords

        // add the createSubrecordBtn for generating unlimited subrecords
        $(element).after(createSubrecordBtn);
    }
  
    
    // create hidden fields to store subrecords information when loading a previously created Record (only in modify/review page)
    if ($('.corners form').attr('id') === "modifyForm") {
        var subtemplateFieldId = $(element).attr('id');
        var subrecords = "";
        $('[data-input="'+subtemplateFieldId+'"').each(function() {
        subrecords+=$(element).attr('id')+";"+$(element).text()+",";
        })
        $('#modifyForm').append('<input type="hidden" name="'+subtemplateFieldId+'-subrecords" id="'+subtemplateFieldId+'-subrecords" value="'+subrecords.slice(0,-1)+'">');
    }
}

//////////////////
/// SUBRECORDS ///
//////////////////

// Create subrecords
function createSubrecord(supertemplateId, fieldName, el, dataReuse=false, subformId=null,cardinality=null ) {
    console.log(supertemplateId, fieldName, el, dataReuse, subformId, cardinality)
    var absoluteSuperTemplateId = supertemplateId.split("_")[0];

    // prepare a new subrecord id in case no one has been provided
    if (!subformId) {
      var now = new Date().valueOf();
      subformId = (now / 1000).toString().replace('.', '-');
    }
    var formId = $('.corners').eq(0).find('form').eq(0).attr('id'); // either 'recordForm' or 'modifyForm'
  
    // prepare the new subrecord form
    const subrecordSection = $("<section class='subform_section col-md-12 col-sm-12'></section>");
    const subrecordForm = $("<section class='subform' id='"+subformId+"-form' data-target='"+subformId+"'></section>");

    // create a clone for each input belonging to the requested (sub-)template
    $("[data-supertemplate='"+absoluteSuperTemplateId+"'][class~='original-subtemplate']").each(function() {
        console.log($(this))

        let moveOn = true;
  
        // DATA REUSE: 
        // do not clone Elements in case data reuse is allowed and the same property is used in the upper level Form
        
        if (dataReuse==true) {
            var rdfProperty = $(this).attr('data-property');
            var upperLevelCls= $("[data-subtemplate='"+absoluteSuperTemplateId+"']").attr('data-class');
            if ($("[data-class='"+upperLevelCls+"'][data-property='"+rdfProperty+"']").length) {
            moveOn = false;
            };
        }
    
        if (moveOn) {
            console.log($(this))
            // CREATE A CLONE ELEMENT
            const cloneElement = $(this).parent().parent().clone();
            cloneElement.find('textarea, select:not([type="hidden"]), input:not([type="hidden"]):not(label.switch input)').attr('data-subform',subformId); // associate the input field with the subrecord id
            cloneElement.find('textarea, select, input').addClass('hidden');
            cloneElement.find('textarea, select, input').removeClass('original-subtemplate');
            // associate proper identifiers to input fields belonging to the subrecord form
            var inputId = cloneElement.find('textarea, select:not([type="hidden"]), input:not([type="hidden"]):not(label.switch input)').attr('id');
            cloneElement.find('textarea, select:not([type="hidden"]), input:not([type="hidden"]):not(label.switch input)').attr('id', inputId+"_"+subformId.toString());
            cloneElement.find('textarea, select:not([type="hidden"]), input:not([type="hidden"]):not(label.switch input)').attr('name', inputId+"_"+subformId.toString());
    
            // SET LITERAL INPUT FIELDS
            if (cloneElement.find('[lang]').length>0) {
                var literalInput = cloneElement.find('[lang]');
                var languageListSection = literalInput.parent().prev();
                languageListSection.find('a').each(function() {
                    var onclickAttr = $(this).attr('onclick');
                    var regex = /'([^"]*)'/g;
                    var originalIdExtended = onclickAttr.match(regex)[0];
                    var originalId = originalIdExtended.substring(1, originalIdExtended.length-1)
                    $(this).attr('onclick', onclickAttr.replace(originalId, originalId+'_'+subformId));
                });
            }
            // add a main-lang hidden input in case of primary key
            if (cloneElement.find('input.disambiguate').next('[type="hidden"]').length > 0) {
                var primaryKeyLangId = cloneElement.find('input.disambiguate').next('[type="hidden"]').attr('id');
                cloneElement.find('input[type="hidden"]').attr('id', primaryKeyLangId+"_"+subformId.toString());
                cloneElement.find('input[type="hidden"]').attr('name', primaryKeyLangId+"_"+subformId.toString());
            }
            console.log(cloneElement.find('[data-subtemplate]'));
            // SET SUBTEMPLATE FIELDS '+' BUTTON
            cloneElement.find('[data-subtemplate]').each(function(){
                prepareSubtemplateForms($(this), hide=true);
                
                /* var subtemplateClass = $(this).attr('data-subtemplate');
                var fieldName = $(this).parent().prev().text();
                var addSubrecordBtn = $(this).next('i');
                addSubrecordBtn.on('click', function(){
                    createSubrecord(subtemplateClass,fieldName,addSubrecordBtn);
                }) */
            });
    
            // retrieve previously provided values in case they are available (i.e., modify subrecords):
            let clonedElementValues = [];
            // a) single value fields
            if ($('#'+formId+' #'+inputId+"_"+subformId).length >0) {
                const toBeModified = $('#'+formId+' #'+inputId+'_'+subformId);
                cloneElement.find('input').val(toBeModified.val());
            } 
            // b) multiple values fields
            if ($('#'+formId+' [name^="'+inputId+'_"][name$="_'+subformId+'"]:not([name="'+inputId.split('_')[0]+'_'+subformId+'"])').length >0) {
            
                var importedValues = $('#'+formId+' [name^="'+inputId.split('_')[0]+'_"][name$="_'+subformId+'"]:not([name="'+inputId.split('_')[0]+'_'+subformId+'"])');
                cloneElement.find('.label div a').remove();
                if ($('#'+inputId).hasClass('searchWikidata') || $('#'+inputId).hasClass('searchVocab') || $('#'+inputId).hasClass('searchGeonamaes')) {
                    importedValues.each(function(){
                        // imported values and URIs
                        var value = $(this).val();
                        var code = value.split(",")[0];
                        var label = decodeURIComponent(value.split(",")[1]);
                        var importedValueSpan = $("<span class='tag "+code+"' data-input='"+inputId+'__'+subformId+"' data-id='"+code+"'>"+label+"</span>");
                        clonedElementValues.push(importedValueSpan);
                        clonedElementValues.push($(this));
                        $(this).remove();
                    });
                } else {
                    importedValues.each(function(){
                    // multiple-lang literal values
                    clonedElementValues.push($(this));
                    cloneElement.find('input').remove();
                    if($(this).attr('lang') != undefined) {
                        let lang = $(this).attr('lang');
                        const newLangItem = $('<a class="lang-item" title="text language: '+lang.toUpperCase()+'" onclick="show_lang(\''+$(this).attr('id')+'\')">'+lang+'</a>');
                        cloneElement.find('div').append(newLangItem);
                    } else {
                        let mainLang = $(this).val();
                        cloneElement.find('div a[title="text language: '+mainLang.toUpperCase()+'"]').addClass('main-lang');
                    }       
                    });
                    cloneElement.find('div a').eq(0).addClass('selected-lang');
                    clonedElementValues[0].show();
                }
            } 
            // c) subrecords fields (inner subrecords)
            if ($('[name="'+inputId+'_'+subformId+'-subrecords"]').length>0) {
                // retrieve subrecords
                var subrecords = $('[name="'+inputId+'_'+subformId+'-subrecords"]').val().split(',');
                console.log("Sub", subrecords)
                var subtemplateFieldId = $(this).attr('name').replace('-subrecords', '');
                var subrecordCls = $('#'+subtemplateFieldId).attr('subtemplate')
                for (let i=0; i<subrecords.length;i++){
                    var code = subrecords[i];
                    let label = "";
                    if (subrecords[i].includes(";")) {
                        code = subrecords[i].split(";")[0];
                        label = subrecords[i].split(";")[1];
                    } else {          
                        var subrecordLabelField = $('.original-subtemplate.disambiguate[class*="('+subrecordCls+')"]');
                        if (subrecordLabelField.length > 0) {
                            var mainLang = $('#'+subrecordLabelField.attr('id').split('_')[0] + '_mainLang_' + code).val();
                            label = $('#'+subrecordLabelField.attr('id').split('_')[0]+'_'+mainLang+'_'+code).val();
                        }
                    }
                }
            }

            cloneElement.find('.input_or_select').eq(0).append(clonedElementValues);
            subrecordForm.append(cloneElement);
        }
    
    })
    
    // Add Knowledge Extraction input field if required

    // TODO: MODIFY
    /* var resourceTemplate = $('[data-subtemplate="'+resourceClass+'"').attr('data-subtemplateid');
    if (extractorsArray.includes(resourceTemplate)) {
    generateExtractionField(subformId,subrecordForm);
    } */


    // Save button, Cancel button, Accordion title (only in case multiple subrecords are allowed)
    if (cardinality==null) {
        // subform accordion
        const subrecordTitle = $("<h4 class='subrecord-title italic' onclick='toggleSubform(this)'>New instance of "+fieldName+"<i class='fas fa-chevron-down chevron'></i></h4>");
        subrecordSection.append(subrecordTitle);
        // save or cancel subrecord (buttons)
        const subrecordButtons = $("<section class='row subform-buttons buttonsSection'></section>");
        const saveSubrecordButton = $("<button id='subrecord-save' class='btn btn-dark'><i class='material-icons'>task_alt</i></button");
        const cancelSubrecordButton = $("<button id='subrecord-cancel' class='btn btn-dark delete'><i class='far fa-trash-alt'></i></button");
    
        // SAVE SUBRECORD
        saveSubrecordButton.on('click', function(e) {
            e.preventDefault();
            // generate a tag
            var isValid = checkMandatoryFields(this);
            if (isValid) {
            var labelField = subrecordForm.find('.disambiguate').eq(0);
            var labelMainLang = $('#'+labelField.attr('id').replace(labelField.attr('lang'), 'mainLang')).val();
            var tagLabel = subrecordForm.find('.disambiguate[lang="'+labelMainLang+'"]').val() || (fieldName + "-" + subformId);
            
            toggleSubform(subrecordTitle,label=tagLabel);
    
            // for each subtemplate field, create an hidden input value including a list of related subrecords
            // this is needed to streamline the creation of records (back-end application)
            var subrecordBase = supertemplateId;
            var createdSubrecords = $('[name="'+subrecordBase+'-subrecords"]');
            if (createdSubrecords.length) {
                var toExtendValue = createdSubrecords.val();
                if (!createdSubrecords.val().split(',').includes(subformId)) {
                    createdSubrecords.val(toExtendValue + "," + subformId);
                }
            } else {
                const newSubrecord = $("<input type='hidden' name='"+subrecordBase+"-subrecords' value='"+subformId+"'>");
                $('#'+formId).append(newSubrecord);
            }

            // store the subtemplate class as an hidden input value
            var selectedClass;
            var selectElement = $(this).parent().parent().find('.subtemplate-select select');
            selectedClass = (selectElement.find('option').length === 2) 
                      ? selectElement.find('option:last').val() 
                      : selectElement.val();
            selectedClass = selectedClass.replace(/[\[\]']/g, '');
            var classHiddenInput = $("<input type='hidden' name='"+subformId+"-class' value='"+selectedClass+"'>");
            console.log(classHiddenInput)
            $('#'+formId).append(classHiddenInput)
            // hide_subform
            }
            return false;
        });
        
        // CANCEL SUBRECORD
        cancelSubrecordButton.on('click', function(e) {
            // hide_subform
            e.preventDefault();
            cancelSubrecord(this);
        });
        
        subrecordButtons.append(cancelSubrecordButton, saveSubrecordButton);
        subrecordForm.append(subrecordButtons);
    }

    // show the dropdown in case multiple templates are available
    var templatesNumber = $("select[data-subtemplate='"+supertemplateId+"']").find('option').length - 1;
    if (templatesNumber > 1) { 
        const subtemplateSelect = $("select[data-subtemplate='"+supertemplateId+"']").clone().show();
        var inputId = $("select[data-subtemplate='"+supertemplateId+"']").attr('id');
        subtemplateSelect.attr('id', inputId+"_"+subformId.toString());
        subtemplateSelect.attr('name', inputId+"_"+subformId.toString());
        subtemplateSelect.on('change', function() { activateTemplateSelection($(this)) })
        const subtemplateSelectSection = $("<section>").addClass("form_row block_field subtemplate-select")
            .append($("<section>").addClass("col-md-12 col-sm-12 col-lg-12 input_or_select detect_web_page")
            .append(subtemplateSelect));
        subrecordForm.prepend(subtemplateSelectSection);
    } else {
        subrecordForm.find('[data-subform="'+subformId+'"]').parent().parent().show();
    }

    subrecordSection.append(subrecordForm);
    console.log(subrecordForm, subrecordSection, $(el))

    $(el).before(subrecordSection);
    
}

function activateTemplateSelection(select) {
    var selected = $(select).val();
    $(select).parent().parent().parent().find('.form_row.block_field:not(.subtemplate-select)').hide();
    selected = JSON.parse(selected.replace(/'/g, '"'));
    if (selected.length == 1) {
        $(select).parent().parent().parent().find('[data-class="'+selected[0]+'"]').parent().parent().show();
    }
}


// CANCEL SUBRECORD (before adding it to #recordForm)
function cancelSubrecord(subrecord_section) {
    $(subrecord_section).closest('.subform_section').remove();
};

// DELETE or MODIFY SUBRECORD (after it has been added to #recordForm)
function modifySubrecord(subId, keep) {
    // get the 'Subtemplate' input field and the 'Subtemplate' class
    var originalSubtemplateId = $('[name*="-subrecords"][value*="'+subId+'"').attr('name').replace("-subrecords", "");
    var originalSubtemplateClass = $('#'+originalSubtemplateId).attr('data-subtemplate');

    if (!keep) {
        // remove all inputs
        var subrecordsListString = $('[name$="-subrecords"][value*='+subId+'"]');
        var subrecordsListArray = subrecordsListString.split(',');
        var idx = subrecordsListArray.indexOf(sub_id);
        var newList = subrecordsListArray.splice(idx, 1);
        subrecordsList.val(newList.join(','));
    }
    else {
        // recreate subrecord_section
        var fieldName = $('#'+subId+'-tag').parent().prev().text();
        var el = $('#'+subId+'-tag').prevAll('.fa-plus-circle').first();
        
        // import data from triplestore in case the subrecord has not been loaded yet
        if (! $('[data-subform="'+subId+'"').length) {
            var currentUrl = window.location.href;
            var subrecordUrl = currentUrl.replace(/(modify|review)-\d+-\d+/, `$1-${subId}`);
            $.ajax({
                type:'GET',
                url:subrecordUrl,
                dataType:"html",
                success:function(data) {
                    var relevantField = $(data).find('[class*="'+originalSubtemplateClass+'"]');
                    $('#modifyForm').append(relevantField);
                    createSubrecord(originalSubtemplateClass,fieldName,el,subformId=subId);
                }
            });
        } else {
            createSubrecord(originalSubtemplateClass,fieldName,el,subformId=subId);
        }

    }

    // remove delete/modify icons
    $('#'+subId+'-tag').next('i').remove();
    $('#'+subId+'-tag').next('i').remove();
    $('#'+subId+'-tag').remove();
    $('#'+subId).remove();
}


// hide and show subrecord input fields
function toggleSubform(element,label=null) {
    $(element).find('.chevron').toggleClass('rotate');
    $(element).toggleClass('closed-title');
    $(element).next('.subform').toggleClass('closed');
  
    // change Subrecord title
    if (label) {
        const subformId = $(element).next('.subform').attr('id').replace('-form', '')
        $(element).html(label+"<section class='buttons-container'>\
        <button class='btn btn-dark delete' title='delete-subrecord'>\
            <i class='far fa-trash-alt'></i>\
        </button>\
        <button class='btn btn-dark modify' title='modify-subrecord'>\
            <i class='far fa-edit'></i>\
        </button>\
        </section>");

        // delete button
        $(element).find('.delete').on('click', function(e) {
        e.preventDefault();
            cancelSubrecord($(this).parent());
        });

        // modify button 
        $(element).find('.modify').on('click', function(e) {
            e.preventDefault();
            modifySubrecord(subformId, keep=true);
        });

        // style
        $(element).removeClass('italic');
        $('html, body').animate({
            scrollTop: $(element).parent().offset().top - 200
        }, 800);
    }
}