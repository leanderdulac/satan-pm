var http = require('http');
var server = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
}).listen(1339, '127.0.0.1');
process.on('exit', function() {
	console.log('Tchau! ' + require('cluster').worker.id);
});
console.log('Server running at http://127.0.0.1:1337/');

