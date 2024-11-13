/* charts.js
----------------------------- 
this file collects all the js functions needed 
to create or modify explorative charts
*/

$(document).ready(function() {

    // generate preview
    $('.preview').on('click', function(e) {
        e.preventDefault();
        var url = "http://localhost:8080/charts";
        var modal = $("<div class='modal-previewMM'><span class='previewTitle'>This is a preview of your multimedia file:<br><a href=''>"+url+"</a></span><span class='closePreview'></span><iframe src='" + url + "'></div>")
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
function addVisualization(visualizationType) {


    // get last visualization block index
    const lastVisualization = $(".sortable .block_field:last-child");
    var index = lastVisualization.data("index");
    console.log(index)

    // set the new block HTML code    
    var newIndex = index + 1;
    var newId = Date.now().toString();
    var newFieldBlock = "<section class='block_field' data-index='"+newIndex+"'>\
        <section class='row'>\
            <label class='col-md-3'>TYPE</label>\
            <select onchange='changeVisualization(this)' class='col-md-8 custom-select' name='type__"+newId+"' id='type__"+newId+"'>\
                <option value='None'>Select a visualization type</option>\
                <option value='counter'>Counter</option>\
                <option value='chart'>Chart</option>\
                <option value='map'>Map</option>\
            </select>\
        </section>\
        <section class='row'>\
            <label class='col-md-3'>TITLE</label>\
            <input type='text' id='title__"+newId+"' class='col-md-8 align-self-start' name='title__"+newId+"'/>\
        </section>\
        <section class='row'>\
            <label class='col-md-3'>DESCRIPTION</label>\
            <textarea id='description__"+newId+"' class='col-md-8 align-self-start' name='description__"+newId+"'></textarea>\
        </section>";

    var countersLits = "<section class='row'>\
        <label class='col-md-3'>COUNTERS<br><span class='comment'>define one or multiple counters</span></label>\
        <section class='col-md-8'>\
            <ul class='col-md-12 charts-list' id='counters__"+newId+"'>\
                <li><label class='inner-label col-md-12'>Counters list</label></li>\
                <li><label class='add-option'>Add new counter <i class='fas fa-plus-circle' onclick='addCounter(this,\""+newId+"\")'></i></label></li>\
            </ul>\
        </section>\
    </section>";

    var chartType =  "<section class='row'>\
        <label class='col-md-3'>TYPE</label>\
        <select onchange='changeChart(this)' class='col-md-8 custom-select' name='chartType__"+newId+"' id='chartType__"+newId+"'>\
            <option value='None'>Select a chart type</option>\
            <option value='bar'>Bar Chart</option>\
            <option value='pie'>Pie Chart</option>\
            <option value='donut'>Donut Chart</option>\
            <option value='semi-circle'>Semi-circle Chart</option>\
        </select>\
    </section>";

    var yasqeField = "<section class='row'>\
        <label class='col-md-3'>QUERY<br><span class='comment'>set a SPARQL query to retrieve data (two variables required)</span></label>\
        <section class='col-md-8 align-self-start'>\
            <div id='yasqe-"+newId+"' class='col-md-12 charts-yasqe'></div>\
        </section>\
    </section>";

    var chartLegend = "<section class='row'>\
        <label class='left col-md-11 col-sm-6' for='legend__"+newId+"'>Show legend</label>\
        <input type='checkbox' id='legend__"+newId+"' name='legend__"+newId+"'>\
    </section>";

    var fieldButtons = "<a href='#' class='up'><i class='fas fa-arrow-up'></i></a> <a href='#' class='down'><i class='fas fa-arrow-down'></i></a><a href='#' class='trash'><i class='far fa-trash-alt'></i></a>"

    // add Type related fields
    if (visualizationType === "counter") {
        newFieldBlock += countersLits ;
    } else if (visualizationType === "chart") {
        newFieldBlock += chartType + yasqeField + chartLegend ;
    } else if (visualizationType === "map") {
        
    }
    
    newFieldBlock += fieldButtons + "</section>"
    // add the new block
    lastVisualization.after($(newFieldBlock));
    $("#type__"+newId+" > option[value='"+visualizationType+"']").attr("selected","selected");
    
    generateYASQE("yasqe-"+newId);
    
}


function changeVisualization(select) {

} 

/* CHARTS */
function changeChart(select) {
    var chartAxes = "<section class='row'>\
        <label class='col-md-3'>X-AXIS<br><span class='comment'>set the SPARQL variable to be shown in the X-Axis</span></label>\
        <section class='col-md-3'>\
            <label class='inner-label'>SPARQL variable</label>\
            <input type='text' id='x-var__$id' name='x-var__$id' value='$chart['x-axis'].split(',',1)[0]'/>\
        </section>\
        <section class='col-md-3'>\
            <label class='inner-label'>Display name</label>\
            <input type='text' id='x-name__$id' name='x-name__$id' value='$chart['x-axis'].split(',',1)[1]'/>\
        </section>\
        <section class='col-md-2 center-checkbox'>\
            <label class='inner-label'>Sort by</label>\
            <input type='checkbox' id='x-sort__$id' name='x-sort__$id' onclick='sortChart('$id')'/>\
        </section>\
    </section>\
    <section class='row'>\
        <label class='col-md-3'>Y-AXIS<br><span class='comment'>set the SPARQL variable to be shown in the Y-Axis</span></label>\
        <section class='col-md-3'>\
            <label class='inner-label'>SPARQL variable</label>\
            <input type='text' id='y-var__$id' name='y-var__$id' value='$chart['y-axis'].split(',',1)[0]'/>\
        </section>\
        <section class='col-md-3'>\
            <label class='inner-label'>Display name</label>\
            <input type='text' id='y-name__$id' name='y-name__$id' value='$chart['y-axis'].split(',',1)[1]'/>\
        </section>\
        <section class='col-md-2 center-checkbox'>\
            <label class='inner-label'>Sort by</label>\
            <input type='checkbox' id='y-sort__$id' name='y-sort__$id' onclick='sortChart('$id')'/>\
        </section>\
    </section>"
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

function saveCounter(element,fieldId) {
    // retrieve the label and the query
    var item = $(element).closest("li");
    var itemsList = $(element).closest("ul");
    var itemIndex = itemsList.find("li").length - 1;
    var label = item.find("[name='description']").val();
    var query = getYASQEQuery(item);

    // make sure a label has been provided
    if (label === "") {
        label = fieldId+" - no label";
    }

    // add the new counter to the DOM and remove input fields
    item.after("<li>\
        <label>"+label+" <i class='far fa-edit' onclick='modifyCounter(this)'></i> <i class='far fa-trash-alt' onclick='removeCounter(this)'></i></label>\
        <input type='hidden' name='"+fieldId+"__"+itemIndex+"__"+label+"' value='"+query+"'/>\
    </li>");
    item.remove();

    // scroll top
    $('html, body').animate({
        scrollTop: itemsList.offset().top - 100
    }, 800);
} 

function modifyCounter(element) {

}

function removeCounter(element) {

} 


/////////////////////
/// VISUALIZATION ///
/////////////////////

// Charts (bar-chart, pie-chart, donut-chart, semicircle-chart)
function barchart(elid,data_x,data_y) {
    var data = JSON.parse($('#'+elid+'_data').html());
    am5.ready(function() {
    var root = am5.Root.new(elid);
    root.setThemes([ am5themes_Animated.new(root) ]);
    var chart = root.container.children.push(am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX:true
    }));
    var cursor = chart.set("cursor", am5xy.XYCursor.new(root, {}));
    cursor.lineY.set("visible", false);
    var xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 });
    xRenderer.labels.template.setAll({
        rotation: -30,
        centerY: am5.p50,
        centerX: am5.p100,
        paddingRight: 15,
        oversizedBehavior: "truncate",
        maxWidth: 120
    });

    var xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
        maxDeviation: 0.3,
        categoryField: data_x,
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {})
    }));

    var yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
        maxDeviation: 0.3,
        renderer: am5xy.AxisRendererY.new(root, {})
    }));

    var series = chart.series.push(am5xy.ColumnSeries.new(root, {
        name: "Series 1",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: data_y,
        sequencedInterpolation: true,
        categoryXField: data_x,
        tooltip: am5.Tooltip.new(root, {
        labelText:"{valueY}"
        })
    }));

    series.columns.template.setAll({ cornerRadiusTL: 5, cornerRadiusTR: 5 });
    series.columns.template.adapters.add("fill", function(fill, target) {
        return chart.get("colors").getIndex(series.columns.indexOf(target));
    });

    series.columns.template.adapters.add("stroke", function(stroke, target) {
        return chart.get("colors").getIndex(series.columns.indexOf(target));
    });

    xAxis.data.setAll(data);
    series.data.setAll(data);
    series.appear(1000);
    chart.appear(1000, 100);
    });
};

