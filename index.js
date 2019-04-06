//@ts-check
"use strict";
// @ts-ignore
nw.Window.get().showDevTools();
const SerialPort = require("serialport");
const ReadLine = SerialPort.parsers.Readline;
const fs = require('fs');

const s_ZEROSTATE = 0        //0, local cmd
const s_CALIBRATE_SCALE = 1        //1, special cmd
const s_START = 2        //2, UI
const s_PAUSE = 3        //3, UI
const s_CONTINUE = 4        //4, UI
const s_STOP = 5        //5, UI
const s_GOUP = 6        //6, UI
const s_GODOWN = 7        //7, UI
const s_PRINT_ADC_DATA = 8        //8, local cmd
const s_SIMULATE1 = 9        //9, debug cmd
const s_SIMULATE2 = 10       //10, debug cmd
const s_SIMULATE3 = 11       //11, debug cmd

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
            // @ts-ignore
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

//default displayed configs 
let data = {
    record: false, //pause btn is disabled
    currentKG: 0,
    zeroValue: Date.now(),
    isPaused: false, //pause
    threshold: "10",
    controllingDCMotorManually: false,
    settings: [true, true, true], //loadcell/time epsilon/time loadcell/epsilon
    fileSaveDir: "./data/",
    sampleArea: 1.6,
    helpToFilterEverySecondData: false,
    chartDataLengthLimit: 10000,
    epsilonFilter: 0.0,
    validityCoeff: 0.5, //1+validityCoeff, 1-validityCoeff
    kgFilter: 0,
    lcv: [0, 0, 0, 0],//shift register for input data, to filter out spikes
    epv: [0, 0, 0, 0], //shift register for input data, to filter out spikes
    max_allowed_kg: 17,
    max_stress_on_scale: -2,
    max_allowed_stretch: 5,
    logData: getFileSaveDirWithTime()
};

// @ts-ignore
Vue.use(VuejsDialog.main.default, {
    html: true,
    loader: false,
    okText: 'დიახ',
    cancelText: 'არა',
    animation: 'bounce',
});


// @ts-ignore
let myVue = new Vue({
    el: "#app",
    data,
    methods: {
        start() {
            this.$dialog.confirm("გსურთ დაიწყოთ ექსპერიმენტი? პროგრამაში არსებული მონაცემები წაიშლება.")
                .then(() => {
                    port.write(s_START + "\n", (err) => {
                        if (err)
                            return console.log('Error on write: ', err.message);
                    });
                    data.zeroValue = Date.now();
                    data.record = true; //pause btn is enabled

                    sigmaTime.series[0].setData([]);
                    sigmaEpsilon.series[0].setData([]);
                    epsilonTime.series[0].setData([]);

                    sigmaTime.redraw();
                    sigmaEpsilon.redraw();
                    epsilonTime.redraw();

                    data.fileSaveDir = getFileSaveDirWithTime()
                    fs.mkdirSync(data.fileSaveDir)
                })
                .catch(() => { });
        },
        stop() {
            //auto control mode
            if (!data.controllingDCMotorManually) {
                this.$dialog.confirm("გსურთ ექსპერიმენტის დასრულება?")
                    .then(() => {
                        port.write(s_STOP + "\n", (err) => {
                            if (err)
                                return console.log('Error on write: ', err.message);
                            data.record = false; //pause btn is disabled
                            data.isPaused = false //pause appears
                        });
                    })
                    .catch(function () { });
            } else {
                //manual mode
                port.write(s_STOP + "\n", err => {
                    if (err) {
                        return console.log('Error on write: ', err.message);
                    }
                    data.record = false //pause btn is disabled
                    data.controllingDCMotorManually = false
                    data.isPaused = false //pause appears
                })
            }
        },

        handlePause() {
            if (data.isPaused) {
                port.write(s_CONTINUE + "\n", function (err) {
                    if (err)
                        return console.log('Error on write: ', err.message);
                    data.isPaused = false; //pause
                });
            } else {
                port.write(s_PAUSE + "\n", function (err) {
                    if (err)
                        return console.log('Error on write: ', err.message);
                    data.isPaused = true; //cont
                });
            }
        },

        up() {
            port.write(s_GOUP + "\n");
            this.controllingDCMotorManually = true
        },

        down() {
            port.write(s_GODOWN + "\n");
            this.controllingDCMotorManually = true
        }
    },

});


//first chart
// @ts-ignore
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
            text: 'Time'
        },
        labels: {
            formatter: function () {
                var d = new Date(this.value);
                let totalHours = this.value / 1000 / 60 / 60
                //   let totalHours = 21345234/1000/60/60
                if (totalHours > 1) {
                    return totalHours.toFixed() + ' H, ' + d.getMinutes() + ':' + d.getSeconds();
                } else {
                    return d.getMinutes() + ':' + d.getSeconds();
                }
            }
        },
        //softMin: 0,
        softMax: 12000,
        tickPixelInterval: 150
    },
    yAxis: {
        title: {
            text: 'σ (sigma)'
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
            // @ts-ignore
            return '<b>σ (sigma): ' + Highcharts.numberFormat(this.y, 2) + '</b><br/>' + str;
        }
    },
    legend: {
        enabled: false
    },
    exporting: {
        buttons: {
            contextButton: {
                align: 'left',
                verticalAlign: 'bottom'
            }
        }
    },
    series: [{
        name: 'Load cell ',
        data: [],
        color: '#00f'
    }]
});


