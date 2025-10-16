/* charts.js
----------------------------- 
this file collects all the js functions needed 
to create or modify explorative charts
*/

$(document).ready(function() {

    // set the base URL for backend queries
    let pageUrl = new URL(window.location.href);
    let baseUrl = pageUrl.origin + pageUrl.pathname.substring(0, pageUrl.pathname.lastIndexOf('/'));

    // check section is in viewport (see window.on('scroll') below)
    function isElementInViewport(el) {
        var rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 && 
            rect.left >= 0
        );
    }

    // show section on scroll
    $(window).on('scroll', function() {
        $('.section-fade').each(function() {
            // activate animation
            if (isElementInViewport(this)) {
                $(this).addClass('section-fade-visible');
            }
        });
    });
    $(window).trigger('scroll'); // for sections already visibile when the page is loaded

    // get data and generate counters
    $(".counters").each(function() {
        var chartInfo = $(this).find("script[type='application/json']").html();
        var $currentCounter = $(this); 

        // get data from the back-end api
        $.ajax({
            type: 'POST',
            url: baseUrl+'/charts-visualization?action=getData',
            data: chartInfo,
            contentType: 'application/json',
            dataType: 'json',
            success: function(jsondata) {
                console.log(jsondata);
                jsondata.forEach(function(element, index) {
                    var $counterElement = $currentCounter.find("p.counterNum").eq(index);
                    
                    // set the animation
                    var startValue = 0;
                    var endValue = element;
                    var duration = 2000;
                    var stepTime = 50;
    
                    var steps = duration / stepTime;
                    var increment = (endValue - startValue) / steps;
    
                    var currentValue = startValue;
                    var counter = setInterval(function() {
                        currentValue += increment;
                        if (currentValue >= endValue) {
                            currentValue = endValue;
                            clearInterval(counter); // stop the animation
                        }
                        $counterElement.text(Math.round(currentValue)); // update number
                    }, stepTime);
                });
            }
        });
    });
    

    // get data and generate charts
    $(".chart-body").each(function() {
        var chartId = $(this).attr("id");
        var chartInfo = $("#"+chartId+"_data").html();
        
        // get data from the back-end api
        $.ajax({
            type: 'POST',
            url: baseUrl+'/charts-visualization?action=getData',
            data: chartInfo,
            contentType: 'application/json',
            dataType: 'json',
            success: function(jsondata) {
                chartInfo = JSON.parse(chartInfo);
                if (chartInfo["type"] == "timeline") {
                  (async function init() {
                    const events = await getTimelineDataFromWikidata(jsondata);
                    timelineChart(
                      chartId,
                      events,
                      "Discovering Italian Cultural Heritage through the millennia",
                      "This timeline shows how <span style='font-weight:600'>Digital Humanities research products</span> reflect <span style='font-weight:600'>real-world Italian Cultural Heritage</span> produced across the millennia, highlighting trends, key periods, and the evolving focus of research."
                    );
                  })();
                } else if (chartInfo["type"] == "network"){
                  forceDirectedTree(chartId, [jsondata], jsondata["name"])
                } else if (chartInfo["type"] == "map") {
                    if (chartInfo["mapType"] === "common-map") {
                        map(chartId,jsondata)
                    } else {
                        mapDrillDown(chartId,jsondata)
                    }
                } else if (chartInfo["type"] == "chart") {
                    var chartOptions = chartInfo["info"];

                    if (chartInfo["chartType"] == "bar") {
                        if (chartInfo["y-var"] == "?label") { invertedBarchart(chartOptions[0],chartOptions[1],chartOptions[2],jsondata) }
				        else if (chartInfo["x-var"] == "?label") { barchart(chartOptions[0],chartOptions[1],chartOptions[2],jsondata) }
                    } else if (chartInfo["chartType"] == "pie") {
                        piechart(chartOptions[0],chartOptions[1],chartOptions[2],chartInfo["legend"],jsondata,donut=false,semi=false);
                    } else if (chartInfo["chartType"] == "donut") {
                        piechart(chartOptions[0],chartOptions[1],chartOptions[2],chartInfo["legend"],jsondata,donut=true,semi=false);
                    } else if (chartInfo["chartType"] == "semi-circle") {
                        piechart(chartOptions[0],chartOptions[1],chartOptions[2],chartInfo["legend"],jsondata,donut=false,semi=true);
                    }
                }
            }
        })
    })

    // generate preview
    // generate preview using event delegation
    $(document).on('click', '.preview', function(e) {
        e.preventDefault();
        var blockField = $(this).closest(".block_field");
        blockField.find(".charts-yasqe").each(function() {
            var query = getYASQEQuery($(this));
            var queryIdx = $(this).attr("id").split("__")[0];
            var queryId = queryIdx + "__query__" + queryIdx;
            blockField.append($("<input type='hidden' name='"+queryId+"' value='"+query+"'/>"));
            $(this).find("textarea").remove();
        });

        let pageUrl = new URL(window.location.href);
        let baseUrl = pageUrl.origin + pageUrl.pathname.substring(0, pageUrl.pathname.lastIndexOf('/'));
        var url = baseUrl+"/charts-visualization?action=preview";
        blockField.find('input, select').each(function() {
            url += "&" + encodeURIComponent($(this).attr("name")).replace(/'/g, '%27') + "=" + encodeURIComponent($(this).val()).replace(/'/g, '%27');
        });
        blockField.find('textarea').each(function() {
            url += "&" + encodeURIComponent($(this).attr("name")).replace(/'/g, '%27') + "=" + encodeURIComponent($(this).text()).replace(/'/g, '%27');
        });
        var modal = $("<div class='modal-previewMM'><span class='previewTitle'>This is a preview of your data visualization<br></span><span class='closePreview'></span><iframe src='" + url + "'></div>")
        $(this).after(modal);
    });

    // save the charts template
    $("#updateTemplate").on('click', function(e) {
        e.preventDefault();

        // resolve yasqe textarea
        $(".charts-yasqe").each(function() {
            var query = getYASQEQuery($(this));
            var queryIdx = $(this).attr("id").split("__")[0];
            var queryId = queryIdx + "__query__" + queryIdx;
            $("#chartForm").append($("<input type='hidden' name='"+queryId+"' value='"+query+"'/>"));
            $(this).find("textarea").remove();
        });

        // save the template in case everything is ok
        Swal.fire({ title: 'Saved!'});
        setTimeout(function() { document.getElementById("chartForm").submit();}, 500);
    });
});

/////////////////////
/// CONFIGURATION ///
/////////////////////

function generateYASQE(elementId,query=null) {
    console.log(elementId);
    var yasqe = YASQE(document.getElementById(elementId), {
        sparql: {
        showQueryButton: false,
        endpoint: myPublicEndpoint,
        }
    });
    
    if (query) {
        query = query.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        yasqe.setValue(query);
    }
}

