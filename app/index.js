const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')
const serialPortId = process.env.NODE_ENV === 'develop' ? '/dev/cu.usbmodem1421' : '/dev/ttyACM0'
const port = new SerialPort(serialPortId, {
    baudRate: 9600
})
const parser = port.pipe(new Readline({delimiter: '\r\n'}))
const dataPattern = /^([A-Z]{4,5})0?HU(\d{3})TE((?:[+|-])\d{3})/
let weatherData = []
const express = require('express')
const app = express()
const expressPort = 3124
const http = require('http').Server(app);
const io = require('socket.io')(http);
const status = {
    ok: true,
    data: {}
}

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// app.get('/weather-data.json', (req, res) => res.send({data: weatherData}))

http.listen(expressPort, console.log('listening on *:3000'));

// Open errors will be emitted as an error event
port.on('error', err => {
    console.log('SerialPort Error: ', err.message);

    status.ok = false
    status.data = {
        id: 'no sensordata',
        message: err.message,
        port: serialPortId
    }

    io.emit('status error', status.data)
})

// The open event is always emitted
port.on('open', function () {

})

io.on('connection', function (socket) {
    console.log('a user connected');

    socket.on('disconnect', function () {
        console.log('user disconnected');
    });

    socket.on('get status', () => {
        console.log('Status ok: ', status.ok)
        socket.emit('status', status)

        if (!status.ok) {
            socket.emit('status error', status.data)
        }
    })

    socket.on('get history', () => {
        socket.emit('history', weatherData)
    })
});

parser.on('data', data => {
    const dataMatch = data.match(dataPattern)

    if (!dataMatch) {
        console.error(`Can\'t read data '${data}'`)

        return
    }

    const date = new Date()
    const deviceId = dataMatch[1]
    const humidity = dataMatch[2].replace('0', '')
    const temperature = dataMatch[3].replace('0', '')
    const item = {
        date: date.toUTCString(),
        deviceId,
        hu: humidity,
        te: temperature
    }

    weatherData.push(item)

    // use 600 items only
    weatherData = weatherData.slice(-600)

    io.emit('update', item)

    console.log(`${date.toLocaleString()}: ${humidity}% Luftfeuchtigkeit bei ${temperature}°C im ${deviceId}`)
})
