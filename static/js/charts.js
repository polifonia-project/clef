/* charts.js
----------------------------- 
this file collects all the js functions needed 
to create or modify explorative charts
*/

$(document).ready(function() {
    $(document).on('click', '#addChart', function(e) {
        e.preventDefault();
        addChart();
    });
});


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

// add a new Chart block to define a new Chart
function addChart(chart) {


    // get last chart index
    const lastChart = $(".sortable .block_field:last-child");
    var index = lastChart.data("index");
    console.log(index)

    // set Chart block HTML code    
    var newIndex = index + 1;
    var newId = Date.now().toString();
    var newFieldBlock = "<section class='block_field' data-index='"+newIndex+"'>\
        <section class='row'>\
            <label class='col-md-3'>TYPE</label>\
            <select onchange='changeChart(this)' class='col-md-8 custom-select' name='type__"+newId+"' id='type__"+newId+"'>\
                <option value='None'>Select</option>\
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
        </section>\
    </section>"

    // add Type related fields
    if (chart === "counter") {

    } else if (chart === "chart") {

    } else if (chart === "map") {

    }
    
    // add Chart block
    
    lastChart.after($(newFieldBlock));
    $("#type__"+newId+" > option[value='"+chart+"']").attr("selected","selected");
    console.log($("#type__"+newId+" > option[value='"+chart+"']"))

    
}


function changeChart(select) {

}

function addCounter(element) {
    var block = $("<li class='col-md-12'><hr><section class='col-md-12'>\
        <section class='row'>\
            <label class='inner-label col-md-12'>New counter name</label>\
            <input type='text' id='description' class='col-md-128 align-self-start' name='description'>\
        </section>\
        <section class='row'>\
            <label class='inner-label col-md-12'>Query</label>\
            <div id='newYasqe' class='yasqe-max'></div>\
        </section>\
        <button class='btn btn-dark' type='submit'>Save counter</button>\
    </section></li>");
    

    $(element).parent().replaceWith(block);
    yasqe = YASQE(document.getElementById("newYasqe"), {
        sparql: {
        showQueryButton: false,
        endpoint: myPublicEndpoint,
        }
    });
}

function modifyCounter(element) {

}

function removeCounter(element) {

} 


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
        paddingRight: 15
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
  

function piechart(elid,data_x,data_y,legend,donut=false) {
    var data = JSON.parse($('#'+elid+'_data').html());
    am5.ready(function() {
        var root = am5.Root.new(elid);
        root.setThemes([
          am5themes_Animated.new(root),
        ]);
        
        var chart;

        if (donut) {
            chart = root.container.children.push(am5percent.PieChart.new(root, {
            layout: root.verticalLayout,
            innerRadius: am5.percent(50)
            }));
        } else {
            chart = root.container.children.push(am5percent.PieChart.new(root, {
                layout: root.verticalLayout
            }));
        }
        
        
        var series = chart.series.push(am5percent.PieSeries.new(root, {
          valueField: "Creations",
          categoryField: "Authors"
        }));
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

        var zoomControl = chart.set("zoomControl", am5map.ZoomControl.new(root, {}));
        zoomControl.homeButton.set("visible", true);

        var polygonSeries = chart.series.push(
        am5map.MapPolygonSeries.new(root, {
            geoJSON: am5geodata_worldLow,
            exclude: ["AQ"]
        })
        );

        polygonSeries.mapPolygons.template.setAll({
        fill:am5.color(0xdadada)
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
            addCity(city["longitude"], city["latitude"], city["title"]);
        }

        function addCity(longitude, latitude, title) {
            console.log(longitude, latitude, title)
            pointSeries.data.push({
                geometry: { type: "Point", coordinates: [longitude, latitude] },
                title: title
            });
        }

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