// add a new Visualization block to define a new Visualization
function addVisualization(visualizationType, changeIndex=null) {


    // get last visualization block index
    const lastVisualization = $(".sortable .block_field:last-child");
    var index = lastVisualization.length ? lastVisualization.data("index") : 0;

    // set the new block HTML code    
    var newIndex = changeIndex != null ? changeIndex : index + 1;
    var newFieldBlock = "<section class='block_field' data-index='"+newIndex+"'>\
        <section class='row'>\
            <label class='col-md-3'>TYPE</label>\
            <select onchange='changeVisualization(this)' class='col-md-8 custom-select' name='type__"+newIndex+"' id='type__"+newIndex+"'>\
                <option value='None'>Select a visualization type</option>\
                <option value='counter' "+is_selected('counter',visualizationType)+">Counter</option>\
                <option value='chart' "+is_selected('chart',visualizationType)+">Chart</option>\
                <option value='map' "+is_selected('map',visualizationType)+">Map</option>\
                <option value='network' "+is_selected('network',visualizationType)+">Network</option>\
            </select>\
        </section>\
        <section class='row'>\
            <label class='col-md-3'>TITLE</label>\
            <input type='text' id='title__"+newIndex+"' class='col-md-8 align-self-start' name='title__"+newIndex+"'/>\
        </section>\
        <section class='row'>\
            <label class='col-md-3'>DESCRIPTION</label>\
            <textarea id='description__"+newIndex+"' class='col-md-8 align-self-start' name='description__"+newIndex+"'></textarea>\
        </section>";

    var countersLits = "<section class='row'>\
        <label class='col-md-3'>COUNTERS<br><span class='comment'>define one or multiple counters</span></label>\
        <section class='col-md-8'>\
            <ul class='col-md-12 charts-list' id='counters__"+newIndex+"'>\
                <li><label class='inner-label col-md-12'>Counters list</label></li>\
                <li><label class='add-option'>Add new counter <i class='fas fa-plus-circle' onclick='addCounter(this,\""+newIndex+"\")'></i></label></li>\
            </ul>\
        </section>\
    </section>";

    var chartType = "<section class='row'>\
        <label class='col-md-3'>CHART TYPE</label>\
        <select onchange='changeChart(this)' class='col-md-8 custom-select' name='chartType__"+newIndex+"' id='chartType__"+newIndex+"'>\
            <option value='None'>Select a chart type</option>\
            <option value='bar'>Bar Chart</option>\
            <option value='pie'>Pie Chart</option>\
            <option value='donut'>Donut Chart</option>\
            <option value='semi-circle'>Semi-circle Chart</option>\
        </select>\
    </section>";

    var chartYasqeField = "<section class='row'>\
        <label class='col-md-3'>QUERY<br><span class='comment'>set a SPARQL query to retrieve data (two variables required)</span></label>\
        <section class='col-md-8 align-self-start'>\
            <div id='yasqe-"+newIndex+"' class='col-md-12 charts-yasqe'></div>\
        </section>\
    </section>";

    var chartLegend = "<section class='row'>\
        <label class='left col-11' for='legend__"+newIndex+"'>Show legend</label>\
        <input type='checkbox' id='legend__"+newIndex+"' name='legend__"+newIndex+"'>\
    </section>";

    var mapType = "<section class='row'>\
        <label class='col-md-3'>MAP TYPE</label>\
        <select onchange='changeMapType(this)' class='col-md-8 custom-select' name='mapType__"+newIndex+"' id='mapType__"+newIndex+"'>\
            <option value='None'>Select a map type</option>\
            <option value='common-map'>Simple Map</option>\
            <option value='drilldown-map'>Drill-down Map</option>\
        </select>\
    </section>";

    var mapYasqeField = "<section class='row'>\
        <label class='col-md-3'>QUERY<br><span class='comment'>set a SPARQL query to retrieve data, where locations can be represented either as GeoNames entities or as latitude-longitude pairs</span></label>\
        <section class='col-md-8 align-self-start'>\
            <div id='yasqe-"+newIndex+"' class='col-md-12 charts-yasqe'></div>\
        </section>\
    </section>";

    var mainClass = "<section class='row'>\
      <label class='col-md-3'>MAIN CLASS<br><span class='comment'>a label describing all collected individuals</span></label>\
      <input type='text' id='mainClass__"+newIndex+"' class='col-md-8 align-self-start' name='mainClass__"+newIndex+"/>\
    </section>";

    var networkYasqeField = "<section class='row'>\
        <label class='col-md-3'>QUERY<br><span class='comment'>set a SPARQL query to retrieve data (three variables required)</span></label>\
        <section class='col-md-8 align-self-start'>\
            <div id='yasqe-"+newIndex+"' class='col-md-12 charts-yasqe'></div>\
        </section>\
    </section>";

    var fieldButtons = "<a href='#' class='up'><i class='fas fa-arrow-up'></i></a> <a href='#' class='down'><i class='fas fa-arrow-down'></i></a> <a href='#' class='preview'><i class='fas fa-eye'></i></a> <a href='#' class='trash'><i class='far fa-trash-alt'></i></a>"

    // add Type related fields
    if (visualizationType === "counter") {
        newFieldBlock += countersLits ;
    } else if (visualizationType === "chart") {
        newFieldBlock += chartType + chartYasqeField + chartLegend ;
    } else if (visualizationType === "map") {
        newFieldBlock += mapType + mapYasqeField ;
    } else if (visualizationType === "network") {
        newFieldBlock += mainClass + networkYasqeField;
    }
    
    newFieldBlock += fieldButtons + "</section>"
    // add the new block
    if (lastVisualization.length) {lastVisualization.after($(newFieldBlock));} else { $(".sortable").append($(newFieldBlock)) }
    
    generateYASQE("yasqe-"+newIndex);

    if (changeIndex === null) {
        updateindex();
        moveUpAndDown();
    }
    
    $(".trash").click(function(e){
        e.preventDefault();
        $(this).parent().remove();
    });
}

// change visualization type
function changeVisualization(select) {
    var newViz = $(select).val();
    var currentIndex = $(select).closest(".block_field").data("index");
    
    addVisualization(newViz, currentIndex); // create a new viz block
    const newVizBlock = $(".sortable .block_field:last-child");
    const oldVizBlock = $(select).closest(".block_field");

    // check if required values have already been provided within the original viz block
    newVizBlock.find("input, select, textarea, .charts-yasqe").each(function() {
        var existingValues = oldVizBlock.find("[id*='__"+$(this).attr("id")+"']");
        if (existingValues.length > 0 && $(this).attr("id") !== undefined) {
            $(this).closest("section.row").replaceWith(existingValues.eq(0).closest("section.row"));
        }
    });

    // check the comment to the SPARQL input
    const commentSpan = newVizBlock.find(".charts-yasqe").closest(".row").find(".comment");
    if (newViz === "chart") { commentSpan.text("set a SPARQL query to retrieve data (two variables required)") }
    else if (newViz === "map") { commentSpan.text("set a SPARQL query to retrieve data, where locations can be represented either as GeoNames entities or as latitude-longitude pairs") }

    // move the new block to right position
    oldVizBlock.replaceWith(newVizBlock);
    updateindex();
    moveUpAndDown();
} 

