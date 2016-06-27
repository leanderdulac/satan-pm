var midCounter = 0x1000;

exports.send = function(target, type, message) {
	target.send(merge({}, message || {}, {
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

function merge(target) {
	var args = [].slice.call(arguments, 1)

	for (var i = 0; i < args.length; i++) {
		var object = args[i]

		for (var key in object) {
			target[key] = object[key]
		}
	}

	return target
}