function invertedBarchart(elid,data_x,data_y) {
    console.log(elid)
    var data = JSON.parse($('#'+elid+'_data').html());
    am5.ready(function() {
        var root = am5.Root.new(elid);
        root.setThemes([
            am5themes_Animated.new(root)
        ]);
        var chart = root.container.children.push(am5xy.XYChart.new(root, {
            panX: true,
            panY: true,
            wheelX: "panY",
            wheelY: "zoomY",
            pinchZoomX:true
        }));
        var cursor = chart.set("cursor", am5xy.XYCursor.new(root, {}));
        cursor.lineY.set("visible", false);
        var yRenderer = am5xy.AxisRendererY.new(root, {
            minGridDistance: 30,
            minorGridEnabled: true
        });
        yRenderer.labels.template.setAll({
            centerY: am5.p50,
            centerX: am5.p100,
            paddingRight: 15,
            oversizedBehavior: "truncate",
            maxWidth: 180
        });
        yRenderer.grid.template.set("location", 1);
        
        var yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, {
            maxDeviation: 0.3,
            categoryField: data_y,
            renderer: yRenderer,
            tooltip: am5.Tooltip.new(root, {})
        }));
        
        var xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
            maxDeviation: 0.3,
            renderer: am5xy.AxisRendererX.new(root, {
                strokeOpacity: 0.1,
                minGridDistance: 80
        
            })
        }));
        
        var series = chart.series.push(am5xy.ColumnSeries.new(root, {
            name: "Series 1",
            xAxis: xAxis,
            yAxis: yAxis,
            valueXField: data_x,
            categoryYField: data_y,
            tooltip: am5.Tooltip.new(root, {
                pointerOrientation: "left",
                labelText: "{valueX}"
            })
        }));
    
        series.columns.template.setAll({ cornerRadiusBR: 5, cornerRadiusTR: 5 });
        series.columns.template.adapters.add("fill", function(fill, target) {
            return chart.get("colors").getIndex(series.columns.indexOf(target));
        });
    
        series.columns.template.adapters.add("stroke", function(stroke, target) {
            return chart.get("colors").getIndex(series.columns.indexOf(target));
        });
    
        yAxis.data.setAll(data);
        series.data.setAll(data);
        series.appear(1000);
        chart.appear(1000, 100);
    });
};
  

