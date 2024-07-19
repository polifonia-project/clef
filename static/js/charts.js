/* charts.js
----------------------------- 
this file collects all the js functions needed 
to create or modify explorative charts
*/

$(document).ready(function() {
    $("#addChart").on('click', function(e) {
        addChart(e);
    })
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
function addChart(e) {
    e.preventDefault();

    // get last chart index
    const lastChart = $(".sortable .block_field:last-child");
    var index = lastChart.data("index");
    
    // set Chart block HTML code    
    var newIndex = index++;
    var newId = Date.now().toString();
    var newFieldBlock = "<section class='block_field' data-index='"+newIndex+"'>\
        <section class='row'>\
            <label class='col-md-3'>CHART TYPE</label>\
            <select onchange='changeChart(this)' class='col-md-8 custom-select' name='type__"+newId+"' id='type__"+newId+"'>\
                <option value='None'>Select</option>\
                <option value='counter'>Counter</option>\
                <option value='bar-chart'>Bar chart</option>\
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

    // add Chart block
    lastChart.after($(newFieldBlock))
    return false;
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
    rotation: -90,
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
  