/* CHARTS */
function changeChart(select) {
    var value = $(select).val();
    var index = $(select).attr("name").split("chartType__")[1];
    let newClass, firstVar, secondVar;
    if (value === "bar") {
        newClass = "chart-axes";
        firstVar = '<label class="col-md-3">X-AXIS<br><span class="comment">set the SPARQL variable to be shown in the X-Axis</span></label>';
        secondVar = '<label class="col-md-3">Y-AXIS<br><span class="comment">set the SPARQL variable to be shown in the Y-Axis</span></label>'
    } else if (["donut", "pie", "semi-circle"].includes(value)) {
        newClass = "chart-variables";
        firstVar = '<label class="col-md-3">1st VARIABLE<br><span class="comment">set a SPARQL variable</span></label>';
        secondVar = '<label class="col-md-3">2nd VARIABLE<br><span class="comment">set a SPARQL variable</span></label>';
    } else {
        newClass = null; firstVar = null; secondVar = null;
    }

    // remove existing fields then add new ones
    $(select).closest("section.block_field").find(".chart-axes, .chart-variables").remove();
    if (newClass !== null) {
        var chartAxes = "<section class='row "+newClass+"'>"+firstVar+"\
            <section class='col-md-3'>\
                <label class='inner-label'>SPARQL variable</label>\
                <input type='text' id='"+index+"__x-var__"+index+"' name='"+index+"__x-var__"+index+"'/>\
            </section>\
            <section class='col-md-3'>\
                <label class='inner-label'>Display name</label>\
                <input type='text' id='"+index+"__x-name__"+index+"' name='"+index+"__x-name__"+index+"'/>\
            </section>\
            <section class='col-md-2 center-checkbox'>\
                <label class='inner-label'>Sort by</label>\
                <input type='checkbox' id='"+index+"__x-sort__"+index+"' name='"+index+"__x-sort__"+index+"' onclick='sortChart('"+index+"')'/>\
            </section>\
        </section>\
        <section class='row "+newClass+"'>"+secondVar+"\
            <section class='col-md-3'>\
                <label class='inner-label'>SPARQL variable</label>\
                <input type='text' id='"+index+"__y-var__"+index+"' name='"+index+"__y-var__"+index+"'/>\
            </section>\
            <section class='col-md-3'>\
                <label class='inner-label'>Display name</label>\
                <input type='text' id='"+index+"__y-name__"+index+"' name='"+index+"__y-name__"+index+"'/>\
            </section>\
            <section class='col-md-2 center-checkbox'>\
                <label class='inner-label'>Sort by</label>\
                <input type='checkbox' id='"+index+"__y-sort__"+index+"' name='"+index+"__y-sort__"+index+"' onclick='sortChart('"+index+"')'/>\
            </section>\
        </section>";

        $(select).closest("section.row").next().after(chartAxes); // add new configuration input fields
    }
}

function sortChart(element, fieldId) {
    var isChecked = $(element).is(":checked");
    var checkboxes = $("[name*='sort__"+fieldId+"']");
    checkboxes.prop("checked", false);

    if (isChecked) {
        $(element).prop("checked", true);
    }
}

/* COUNTERS */
function addCounter(element, fieldId) {
    var block = $("<li class='col-md-12'><hr><section class='col-md-12'>\
        <section class='row'>\
            <label class='inner-label col-md-12'>New counter name</label>\
            <input type='text' id='description' class='col-md-12 align-self-start' name='description'>\
        </section>\
        <section class='row'>\
            <label class='inner-label col-md-12'>Query</label>\
            <div id='newYasqe' class='yasqe-max'></div>\
        </section>\
        <button class='btn btn-dark' type='button' onclick='saveCounter(this,\""+fieldId+"\")'>Save counter</button>\
    </section></li>");

    $(element).parent().parent().replaceWith(block);
    yasqe = YASQE(document.getElementById("newYasqe"), {
        sparql: {
        showQueryButton: false,
        endpoint: myPublicEndpoint,
        }
    });
}

function saveCounter(element,fieldId,modify=false) {
    var item = $(element).closest("li");
    let itemIndex;

    // retrieve the label and the query
    if (modify) {
        itemIndex = modify
    } else {
        var itemsList = $(element).closest("ul");
        itemIndex = itemsList.find("li").length - 1;
    }
    var label = item.find("[name='description']").val();
    var query = getYASQEQuery(item);

    // make sure a label has been provided
    if (label === "") {
        label = fieldId+" - no label";
    }

    // add the new counter to the DOM and remove input fields
    item.after("<li>\
        <label>"+label+" <i class='far fa-edit' onclick='modifyCounter(this)'></i> <i class='far fa-trash-alt' onclick='removeCounter(this)'></i></label>\
        <input type='hidden' name='"+fieldId+"__counter"+itemIndex+"_"+label.replace(" ","_")+"__"+fieldId+"' value='"+query+"'/>\
    </li>\
    <li>\
        <label class='add-option'>Add new counter <i class='fas fa-plus-circle' onclick='addCounter(this, \""+fieldId+"\")'></i></label>\
    </li>");
    item.remove();

    // scroll top
    $('html, body').animate({
        scrollTop: itemsList.offset().top - 100
    }, 800);
}

function modifyCounter(element) {
    // retrieve counter's data
    const input = $(element).parent().next("input");
    var fieldId = input.attr("name").split("__")[0]
    var idx = input.attr("name").split("__")[1].split("_")[0].replace("counter","")
    var rawTitle = input.attr("name").split("__")[1].split("_");
    var title = rawTitle.slice(1, rawTitle.length).join(' ');
    var query = input.val()

    var block = $("<li class='col-md-12'><hr><section class='col-md-12'>\
        <section class='row'>\
            <label class='inner-label col-md-12'>New counter name</label>\
            <input type='text' id='description' class='col-md-12 align-self-start' name='description'>\
        </section>\
        <section class='row'>\
            <label class='inner-label col-md-12'>Query</label>\
            <div id='newYasqe' class='yasqe-max'></div>\
        </section>\
        <button class='btn btn-dark' type='button' onclick='saveCounter(this,\""+fieldId+"\",\""+idx+"\")'>Save counter</button>\
    </section></li>");
    
    $(block).find("input").val(title.replace("_"," "));
    $(element).closest("ul").find("li:last-of-type").replaceWith(block);
    $(element).closest("li").remove();
    yasqe = YASQE(document.getElementById("newYasqe"), {
        sparql: {
        showQueryButton: false,
        endpoint: myPublicEndpoint,
        }
    });
    yasqe.setValue(query);
    $('html, body').animate({
        scrollTop: block.offset().top - 100
    }, 800);
}

function removeCounter(element) {
    $(element).closest("li").remove();
} 


/////////////////////
/// VISUALIZATION ///
/////////////////////

