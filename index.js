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
    lcv: [0,0,0,0],//shift register for input data, to filter out spikes
    epv: [0,0,0,0] //shift register for input data, to filter out spikes
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
                    data.record = true; //pause btn is enabled

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
            //auto control mode
            if (!data.controllingDCMotorManually) {
                this.$dialog.confirm("გსურთ ექსპერიმენტის დასრულება?")
                    .then(() => {
                        port.write("stop\n", (err) => {
                            if (err)
                                return console.log('Error on write: ', err.message);
                            data.record = false; //pause btn is disabled
                            data.isPaused = false //pause appears
                        });
                    })
                    .catch(function () { });
            } else {
                //manual mode
                port.write("stop\n", err => {
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
                port.write("start\n", function (err) {
                    if (err)
                        return console.log('Error on write: ', err.message);
                    data.isPaused = false; //pause
                });
            } else {
                port.write("pause\n", function (err) {
                    if (err)
                        return console.log('Error on write: ', err.message);
                    data.isPaused = true; //cont
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


//first chart
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
            formatter: function(){
              var d = new Date(this.value);
              let totalHours = this.value/1000/60/60
            //   let totalHours = 21345234/1000/60/60
              if (totalHours > 1) {
                return totalHours.toFixed()+' H, '+d.getMinutes() +':'+ d.getSeconds();
              } else {
                  return d.getMinutes() +':'+ d.getSeconds();
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
            return '<b>σ (sigma): '+ Highcharts.numberFormat(this.y, 2) + '</b><br/>' + str;
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
        name: 'P ',
        data: []
    }]
});


//second chart
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
            formatter: function(){
              var d = new Date(this.value);
              let totalHours = this.value/1000/60/60
            //   let totalHours = 21345234/1000/60/60
              if (totalHours > 1) {
                return totalHours.toFixed()+' H, '+d.getMinutes() +':'+ d.getSeconds();
              } else {
                  return d.getMinutes() +':'+ d.getSeconds();
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
            return '<b> ε (epsilon): '  + Highcharts.numberFormat(this.y, 4) + '</b><br/>' + str;
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
    for (let i = -0.5; i < this.dataMax + 1; i += incrementBy) {
        tickIntervals.push(i)
    }
    return tickIntervals;
}

function handleReceivedData(receivedData, port) {
    // console.log(receivedData)
    
    //filter every second data
    if (data.helpToFilterEverySecondData) {
        data.helpToFilterEverySecondData = false
        return
    } else {
        data.helpToFilterEverySecondData = true
    }

    let [loadCellValue, epsilonValue] = receivedData.split("/");
    loadCellValue = parseFloat(loadCellValue)
    epsilonValue = parseFloat(epsilonValue)
    
    
    
    
    // L O A D C E L L  --  S P I K E S 
    //filtering SPIKES out of real data
    data.lcv[3]=data.lcv[0] //save the first value, that needs to be sent to pgrogram.

    //shift register
    data.lcv[0]=data.lcv[1]
    data.lcv[1]=data.lcv[2]
    data.lcv[2]=loadCellValue
        
    //if middle number is garbage
    if (DetectSpike(data.lcv[0], data.lcv[1], data.lcv[2])){
        console.log('a : '+data.lcv[0] +       ', b : '+data.lcv[1]+     ', c : '+data.lcv[2])
        data.lcv[1] = data.lcv[2]; //TODO        
    }

    //write valid data back to variable
    loadCellValue = data.lcv[3]
    // L O A D C E L L --  S P I K E S  -- E N D 




    // E P S I L O N  --  S P I K E S  -- S T A R T 
    //filtering SPIKES out of real data
    data.epv[3]=data.epv[0] //save the first value, that needs to be sent to pgrogram.

    //shift register
    data.epv[0]=data.epv[1]
    data.epv[1]=data.epv[2]
    data.epv[2]=epsilonValue
        
    //if middle number is garbage
    if (DetectSpike(data.epv[0], data.epv[1], data.epv[2])){
        console.log('a : '+data.epv[0] +       ', b : '+data.epv[1]+     ', c : '+data.epv[2])
        data.epv[1] = data.epv[2]; //TODO        
    }

    //write valid data back to variable
    epsilonValue = data.epv[3]
    // E P S I L O N  --  S P I K E S  -- E N D 


    data.currentKG = loadCellValue
    if (data.record) {
        switch (receivedData) {
            case "sos2\r":
                data.record = false //pause btn is disabled
                Vue.dialog.alert("ნიმუში გაწყდა")
                return
            case "sos1\r":
                data.record = false //pause btn is disabled
                Vue.dialog.alert("ნიმუში გაიწელა 10მმ-ით")
                return
        }

        if (parseFloat(data.threshold) - 0.1 < loadCellValue) {
            port.write("pause\n", (err) => {
                if (err) {
                    return console.log('Error on write: ', err.message);
                }
                data.isPaused = true; //cont
            })
        }

        let p = parseFloat(    (loadCellValue / ((epsilonValue + 1) * data.sampleArea)).toFixed(3)     )
        let sigmaTimeValues = [(new Date()).getTime() - data.zeroValue, p]
        let epsilonTimeValues = [(new Date()).getTime() - data.zeroValue, epsilonValue]
        let sigmaEpsilonValues = [epsilonValue, p]

        //write in file
        fs.appendFileSync(data.fileSaveDir + "sigmaTime.csv", `${sigmaTimeValues[0]},${sigmaTimeValues[1]}\n`)
        fs.appendFileSync(data.fileSaveDir + "epsilonTime.csv", `${epsilonTimeValues[0]},${epsilonTimeValues[1]}\n`)
        fs.appendFileSync(data.fileSaveDir + "sigmaEpsilon.csv", `${sigmaEpsilonValues[0]},${sigmaEpsilonValues[1]}\n`)


        
        if (sigmaTime.series[0].data.length === 0
            || (Math.abs(sigmaTime.series[0].data[sigmaTime.series[0].data.length - 1].y - p) > 0.02    //filter out similar data from display
                && data.settings[0])) {
            sigmaTime.series[0].addPoint(sigmaTimeValues, true, false);
            if (sigmaTime.series[0].data.length > 10000) {
                sigmaTime.series[0].data[0].remove()
            }
        }

        if (epsilonTime.series[0].data.length === 0
            || (Math.abs(epsilonTime.series[0].data[epsilonTime.series[0].data.length - 1].y - epsilonValue) > 0.002  //filter out similar data from display
                && data.settings[1])) {
            epsilonTime.series[0].addPoint(epsilonTimeValues, true, false);
            if (epsilonTime.series[0].data.length > 10000) {
                epsilonTime.series[0].data[0].remove()
            }
        }

        if (sigmaEpsilon.series[0].data.length === 0
            || ((Math.abs(sigmaEpsilon.series[0].data[sigmaEpsilon.series[0].data.length - 1].y - p) > 0.02
                || Math.abs(sigmaEpsilon.series[0].data[sigmaEpsilon.series[0].data.length - 1].x - epsilonValue) > 0.002)  //filter out similar data from display
                && data.settings[2])) {
            sigmaEpsilon.series[0].addPoint(sigmaEpsilonValues, true, false)
            if (sigmaEpsilon.series[0].data.length > 10000)
                sigmaEpsilon.series[0].data[0].remove()
        }

    }
}

//chawerili monacemebis maokitxva
function emulate() {
    data.record = true //pause btn is enabled
    port = {
        write(mes) {
            console.log("port.write: " + mes)
        }
    }
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

function DetectSpike(a,b,c){
    let validity_coeff = 2

    return (
        (b >= a*validity_coeff && b >= c*validity_coeff) 
        ||
        (b <= a*validity_coeff && b <= c*validity_coeff && b < 0) 
    )
     
}

function log(str) {
    console.log(str)
    fs.appendFileSync('log.txt', str + "\n");
}

//log("asdf")