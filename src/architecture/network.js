/* Export */
module.exports = Network;

/* Imports */
const config = require('../config');
const methods = require('../methods/methods');

/* Easier letiable naming */
let mutation = methods.mutation;

class Network {
	/* Constructs a network */
	constructor(input, output) {
		if (typeof input === 'undefined' || typeof output === 'undefined') {
			throw new Error('No input or output size given');
		}
		this.input = input;
		this.output = output;

		/* Stores node and connection genes */
		this.nodes = [];
		this.connections = [];
		this.gates = [];
		this.selfConns = [];

		/* Regularization */
		this.dropout = 0;

		/* Create Input and Output nodes */
		for (let i = 0; i < this.input + this.output; i++) {
			this.nodes.push(new Node(i < this.input ? 'input' : 'output'));
		}

		/* Connect Input and Output nodes to each other */
		for (let i = 0; i < this.input; i++) {
			for (let j = this.input; j < this.output + this.input; j++) {
				/* See: https://stats.stackexchange.com/a/248040/147931 */
				let weight = Math.random() * this.input * Math.sqrt(2 / this.input);
				this.connect(this.nodes[i], this.nodes[j], weight);
			}
		}
	}

	/* Activates the network */
	activate(input, training) {
		const output = [];
		/* Activate nodes in the same order as the connections array */
		for (let i = 0; i < this.nodes.length; i++) {
			if (this.nodes[i].type === 'input') {
				this.nodes[i].activate(input[i]);
			} else if (this.nodes[i].type === 'output') {
				let activation = this.nodes[i].activate();
				output.push(activation);
			} else {
				if (training) this.nodes[i].mask = Math.random() < this.dropout ? 0 : 1;
				this.nodes[i].activate();
			}
		}
		return output;
	}

	/* Activates the network without calculating elegibility traces and such */
	noTraceActivate(input) {
		const output = [];

		/* Activate nodes in the same order as the connections array */
		for (let i = 0; i < this.nodes.length; i++) {
			if (this.nodes[i].type === 'input') {
				this.nodes[i].noTraceActivate(input[i]);
			} else if (this.nodes[i].type === 'output') {
				let activation = this.nodes[i].noTraceActivate();
				output.push(activation);
			} else {
				this.nodes[i].noTraceActivate();
			}
		}
		return output;
	}

	/* Backpropogate the Network */
	propagate(rate, momentum, update, target) {
		if (typeof target === 'undefined' || target.length !== this.output) {
			throw new Error('Output target length should match network output length');
		}

		let targetIdx = target.length;

		/* Propagate output nodes */
		for (let i = this.nodes.length - 1; i >= this.nodes.length - this.output; i--) {
			this.nodes[i].propagate(rate, momentum, update, target[--targetIdx]);
		}

		/* Propagate hidden and input nodes */
		for (let i = this.nodes.length - this.output - 1; i >= this.input; i--) {
			this.nodes[i].propagate(rate, momentum, update);
		}
	}

	/* Clear the context of the Network */
	clear() {
		for (let i = 0; i < this.nodes.length; i++) {
			this.nodes[i].clear();
		}
	}

	/* Disconnects the from node from the to node */
	disconnect(from, to) {
		/* Delete the connection in the network's connection array */
		let connections = from === to ? this.selfConns : this.connections;

		for (let i = 0; i < connections.length; i++) {
			let connection = connections[i];
			if (connection.from === from && connection.to === to) {
				if (connection.gater !== null) this.ungate(connection);
				connections.splice(i, 1);
				break;
			}
		}

		/* Delete the connection at the sending and receiving neuron */
		from.disconnect(to);
	}

	/* Gate a connection with a node */
	gate(node, connection) {
		if (this.nodes.indexOf(node) === -1) {
			throw new Error('This node is not part of the network!');
		} else if (connection.gater != null) {
			if (config.warnings) console.warn('This connection is already gated!');
			return;
		}
		node.gate(connection);
		this.gates.push(connection);
	}

	/* Remove the gate of a connection */
	ungate(connection) {
		let idx = this.gates.indexOf(connection);
		if (idx === -1) {
			throw new Error('This connection is not gated!');
		}

		this.gates.splice(idx, 1);
		connection.gater.ungate(connection);
	}

