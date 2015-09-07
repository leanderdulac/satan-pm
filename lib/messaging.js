var _ = require('lodash');
var Promise = require('bluebird');
var midCounter = 0x1000;

exports.send = function(target, type, message) {
	target.send(_.merge({}, message || {}, {
		__satan: true,
		__mid: getNextMid(),
		__type: type
	}));

	return Promise.resolve();
};

// MID counting
function getNextMid() {
	return midCounter++;
}

