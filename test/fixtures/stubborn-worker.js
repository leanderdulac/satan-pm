var cluster = require('cluster');

process.on('shutdown', function() {
	process.send('they are trying to kill me');
});

process.on('message', function(msg) {
	if (msg == 'let it go') {
		cluster.worker.disconnect();
	}
});

process.send('online');