	/* Removes specified node from the network */
	remove(node) {
		let idx = this.nodes.indexOf(node);
		if (idx === -1) {
			throw new Error('This node does not exist in the network!');
		}

		/* Keep track of gaters */
		const gaters = [];

		/* Remove selfconnections from this.selfConns */
		this.disconnect(node, node);

		/* Get all its inputting nodes */
		const inputs = [];
		for (let i = node.connections.in.length - 1; i >= 0; i--) {
			let connection = node.connections.in[i];
			if (mutation.SUB_NODE.keep_gates && connection.gater !== null && connection.gater !== node) {
				gaters.push(connection.gater);
			}
			inputs.push(connection.from);
			this.disconnect(connection.from, node);
		}

		/* Get all its outputting nodes */
		const outputs = [];
		for (let i = node.connections.out.length - 1; i >= 0; i--) {
			let connection = node.connections.out[i];
			if (mutation.SUB_NODE.keep_gates && connection.gater !== null && connection.gater !== node) {
				gaters.push(connection.gater);
			}
			outputs.push(connection.to);
			this.disconnect(node, connection.to);
		}

		/* Connect the input nodes to the output nodes (if not already connected) */
		const connections = [];
		for (let i = 0; i < inputs.length; i++) {
			let input = inputs[i];
			for (let j = 0; j < outputs.length; j++) {
				let output = outputs[j];
				if (!input.isProjectingTo(output)) {
					let conn = this.connect(input, output);
					connections.push(conn[0]);
				}
			}
		}

		/* Gate random connections with gaters */
		for (let i = 0; i < gaters.length; i++) {
			if (connections.length === 0) break;

			let gater = gaters[i];
			let connIndex = Math.floor(Math.random() * connections.length);

			this.gate(gater, connections[connIndex]);
			connections.splice(connIndex, 1);
		}

		/* Remove gated connections gated by this node */
		for (let i = node.connections.gated.length - 1; i >= 0; i--) {
			let conn = node.connections.gated[i];
			this.ungate(conn);
		}

		/* Remove selfconnection */
		this.disconnect(node, node);

		/* Remove the node from this.nodes */
		this.nodes.splice(idx, 1);
	}

