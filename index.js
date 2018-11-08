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
                let [loadCellValue, epsilonValue] = sData.split("/");
                if (data.record) {
                    if (data.threshold > parseFloat(loadCellValue))
                        port.write("pause\n", (err) => {
                            if (err)
                                return console.log('Error on write: ', err.message);
                            chart.series[0].addPoint([(new Date()).getTime() - data.zeroValue, parseFloat(loadCellValue)], true, false);
                            chartEpsilon.series[0].addPoint([(new Date()).getTime() - data.zeroValue, parseFloat(epsilonValue)], true, false);
                            //chartEpsilon.series[0].addPoint([parseFloat(loadCellValue), parseFloat(epsilonValue)], true, false); 
                        });
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
    lang: "geo",
    constrollingDCMotorManually: false
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
            this.$dialog.confirm(this.getWordByLang.startConfirm)
                .then(() => {
                    port.write("start\n");
                    data.zeroValue = Date.now();
                    data.record = true;
                    chart.series[0].setData([]);
                    chartEpsilon.series[0].setData([]);
                    chart.redraw();
                    chartEpsilon.redraw();
                })
                .catch(() => { });
        },
        stop() {
            // let shouldDeleteData = confirm('წაიშლება ინფორმაცია და განულდება მოწყობილობის პოზიცია. გთხოვთ დაადასტუროთ')
            if (!data.constrollingDCMotorManually)
                this.$dialog.confirm(this.getWordByLang.stopConfirm)
                    .then(() => {
                        port.write("stop\n", (err) => {
                            if (err)
                                return console.log('Error on write: ', err.message);
                            data.record = false;
                            this.$dialog.alert(this.getWordByLang.stopConfirm2);
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
    
    computed: {
        getWordByLang() {
            let langs = {
                okText: ['დიახ', "OK"],
                cancelText: ['არა', "Cancel"],
                start: ["დაწყება", "Start"],
                startConfirm: ["გსურთ დაიწყოთ ექსპერიმენტი? პროგრამაში არსებული მონაცემები წაიშლება",
                    "Do you want to start a new experiment? Current data will be lost"],
                stop: ["დასრულება", "Stop"],
                stopConfirm: ["გსურთ ექსპერიმენტის დასრულება?",
                    "Do you want to end the experiment?"],
                stopConfirm2: ["გთხოვთ გადმოწეროთ ექსპერიმენტის მონაცემები, რადგან პროგრამის გათიშვისას წაიშლება არსებული მონაცემები",
                    "Please export recorded data, otherwise it will be lost"],
                pause: ["პაუზა", "Pause"],
                continue: ["გაგრძელება", "Continue"],
                limit: ["ლიმიტი: ", "Limit: "],
                day: [" დღე ", " days "],
                hours: [" საათი ", " hours "],
                minutes: [" წუთი ", " minutes "],
                seconds: [" წამი ", " seconds "],
                millis: [" მილიწამი ", " milliseconds "],
            }
            function getLanguage(i) {
                let lang = {};
                Reflect.ownKeys(langs).forEach(key => {
                    return lang[key] = langs[key][i]
                })
                return lang
            }
            if (this.lang === "geo") {
                return getLanguage(0)
            } else {
                return getLanguage(1)
            }
        }
    }
});
Highcharts.setOptions({
    lang: {
        resetZoom: "უკან დაბრუნება"
    }
});
let chart = Highcharts.chart('container', {
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
        min: 0,
        softMax: 12000,
        tickPixelInterval: 150
    },
    yAxis: {
        title: {
            text: 'Value'
        },
        min: -5,
        max: 40,
        plotLines: [{
            value: 0,
            width: 1,
            color: '#808080'
        }]
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
            str += date.getUTCDate() - 1 + myVue.getWordByLang.day;
            str += date.getUTCHours() + myVue.getWordByLang.hours;
            str += date.getUTCMinutes() + myVue.getWordByLang.minutes;
            str += date.getUTCSeconds() + myVue.getWordByLang.seconds;
            str += date.getUTCMilliseconds() + myVue.getWordByLang.millis;
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
        data: []
    }]
});

let chartEpsilon = Highcharts.chart('containerEpsilon', {
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
        min: 0,
        softMax: 12000,
        tickPixelInterval: 150
    },
    yAxis: {
        title: {
            text: 'Value'
        },
        min: -5,
        max: 40,
        plotLines: [{
            value: 0,
            width: 1,
            color: '#808080'
        }]
    },
    plotOptions: {
        series: {
            marker: {
                enabled: false
            },
            color: "gray"
        }
    },
    tooltip: {
        formatter: function () {
            const date = new Date(this.x);
            let str = '';
            str += date.getUTCDate() - 1 + myVue.getWordByLang.day;
            str += date.getUTCHours() + myVue.getWordByLang.hours;
            str += date.getUTCMinutes() + myVue.getWordByLang.minutes;
            str += date.getUTCSeconds() + myVue.getWordByLang.seconds;
            str += date.getUTCMilliseconds() + myVue.getWordByLang.millis;
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
        name: 'Epsilon ',
        data: []
    }]
});
