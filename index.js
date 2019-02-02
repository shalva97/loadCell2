"use strict";
nw.Window.get().showDevTools();
const SerialPort = require("serialport");
const ReadLine = SerialPort.parsers.Readline;
let reconnectTimer;
let port;

connect();
function connect() {
    SerialPort.list().then((list) => {
        let f = list.filter(item => {
            return String(item.manufacturer).includes('Arduino');
        });
        if (f.length === 0) {
            clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(connect, 4000);
            console.log("Error: cannot find correct device/ვერ ვპოულობ მოწყობილობას");
            return;
        }
        port = new SerialPort(f[0].comName, {
            baudRate: 9600
        });
        port.flush(() => {
            const parser = new ReadLine();
            port.pipe(parser);
            port.on("open", () => {
                console.log("connection established to device/წარმატებით დავუკავშირდი");
            });
            parser.on('data', function (sData) {

                if (data.record) {
                    switch (sData) {
                        case "sos2\r":
                            data.record = false
                            Vue.dialog.alert("ნიმუში გაწყდა")
                            return
                            break
                        case "sos1\r":
                            data.record = false
                            Vue.dialog.alert("ნიმუში გაიწელა 10მმ-ით")
                            return
                            break
                    }

                    let [loadCellValue, epsilonValue] = sData.split("/");
                    if (parseFloat(data.threshold) < parseFloat(loadCellValue)){
                        port.write("pause\n", (err) => {
                            if (err) {
                                return console.log('Error on write: ', err.message);
                            }
                            data.isPaused = false;
                        });
                        
                    }

                    if (data.settings[0]) {
                        sigmaTime.series[0].addPoint([(new Date()).getTime() - data.zeroValue, parseFloat(loadCellValue)], true, false);
                    }
                    if (data.settings[1]) {
                        epsilonTime.series[0].addPoint([(new Date()).getTime() - data.zeroValue, parseFloat(epsilonValue)], true, false);
                    }
                    if (data.settings[2]) {
                        sigmaEpsilon.series[0].addPoint([parseFloat(epsilonValue), parseFloat(loadCellValue)], true, false);
                    }

                }
            });
            port.on('close', function () {
                clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(connect, 4000);
                console.log("Error: connection closed/კავშირი გაწყდა");
            });
            port.on('error', function () {
                clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(connect, 4000);
                console.log("Error: connection fault/შეცდომა კავშირის დროს");
            });
        });
    });
}
let data = {
    record: false,
    zeroValue: Date.now(),
    isPaused: false,
    threshold: 3,
    constrollingDCMotorManually: false,
    experimentType: "kg/epsilon",
    settings: [false,false, false]
};

Vue.use(VuejsDialog.main.default, {
    html: true,
    loader: false,
    okText: 'დიახ',
    cancelText: 'არა',
    animation: 'bounce',
});


let myVue = new Vue({
    el: "#app",
    data,
    methods: {
        start() {
            this.$dialog.confirm("გსურთ დაიწყოთ ექსპერიმენტი? პროგრამაში არსებული მონაცემები წაიშლება.")
                .then(() => {
                    port.write("down\n", () => {
                        port.write("start\n")
                    })
                    data.zeroValue = Date.now();
                    data.record = true;

                    sigmaTime.series[0].setData([]);
                    sigmaEpsilon.series[0].setData([]);
                    epsilonTime.series[0].setData([]);

                    sigmaTime.redraw();
                    sigmaEpsilon.redraw();
                    epsilonTime.redraw();
                })
                .catch(() => { });
        },
        stop() {
            if (!data.constrollingDCMotorManually)
                this.$dialog.confirm("გსურთ ექსპერიმენტის დასრულება?")
                    .then(() => {
                        port.write("stop\n", (err) => {
                            if (err)
                                return console.log('Error on write: ', err.message);
                            data.record = false;
                            this.$dialog.alert("გთხოვთ გადმოწეროთ ექსპერიმენტის მონაცემები, რადგან პროგრამის გათიშვისას წაიშლება.");
                        });
                    })
                    .catch(function () { });
            else
                port.write("stop\n", err => {
                    if (err) {
                        return console.log('Error on write: ', err.message);
                    }
                    data.record = false
                    data.constrollingDCMotorManually = false
                })
        },

        handlePause() {
            if (data.isPaused) {
                port.write("start\n", function (err) {
                    if (err)
                        return console.log('Error on write: ', err.message);
                    data.isPaused = false;
                });
            } else {
                port.write("pause\n", function (err) {
                    if (err)
                        return console.log('Error on write: ', err.message);
                    data.isPaused = true;
                });
            }
        },
        up() {
            port.write("up\n");
            this.constrollingDCMotorManually = true
        },
        down() {
            port.write("down\n");
            this.constrollingDCMotorManually = true
        }
    },

});