//third chart
// @ts-ignore
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
            text: 'ε (epsilon)'
        },
        //min: -1,
        softMax: 0.5,
        tickPixelInterval: 150,
        tickInterval: 0.25
    },
    yAxis: {
        tickInterval: 2,
        title: {
            text: 'σ (sigma)'
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
            // @ts-ignore
            const date = new Date(this.x);
            return '<b>ε (epsilon): ' + this.x + '</b><br/>'
                + '<b>σ (sigma): ' + this.y + '</b>';
        }
    },
    legend: {
        enabled: false
    },
    exporting: {
        buttons: {
            contextButton: {
                align: 'left',
                verticalAlign: 'bottom'
            }
        }
    },
    series: [{
        name: 'σ (sigma) ',
        data: []
    }]
});


//second chart
// @ts-ignore
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
            text: 'Time'
        },
        labels: {
            formatter: function () {
                var d = new Date(this.value);
                let totalHours = this.value / 1000 / 60 / 60
                //   let totalHours = 21345234/1000/60/60
                if (totalHours > 1) {
                    return totalHours.toFixed() + ' H, ' + d.getMinutes() + ':' + d.getSeconds();
                } else {
                    return d.getMinutes() + ':' + d.getSeconds();
                }
            }
        },
        softMax: 12000,
        tickPixelInterval: 150
    },
    yAxis: {
        title: {
            text: 'ε (epsilon)'
        },
        softmin: 0, //TS
        softMax: 1,
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
            // @ts-ignore
            return '<b> ε (epsilon): ' + Highcharts.numberFormat(this.y, 4) + '</b><br/>' + str;
        }
    },
    legend: {
        enabled: false
    },
    exporting: {
        buttons: {
            contextButton: {
                align: 'left',
                verticalAlign: 'bottom'
            }
        }
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
    for (let i = 0; i < this.dataMax + 2; i += incrementBy) {
        tickIntervals.push(i)
    }
    return tickIntervals;
}

