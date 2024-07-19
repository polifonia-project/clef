/* form.js
---------------------------- 
this file contains the js code devoted to the proper
management of Records Creation, Modification and Publication. 
*/

///////////////
/// GENERAL ///
///////////////

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

//////////////////////
//// AUTOCOMPLETE ////
//////////////////////

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
        });
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
    var subrecordBase = $('#'+searchterm).attr('data-supertemplate');

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

                });

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

// recover extraction information to modify it
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
        });
        
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

    // manage navigation buttons 
    var buttonList = "<section class='row extractor-2'>\
        <input id='api-back2' class='btn btn-dark extractor-2' style='margin-left:20px' value='Back' onClick='prevExtractor(\"extractor-2\", \"extractor-1\")'>\
        <input id='api-next2' class='btn btn-dark extractor-2' style='margin-left:20px' value='Import' onClick='prevExtractor(\"extractor-2\", \"form_row\", true,\""+ id+"\")'>\
    </section>";
    $('.extractor-1').hide();
    $('.import-form.block_field .block_field').append(resultSection);
    $('.import-form.block_field .block_field').append(buttonList);

    // manage results pagination
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