	/* Mutates the network with the given method */
	mutate(method) {
		if (typeof method === 'undefined') {
			throw new Error('No (correct) mutate method given!');
		}

		let i, j;
		switch (method) {
			case mutation.ADD_NODE: {
				/* Look for an existing connection and place a node in between */
				var connection = this.connections[Math.floor(Math.random() * this.connections.length)];
				var gater = connection.gater;
				this.disconnect(connection.from, connection.to);

				/* Insert the new node right before the old connection.to */
				var toIdx = this.nodes.indexOf(connection.to);
				var node = new Node('hidden');

				/* Random squash function */
				node.mutate(mutation.MOD_ACTIVATION);

				/* Place it in this.nodes */
				var minBound = Math.min(toIdx, this.nodes.length - this.output);
				this.nodes.splice(minBound, 0, node);

				/* Now create two new connections */
				var newConn1 = this.connect(connection.from, node)[0];
				var newConn2 = this.connect(node, connection.to)[0];

				/* Check if the original connection was gated */
				if (gater != null) {
					this.gate(gater, Math.random() >= 0.5 ? newConn1 : newConn2);
				}
				break;
			}

			case mutation.SUB_NODE: {
				/* Check if there are nodes left to remove */
				if (this.nodes.length === this.input + this.output) {
					if (config.warnings) console.warn('No more nodes left to remove!');
					break;
				}

				/* Select a node which isn't an input or output node */
				var idx = Math.floor(
					Math.random() * (this.nodes.length - this.output - this.input) + this.input
				);
				this.remove(this.nodes[idx]);
				break;
			}

			case mutation.ADD_CONN: {
				/* Create an array of all uncreated (feedforward) connections */
				var available = [];
				for (i = 0; i < this.nodes.length - this.output; i++) {
					var node1 = this.nodes[i];
					for (j = Math.max(i + 1, this.input); j < this.nodes.length; j++) {
						var node2 = this.nodes[j];
						if (!node1.isProjectingTo(node2)) available.push([node1, node2]);
					}
				}

				if (available.length === 0) {
					if (config.warnings) console.warn('No more connections to be made!');
					break;
				}

				var pair = available[Math.floor(Math.random() * available.length)];
				this.connect(pair[0], pair[1]);
				break;
			}

			case mutation.SUB_CONN: {
				/* List of possible connections that can be removed */
				var possible = [];

				for (i = 0; i < this.connections.length; i++) {
					var conn = this.connections[i];
					// Check if it is not disabling a node
					if (
						conn.from.connections.out.length > 1 &&
						conn.to.connections.in.length > 1 &&
						this.nodes.indexOf(conn.to) > this.nodes.indexOf(conn.from)
					) {
						possible.push(conn);
					}
				}

				if (possible.length === 0) {
					if (config.warnings) console.warn('No connections to remove!');
					break;
				}

				var randomConn = possible[Math.floor(Math.random() * possible.length)];
				this.disconnect(randomConn.from, randomConn.to);
				break;
			}

			case mutation.MOD_WEIGHT: {
				var allconnections = this.connections.concat(this.selfconns);

				connection = allconnections[Math.floor(Math.random() * allconnections.length)];
				let modification = Math.random() * (method.max - method.min) + method.min;
				connection.weight += modification;
				break;
			}

			case mutation.MOD_BIAS: {
				/* no effect on input nodes, so they are excluded */
				let index = Math.floor(Math.random() * (this.nodes.length - this.input) + this.input);
				let node = this.nodes[index];
				node.mutate(method);
				break;
			}

			case mutation.MOD_ACTIVATION: {
				/* no effect on input nodes, so they are excluded */
				if (!method.mutateOutput && this.input + this.output === this.nodes.length) {
					if (config.warnings) console.warn('No nodes that allow mutation of activation function');
					break;
				}

				let idx = Math.floor(
					Math.random() *
						(this.nodes.length - (method.mutateOutput ? 0 : this.output) - this.input) +
						this.input
				);
				let node = this.nodes[idx];

				node.mutate(method);
				break;
			}

			case mutation.ADD_SELF_CONN: {
				/* Check which nodes aren't selfconnected yet */
				let possible = [];
				for (i = this.input; i < this.nodes.length; i++) {
					let node = this.nodes[i];
					if (node.connections.self.weight === 0) {
						possible.push(node);
					}
				}

				if (possible.length === 0) {
					if (config.warnings) console.warn('No more self-connections to add!');
					break;
				}

				/* Select a random node */
				let node = possible[Math.floor(Math.random() * possible.length)];

				/* Connect it to himself */
				this.connect(node, node);
				break;
			}

			case mutation.SUB_SELF_CONN: {
				if (this.selfconns.length === 0) {
					if (config.warnings) console.warn('No more self-connections to remove!');
					break;
				}
				let conn = this.selfconns[Math.floor(Math.random() * this.selfconns.length)];
				this.disconnect(conn.from, conn.to);
				break;
			}

			case mutation.ADD_GATE: {
				let allconnections = this.connections.concat(this.selfconns);

				/* Create a list of all non-gated connections */
				let possible = [];
				for (i = 0; i < allconnections.length; i++) {
					let conn = allconnections[i];
					if (conn.gater === null) {
						possible.push(conn);
					}
				}

				if (possible.length === 0) {
					if (config.warnings) console.warn('No more connections to gate!');
					break;
				}

				/* Select a random gater node and connection, can't be gated by input */
				let index = Math.floor(Math.random() * (this.nodes.length - this.input) + this.input);
				let node = this.nodes[index];
				let conn = possible[Math.floor(Math.random() * possible.length)];

				/* Gate the connection with the node */
				this.gate(node, conn);
				break;
			}

			case mutation.SUB_GATE: {
				/* Select a random gated connection */
				if (this.gates.length === 0) {
					if (config.warnings) console.warn('No more connections to ungate!');
					break;
				}

				let idx = Math.floor(Math.random() * this.gates.length);
				let gatedconn = this.gates[idx];

				this.ungate(gatedconn);
				break;
			}

			case mutation.ADD_BACK_CONN: {
				/* Create an array of all uncreated (backfed) connections */
				let available = [];
				for (i = this.input; i < this.nodes.length; i++) {
					let node1 = this.nodes[i];
					for (j = this.input; j < i; j++) {
						let node2 = this.nodes[j];
						if (!node1.isProjectingTo(node2)) available.push([node1, node2]);
					}
				}

				if (available.length === 0) {
					if (config.warnings) console.warn('No more connections to be made!');
					break;
				}

				let pair = available[Math.floor(Math.random() * available.length)];
				this.connect(pair[0], pair[1]);
				break;
			}

			case mutation.SUB_BACK_CONN: {
				/* List of possible connections that can be removed */
				let possible = [];

				for (i = 0; i < this.connections.length; i++) {
					let conn = this.connections[i];
					/* Check if it is not disabling a node */
					if (
						conn.from.connections.out.length > 1 &&
						conn.to.connections.in.length > 1 &&
						this.nodes.indexOf(conn.from) > this.nodes.indexOf(conn.to)
					) {
						possible.push(conn);
					}
				}

				if (possible.length === 0) {
					if (config.warnings) console.warn('No connections to remove!');
					break;
				}

				let randomConn = possible[Math.floor(Math.random() * possible.length)];
				this.disconnect(randomConn.from, randomConn.to);
				break;
			}

			case mutation.SWAP_NODES: {
				/* no effect on input nodes, so they are excluded */
				if (
					(method.mutateOutput && this.nodes.length - this.input < 2) ||
					(!method.mutateOutput && this.nodes.length - this.input - this.output < 2)
				) {
					if (config.warnings)
						console.warn('No nodes that allow swapping of bias and activation function');
					break;
				}

				let idx = Math.floor(
					Math.random() *
						(this.nodes.length - (method.mutateOutput ? 0 : this.output) - this.input) +
						this.input
				);
				let node1 = this.nodes[idx];
				idx = Math.floor(
					Math.random() *
						(this.nodes.length - (method.mutateOutput ? 0 : this.output) - this.input) +
						this.input
				);
				let node2 = this.nodes[idx];

				let biasTemp = node1.bias;
				let squashTemp = node1.squash;

				node1.bias = node2.bias;
				node1.squash = node2.squash;
				node2.bias = biasTemp;
				node2.squash = squashTemp;
				break;
			}
		}
	}

