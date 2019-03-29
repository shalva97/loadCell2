//@ts-check
"use strict";
nw.Window.get().showDevTools();
const SerialPort = require("serialport");
const ReadLine = SerialPort.parsers.Readline;
const fs = require('fs');
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
            parser.on('data', recevedData => {
                //console.log(recevedData)
                handleReceivedData(recevedData, port)
            })
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
    threshold: "20",
    controllingDCMotorManually: false,
    settings: [true, false, false], //loadcell/time epsilon/time loadcell/epsilon
    fileSaveDir: "./data/",
    sampleArea: 1.6,
    helpToFilterEverySecondData: false
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

                    let date = new Date(); // Or the date you'd like converted.
                    let isoDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
                    data.fileSaveDir = "data/" + isoDate.replace(/:/g, "-") + "/"
                    fs.mkdirSync(data.fileSaveDir)
                })
                .catch(() => { });
        },
        stop() {
            if (!data.controllingDCMotorManually) {
                this.$dialog.confirm("გსურთ ექსპერიმენტის დასრულება?")
                    .then(() => {
                        port.write("stop\n", (err) => {
                            if (err)
                                return console.log('Error on write: ', err.message);
                            data.record = false;
                        });
                    })
                    .catch(function () { });
            } else {
                port.write("stop\n", err => {
                    if (err) {
                        return console.log('Error on write: ', err.message);
                    }
                    data.record = false
                    data.controllingDCMotorManually = false
                    data.isPaused = false
                })
            }
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
            this.controllingDCMotorManually = true
        },

        down() {
            port.write("down\n");
            this.controllingDCMotorManually = true
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
    boost: {
        useGPUTranslations: true,
        usePreAllocated: true
    },
    xAxis: {
        title: {
            text: 'Milliseconds'
        },
        //softMin: 0,
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
    boost: {
        useGPUTranslations: true,
        usePreAllocated: true
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
    boost: {
        useGPUTranslations: true,
        usePreAllocated: true
    },
    xAxis: {
        title: {
            text: 'milliseconds'
        },
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
    let max = this.dataMax + 4
    let incrementBy = max > 12 ? 2 : 1
    for (let i = -1; i < this.dataMax + 4; i += incrementBy) {
        tickIntervals.push(i)
    }
    return tickIntervals;
}

function handleReceivedData(receivedData, port) {
    if (data.helpToFilterEverySecondData) {
        data.helpToFilterEverySecondData = false
        return
    } else {
        data.helpToFilterEverySecondData = true
    }
    let [loadCellValue, epsilonValue] = receivedData.split("/");
    loadCellValue = parseFloat(loadCellValue)
    epsilonValue = parseFloat(epsilonValue)
    if (data.record) {
        switch (receivedData) {
            case "sos2\r":
                data.record = false
                Vue.dialog.alert("ნიმუში გაწყდა")
                return
            case "sos1\r":
                data.record = false
                Vue.dialog.alert("ნიმუში გაიწელა 10მმ-ით")
                return
        }

        if (parseFloat(data.threshold) - 0.1 < loadCellValue) {
            port.write("pause\n", (err) => {
                if (err) {
                    return console.log('Error on write: ', err.message);
                }
                data.isPaused = true;
            })
        }

        let p = parseFloat((loadCellValue / (epsilonValue + 1) * data.sampleArea).toFixed(3))
        let sigmaTimeValues = [(new Date()).getTime() - data.zeroValue, p]
        let epsilonTimeValues = [(new Date()).getTime() - data.zeroValue, epsilonValue]
        let sigmaEpsilonValues = [epsilonValue, p]

        fs.appendFileSync(data.fileSaveDir + "sigmaTime.csv", `${sigmaTimeValues[0]},${sigmaTimeValues[1]}\n`)
        fs.appendFileSync(data.fileSaveDir + "epsilonTime.csv", `${epsilonTimeValues[0]},${epsilonTimeValues[1]}\n`)
        fs.appendFileSync(data.fileSaveDir + "sigmaEpsilon.csv", `${sigmaEpsilonValues[0]},${sigmaEpsilonValues[1]}\n`)

        if (sigmaTime.series[0].data.length === 0
            || (Math.abs(sigmaTime.series[0].data[sigmaTime.series[0].data.length - 1].y - p) > 0.02
                && data.settings[0])) {
            sigmaTime.series[0].addPoint(sigmaTimeValues, true, false);
            if (sigmaTime.series[0].data.length > 10000) {
                sigmaTime.series[0].data[0].remove()
            }
        }

        if (epsilonTime.series[0].data.length === 0
            || (Math.abs(epsilonTime.series[0].data[epsilonTime.series[0].data.length - 1].y - epsilonValue) > 0.02
                && data.settings[1])) {
            epsilonTime.series[0].addPoint(epsilonTimeValues, true, false);
            if (epsilonTime.series[0].data.length > 10000) {
                epsilonTime.series[0].data[0].remove()
            }
        }

        if (sigmaEpsilon.series[0].data.length === 0
            || ((Math.abs(sigmaEpsilon.series[0].data[sigmaEpsilon.series[0].data.length - 1].y - p) > 0.02
                || Math.abs(sigmaEpsilon.series[0].data[sigmaEpsilon.series[0].data.length - 1].x - epsilonValue) > 0.02)
                && data.settings[2])) {
            sigmaEpsilon.series[0].addPoint(sigmaEpsilonValues, true, false)
            if (sigmaEpsilon.series[0].data.length > 10000)
                sigmaEpsilon.series[0].data[0].remove()
        }

    }
}


function emulate() {
    data.record = true
    port = {
        write(mes) {
            console.log("port.write: " + mes)
        }
    }
    fs.readFile(data.fileSaveDir + "emulation.csv", 'utf8', function (err, contents) {
        let dataLines = contents.split('\n')
        let timer = setInterval(() => {
            let currentData = dataLines.shift()
            if (currentData) {
                handleReceivedData(currentData, port)
            } else {
                clearInterval(timer)
            }
        }, 1000)
    });
}

function emulate2(n) {
    let randomData = []
    for (let i = 0; i < n; i++) {
        randomData.push([i, Math.floor(Math.random() * 10) + 1])
    }

    sigmaTime.series[0].setData(randomData)
    sigmaEpsilon.series[0].setData(randomData)
    epsilonTime.series[0].setData(randomData)
}

function emulate3(n) {
    let randomData = []
    for (let i = 0; i < n; i++) {
        randomData.push([i, Math.floor(Math.random() * 10) + 1])
    }

    let timer = setInterval(() => {
        let point = randomData.shift()
        sigmaTime.series[0].addPoint(point)
        sigmaEpsilon.series[0].addPoint(point)
        epsilonTime.series[0].addPoint(point)
        if (randomData.length < 1) {
            clearInterval(timer)
        }
    }, 1000)

}
