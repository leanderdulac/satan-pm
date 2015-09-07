var _ = require('lodash');
var fs = require('fs');
var os = require('os');
var WorkerManager = require('./worker-manager');
var logger = require('log4js').getLogger('SATAN');

var Satan = function(defaultConfig, configFilePath) {
	this.defaultConfig = defaultConfig;
	this.configFile = {};
	this.configFilePath = configFilePath;

	this.sanitizeConfig(this.defaultConfig);
	this.refreshConfiguration();

	this.manager = new WorkerManager(this.config);
};

Satan.prototype.sanitizeConfig = function(config) {
	if (typeof config.arguments == 'string') {
		config.arguments = config.arguments.split(' ');
	}
};

Satan.prototype.refreshConfiguration = function() {
	if (this.configFilePath) {
		try {
			this.configFile = JSON.parse(fs.readFileSync(this.configFilePath));
			this.sanitizeConfig(this.configFile);
		} catch (e) {
			logger.error('Failed to read config file! Continuing anyway with previous configuration...');
			logger.error(e);
		}
	}

	this.config = _.defaults({
		arguments: (this.defaultConfig.arguments || []).concat(this.configFile.arguments || [])
	}, this.defaultConfig, this.configFile, {
		instances: 1,
		schedulingPolicy: 'rr',
		nodeArguments: process.execArgs
	});

	if (this.config.instances <= 0) {
		this.config.instances = os.cpus().length;
	}
};

Satan.prototype.prepare = function() {
	var self = this;

	process.title = 'satan-pm ' + this.config.script;

	process.on('SIGUSR2', function() {
		logger.debug('Caught SIGUSR2!');

		self.manager.gc();
	});

	process.on('SIGHUP', function() {
		logger.debug('Caught SIGHUP!');

		self.manager.reload();
	});

	process.on('SIGINT', function() {
		logger.debug('Caught SIGINT!');

		self.manager.terminate()
		.then(function() {
			process.exit(0);
		});
	});

	process.on('SIGTERM', function() {
		logger.debug('Caught SIGTERM!');

		self.manager.terminate()
		.then(function() {
			process.exit(0);
		});
	});

	if (this.config.pidFile) {
		fs.writeFileSync(this.config.pidFile, process.pid);
	}
};

Satan.prototype.start = function() {
	this.refreshConfiguration();
	this.prepare();

	logger.info('Satan is ready.')

	this.manager.run();

};

module.exports = Satan;

