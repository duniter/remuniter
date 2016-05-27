module.exports = (app) => {

  app.factory('Graph', function() {
      return {

        accountsGraph: function speedGraphs (id, offset, series) {
          $(id).highcharts({
            chart: {
              type: "area",
              zoomType: 'x'
            },
            title: {
              text: 'Accounts evolution'
            },
            subtitle: {
              text: document.ontouchstart === undefined ?
                'Click and drag in the plot area to zoom in' :
                'Pinch the chart to zoom in'
            },
            xAxis: {
              //categories: xValuex,
              minRange: 3, // 10 blocks,
              labels: {
                formatter: function() {
                  return this.value + offset;
                }
              }
            },
            yAxis: {
              //type: 'logarithmic',
              minorTickInterval: 1,
              title: {
                text: 'Blocks per hour (logarithmic scale)'
              }
            },
            colors: ['#ff0000', '#7cb5ec', '#000000'],
            legend: {
              enabled: true
            },
            tooltip: {
              shared: true,
              crosshairs: true,
              formatter: blockFormatter(offset)
            },
            plotOptions: {
              area: {
                fillColor: {
                  linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1},
                  stops: [
                    [0, Highcharts.getOptions().colors[0]],
                    [1, Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0).get('rgba')]
                  ]
                },
                marker: {
                  radius: 2
                },
                lineWidth: 1,
                states: {
                  hover: {
                    lineWidth: 1
                  }
                },
                threshold: null
              }
            },

            series: series
          });
        },

        speedGraph: function speedGraphs (id, offset, speeds, minSpeeds, maxSpeeds, getSeries) {
          var xValuex = [];
          for (var i = 0, len = speeds.length; i < len; i++) {
            xValuex.push(i + offset);
          }
          $(id).highcharts({
            chart: {
              type: "area",
              zoomType: 'x',
              events: {
                load: function () {
                  getSeries(this.series);
                }
              }
            },
            title: {
              text: 'Blocks writing speed'
            },
            subtitle: {
              text: document.ontouchstart === undefined ?
                'Click and drag in the plot area to zoom in' :
                'Pinch the chart to zoom in'
            },
            xAxis: {
              //categories: xValuex,
              minRange: 3, // 10 blocks,
              labels: {
                formatter: function() {
                  return this.value + offset;
                }
              }
            },
            yAxis: {
              //type: 'logarithmic',
              minorTickInterval: 1,
              title: {
                text: 'Blocks per hour (logarithmic scale)'
              },
              floor: 0,
              min: 0
            },
            colors: ['#ff0000', '#7cb5ec', '#000000'],
            legend: {
              enabled: true
            },
            tooltip: {
              shared: true,
              crosshairs: true,
              formatter: blockFormatter(offset)
            },
            plotOptions: {
              area: {
                fillColor: {
                  linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1},
                  stops: [
                    [0, Highcharts.getOptions().colors[0]],
                    [1, Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0).get('rgba')]
                  ]
                },
                marker: {
                  radius: 2
                },
                lineWidth: 1,
                states: {
                  hover: {
                    lineWidth: 1
                  }
                },
                threshold: null
              }
            },

            series: [{
              type: 'line',
              name: "Upper limit",
              data: maxSpeeds
            },{
              type: 'area',
              name: "Actual speed",
              data: speeds
            },{
              type: 'line',
              name: "Lower limit",
              data: minSpeeds
            }
            ]
          });
        },

        difficultyGraph: function difficultyGraph (id, offset, difficulties) {
          $(id).highcharts({
            chart: {
              type: "area",
              zoomType: 'x'
            },
            title: {
              text: 'Proof-of-Work difficulty by block'
            },
            subtitle: {
              text: document.ontouchstart === undefined ?
                'Click and drag in the plot area to zoom in' :
                'Pinch the chart to zoom in'
            },
            xAxis: {
              minRange: 10, // 10 blocks,
              labels: {
                formatter: function() {
                  return this.value + offset;
                }
              }
            },
            yAxis: {
              title: {
                text: 'Number of zeros'
              },
              floor: 0,
              min: 0
            },
            legend: {
              enabled: true
            },
            tooltip: {
              shared: true,
              crosshairs: true,
              formatter: blockFormatter(offset)
            },
            plotOptions: {
              area: {
                fillColor: {
                  linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1},
                  stops: [
                    [0, Highcharts.getOptions().colors[0]],
                    [1, Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0).get('rgba')]
                  ]
                },
                marker: {
                  radius: 2
                },
                lineWidth: 1,
                states: {
                  hover: {
                    lineWidth: 1
                  }
                },
                threshold: null
              }
            },

            series: [
              {
                name: 'PoW difficulty',
                data: difficulties
              }
            ]
          });
        },

        timeGraphs: function timeGraphs (id, offset, timeAccelerations, medianTimeIncrements, speeds, minSpeeds, maxSpeeds) {
          var timesInc = [];
          medianTimeIncrements.forEach(function (inc) {
            timesInc.push(inc == 0 ? 1 : inc);
          });
          $(id).highcharts({
            chart: {
              // type: "area",
              zoomType: 'x'
            },
            title: {
              text: 'Blockchain time variations'
            },
            subtitle: {
              text: document.ontouchstart === undefined ?
                'Click and drag in the plot area to zoom in' :
                'Pinch the chart to zoom in'
            },
            xAxis: {
              minRange: 10, // 10 blocks,
              labels: {
                formatter: function() {
                  return this.value + offset;
                }
              }
            },
            yAxis: {
              //type: 'logarithmic',
              minorTickInterval: 1,
              title: {
                text: 'Number of seconds (logarithmic scale)'
              }
            },
            legend: {
              enabled: true
            },
            tooltip: {
              shared: true,
              crosshairs: true,
              formatter: blockFormatter(offset)
            },
            plotOptions: {
              area: {
                fillColor: {
                  linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1},
                  stops: [
                    [0, Highcharts.getOptions().colors[0]],
                    [1, Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0).get('rgba')]
                  ]
                },
                marker: {
                  radius: 2
                },
                lineWidth: 1,
                states: {
                  hover: {
                    lineWidth: 1
                  }
                },
                threshold: null
              }
            },

            series: [
              {
                name: 'Time acceleration',
                data: timeAccelerations
              },{
                name: "Median Time variation",
                data: timesInc
              }
              ,{
                name: "Too high duration",
                data: maxSpeeds
              }
              ,{
                name: "Actual duration",
                data: speeds
              }
              ,{
                name: "Too low duration",
                data: minSpeeds
              }
            ]
          });
        }
      }
    });
};

function blockFormatter(offset) {
  return function() {
    var html = '<span style="font-size: 10px">' + (this.x + offset) + '</span><br/>';
    for (var i = 0, len = this.points.length; i < len; i++) {
      var point = this.points[i];
      var series = point.series;
      html += '<span style="color:' + series.color + '">\u25CF</span>' + series.name + ': <b>' + point.y + '</b><br/>';
    }
    return html;
  }
}