let sigmaTime = Highcharts.chart('sigmaTime', {
    chart: {
        type: 'spline',
        animation: false,
        marginRight: 10,
        zoomType: "x"
    },
    title: {
        text: ''
    },
    xAxis: {
        title: {
            text: 'Milliseconds'
        },
        softMin: 0,
        softMax: 12000,
        tickPixelInterval: 150        
    },
    yAxis: {
        title: {
            text: 'P'
        },
        min: -1,
        softMax: 4,
        plotLines: [{
            value: 0,
            width: 1,
            color: '#808080'
        }],
        gridLineColor: 'gray',
        tickPositioner: myEpicTickPositioner
        // tickInterval: 1,
        // tickAmount: 8
    },
    plotOptions: {
        series: {
            marker: {
                enabled: false
            }
        }
    },
    tooltip: {
        formatter: function () {
            const date = new Date(this.x);
            let str = '';
            str += date.getUTCDate() - 1 + ' day ';
            str += date.getUTCHours() + " hours ";
            str += date.getUTCMinutes() + " minutes ";
            str += date.getUTCSeconds() + " seconds ";
            str += date.getUTCMilliseconds() + " milliseconds ";
            return '<b>' + this.series.name + Highcharts.numberFormat(this.y, 2) + '</b><br/>' + str;
        }
    },
    legend: {
        enabled: false
    },
    exporting: {
        enabled: true
    },
    series: [{
        name: 'Load cell ',
        data: [],
        color: '#00f'
    }]
});

let sigmaEpsilon = Highcharts.chart('sigmaEpsilon', {
    chart: {
        type: 'spline',
        animation: false,
        marginRight: 10,
        zoomType: "xy"
    },
    title: {
        text: ''
    },
    xAxis: {
        title: {
            text: 'epsilon'
        },
        //min: -1,
        softMax: 5,
        tickPixelInterval: 150,
        tickInterval: 2
    },
    yAxis: {
        tickInterval: 2,
        title: {
            text: 'P'
        },
        //min: -5,
        softMax: 4,
        plotLines: [{
            value: 0,
            width: 1,
            color: '#808080'
        }],
        gridLineColor: 'gray',
        tickPositioner: myEpicTickPositioner
    },
    plotOptions: {
        series: {
            marker: {
                enabled: false
            },
            color: "red"
        }
    },
    tooltip: {
        formatter: function () {
            const date = new Date(this.x);
            return '<b>Epsilon: ' + this.x + '</b><br/>'
                + '<b>kg: ' + this.y + '</b>';
        }
    },
    legend: {
        enabled: false
    },
    exporting: {
        enabled: true
    },
    series: [{
        name: 'P ',
        data: []
    }]
});

let epsilonTime = Highcharts.chart('epsilonTime', {
    chart: {
        type: 'spline',
        animation: false,
        marginRight: 10,
        zoomType: "x"
    },
    title: {
        text: ''
    },
    xAxis: {
        title: {
            text: 'milliseconds'
        },
        //min: 0,
        softMax: 12000,
        tickPixelInterval: 150
    },
    yAxis: {
        title: {
            text: 'epsilon'
        },
        //min: -1,
        softMax: 2,
        plotLines: [{
            value: 0,
            width: 1,
            color: '#808080'
        }],
        gridLineColor: 'gray',
        tickPositioner: myEpicTickPositioner
    },
    plotOptions: {
        series: {
            marker: {
                enabled: false
            }
        }        
    },
    tooltip: {
        formatter: function () {
            const date = new Date(this.x);
            let str = '';
            str += date.getUTCDate() - 1 + ' day ';
            str += date.getUTCHours() + " hours ";
            str += date.getUTCMinutes() + " minutes ";
            str += date.getUTCSeconds() + " seconds ";
            str += date.getUTCMilliseconds() + " milliseconds ";
            return '<b>' + this.series.name + Highcharts.numberFormat(this.y, 2) + '</b><br/>' + str;
        }
    },
    legend: {
        enabled: false
    },
    exporting: {
        enabled: true
    },
    series: [{
        name: 'Load cell ',
        data: [],
        color: "green"
    }]
});

function myEpicTickPositioner() {
    let tickIntervals = []
    for (let i = -1; i < this.dataMax + 4; i++) {
        tickIntervals.push(i)
    }
    return tickIntervals;
}