// Charts (bar-chart, pie-chart, donut-chart, semicircle-chart)
function barchart(elid, data_x, data_y, data) {
  am5.ready(function() {
    var root = am5.Root.new(elid);
    root.setThemes([am5themes_Animated.new(root)]);

    // Create chart
    var chart = root.container.children.push(am5xy.XYChart.new(root, {
      panX: true,
      panY: true,
      wheelX: "panX",
      wheelY: "zoomX",
      pinchZoomX: true
    }));

    // Add cursor
    var cursor = chart.set("cursor", am5xy.XYCursor.new(root, {}));
    cursor.lineY.set("visible", false);

    // X-axis renderer (categories)
    var xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 });
    xRenderer.labels.template.setAll({
      rotation: -90,
      centerY: am5.p100,
      centerX: am5.p100,
      oversizedBehavior: "truncate",
      maxHeight: 150,
      textAlign: "center",
      fill: am5.color(0x333333),
      fontSize: 14,
      fontWeight: "300"
    });
    xRenderer.grid.template.setAll({
      stroke: am5.color(0xcccccc),
      strokeOpacity: 0.5,
      strokeDasharray: [2, 2]
    });

    // Create X-axis (no tooltip to avoid duplicate hover popup)
    var xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
      maxDeviation: 0.3,
      categoryField: data_x,
      renderer: xRenderer
    }));

    // Create Y-axis (values)
    var yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
      maxDeviation: 0.3,
      renderer: am5xy.AxisRendererY.new(root, {})
    }));
    yAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x777777),
      fontSize: 12
    });
    yAxis.get("renderer").grid.template.setAll({
      stroke: am5.color(0xdddddd),
      strokeOpacity: 0.6
    });

    // Create series
    var series = chart.series.push(am5xy.ColumnSeries.new(root, {
      name: "Series 1",
      xAxis: xAxis,
      yAxis: yAxis,
      valueYField: data_y,
      categoryXField: data_x,
      sequencedInterpolation: true
    }));

    // Apply custom color set
    chart.set("colors", am5.ColorSet.new(root, {
      colors: generatePaletteForAmCharts(data.length),
      reuse: true
    }));
    series.columns.template.adapters.add("fill", function(fill, target) {
      return chart.get("colors").getIndex(series.columns.indexOf(target));
    });
    series.columns.template.adapters.add("stroke", function(stroke, target) {
      return chart.get("colors").getIndex(series.columns.indexOf(target));
    });

    // Tooltip for series
    series.set("tooltip", am5.Tooltip.new(root, {
      pointerOrientation: "vertical",
      labelText: "{categoryX}: [bold]{valueY}[/]",
      getFillFromSprite: false,
      getStrokeFromSprite: false,
      autoTextColor: false,
      background: am5.Rectangle.new(root, {
        fill: am5.color(0x000000),
        fillOpacity: 0.7,
        stroke: am5.color(0xffffff),
        strokeOpacity: 0.2,
        cornerRadius: 6
      })
    }));
    series.get("tooltip").label.setAll({
      fill: am5.color(0xffffff),
      fontSize: 13,
      textAlign: "center",
      oversizedBehavior: "wrap",
      maxWidth: 270,
    });

    // Set data
    xAxis.data.setAll(data);
    series.data.setAll(data);

    // Animate
    series.appear(1000);
    chart.appear(1000, 100);
  });
}


function invertedBarchart(elid, data_x, data_y, data) {
  am5.ready(function() {
    var root = am5.Root.new(elid);
    root.setThemes([am5themes_Animated.new(root)]);

    // Create chart
    var chart = root.container.children.push(am5xy.XYChart.new(root, {
      panX: true,
      panY: true,
      wheelX: "panY",
      wheelY: "zoomY",
      pinchZoomX: true
    }));

    // Add cursor
    var cursor = chart.set("cursor", am5xy.XYCursor.new(root, {}));
    cursor.lineY.set("visible", false);

    // Y-axis renderer (categories)
    var yRenderer = am5xy.AxisRendererY.new(root, {
      minGridDistance: 30,
      minorGridEnabled: true
    });
    yRenderer.labels.template.setAll({
      oversizedBehavior: "wrap",
      textAlign: "right",
      centerX: am5.p100,
      maxWidth: 180,
      fill: am5.color(0x333333),
      fontSize: 14,
      fontWeight: "300",
    });
    yRenderer.grid.template.setAll({
      stroke: am5.color(0xcccccc),
      strokeOpacity: 0.5,
      strokeDasharray: [2, 2]
    });

    // Create Y-axis
    var yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, {
      maxDeviation: 0.3,
      categoryField: data_y,
      renderer: yRenderer,
    }));

    // X-axis renderer (values)
    var xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
      maxDeviation: 0.3,
      renderer: am5xy.AxisRendererX.new(root, {
        strokeOpacity: 0.1,
        minGridDistance: 80
      })
    }));
    xAxis.get("renderer").grid.template.setAll({
      stroke: am5.color(0xdddddd),
      strokeOpacity: 0.6
    });
    xAxis.get("renderer").labels.template.setAll({
      fill: am5.color(0x777777),
      fontSize: 12
    });

    // Create series
    var series = chart.series.push(am5xy.ColumnSeries.new(root, {
      name: "Series 1",
      xAxis: xAxis,
      yAxis: yAxis,
      valueXField: data_x,
      categoryYField: data_y
    }));

    // Apply custom color set
    chart.set("colors", am5.ColorSet.new(root, {
      colors: generatePaletteForAmCharts(data.length),
      reuse: true
    }));
    series.columns.template.adapters.add("fill", function(fill, target) {
      return chart.get("colors").getIndex(series.columns.indexOf(target));
    });
    series.columns.template.adapters.add("stroke", function(stroke, target) {
      return chart.get("colors").getIndex(series.columns.indexOf(target));
    });

    // Tooltip
    series.set("tooltip", am5.Tooltip.new(root, {
      pointerOrientation: "left",
      labelText: "{categoryY}: [bold]{valueX}[/]",
      getFillFromSprite: false,
      getStrokeFromSprite: false,
      autoTextColor: false,
      background: am5.Rectangle.new(root, {
        fill: am5.color(0x000000),
        fillOpacity: 0.7,
        stroke: am5.color(0xffffff),
        strokeOpacity: 0.2,
        cornerRadius: 6
      })
    }));
    series.get("tooltip").label.setAll({
      fill: am5.color(0xffffff),
      fontSize: 13,
      textAlign: "left"
    });

    // Set data
    yAxis.data.setAll(data);
    series.data.setAll(data);

    // Animate
    series.appear(1000);
    chart.appear(1000, 100);
  });
}

  

function piechart(elid, data_x, data_y, legend, data, donut = false, semi = false) {
  console.log(elid, data_x, data_y, legend, data)
  am5.ready(function() {
    var root = am5.Root.new(elid);
    root.setThemes([am5themes_Animated.new(root)]);

    // Create pie chart
    var chart = root.container.children.push(am5percent.PieChart.new(root, {
      layout: root.verticalLayout,
      ...(donut && { innerRadius: am5.percent(50) }),
      ...(semi && { startAngle: 180, endAngle: 360 })
    }));

    // Create series
    var series = chart.series.push(am5percent.PieSeries.new(root, {
      valueField: data_y,
      categoryField: data_x,
      ...(semi && { startAngle: 180, endAngle: 360, alignLabels: false })
    }));

    // Hidden state for semicircle animation
    if (semi) {
      series.states.create("hidden", { startAngle: 180, endAngle: 180 });
    }

    // Label styling
    series.labels.template.setAll({
      wrap: true,
      maxWidth: 140,
      oversizedBehavior: "wrap",
      fontSize: 14,
      fontWeight: "300",
      textAlign: "center"
    });

    // Tick lines (callout lines) styling
    series.ticks.template.setAll({
      strokeWidth: 2,
      stroke: am5.color(0x999999),
      strokeDasharray: [2, 2],
      visible: true
    });

    // Tooltip styling
    series.set("tooltip", am5.Tooltip.new(root, {
      labelText: "{category}: [bold]{valuePercentTotal.formatNumber('0.00')}%[/] ({value})",
      getFillFromSprite: false,
      getStrokeFromSprite: false,
      autoTextColor: false,
      background: am5.Rectangle.new(root, {
        fill: am5.color(0x000000),
        fillOpacity: 0.7,
        stroke: am5.color(0xffffff),
        strokeOpacity: 0.2,
        cornerRadius: 6
      })
    }));
    series.get("tooltip").label.setAll({
      fill: am5.color(0xffffff),
      fontSize: 13,
      textAlign: "center"
    });

    // Custom color palette
    series.set("colors", am5.ColorSet.new(root, {
      colors: generatePaletteForAmCharts(data.length),
      reuse: true
    }));

    // Set data and animate
    series.data.setAll(data);
    series.appear(1000, 100);

    // Add legend if requested
    if (legend === "True") {
      let legendDiv = chart.children.push(am5.Legend.new(root, {
        centerX: am5.percent(50),
        x: am5.percent(50),
        marginTop: 15,
        marginBottom: 15
      }));
      legendDiv.data.setAll(series.dataItems);
      legendDiv.markers.template.setAll({
        width: 14,
        height: 14,
      });
      legendDiv.markerRectangles.template.setAll({
        cornerRadiusTL: 0,
        cornerRadiusTR: 0,
        cornerRadiusBL: 0,
        cornerRadiusBR: 0
      });
      legendDiv.labels.template.setAll({
        fontSize: 14,
        fontWeight: "300"
      });
      legendDiv.valueLabels.template.setAll({
        fontSize: 14,
        fontWeight: "400"
      });
    }

    // ---- Responsive behavior: hide labels if width < 500 ----
    function updateLabelsVisibility() {
      const width = root.dom.clientWidth;
      if (width < 500) {
        // Hide labels and ticks
        series.labels.template.set("visible", false);
        series.ticks.template.set("visible", false);
      } else {
        // Show labels and ticks again
        series.labels.template.set("visible", true);
        series.ticks.template.set("visible", true);
      }
    }

    // Run once at startup
    updateLabelsVisibility();

    // Update when the container is resized
    const resizeObserver = new ResizeObserver(() => updateLabelsVisibility());
    resizeObserver.observe(root.dom);
  });
}