function piechart(elid,data_x,data_y,legend,donut=false,semi=false) {
    console.log(data_x, data_y)
    var data = JSON.parse($('#'+elid+'_data').html());
    am5.ready(function() {
        var root = am5.Root.new(elid);
        root.setThemes([
          am5themes_Animated.new(root),
        ]);
        
        var chart = root.container.children.push(am5percent.PieChart.new(root, {
            layout: root.verticalLayout,
            ...(donut && { innerRadius: am5.percent(50) }), // donut-chart
            ...(semi && { startAngle: 180, endAngle: 360 }) // semicircle-chart
        }));
        
        
        var series = chart.series.push(am5percent.PieSeries.new(root, {
          valueField: data_y,
          categoryField: data_x,
          ...(semi && { startAngle: 180, endAngle: 360, alignLabels: false }) // semicircle-chart
        }));

        // semicircle-chart
        if (semi) {
            series.states.create("hidden", {
                startAngle: 180,
                endAngle: 180
            });
        }
        
        series.slices.template.setAll({
            cornerRadius: 5
        });
        series.data.setAll(data);
        series.appear(1000, 100);

        if (legend==="True") {
            let legendDiv = chart.children.push(am5.Legend.new(root, {
                centerX: am5.percent(50),
                x: am5.percent(50),
                marginTop: 15,
                marginBottom: 15
            }));
            
            legendDiv.data.setAll(series.dataItems);
        }
    });
};



