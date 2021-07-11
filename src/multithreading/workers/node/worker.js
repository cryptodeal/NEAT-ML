/* Imports */
const { multi, methods } = require('../../../neataptic');

let set = [];
let cost;
let F = multi.activations;

process.on('message', function (e) {
	if (typeof e.set === 'undefined') {
		let A = e.activations;
		let S = e.states;
		let data = e.conns;

		let result = multi.testSerializedSet(set, cost, A, S, data, F);

		process.send(result);
	} else {
		cost = methods.cost[e.cost];
		set = multi.deserializeDataSet(e.set);
	}
});