	/* Train the given set to this network */
	train(set, options) {
		if (set[0].input.length !== this.input || set[0].output.length !== this.output) {
			throw new Error('Dataset input/output size should be same as network input/output size!');
		}

		options = options || {};

		/* Warning messages */
		if (typeof options.rate === 'undefined') {
			if (config.warnings) console.warn('Using default learning rate, please define a rate!');
		}
		if (typeof options.iterations === 'undefined') {
			if (config.warnings)
				console.warn('No target iterations given, running until error is reached!');
		}

		/* Read the options */
		var targetError = options.error || 0.05;
		var cost = options.cost || methods.cost.MSE;
		var baseRate = options.rate || 0.3;
		var dropout = options.dropout || 0;
		var momentum = options.momentum || 0;
		/* online learning */
		var batchSize = options.batchSize || 1;
		var ratePolicy = options.ratePolicy || methods.rate.FIXED();

		var start = Date.now();

		if (batchSize > set.length) {
			throw new Error('Batch size must be smaller or equal to dataset length!');
		} else if (typeof options.iterations === 'undefined' && typeof options.error === 'undefined') {
			throw new Error('At least one of the following options must be specified: error, iterations');
		} else if (typeof options.error === 'undefined') {
			/* run until iterations */
			targetError = -1;
		} else if (typeof options.iterations === 'undefined') {
			/* run until target error */
			options.iterations = 0;
		}

		/* Save to network */
		this.dropout = dropout;

		if (options.crossValidate) {
			let numTrain = Math.ceil((1 - options.crossValidate.testSize) * set.length);
			var trainSet = set.slice(0, numTrain);
			var testSet = set.slice(numTrain);
		}

		/* Loop the training process */
		var currentRate = baseRate;
		var iteration = 0;
		var error = 1;

		var i, j, x;
		while (error > targetError && (options.iterations === 0 || iteration < options.iterations)) {
			if (options.crossValidate && error <= options.crossValidate.testError) break;

			iteration++;

			/* Update the rate */
			currentRate = ratePolicy(baseRate, iteration);

			/* Checks if cross validation is enabled */
			if (options.crossValidate) {
				this.#trainSet(trainSet, batchSize, currentRate, momentum, cost);
				if (options.clear) this.clear();
				error = this.test(testSet, cost).error;
				if (options.clear) this.clear();
			} else {
				error = this.#trainSet(set, batchSize, currentRate, momentum, cost);
				if (options.clear) this.clear();
			}

			/* Checks for options such as scheduled logs and shuffling */
			if (options.shuffle) {
				for (
					j, x, i = set.length;
					i;
					j = Math.floor(Math.random() * i), x = set[--i], set[i] = set[j], set[j] = x
				);
			}

			if (options.log && iteration % options.log === 0) {
				console.log('iteration', iteration, 'error', error, 'rate', currentRate);
			}

			if (options.schedule && iteration % options.schedule.iterations === 0) {
				options.schedule.function({ error: error, iteration: iteration });
			}
		}

		if (options.clear) this.clear();

		if (dropout) {
			for (i = 0; i < this.nodes.length; i++) {
				if (this.nodes[i].type === 'hidden' || this.nodes[i].type === 'constant') {
					this.nodes[i].mask = 1 - this.dropout;
				}
			}
		}

		return {
			error: error,
			iterations: iteration,
			time: Date.now() - start
		};
	}