function map(elid, data) {
  am5.ready(function() {
    const root = am5.Root.new(elid);
    root.setThemes([am5themes_Animated.new(root)]);

    // Primary color
    const baseHex = (getComputedStyle(document.documentElement)
      .getPropertyValue('--primary-color') || "#6baed6").trim();

    // utility color helpers
    function hexToRgb(hex) {
      const bigint = parseInt(hex.replace("#", ""), 16);
      return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    }
    function rgbToHex(r, g, b) {
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    function blendColor(hex, targetHex, alpha = 0.5) {
      const [r1,g1,b1] = hexToRgb(hex);
      const [r2,g2,b2] = hexToRgb(targetHex);
      const r = Math.round(r1*(1-alpha)+r2*alpha);
      const g = Math.round(g1*(1-alpha)+g2*alpha);
      const b = Math.round(b1*(1-alpha)+b2*alpha);
      return rgbToHex(r,g,b);
    }

    const countryColor = generatePaletteForAmCharts(10)[6];

    // Chart
    const chart = root.container.children.push(
      am5map.MapChart.new(root, {
        panX: "rotateX",
        panY: "translateY",
        projection: am5map.geoMercator(),
        minZoomLevel: 1.5,
        zoomLevel: 1.5
      })
    );

    // Background
    const backgroundSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {}));
    backgroundSeries.mapPolygons.template.setAll({ fillOpacity: 0, strokeOpacity: 0 });
    backgroundSeries.data.push({ geometry: am5map.getGeoRectangle(90, 180, -90, -180) });

    // Zoom controls 
    const zoomControl = chart.set("zoomControl", am5map.ZoomControl.new(root, {}));
    zoomControl.homeButton.set("visible", true);

    const styleButton = btn => {
      btn.setAll({
        width: 32,
        height: 32,
        background: am5.Rectangle.new(root, {
          fill: am5.color(baseHex),
          stroke: am5.color(baseHex),
          cornerRadius: 16,
          shadowColor: am5.color(0x222222),
          shadowBlur: 4,
          shadowOffsetX: 0,
          shadowOffsetY: 1,
          shadowOpacity: 0.12
        })
      });
      btn.get("icon")?.setAll({ fill: am5.color(0xffffff), scale: 0.9 });
      btn.events.on("pointerover", ev => {
        ev.target.get("background").setAll({ fill: am5.color(0x222222), stroke: am5.color(0x222222) });
      });
      btn.events.on("pointerout", ev => {
        ev.target.get("background").setAll({ fill: am5.color(baseHex), stroke: am5.color(baseHex) });
      });
    };
    [zoomControl.plusButton, zoomControl.minusButton, zoomControl.homeButton].forEach(styleButton);

    // World polygons
    const polygonSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {
      geoJSON: am5geodata_worldLow,
      exclude: ["AQ"]
    }));
    polygonSeries.mapPolygons.template.setAll({
      fill: am5.color(countryColor),
      fillOpacity: 0.15,
      strokeWidth: 0.7,
      stroke: am5.color(0x999999)
    });

    // Point series
    const pointSeries = chart.series.push(am5map.ClusteredPointSeries.new(root, {}));

    // Clustered bullets
    pointSeries.set("clusteredBullet", function(root) {
      const container = am5.Container.new(root, {
        cursorOverStyle: "pointer"
      });

      container.children.push(am5.Circle.new(root, {
        radius: 8,
        tooltipY: 0,
        fill: am5.color(baseHex)
      }));
      container.children.push(am5.Circle.new(root, {
        radius: 12,
        fillOpacity: 0.25,
        fill: am5.color(baseHex)
      }));
      container.children.push(am5.Circle.new(root, {
        radius: 16,
        fillOpacity: 0.15,
        fill: am5.color(baseHex)
      }));
      container.children.push(am5.Label.new(root, {
        centerX: am5.p50,
        centerY: am5.p50,
        fill: am5.color(0xffffff),
        populateText: true,
        fontSize: 12,
        fontWeight: "400",
        fontFamily: "sans-serif",
        text: "{value}"
      }));

      container.events.on("click", function(e) {
        pointSeries.zoomToCluster(e.target.dataItem);
      });

      return am5.Bullet.new(root, { sprite: container });
    });

    // Regular bullets 
    pointSeries.bullets.push(function() {
      const circle = am5.Circle.new(root, {
        radius: 6,
        tooltipY: 0,
        fill: am5.color(baseHex),
        tooltipText: "{title}"
      });

      const tooltip = am5.Tooltip.new(root, {
        labelText: "{title}",
        background: am5.Rectangle.new(root, {
          fill: am5.color(0x000000),
          fillOpacity: 0.7,
          cornerRadius: 6
        })
      });

      circle.set("tooltip", tooltip);
      tooltip.label.setAll({
        fill: am5.color(0xffffff),
        fontSize: 12,
        fontWeight: "400",
        fontFamily: "sans-serif",
        textAlign: "left"
      });

      return am5.Bullet.new(root, { sprite: circle });
    });
    data.forEach(city => {
      pointSeries.data.push({
        geometry: { type: "Point", coordinates: [city.longitude, city.latitude] },
        title: city.label
      });
    });

    // Switch container + label
    const cont = chart.children.push(am5.Container.new(root, {
      layout: root.horizontalLayout,
      x: 20,
      y: 40
    }));

    // --- SWITCH BUTTON: default shape, same color as other buttons, TOGGLE LOGIC FIXED ---
    const switchButton = cont.children.push(
      am5.Button.new(root, {
        dy: -20,
        icon: am5.Label.new(root, {
          html: "<i class='fas fa-globe'></i>",
          fontSize: 20,               
          centerX: am5.p10,
          centerY: am5.p30,
          fill: am5.color(0xffffff),
          paddingTop: 10,
          paddingBottom: 2,
          dx: -11,
          dy: -10
        })

      })
    );
    styleButton(switchButton);

    const sbBg = switchButton.get("background");
    if (sbBg) {
      sbBg.setAll({
        fill: am5.color(baseHex),
        stroke: am5.color(baseHex)
      });
    }
    const sbIcon = switchButton.get("icon");

    function applyPolygonAppearance(pFillHex, pFillOpacity) {
      polygonSeries.mapPolygons.template.setAll({
        fill: am5.color(pFillHex),
        fillOpacity: pFillOpacity,
        stroke: am5.color(0x999999),
        strokeWidth: 0.7
      });
      polygonSeries.mapPolygons.each(function(mp) {
        mp.set("fill", am5.color(pFillHex));
        mp.set("fillOpacity", pFillOpacity);
        mp.set("stroke", am5.color(0x999999));
        mp.set("strokeWidth", 0.7);
      });
    }
    function applyBackgroundAppearance(bgHexOrNull, bgOpacity) {
      if (bgHexOrNull) {
        backgroundSeries.mapPolygons.template.setAll({
          fill: am5.color(bgHexOrNull),
          fillOpacity: bgOpacity,
          strokeOpacity: 0
        });
        backgroundSeries.mapPolygons.each(function(mp) {
          mp.set("fill", am5.color(bgHexOrNull));
          mp.set("fillOpacity", bgOpacity);
          mp.set("strokeOpacity", 0);
        });
      } else {
        backgroundSeries.mapPolygons.template.setAll({ fillOpacity: 0, strokeOpacity: 0 });
        backgroundSeries.mapPolygons.each(function(mp) {
          mp.set("fillOpacity", 0);
          mp.set("strokeOpacity", 0);
        });
      }
    }

    // Click handler
    switchButton.events.on("click", function() {
      const nowActive = !switchButton.get("active"); // compute what the state will be
      switchButton.set("active", nowActive);

      if (nowActive) {
        // Globe
        chart.set("projection", am5map.geoOrthographic());
        const bgHex = generatePaletteForAmCharts(10)[8];
        applyBackgroundAppearance(bgHex, 0.5);
        const landHex = generatePaletteForAmCharts(10)[5];
        applyPolygonAppearance(landHex, 0.15);
        if (sbIcon && sbIcon.set) {
              sbIcon.set("html", '<i class="fas fa-map"></i>');
        }

      } else {
        // Map (back to mercator)
        chart.set("projection", am5map.geoMercator());
        applyBackgroundAppearance(null, 0);
        applyPolygonAppearance(countryColor, 0.15);
        if (sbIcon && sbIcon.set) {
              sbIcon.set("html", '<i class="fas fa-globe"></i>');
        }
      }
    });


    // animate
    chart.appear(1000, 100);
  });
}