function map(elid) {
    var data = JSON.parse($('#'+elid+'_data').html());

    am5.ready(function() {
        var root = am5.Root.new(elid);
        root.setThemes([
            am5themes_Animated.new(root)
        ]);
        var chart = root.container.children.push(
            am5map.MapChart.new(root, {
                panX: "rotateX",
                panY: "translateY",
                projection: am5map.geoMercator(),
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

        var zoomControl = chart.set("zoomControl", am5map.ZoomControl.new(root, {}));
        zoomControl.homeButton.set("visible", true);

        var polygonSeries = chart.series.push(
        am5map.MapPolygonSeries.new(root, {
            geoJSON: am5geodata_worldLow,
            exclude: ["AQ"]
        })
        );

        polygonSeries.mapPolygons.template.setAll({
            fill: root.interfaceColors.get("alternativeBackground"),
            fillOpacity: 0.15,
            strokeWidth: 0.5,
            stroke: root.interfaceColors.get("background")
        });
        var pointSeries = chart.series.push(am5map.ClusteredPointSeries.new(root, {}));

        pointSeries.set("clusteredBullet", function(root) {
            var container = am5.Container.new(root, {
                cursorOverStyle:"pointer"
            });

            var circle1 = container.children.push(am5.Circle.new(root, {
                radius: 8,
                tooltipY: 0,
                fill: am5.color(0xff8c00)
            }));

            var circle2 = container.children.push(am5.Circle.new(root, {
                radius: 12,
                fillOpacity: 0.3,
                tooltipY: 0,
                fill: am5.color(0xff8c00)
            }));

            var circle3 = container.children.push(am5.Circle.new(root, {
                radius: 16,
                fillOpacity: 0.3,
                tooltipY: 0,
                fill: am5.color(0xff8c00)
            }));

            var label = container.children.push(am5.Label.new(root, {
                centerX: am5.p50,
                centerY: am5.p50,
                fill: am5.color(0xffffff),
                populateText: true,
                fontSize: "8",
                text: "{value}"
            }));

            container.events.on("click", function(e) {
                pointSeries.zoomToCluster(e.target.dataItem);
            });

            return am5.Bullet.new(root, {
                sprite: container
            });
        });

        // Create regular bullets
        pointSeries.bullets.push(function() {
            var circle = am5.Circle.new(root, {
                radius: 6,
                tooltipY: 0,
                fill: am5.color(0xff8c00),
                tooltipText: "{title}"
            });

            return am5.Bullet.new(root, {
                sprite: circle
            });
        });

        for (var i = 0; i < data.length; i++) {
            var city = data[i];
            addCity(city["longitude"], city["latitude"], city["label"]);
        }

        function addCity(longitude, latitude, label) {
            console.log(longitude, latitude, label)
            pointSeries.data.push({
                geometry: { type: "Point", coordinates: [longitude, latitude] },
                title: label
            });
        }

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
        
        var switchButton = cont.children.push(
            am5.Button.new(root, {
            themeTags: ["switch"],
            centerY: am5.p50,
            icon: am5.Circle.new(root, {
                themeTags: ["icon"]
            })
            })
        );
        
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

    }); // end am5.ready()
}


function linechart(elid, data_x, data_y) {
    var data = JSON.parse(document.getElementById(elid + '_data').textContent);
    console.log("Data loaded:", data); // Debug per verificare i dati caricati

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

        // Utilizza CategoryAxis per l'asse X (per gli anni come categorie)
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

        // Imposta i dati per la serie
        series.data.setAll(data);

        // Effetti di animazione
        series.appear(1000);
        chart.appear(1000, 100);
    }); 
}

function mapDrillDown(elid) {
    var data = JSON.parse(document.getElementById(elid + '_data').textContent);
    
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
        
        var switchButton = cont.children.push(
            am5.Button.new(root, {
            themeTags: ["switch"],
            centerY: am5.p50,
            icon: am5.Circle.new(root, {
                themeTags: ["icon"]
            })
            })
        );
        
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