	/**
	 * Performs one training epoch and returns the error
	 * private function used in this.train
	 */
	#trainSet(set, batchSize, currentRate, momentum, costFunction) {
		let errorSum = 0;
		for (let i = 0; i < set.length; i++) {
			let input = set[i].input;
			let target = set[i].output;

			let update = !!((i + 1) % batchSize === 0 || i + 1 === set.length);

			let output = this.activate(input, true);
			this.propagate(currentRate, momentum, update, target);

			errorSum += costFunction(target, output);
		}
		return errorSum / set.length;
	}

	/* Tests a set and returns the error and elapsed time */
	test(set, cost = methods.cost.MSE) {
		/* Check if dropout is enabled, set correct mask */
		let i;
		if (this.dropout) {
			for (i = 0; i < this.nodes.length; i++) {
				if (this.nodes[i].type === 'hidden' || this.nodes[i].type === 'constant') {
					this.nodes[i].mask = 1 - this.dropout;
				}
			}
		}

		let error = 0;
		let start = Date.now();

		for (i = 0; i < set.length; i++) {
			let input = set[i].input;
			let target = set[i].output;
			let output = this.noTraceActivate(input);
			error += cost(target, output);
		}

		error /= set.length;

		let results = {
			error: error,
			time: Date.now() - start
		};

		return results;
	}

	/* creates a json that can be used to create a graph with d3 and webcola */
	graph(width, height) {
		let input = 0;
		let output = 0;

		let json = {
			nodes: [],
			links: [],
			constraints: [
				{
					type: 'alignment',
					axis: 'x',
					offsets: []
				},
				{
					type: 'alignment',
					axis: 'y',
					offsets: []
				}
			]
		};

		let i;
		for (i = 0; i < this.nodes.length; i++) {
			let node = this.nodes[i];

			if (node.type === 'input') {
				if (this.input === 1) {
					json.constraints[0].offsets.push({
						node: i,
						offset: 0
					});
				} else {
					json.constraints[0].offsets.push({
						node: i,
						offset: ((0.8 * width) / (this.input - 1)) * input++
					});
				}
				json.constraints[1].offsets.push({
					node: i,
					offset: 0
				});
			} else if (node.type === 'output') {
				if (this.output === 1) {
					json.constraints[0].offsets.push({
						node: i,
						offset: 0
					});
				} else {
					json.constraints[0].offsets.push({
						node: i,
						offset: ((0.8 * width) / (this.output - 1)) * output++
					});
				}
				json.constraints[1].offsets.push({
					node: i,
					offset: -0.8 * height
				});
			}

			json.nodes.push({
				id: i,
				name: node.type === 'hidden' ? node.squash.name : node.type.toUpperCase(),
				activation: node.activation,
				bias: node.bias
			});
		}

		let connections = this.connections.concat(this.selfconns);
		for (i = 0; i < connections.length; i++) {
			let connection = connections[i];
			if (connection.gater == null) {
				json.links.push({
					source: this.nodes.indexOf(connection.from),
					target: this.nodes.indexOf(connection.to),
					weight: connection.weight
				});
			} else {
				/* Add a gater 'node' */
				let index = json.nodes.length;
				json.nodes.push({
					id: index,
					activation: connection.gater.activation,
					name: 'GATE'
				});
				json.links.push({
					source: this.nodes.indexOf(connection.from),
					target: index,
					weight: (1 / 2) * connection.weight
				});
				json.links.push({
					source: index,
					target: this.nodes.indexOf(connection.to),
					weight: (1 / 2) * connection.weight
				});
				json.links.push({
					source: this.nodes.indexOf(connection.gater),
					target: index,
					weight: connection.gater.activation,
					gate: true
				});
			}
		}

		return json;
	}

	/* Convert the network to a json object */
	toJSON() {
		let json = {
			nodes: [],
			connections: [],
			input: this.input,
			output: this.output,
			dropout: this.dropout
		};

		// So we don't have to use expensive .indexOf()
		let i;
		for (i = 0; i < this.nodes.length; i++) {
			this.nodes[i].index = i;
		}

		for (i = 0; i < this.nodes.length; i++) {
			let node = this.nodes[i];
			let tojson = node.toJSON();
			tojson.index = i;
			json.nodes.push(tojson);

			if (node.connections.self.weight !== 0) {
				let tojson = node.connections.self.toJSON();
				tojson.from = i;
				tojson.to = i;

				tojson.gater =
					node.connections.self.gater != null ? node.connections.self.gater.index : null;
				json.connections.push(tojson);
			}
		}

		for (i = 0; i < this.connections.length; i++) {
			let conn = this.connections[i];
			let tojson = conn.toJSON();
			tojson.from = conn.from.index;
			tojson.to = conn.to.index;

			tojson.gater = conn.gater != null ? conn.gater.index : null;

			json.connections.push(tojson);
		}

		return json;
	}
}