function linechart(elid, data_x, data_y) {
    var data = JSON.parse(document.getElementById(elid + '_data').textContent);
    console.log("Data loaded:", data);

    am5.ready(function() {

        var root = am5.Root.new(elid);
        root.setThemes([
            am5themes_Animated.new(root)
        ]);

        var chart = root.container.children.push(am5xy.XYChart.new(root, {
            panX: true,
            panY: true,
            wheelX: "panX",
            wheelY: "zoomX",
            pinchZoomX: true
        }));

        var cursor = chart.set("cursor", am5xy.XYCursor.new(root, {
            behavior: "none"
        }));
        cursor.lineY.set("visible", false);

        var xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
            categoryField: data_x,
            renderer: am5xy.AxisRendererX.new(root, {
                minGridDistance: 30
            })
        }));

        var yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {})
        }));

        var series = chart.series.push(am5xy.LineSeries.new(root, {
            name: "Creations",
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: data_y,
            categoryXField: data_x,
            tooltip: am5.Tooltip.new(root, {
                labelText: "{valueY}"
            })
        }));

        series.data.setAll(data);

        series.appear(1000);
        chart.appear(1000, 100);
    }); 
}

function mapDrillDown(elid, data) {

    console.log(elid, data)

    // group data by country
    async function groupDataByCountry(data) {
        let promises = data.map(async (item) => {
            let country = await getCountryByCoords(parseFloat(item.latitude), parseFloat(item.longitude));
            return { country, item };
        });

        // Promise.all to get all data
        let results = await Promise.all(promises);

        // Group data by cities and nations
        let groupedData = {};

        results.forEach(({ country, item }) => {
            if (!groupedData[country]) {
                groupedData[country] = { name: country, count: 0, cities: {} };
            }

            groupedData[country].count++;

            if (!groupedData[country].cities[item.label]) {
                groupedData[country].cities[item.label] = { 
                    name: item.label,
                    count: 0, 
                    geometry: { 
                        type: "Point", 
                        coordinates: [parseFloat(item.longitude), parseFloat(item.latitude)]
                    }
                };
            }
            groupedData[country].cities[item.label].count++;
        });

        return groupedData;
    }

    // initialize map
    am5.ready(function() {
        var root = am5.Root.new(elid);
        root.setThemes([am5themes_Animated.new(root)]);
        var chart = root.container.children.push(
            am5map.MapChart.new(root, {
                panX: "rotateX",
                panY: "translateY",
                projection: am5map.geoMercator()
            })
        );

        // set background 
        var backgroundSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {}));
        backgroundSeries.mapPolygons.template.setAll({
            fill: root.interfaceColors.get("alternativeBackground"),
            fillOpacity: 0,
            strokeOpacity: 0
        });
        backgroundSeries.data.push({
            geometry: am5map.getGeoRectangle(90, 180, -90, -180)
        });

        // initialize series
        var citySeries;
        var countrySeries;

        // zoom out button
        var zoomOutButton = root.tooltipContainer.children.push(am5.Button.new(root, {
            x: am5.p100,
            y: 0,
            centerX: am5.p100,
            centerY: 0,
            paddingTop: 18,
            paddingBottom: 18,
            paddingLeft: 12,
            paddingRight: 12,
            dx: -20,
            dy: 20,
            themeTags: ["zoom"],
            icon: am5.Graphics.new(root, {
                themeTags: ["button", "icon"],
                strokeOpacity: 0.7,
                draw: function(display) {
                    display.moveTo(0, 0);
                    display.lineTo(12, 0);
                }
            })
        }));
        zoomOutButton.get("background").setAll({
            cornerRadiusBL: 40,
            cornerRadiusBR: 40,
            cornerRadiusTL: 40,
            cornerRadiusTR: 40
        });
        zoomOutButton.events.on("click", function() {
            chart.goHome();
            zoomOutButton.hide();
            if (citySeries) citySeries.dispose();
            countrySeries.show();
        });
        zoomOutButton.hide();


        // set countries
        var polygonSeries = chart.series.push(
            am5map.MapPolygonSeries.new(root, {
                geoJSON: am5geodata_worldLow,
                exclude: ["AQ"]
            })
        );
        polygonSeries.mapPolygons.template.setAll({
            tooltipText: "{name}",
            interactive: true
        });
        polygonSeries.mapPolygons.template.states.create("hover", {
            fill: am5.color(0xdadada)
        });
        groupDataByCountry(data).then(groupedData => {
            
            // visualization by countries
            countrySeries = chart.series.push(
                am5map.MapPointSeries.new(root, {
                    valueField: "count",
                    calculateAggregates: true
                })
            );

            // set countries bullets
            var circleTemplate = am5.Template.new(root);
            countrySeries.bullets.push(function() {
                var container = am5.Container.new(root, {});
                var circle = container.children.push(am5.Circle.new(root, {
                    radius: 10,
                    fill: am5.color(0x000000),
                    fillOpacity: 0.7,
                    cursorOverStyle: "pointer",
                    tooltipText: "{name}: {count} values"
                }, circleTemplate));

                var label = container.children.push(am5.Label.new(root, {
                    text: "{count}", 
                    fill: am5.color(0xffffff),
                    centerX: am5.p50,
                    centerY: am5.p50,
                    fontSize: 12,
                    populateText: true,
                    textAlign: "center"
                }));

                circle.events.on("click", function(ev) {
                    var countryData = ev.target.dataItem.dataContext;
                    countrySeries.hide();
                    if (citySeries) {
                        citySeries.dispose(); // Remove existing city series
                    }

                    // create new city series
                    citySeries = chart.series.push(
                        am5map.MapPointSeries.new(root, {
                            valueField: "count",
                            calculateAggregates: true
                        })
                    );

                    // set cities bulltets
                    citySeries.bullets.push(function() {
                        var container = am5.Container.new(root, {});

                        var circle = container.children.push(am5.Circle.new(root, {
                            radius: 10,
                            fill: am5.color(0x000000),
                            fillOpacity: 0.7,
                            tooltipText: "{name}: {count} values",
                            cursorOverStyle: "pointer"
                        }));
                        
                        var label = container.children.push(am5.Label.new(root, {
                            text: "{count}", 
                            fill: am5.color(0xffffff),
                            centerX: am5.p50,
                            centerY: am5.p50,
                            fontSize: 12,
                            populateText: true,
                            textAlign: "center"
                        }));

                        return am5.Bullet.new(root, { sprite: container });
                    });
                    citySeries.data.setAll(countryData.cities);
                    chart.zoomToGeoPoint({ latitude: countryData.geometry.coordinates[1], longitude: countryData.geometry.coordinates[0] }, 10);
                    zoomOutButton.show();
                });

                return am5.Bullet.new(root, { sprite: container });
            });

            countrySeries.set("heatRules", [{
                target: circleTemplate,
                dataField: "value",
                min: 10,
                max: 30,
                key: "radius"
            }])

            

            // Carica i dati delle nazioni nella serie
            var countryMarkerData = Object.keys(groupedData).map(country => {
                var countryCities = Object.values(groupedData[country].cities);
                var countryLon = countryCities[0].geometry.coordinates[0];
                var countryLat = countryCities[0].geometry.coordinates[1];

                return {
                    name: country,
                    count: groupedData[country].count,
                    geometry: { type: "Point", coordinates: [countryLon, countryLat] },
                    cities: countryCities
                };
            });
            countrySeries.data.setAll(countryMarkerData);


        });

        // Add globe/map switch
        var cont = chart.children.push(am5.Container.new(root, {
            layout: root.horizontalLayout,
            x: 20,
            y: 40
        }));
        
        cont.children.push(am5.Label.new(root, {
            centerY: am5.p50,
            text: "Map"
        }));
        
        switchButton.on("active", function () {
            if (!switchButton.get("active")) {
            chart.set("projection", am5map.geoMercator());
            backgroundSeries.mapPolygons.template.set("fillOpacity", 0);
            } else {
            chart.set("projection", am5map.geoOrthographic());
            backgroundSeries.mapPolygons.template.set("fillOpacity", 0.1);
            }
        });
        
        cont.children.push(
            am5.Label.new(root, {
            centerY: am5.p50,
            text: "Globe"
            })
        );

        // Make stuff animate on load
        chart.appear(1000, 100);
    });
}


