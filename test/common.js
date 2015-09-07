var chai = require('chai');
var log4js = require('log4js');

chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

if (!process.env.DEBUG) {
	log4js.configure({ appenders: [] });
}

global.expect = chai.expect;