function handleReceivedData(receivedData, port) {
    console.log("RECEIVED: " + receivedData)

    let [loadCellValue, epsilonValue] = receivedData.split("/");
    loadCellValue = parseFloat(loadCellValue)
    epsilonValue = parseFloat(epsilonValue)


    data.currentKG = loadCellValue
    if (data.record) {
        switch (receivedData) {
            case "sos3\r":
                data.record = false //pause btn is disabled
                // @ts-ignore
                Vue.dialog.alert("მოდებულმა ძალამ/კგ გადააჭარბა " + data.max_allowed_kg + "-ს")
                return
            case "sos2\r":
                data.record = false //pause btn is disabled
                // @ts-ignore
                Vue.dialog.alert("სასწორმა მიიღო " + data.max_stress_on_scale + " კგ დაწოლა")
                return
            case "sos1\r":
                data.record = false //pause btn is disabled
                // @ts-ignore
                Vue.dialog.alert("ნიმუში გაიწელა " + data.max_allowed_stretch + " მმ ით")
                return
        }

        if (parseFloat(data.threshold) - 0.1 < loadCellValue) {
            port.write(s_PAUSE + "\n", (err) => {
                if (err) {
                    return console.log('Error on write: ', err.message);
                }
                data.isPaused = true; //cont
            })
        }

        // L O A D C E L L  --  S P I K E S 
        //filtering SPIKES out of real data
        data.lcv[3] = data.lcv[0] //save the first value, that needs to be sent to pgrogram.

        //shift register
        data.lcv[0] = data.lcv[1]
        data.lcv[1] = data.lcv[2]
        data.lcv[2] = loadCellValue


        //if middle number is garbage,
        if (DetectSpike(data.lcv[0], data.lcv[1], data.lcv[2])) {
            console.log("fake-spike SCALE ADC: " + data.lcv[0] + ' ' + data.lcv[1] + ' ' + data.lcv[2])
            data.lcv[1] = (data.lcv[2]+data.lcv[0])/2;
        }

        //write valid data back to variable
        loadCellValue = data.lcv[3]
        // L O A D C E L L --  S P I K E S  -- E N D 



        // E P S I L O N  --  S P I K E S  -- S T A R T 
        //filtering SPIKES out of real data
        data.epv[3] = data.epv[0] //save the first value, that needs to be sent to pgrogram.

        //shift register
        data.epv[0] = data.epv[1]
        data.epv[1] = data.epv[2]
        data.epv[2] = epsilonValue

        //if middle number is garbage
        if (DetectSpike(data.epv[0], data.epv[1], data.epv[2])) {
            console.log("fake-spike on Extensometer ADC: " + data.epv[0] + ' ' + data.epv[1] + ' ' + data.epv[2])
            data.epv[1] = (data.epv[2]+data.epv[0])/2;        
        }

        //write valid data back to variable
        epsilonValue = data.epv[3]
        // E P S I L O N  --  S P I K E S  -- E N D 


        //TODO: code to detect breaking of an sample
        //TODO: code to properly display received values
        //TODO: if can't execute writes, don't mark buttons as pressed.
        //TODO: change reset zoom location

        let p = parseFloat((loadCellValue / ((epsilonValue + 1) * data.sampleArea)).toFixed(3))
        let sigmaTimeValues = [(new Date()).getTime() - data.zeroValue, p]
        let epsilonTimeValues = [(new Date()).getTime() - data.zeroValue, epsilonValue]
        let sigmaEpsilonValues = [epsilonValue, p]

        //write in file
        fs.appendFileSync(data.fileSaveDir + "sigmaTime.csv", `${sigmaTimeValues[0]},${sigmaTimeValues[1]}\n`)
        fs.appendFileSync(data.fileSaveDir + "epsilonTime.csv", `${epsilonTimeValues[0]},${epsilonTimeValues[1]}\n`)
        fs.appendFileSync(data.fileSaveDir + "sigmaEpsilon.csv", `${sigmaEpsilonValues[0]},${sigmaEpsilonValues[1]}\n`)


        if (sigmaTime.series[0].data.length === 0
            || (Math.abs(sigmaTime.series[0].data[sigmaTime.series[0].data.length - 1].y - p) > data.kgFilter    //filter out similar data from display
                && data.settings[0])) {
            sigmaTime.series[0].addPoint(sigmaTimeValues, true, false);
            if (sigmaTime.series[0].data.length > data.chartDataLengthLimit) {
                sigmaTime.series[0].data[0].remove()
            }
        }

        if (epsilonTime.series[0].data.length === 0
            || (Math.abs(epsilonTime.series[0].data[epsilonTime.series[0].data.length - 1].y - epsilonValue) > data.epsilonFilter  //filter out similar data from display
                && data.settings[1])) {
            epsilonTime.series[0].addPoint(epsilonTimeValues, true, false);
            if (epsilonTime.series[0].data.length > data.chartDataLengthLimit) {
                epsilonTime.series[0].data[0].remove()
            }
        }

        if (sigmaEpsilon.series[0].data.length === 0
            || ((Math.abs(sigmaEpsilon.series[0].data[sigmaEpsilon.series[0].data.length - 1].y - p) > data.kgFilter
                || Math.abs(sigmaEpsilon.series[0].data[sigmaEpsilon.series[0].data.length - 1].x - epsilonValue) > data.epsilonFilter)  //filter out similar data from display
                && data.settings[2])) {
            sigmaEpsilon.series[0].addPoint(sigmaEpsilonValues, true, false)
            if (sigmaEpsilon.series[0].data.length > data.chartDataLengthLimit)
                sigmaEpsilon.series[0].data[0].remove()
        }

    }
}

//chawerili monacemebis maokitxva
// @ts-ignore
function emulate() {
    data.record = true //pause btn is enabled
    port = {
        write(mes) {
            console.log("port.write: " + mes)
        }
    }
    // @ts-ignore
    fs.readFile(data.fileSaveDir + "emulation.csv", 'utf8', function (err, contents) {
        // fs.readFile(data.fileSaveDir + "generated_data.csv", 'utf8', function (err, contents) {
        let dataLines = contents.split('\n')
        let timer = setInterval(() => {
            let currentData = dataLines.shift()
            // console.log(receivedData)
            if (currentData) {
                handleReceivedData(currentData, port)
            } else {
                clearInterval(timer)
            }
        }, 1000)
    });
}

//n monacemis emulireba
// @ts-ignore
function emulate2(n) {
    let randomData = []
    for (let i = 0; i < n; i++) {
        randomData.push([i, Math.floor(Math.random() * 10) + 1])
    }

    sigmaTime.series[0].setData(randomData)
    sigmaEpsilon.series[0].setData(randomData)
    epsilonTime.series[0].setData(randomData)
}

//igive rac zeda, magram delay ti
// @ts-ignore
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

//returns true, if there is a spike
function DetectSpike(a, b, c) {
    let aP = a * (1 + data.validityCoeff)
    let cP = c * (1 + data.validityCoeff)
    let acP = aP > cP ? aP : cP

    let aN = a * (1 - data.validityCoeff)
    let cN = c * (1 - data.validityCoeff)
    let acN = aN < cN ? aN : cN

    let max = acP >= acN ? acP : acN
    let min = acP <= acN ? acP : acN

    // log("compare:" + min + ' ' + b + ' ' + max)
    return !(min <= b && b <= max)

}

// @ts-ignore
function log(str) {
    console.log(str)
    if (!fs.existsSync(data.logData)) {
        fs.mkdirSync(data.logData)
    }
    fs.appendFileSync(data.logData + "log.txt", str + "\n");
}

function getFileSaveDirWithTime() {
    let date = new Date()
    let isoDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString()
    return "data/" + isoDate.replace(/:/g, "-") + "/"
}
//log("asdf")