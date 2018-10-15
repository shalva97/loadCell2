nw.Window.get().showDevTools()
window.Vue.use(VuejsDialog.main.default, {
    html: true,
    loader: false,
    okText: 'გაგრძელება',
    cancelText: 'გაუქმება',
    animation: 'bounce',
})

const SerialPort = require('serialport');
const ReadLine = SerialPort.parsers.Readline;
let reconnectTimer
let port

connect()

function connect() {
    SerialPort.list().then(list => {
        let f = list.filter(item => {
            return String(item.manufacturer).includes('Arduino');
        })
        if (f.length === 0) {
            clearTimeout(reconnectTimer)
            reconnectTimer = setTimeout(connect, 4000)
            console.log("Error: cannot find correct device/ვერ ვპოულობ მოწყობილობას")
            return
        }

        port = new SerialPort(f[0].comName, {
            baudRate: 9600
        });

        port.flush(() => {
            const parser = new ReadLine();
            port.pipe(parser);
            port.on("open", () => {
                console.log("connection established to device/წარმატებით დავუკავშირდი")
            })

            parser.on('data', function (sData) {
                if (data.record)
                    chart.series[0].addPoint([(new Date()).getTime() - data.zeroValue, parseFloat(sData)], true, false)
            });

            port.on('close', function (u) {
                clearTimeout(reconnectTimer)
                reconnectTimer = setTimeout(connect, 4000)
                console.log("Error: connection closed/კავშირი გაწყდა")
            })

            port.on('error', function (e) {
                clearTimeout(reconnectTimer)
                reconnectTimer = setTimeout(connect, 4000)
                console.log("Error: connection fault/შეცდომა კავშირის დროს")
            })
        })
    })

}


let data = {
    record: false,
    zeroValue: Date.now()
}


let vue = new Vue({
    el: "#app",
    data,
    methods: {
        start() {
            this.zeroValue = Date.now()
            port.write("start\n")
            this.record = true
        },

        stop() {
            // let shouldDeleteData = confirm('წაიშლება ინფორმაცია და განულდება მოწყობილობის პოზიცია. გთხოვთ დაადასტუროთ')
            this.$dialog.confirm('განულდება მოწყობილობა და ჩაწერილი მონაცემები. გთხოვთ დაადასტუროთ')
                .then(function (dialog) {
                    port.write("stop\n")
                    chart.series[0].setData([]);
                    chart.redraw();
                    data.record = false
                })
                .catch(function () {});
            },

        pause() {
            port.write("pause\n")
        },

        resume() {
            port.write("start\n")
        },

        up() {

        },

        down() {

        }
    }
})

let chart = Highcharts.chart('container', {
    chart: {
        type: 'spline',
        animation: false,
        marginRight: 10
    },
    title: {
        text: 'მონაცემები'
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
            str += date.getUTCDate() - 1 + " დღე, ";
            str += date.getUTCHours() + " საათი, ";
            str += date.getUTCMinutes() + " წუთი, ";
            str += date.getUTCSeconds() + " წამი, ";
            str += date.getUTCMilliseconds() + " მილიწამი";
            return '<b>' + this.series.name + '</b><br/>' +
                str + '<br/>' +
                Highcharts.numberFormat(this.y, 2);
        }
    },
    legend: {
        enabled: false
    },
    exporting: {
        enabled: true
    },
    series: [{
        name: 'სენსორის მნიშვნელობა',
        data: []
    }]
});