// Network
function forceDirectedTree(elid, data, rootName) {
  am5.ready(function () {

    // Create root and custom theme
    var root = am5.Root.new(elid);

    // Main container
    var container = root.container.children.push(
      am5.Container.new(root, {
        width: am5.percent(100),
        height: am5.percent(100),
        layout: root.verticalLayout
      })
    );

    // ForceDirected series
    var series = container.children.push(
      am5hierarchy.ForceDirected.new(root, {
        downDepth: 1,
        initialDepth: 1,
        valueField: "value",
        categoryField: "name",
        childDataField: "children",
        minRadius: 30,
        maxRadius: 55,
        centerStrength: 0.7,
        manyBodyStrength: -15
      })
    );

    const palette = generatePaletteForAmCharts(7);

    // Apply custom colors depending on node depth
    series.circles.template.adapters.add("fill", (fill, target) => {
  const di = target.dataItem;
  if (!di) return fill;

  const depth = di.get("depth");

  if (depth === 0) {
    // Root
    return generatePaletteForAmCharts(7)[0];
    } else if (depth === 1) {
      // Primo livello: palette globale
      const parent = di.parent;
      if (!parent) return fill; // sicurezza

      const siblings = parent.children || [];
      const index = siblings.indexOf(di);

      const palette = generatePaletteForAmCharts(siblings.length);
      return palette[index % palette.length];
    } else {
      // Livelli successivi: variazione rispetto al colore del parent
      const parent = di.parent;
      if (!parent) return fill; // sicurezza

      const parentNode = parent.get("node");
      if (!parentNode) return fill;

      const parentColor = parentNode.get("fill");
      if (!parentColor) return fill;

      const [h, s, l] = hexToHSL(parentColor.toCSSHex());
      const variation = (di.get("index") % 2 ? 8 : -8); // alterna più chiaro/scuro
      const newColor = hslToHex(h, s, Math.min(90, Math.max(10, l + variation)));

      return am5.color(parseInt(newColor.replace("#", "0x"), 16));
    }
  });



    series.labels.template.setAll({
      text: "{name}",        // show the "name" field
      fill: am5.color(0xffffff),  // white text (for dark circles)
      centerX: am5.percent(50),
      centerY: am5.percent(50),
      textAlign: "center",
      oversizedBehavior: "wrap"
    });

    series.labels.template.adapters.add("fontSize", (fontSize, target) => {
      const di = target.dataItem;
      if (!di) {
        return fontSize;
      }
      const depth = di.get("depth");

      if (depth === 0) {
        return 16;
      } else if (depth === 1) {
        return 14;
      } else if (depth === 2) {
        return 11;
      } else {
        return 10; 
      }
    });

    // Tooltip appearance (background + label styling)
    series.set("tooltip", am5.Tooltip.new(root, {
      labelText: "{name}: [bold]{value}[/]",
      getFillFromSprite: false,
      getStrokeFromSprite: false,
      autoTextColor: false,
      background: am5.Rectangle.new(root, {
        fill: am5.color(0x000000),
        fillOpacity: 0.7,
        stroke: am5.color(0xffffff),
        strokeOpacity: 0.2,
        cornerRadius: 6
      })
    }));
    series.get("tooltip").label.setAll({
      fill: am5.color(0xffffff),
      fontSize: 13,
      textAlign: "center"
    });

    series.set("colors", am5.ColorSet.new(root, {
      colors: palette,
      reuse: true
    }));

    series.nodes.template.adapters.add("tooltipText", function (text, target) {
      var di = target.dataItem;
      var ctx = di && di.dataContext;
      if (!ctx) return "";
      // show "Name: value" if value exists, otherwise just the name
      return ctx.value ? `${ctx.name}: [bold]${ctx.value}[/]` : `${ctx.name}`;
    });

    // Make nodes collapsible on click
    series.nodes.template.events.on("click", function (e) {
      var node = e.target;
      if (node.dataItem) {
        node.dataItem.isActive = !node.dataItem.isActive;
      }
    });

    // Set data and animate
    series.data.setAll(data);
    if (series.dataItems.length) {
      series.set("selectedDataItem", series.dataItems[0]);
    }

    function updateLabelsVisibility() {
      const width = root.dom.clientWidth;
      if (width < 500) {
        series.labels.template.set("visible", false);
      } else {
        series.labels.template.set("visible", true);
      }
    }
    const resizeObserver = new ResizeObserver(updateLabelsVisibility);
    resizeObserver.observe(root.dom);

    series.appear(1000, 100);
  });
}





