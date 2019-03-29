const fs = require('fs');

for (let i = 0; i < 8000000; i++) {
	let myRandomDot = [i, Math.floor(Math.random() * 10) + 1]
	fs.appendFileSync('shitloadofrandomnumbers.cvs', `${myRandomDot[0]},${myRandomDot[1]}\n`, function (err) {
		if (err) throw err;
		console.log('Saved!');
	});
}








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

// for (let i = 0; i < 2000000; i ++) {
// 	let myRandomDot = [i, Math.floor(Math.random() * 10) + 1]
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