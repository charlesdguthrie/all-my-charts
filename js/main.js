(function ( $ ) {

  $.fn.dynamicHighchart = function ( options ) {
     var chart_settings = $.extend({
        // These are the defaults.
        query: "SELECT * FROM t2 WHERE year = 2012 AND type = 'withdrawal' AND (month = 1 OR month = 2) AND is_total = 0",
        chart_type: 'datetime',
        series: 'item',
        date: 'date',
        value: 'today',
        title: 'Chart Title',
        y_axis_label: 'Y-Axis label'
      }, options ),
  	  color_palette = ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5'],
  		$hover_templ = $('#hover-templ'),
  		response_ds;

  	String.prototype.contains = function(it) { return this.indexOf(it) != -1; };

  	function commaSeparateNumber(val){
      while (/(\d+)(\d{3})/.test(val.toString())){
        val = val.toString().replace(/(\d+)(\d{3})/, '$1'+','+'$2');
      }
      return val;
    };

    function currencyFormatNumber(val){
    	var with_commas = String(commaSeparateNumber(val));
    	if (with_commas.contains('-')){
    		return '-$' + with_commas.replace('-','');
    	}else{
    		return '$' + with_commas;
    	}

    };

  	function treasuryIo(query){
  	  return $.ajax({
  	    url: 'https://premium.scraperwiki.com/cc7znvq/47d80ae900e04f2/sql/?q='+query
  	  })
  	};

  	function fetchJSON(chart_settings, $ctnr, callback){
  		treasuryIo(chart_settings.query)
  		  .done(function(response){

          // console.log(callback)
  		    createAndFetchDs(response, chart_settings, $ctnr, callback);

  		  }).fail(function(err){

  		    // console.log(err);

  		  });
  	};

  	function createAndFetchDs(response, chart_settings, $ctnr, callback){
  		response_ds = new Miso.Dataset({
  			data: response
  		});

  		response_ds.fetch({ 
  		  success : function() {
  		  	var ds = this;
  		  	reshapeData(ds, chart_settings, $ctnr, callback)
  		  },
  		  error : function() {
  		  }
  		});
  	};

  	function reshapeData(ds, chart_settings, $ctnr, callback){
  	  	var items_uniq = findDistinctSeriesNames(ds, chart_settings.series), // findDistinctSeriesNames takes a miso.dataset object and the column name whose values you want unique records of. It returns an array of unique names that appear as values in the specified column.
  	  			series_ds_arr  = geEachSeriesDs(ds, items_uniq, chart_settings.series), // getDataForEachSeries takes a miso.dataset object, the unique columns and the name of the column those unique items appear in. It returns an array of miso ds objects, one for every unique item name.
  	  			series_data_hc = createHighChartsDataSeries(series_ds_arr, chart_settings.series, chart_settings.value, chart_settings.date, chart_settings.chart_type), // createHighChartsDataSeries returns an arrray of objects that conforms to how highcharts like a series object to be, namely, a name as a string, data as an array of values and for our purposes a color chosen from the color palette index. For a datetime series, highcharts wants the data array to be an array of arrays. Each value point is an array of two values, the date in unix time and what will be the y coordinate.
  	  			x_axis_info    = getChartTypeSpecificXAxis(chart_settings.chart_type, items_uniq, chart_settings.series); // getChartTypeSpecificXAxis this will pick what kind of Highcharts xAxis object is added into the chart JSON.

  	  	makeHighchart(series_data_hc, x_axis_info, chart_settings, $ctnr, callback)
    };

  	function findDistinctSeriesNames(ds, col){
  		var items = ds.column(col).data,
  				items_uniq = _.uniq(items);
  		return items_uniq;
  	};

  	function geEachSeriesDs(ds, items_uniq, col){
  		var series_ds_arr = [];
  		_.each(items_uniq, function(item){
  			var series = ds.where({
  	      // copy only where the value of the specified call is equal to one of the unique item names
  	      rows: function(row) {
  	        return row[col] == item;
  	      }
  	    });
  	    series_ds_arr.push(series);
  		})
  		return series_ds_arr;
  	};

    function keepBetweenZeroAndN(index, limit){
        var val = index - Math.floor(index / limit) * limit;
        return val;
    };

  	function createHighChartsDataSeries(series_ds_arr, col, value, date, type){
  		var series = [];
  		_.each(series_ds_arr, function(series_ds, index){
  			var series_name = series_ds.column(col).data[0],
  					series_data_value = series_ds.column(value).data,
  					series_date_time,
  			    series_data = [];

  			    if (type == 'datetime'){
  			    	series_data_time = series_ds.column(date).data;

  				    // Create the [unix_time, value] format that highcharts likes for time series
  				    for (var i = 0; i < series_data_value.length; i++){
  				    	var date_unix = new Date(series_data_time[i]).getTime(),
  				    			date_val = [date_unix, series_data_value[i]];

  				    	series_data.push(date_val)
  				    };
  			    }else{
  			    	series_data = series_data_value;
  			    };

  			// We only have twenty colors so if the index is above 20, kick it back down.
        var color_index = keepBetweenZeroAndN(index, 20);

  			var obj = {
  			    	name:  series_name,
  						color: color_palette[color_index],
  						data:  series_data
  			    };
  			    series.push(obj);
  		});
  		return series
  	}


  	function getChartTypeSpecificXAxis(type, items_uniq, col){
  		var datetime = {
                  type: 'datetime',
                  minTickInterval: 24 * 3600 * 1000, // Don't let the time interval go less than one day
                  dateTimeLabelFormats: {
  										millisecond: '%H:%M:%S.%L',
  										second: '%H:%M:%S',
  										minute: '%H:%M',
  										hour: '%H:%M',
  										day: '%b %e',
  										week: '%b %e',
  										month: '%b \'%y',
  										year: '%Y'
  									}
          },
          categorical = {
        		categories: [col]
          },
          default_x_info = {
  				 	tickColor: '#e3e3e3',
  		      lineColor: '#e3e3e3'
  			  };

  		if (type == 'datetime'){
  			return _.extend(datetime, default_x_info);
  		}else{
  			return _.extend(categorical, default_x_info);
  		};
  	};

  	function makeHighchart(series_data, x_axis_info, chart_settings, $ctnr, callback){
	    $ctnr.highcharts({
          chart: {
              type: (chart_settings.chart_type == 'datetime' ? 'line' : 'column')
          },
          title: {
              text: chart_settings.title,
              style: {
                  color:'#5e5e5e',
                  font: 'normal 16px "Arial", sans-serif'
              }
          },
          subtitle: {
              text: ''
          },
          xAxis: x_axis_info,
          yAxis: {
              title: {
                  text: chart_settings.y_axis_label,
                  style: {
	                  color:'#5e5e5e',
	                  font: 'normal 16px "Arial", sans-serif'
	              }
              },
              gridLineWidth: 1,
              gridLineColor: '#e3e3e3'
          },
          tooltip: {
              formatter: function() {
              	var s = '<div class="chart-hover-title" style="color:'+ this.series.color +'">'+ this.series.name +'</div><div class="chart-hover-info">'+
                       (chart_settings.chart_type == 'datetime' ? Highcharts.dateFormat('%b %e', this.x) : this.x) +': '+ currencyFormatNumber(this.y) + '</div>';
		          	$hover_templ.html(s).show();
              },
              style: {
              	visibility: 'hidden'
              }
          },
          series: series_data,
          plotOptions: {
          	line: {
            	marker: {
            		enabled: false,
            		radius: 2
            	},
            	events:{
                  mouseOut:function(){
                      $hover_templ.hide();
                  }
              }
          	}
          }
      });
      callback('Chart created')
      
  	};

  	function bindHandlers($ctnr){
  		$ctnr.mousemove( function(e){
        $hover_templ.css({
            'top' : e.pageY + 50,
            'left': e.pageX - 75
        });
      });
      $ctnr.mouseleave( function(e){
          $hover_templ.hide();
      });
  	};

    function startTheShow(chart_settings, $ctnr){
      fetchJSON(chart_settings, $ctnr, function(response){
        // console.log(response) /* "Chart created"
      	bindHandlers($ctnr);
      });
    };

    return this.each(function(){
      var $ctnr = $(this);
      startTheShow(chart_settings, $ctnr);

    });
  }; /* E N D  J Q U E R Y */


  var chart_settings = {
    // query: 'SELECT item, avg(today) as today FROM "t2" WHERE year = 2012 AND type = \'withdrawal\' AND is_total = 0 GROUP BY item',
    // query: "SELECT * FROM t2 WHERE year = 2012 AND type = 'withdrawal' AND (month = 1 OR month = 2) AND item = 'Energy Department programs'",
    query: "SELECT * FROM t2 WHERE year = 2012 AND type = 'withdrawal' AND (month = 1 OR month = 2) AND is_total = 0",
    chart_type: 'datetime',
    series: 'item',
    date: 'date',
    value: 'today',
    title: 'Jan and Feb withdrawals (2012)',
    y_axis_label: 'Today (millions)'
  };



  $('#container').dynamicHighchart(chart_settings);


})(jQuery);