///////////////////////
/// EXTRA FUNCTIONS ///
///////////////////////

// get country name by coords
function getCountryByCoords(lat, lon) {
    const url = `http://api.geonames.org/countryCodeJSON?lat=${lat}&lng=${lon}&username=palread`;

    return new Promise((resolve, reject) => {
        $.getJSON(url, function(data) {
            if (data && data.countryName) {
                resolve(data.countryName);
            } else {
                reject("Country not found");
            }
        }).fail(function(jqXHR, textStatus, errorThrown) {
            reject("Error: " + errorThrown);
        });
    });
}

function getYASQEQuery(item) {
    let query = "";
    let newLine = "";

    var yasqeQueryRows = $(item).find('.CodeMirror-code>div');
    yasqeQueryRows.each(function() {
        var tokens = $(this).find('pre span span');
        query+=newLine;
        tokens.each(function() {
            query += $(this).hasClass('cm-ws') ? ' ' : $(this).text();
            newLine="\n";
        });
    });

    return query
}

// Timeline
function timelineChart(elid, events, titleText = "Timeline", subtitleText = "") {
  // Data structure required by TimelineJS
  const timelineData = {
    title: {
      text: {
        headline: titleText,
        text: subtitleText
      }
    },
    events: events
  };

  // Initialize the TimelineJS instance
  const timeline = new TL.Timeline(elid, timelineData, {
    language: "en",                // UI language
    initial_zoom: 3,               // Initial zoom level (1=decades, 10=days)
    timenav_height_percentage: 25, // Timeline navigation height
    hash_bookmark: false,          // Disable URL hash changes
    start_at_slide: 0              // Start always at the first slide
  });

  // Return instance for programmatic control
  return timeline;
}

// --- Fetch Wikidata entities and transform them into TimelineJS events ---
async function getTimelineDataFromWikidata(items) {
  // Extract only the Wikidata IDs (time)
  const ids = items.map(it => it.time);

  // SPARQL query (added P18 image)
  const query = `
    SELECT ?item ?itemLabel ?start ?end ?point ?image WHERE {
      VALUES ?item { ${ids.map(id => "wd:" + id).join(" ")} }
      OPTIONAL { ?item wdt:P580 ?start. }
      OPTIONAL { ?item wdt:P582 ?end. }
      OPTIONAL { ?item wdt:P585 ?point. }
      OPTIONAL { ?item wdt:P18 ?image. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,it". }
    }
  `;

  const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(query) + "&format=json";
  const response = await fetch(url);
  const json = await response.json();

  // Utility: extract year
  function extractYear(dateString) {
    if (!dateString) return null;
    const match = dateString.match(/^(-?\d{1,4})/);
    return match ? parseInt(match[1], 10) : null;
  }

  let lastImage = 0;
  return json.results.bindings
  .filter((row, index, arr) => {
    const qid = row.item.value.split("/").pop();
    return arr.findIndex(r => r.item.value.split("/").pop() === qid) === index;
  })
  .map(row => {
    const qid = row.item.value.split("/").pop();
    const startYear = extractYear(row.start?.value);
    const endYear   = extractYear(row.end?.value);
    const pointYear = extractYear(row.point?.value);
    const imageUrl  = row.image?.value || null;

    const extra = items.find(it => it.time === qid);

    let linksHtml = "";
    if (extra?.uri && extra?.label) {
      linksHtml = `<div class="extra-links">
        ${extra.uri.map((u, i) => `<a href="${u}" target="_blank">${extra.label[i]}</a><br>`).join("")}
      </div>`;
    }

    let start_date = startYear || endYear ? { year: startYear || 0 } : { year: pointYear || 0 };
    let end_date = endYear ? { year: endYear } : undefined;

    const event = {
      text: { headline: row.itemLabel.value, text: linksHtml },
      start_date,
      end_date
    };

    if (imageUrl) event.background = { url: imageUrl } 
    /* else {
      if (lastImage === 0) {
        event.background = { url : "https://raw.githubusercontent.com/Sebastiano-G/Private_clef/refs/heads/main/people.jpg"};
        lastImage = 1;
      } else {
        event.background = { url : "https://raw.githubusercontent.com/Sebastiano-G/Private_clef/refs/heads/main/pilots(1).jpg"};
        lastImage = 0;
      }
      
    } */

    return event;
  });

    
}



/////////////////////////////
///// PALETTE GENERATOR /////
/////////////////////////////

function hexToHSL(H) {
    // Convert HEX -> HSL
    let r = 0, g = 0, b = 0;
    if (H.length == 4) {
        r = "0x" + H[1] + H[1];
        g = "0x" + H[2] + H[2];
        b = "0x" + H[3] + H[3];
    } else if (H.length == 7) {
        r = "0x" + H[1] + H[2];
        g = "0x" + H[3] + H[4];
        b = "0x" + H[5] + H[6];
    }
    r /= 255; g /= 255; b /= 255;
    let cmin = Math.min(r,g,b),
    cmax = Math.max(r,g,b),
    delta = cmax - cmin,
    h = 0, s = 0, l = 0;

    if (delta == 0) h = 0;
    else if (cmax == r) h = ((g - b) / delta) % 6;
    else if (cmax == g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;

    h = Math.round(h * 60);
    if (h < 0) h += 360;
    l = (cmax + cmin) / 2;
    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);
    return [h, s, l];
}

function hslToHex(h, s, l) {
    // Convert HSL -> HEX
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs((h / 60) % 2 - 1)),
        m = l - c/2,
        r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return "#" + [r,g,b].map(x => x.toString(16).padStart(2,"0")).join("");
}

function generatePaletteForAmCharts(numColors) {
    const baseHex = getComputedStyle(document.documentElement)
                    .getPropertyValue('--primary-color')
                    .trim();
    const [h, s, l] = hexToHSL(baseHex);

    const colors = [];
    for (let i = 0; i < numColors; i++) {
        let newLightness = numColors > 2 ? Math.min(100, Math.max(0, l + (i - numColors/2) * 10)) : Math.min(100, Math.max(0, l + (i - numColors/2) * 15));
        const newColor = hslToHex(h, s, newLightness);
        const amColor = parseInt(newColor.replace("#", "0x"), 16);
        colors.push(am5.color(amColor));
    }
    return colors;
}