nw.Window.get().showDevTools()

const SerialPort = require('serialport'); //chart.series[0].addPoint([(new Date()).getTime(), parseFloat(sData)], true, false)
const ReadLine = SerialPort.parsers.Readline;
let reconnectTimer

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

        const port = new SerialPort(f[0].comName, {
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
                    chart.series[0].addPoint([(new Date()).getTime(), parseFloat(sData)], true, false)
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
    record: false
}

let vue = new Vue({
    el: "#app",
    data,
    methods: {
        clear() {
            chart.series[0].setData([]);
            chart.redraw();
        }
    }
})

Highcharts.setOptions({
    global: {
        useUTC: false
    }
});
let chart = Highcharts.chart('container', {
    chart: {
        type: 'spline',
        animation: false,
        marginRight: 10,
        // events: {
        //     load: function () {
        //         let socket = io();
        //         socket.on('data', sData => {
        //             if (data.record)
        //                 chart.series[0].addPoint([(new Date()).getTime(), parseFloat(sData)], true, false)
        //         });
        //     }
        // }
    },
    title: {
        text: 'მონაცემები'
    },
    xAxis: {
        type: 'datetime',
        tickPixelInterval: 150
    },
    yAxis: {
        title: {
            text: 'Value'
        },
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
            return '<b>' + this.series.name + '</b><br/>' +
                Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '<br/>' +
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