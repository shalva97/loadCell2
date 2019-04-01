




const fs = require('fs');
// let x =0

// for (let i = 0; i < 800; i++) {
// 	let myRandomDot = [i, x]
// 	x += 0.013
// 	fs.appendFileSync('shitloadofrandomnumbers.csv', `${myRandomDot[0]},${myRandomDot[1]}\n`, function (err) {
// 		if (err) throw err;
// 		console.log('Saved!');
// 	});
// }

if (fs.existsSync("data/")) {
   	console.log("asdf")
}

// const fs = require('fs');
// let x =0
// let y =0
// fs.writeFileSync('data/generated_data.csv', '');
// for (let i = 0; i < 25000; i++) {
// 	x += 0.009
// 	y += 0.00017
// 	fs.appendFileSync('data/generated_data.csv', `${x.toFixed(2)}/${y.toFixed(4)}\n`, function (err) {
// 		if (err) throw err;
// 		console.log('Saved!');
// 	});
// }







// var XLSXChart = require ("xlsx-chart");
// var fs = require ("fs");
// var xlsxChart = new XLSXChart ();
// var opts = {
// 	chart: "line",
// 	titles: [
// 		"Price"
// 	],
// 	fields: [],
// 	data: {
// 		"Price": {}
// 	},
// 	chartTitle: "Line chart"
// };

// for (let i = 0; i < 2000; i ++) {
// 	let myRandomDot = [i, Math.floor(Math.random()) + 1]
// 	opts.fields.push(myRandomDot[0])
// 	opts.data.Price[myRandomDot[0]] = myRandomDot[1]
// }


// xlsxChart.generate (opts, function (err, data) {
// 	if (err) {
// 		console.error (err);
// 	} else {
// 		fs.writeFileSync ("line.xlsx", data);
// 		console.log ("line.xlsx created.");
// 	};
// });