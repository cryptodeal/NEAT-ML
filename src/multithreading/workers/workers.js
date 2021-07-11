/* Export */
module.exports = workers;

/* WORKERS */
const workers = {
	node: {
		TestWorker: require('./node/testworker')
	},
	browser: {
		TestWorker: require('./browser/testworker')
	}
};
