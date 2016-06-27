#!/usr/bin/env node

var _ = require('lodash');
var program = require('commander');
var Satan = require('../lib');
var pkg = require('../package');

program.version(pkg.version);
program.usage('[options] -- [args...]');
program.option('-s, --script [path]', 'worker script path');
program.option('-d, --working-directory [path]', 'working directory');
program.option('-i, --instances [count]', 'number of workers to spawn');
program.option('-n, --node-arguments [args]', 'custom arguments to nodejs');
program.option('-p, --scheduling-policy', 'cluster scheduling policy(none or rr)');
program.option('-c, --config [path]', 'config file path');
program.option('-P, --pid-file [path]', 'pid file path');
program.parse(process.argv);

new Satan({
	script: program.script,
	arguments: program.args,
	nodeArguments: program.nodeArguments,
	workingDirectory: program.workingDirectory,
	instances: program.instances,
	schedulingPolicy: program.schedulingPolicy,
	pidFile: program.pidFile
}, program.config).start();

