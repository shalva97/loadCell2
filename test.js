const fs = require('fs');

let data = ""
let r = 4

for (let i = 0, j = 0
    ; i < 40
    ; i = Math.random() + i, j = Math.random()/4 + j) {

        data = data + i.toFixed(2) + "/" + j.toFixed(4) + "\n"

}
fs.appendFileSync('./data/emulation.csv', data)

//console.log((Math.random() + i).toFixed(3))