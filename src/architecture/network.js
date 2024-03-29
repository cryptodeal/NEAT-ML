/* Imports */
const config = require('../config');
const methods = require('../methods/methods');
const multi = require('../multithreading/multi');
const Node = require('./node');
const Connection = require('./connection');

/* Easier letiable naming */
let mutation = methods.mutation;
var Neat;

module.exports = class Network {
	/* Constructs a network */
	constructor(input, output) {
		if (typeof input === 'undefined' || typeof output === 'undefined') {
			throw new Error('No input or output size given');
		}
		this.isType = 'Network';
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

	/* Backpropagate the Network */
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

	/* Connects the from node to the to node */
	connect(from, to, weight) {
		const connections = from.connect(to, weight);

		for (let i = 0; i < connections.length; i++) {
			let connection = connections[i];
			if (from !== to) {
				this.connections.push(connection);
			} else {
				this.selfConns.push(connection);
			}
		}

		return connections;
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
			let connIdx = Math.floor(Math.random() * connections.length);

			this.gate(gater, connections[connIdx]);
			connections.splice(connIdx, 1);
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
				let connection = this.connections[Math.floor(Math.random() * this.connections.length)];
				let gater = connection.gater;
				this.disconnect(connection.from, connection.to);

				/* Insert the new node right before the old connection.to */
				let toIdx = this.nodes.indexOf(connection.to);
				let node = new Node('hidden');

				/* Random squash function */
				node.mutate(mutation.MOD_ACTIVATION);

				/* Place it in this.nodes */
				let minBound = Math.min(toIdx, this.nodes.length - this.output);
				this.nodes.splice(minBound, 0, node);

				/* Now create two new connections */
				let newConn1 = this.connect(connection.from, node)[0];
				let newConn2 = this.connect(node, connection.to)[0];

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
				let idx = Math.floor(
					Math.random() * (this.nodes.length - this.output - this.input) + this.input
				);
				this.remove(this.nodes[idx]);
				break;
			}

			case mutation.ADD_CONN: {
				/* Create an array of all uncreated (feedforward) connections */
				const available = [];
				for (i = 0; i < this.nodes.length - this.output; i++) {
					let node1 = this.nodes[i];
					for (j = Math.max(i + 1, this.input); j < this.nodes.length; j++) {
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

			case mutation.SUB_CONN: {
				/* List of possible connections that can be removed */
				const possible = [];

				for (i = 0; i < this.connections.length; i++) {
					let conn = this.connections[i];
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

				let randomConn = possible[Math.floor(Math.random() * possible.length)];
				this.disconnect(randomConn.from, randomConn.to);
				break;
			}

			case mutation.MOD_WEIGHT: {
				let allconnections = this.connections.concat(this.selfConns);

				let connection = allconnections[Math.floor(Math.random() * allconnections.length)];
				let modification = Math.random() * (method.max - method.min) + method.min;
				connection.weight += modification;
				break;
			}

			case mutation.MOD_BIAS: {
				/* no effect on input nodes, so they are excluded */
				let idx = Math.floor(Math.random() * (this.nodes.length - this.input) + this.input);
				let node = this.nodes[idx];
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
				if (this.selfConns.length === 0) {
					if (config.warnings) console.warn('No more self-connections to remove!');
					break;
				}
				let conn = this.selfConns[Math.floor(Math.random() * this.selfConns.length)];
				this.disconnect(conn.from, conn.to);
				break;
			}

			case mutation.ADD_GATE: {
				let allconnections = this.connections.concat(this.selfConns);

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
				let idx = Math.floor(Math.random() * (this.nodes.length - this.input) + this.input);
				let node = this.nodes[idx];
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
		let targetError = options.error || 0.05;
		let cost = options.cost || methods.cost.MSE;
		let baseRate = options.rate || 0.3;
		let dropout = options.dropout || 0;
		let momentum = options.momentum || 0;
		/* online learning */
		let batchSize = options.batchSize || 1;
		let ratePolicy = options.ratePolicy || methods.rate.FIXED();

		let start = Date.now();

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
		let trainSet;
		let testSet;

		if (options.crossValidate) {
			let numTrain = Math.ceil((1 - options.crossValidate.testSize) * set.length);
			trainSet = set.slice(0, numTrain);
			testSet = set.slice(numTrain);
		}

		/* Loop the training process */
		let currentRate = baseRate;
		let iteration = 0;
		let error = 1;

		let i, j, x;
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

		let connections = this.connections.concat(this.selfConns);
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
				let idx = json.nodes.length;
				json.nodes.push({
					id: idx,
					activation: connection.gater.activation,
					name: 'GATE'
				});
				json.links.push({
					source: this.nodes.indexOf(connection.from),
					target: idx,
					weight: (1 / 2) * connection.weight
				});
				json.links.push({
					source: idx,
					target: this.nodes.indexOf(connection.to),
					weight: (1 / 2) * connection.weight
				});
				json.links.push({
					source: this.nodes.indexOf(connection.gater),
					target: idx,
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

	/* Sets the value of a property for every node in this network */
	set(values) {
		for (let i = 0; i < this.nodes.length; i++) {
			this.nodes[i].bias = values.bias || this.nodes[i].bias;
			this.nodes[i].squash = values.squash || this.nodes[i].squash;
		}
	}

	/* Evolves the network to reach a lower error on a dataset */
	async evolve(set, options) {
		if (set[0].input.length !== this.input || set[0].output.length !== this.output) {
			throw new Error('Dataset input/output size should be same as network input/output size!');
		}
		if (Neat == null) {
			Neat = require('../neat');
		}

		/* Read the options */
		options = options || {};
		let targetError = typeof options.error !== 'undefined' ? options.error : 0.05;
		let growth = typeof options.growth !== 'undefined' ? options.growth : 0.0001;
		let cost = options.cost || methods.cost.MSE;
		let amount = options.amount || 1;

		let threads = options.threads;
		if (typeof threads === 'undefined') {
			if (typeof window === 'undefined') {
				/* Node.js */
				threads = require('os').cpus().length;
			} else {
				/* Browser */
				threads = navigator.hardwareConcurrency;
			}
		}

		let start = Date.now();

		if (typeof options.iterations === 'undefined' && typeof options.error === 'undefined') {
			throw new Error('At least one of the following options must be specified: error, iterations');
		} else if (typeof options.error === 'undefined') {
			/* run until iterations */
			targetError = -1;
		} else if (typeof options.iterations === 'undefined') {
			/* run until target error */
			options.iterations = 0;
		}

		let fitnessFunction;
		if (threads === 1) {
			/* Create the fitness function */
			fitnessFunction = function (genome) {
				let score = 0;
				for (let i = 0; i < amount; i++) {
					score -= genome.test(set, cost).error;
				}

				score -=
					(genome.nodes.length -
						genome.input -
						genome.output +
						genome.connections.length +
						genome.gates.length) *
					growth;
				/* this can cause problems with fitness proportionate selection */
				score = isNaN(score) ? -Infinity : score;

				return score / amount;
			};
		} else {
			/* Serialize the dataset */
			let converted = multi.serializeDataSet(set);

			/* Create workers, send datasets */
			var workers = [];
			if (typeof window === 'undefined') {
				for (let i = 0; i < threads; i++) {
					workers.push(new multi.workers.node.TestWorker(converted, cost));
				}
			} else {
				for (let i = 0; i < threads; i++) {
					workers.push(new multi.workers.browser.TestWorker(converted, cost));
				}
			}

			fitnessFunction = function (population) {
				/* eslint-disable no-unused-vars */
				return new Promise((resolve, reject) => {
					/* eslint-enable no-unused-vars */
					/* Create a queue */
					let queue = population.slice();
					let done = 0;

					/* Start worker function */
					let startWorker = function (worker) {
						if (!queue.length) {
							if (++done === threads) resolve();
							return;
						}

						let genome = queue.shift();

						worker.evaluate(genome).then(function (result) {
							genome.score = -result;
							genome.score -=
								(genome.nodes.length -
									genome.input -
									genome.output +
									genome.connections.length +
									genome.gates.length) *
								growth;
							genome.score = isNaN(parseFloat(result)) ? -Infinity : genome.score;
							startWorker(worker);
						});
					};

					for (let i = 0; i < workers.length; i++) {
						startWorker(workers[i]);
					}
				});
			};

			options.fitnessPopulation = true;
		}

		/* Intialise the NEAT instance */
		options.network = this;
		let neat = new Neat(this.input, this.output, fitnessFunction, options);

		let error = -Infinity;
		let bestFitness = -Infinity;
		let bestGenome;

		while (
			error < -targetError &&
			(options.iterations === 0 || neat.generation < options.iterations)
		) {
			let fittest = await neat.evolve();
			let fitness = fittest.score;
			error =
				fitness +
				(fittest.nodes.length -
					fittest.input -
					fittest.output +
					fittest.connections.length +
					fittest.gates.length) *
					growth;

			if (fitness > bestFitness) {
				bestFitness = fitness;
				bestGenome = fittest;
			}

			if (options.log && neat.generation % options.log === 0) {
				console.log('iteration', neat.generation, 'fitness', fitness, 'error', -error);
			}

			if (options.schedule && neat.generation % options.schedule.iterations === 0) {
				options.schedule.function({ fitness: fitness, error: -error, iteration: neat.generation });
			}
		}

		if (threads > 1) {
			for (let i = 0; i < workers.length; i++) workers[i].terminate();
		}

		if (typeof bestGenome !== 'undefined') {
			this.nodes = bestGenome.nodes;
			this.connections = bestGenome.connections;
			this.selfConns = bestGenome.selfConns;
			this.gates = bestGenome.gates;

			if (options.clear) this.clear();
		}

		return {
			error: -error,
			iterations: neat.generation,
			time: Date.now() - start
		};
	}

	/**
	 * Creates a standalone function of the network which can be run without the
	 * need of a library
	 */
	standalone() {
		const present = [];
		const activations = [];
		const states = [];
		const lines = [];
		const functions = [];

		let i;
		for (i = 0; i < this.input; i++) {
			let node = this.nodes[i];
			activations.push(node.activation);
			states.push(node.state);
		}

		lines.push('for(let i = 0; i < input.length; i++) A[i] = input[i];');

		/* So we don't have to use expensive .indexOf() */
		for (i = 0; i < this.nodes.length; i++) {
			this.nodes[i].index = i;
		}

		for (i = this.input; i < this.nodes.length; i++) {
			let node = this.nodes[i];
			activations.push(node.activation);
			states.push(node.state);

			let functionIdx = present.indexOf(node.squash.name);

			if (functionIdx === -1) {
				functionIdx = present.length;
				present.push(node.squash.name);
				functions.push(node.squash.toString());
			}

			const incoming = [];
			for (let j = 0; j < node.connections.in.length; j++) {
				let conn = node.connections.in[j];
				let computation = `A[${conn.from.index}] * ${conn.weight}`;

				if (conn.gater != null) {
					computation += ` * A[${conn.gater.index}]`;
				}

				incoming.push(computation);
			}

			if (node.connections.self.weight) {
				let conn = node.connections.self;
				let computation = `S[${i}] * ${conn.weight}`;

				if (conn.gater != null) {
					computation += ` * A[${conn.gater.index}]`;
				}

				incoming.push(computation);
			}

			let line1 = `S[${i}] = ${incoming.join(' + ')} + ${node.bias};`;
			let line2 = `A[${i}] = F[${functionIdx}](S[${i}])${!node.mask ? ' * ' + node.mask : ''};`;
			lines.push(line1);
			lines.push(line2);
		}

		let output = [];
		for (i = this.nodes.length - this.output; i < this.nodes.length; i++) {
			output.push(`A[${i}]`);
		}

		output = `return [${output.join(',')}];`;
		lines.push(output);

		let total = '';
		total += `let F = [${functions.toString()}];\r\n`;
		total += `let A = [${activations.toString()}];\r\n`;
		total += `let S = [${states.toString()}];\r\n`;
		total += `function activate(input){\r\n${lines.join('\r\n')}\r\n}`;

		return total;
	}

	/* Serialize to send to workers efficiently */
	serialize() {
		const activations = [];
		const states = [];
		const conns = [];
		const squashes = [
			'LOGISTIC',
			'TANH',
			'IDENTITY',
			'STEP',
			'RELU',
			'SOFTSIGN',
			'SINUSOID',
			'GAUSSIAN',
			'BENT_IDENTITY',
			'BIPOLAR',
			'BIPOLAR_SIGMOID',
			'HARD_TANH',
			'ABSOLUTE',
			'INVERSE',
			'SELU'
		];

		conns.push(this.input);
		conns.push(this.output);

		let i;
		for (i = 0; i < this.nodes.length; i++) {
			let node = this.nodes[i];
			node.index = i;
			activations.push(node.activation);
			states.push(node.state);
		}

		for (i = this.input; i < this.nodes.length; i++) {
			let node = this.nodes[i];
			conns.push(node.index);
			conns.push(node.bias);
			conns.push(squashes.indexOf(node.squash.name));

			conns.push(node.connections.self.weight);
			conns.push(node.connections.self.gater == null ? -1 : node.connections.self.gater.index);

			for (let j = 0; j < node.connections.in.length; j++) {
				let conn = node.connections.in[j];

				conns.push(conn.from.index);
				conns.push(conn.weight);
				conns.push(conn.gater == null ? -1 : conn.gater.index);
			}

			/* stop token -> next node */
			conns.push(-2);
		}

		return [activations, states, conns];
	}

	/* Convert a json object to a network */
	static fromJSON(json) {
		let network = new Network(json.input, json.output);
		network.dropout = json.dropout;
		network.nodes = [];
		network.connections = [];

		let i;
		for (i = 0; i < json.nodes.length; i++) {
			network.nodes.push(Node.fromJSON(json.nodes[i]));
		}

		for (i = 0; i < json.connections.length; i++) {
			let conn = json.connections[i];

			let connection = network.connect(network.nodes[conn.from], network.nodes[conn.to])[0];
			connection.weight = conn.weight;

			if (conn.gater != null) {
				network.gate(network.nodes[conn.gater], connection);
			}
		}

		return network;
	}

	/* Merge two networks into one */
	static merge(network1, network2) {
		/* Create a copy of the networks */
		network1 = this.fromJSON(network1.toJSON());
		network2 = this.fromJSON(network2.toJSON());

		/* Check if output and input size are the same */
		if (network1.output !== network2.input) {
			throw new Error('Output size of network1 should be the same as the input size of network2!');
		}

		/* Redirect all connections from network2 input from network1 output */
		let i;
		for (i = 0; i < network2.connections.length; i++) {
			let conn = network2.connections[i];
			if (conn.from.type === 'input') {
				let idx = network2.nodes.indexOf(conn.from);

				/* redirect */
				conn.from = network1.nodes[network1.nodes.length - 1 - idx];
			}
		}

		/* Delete input nodes of network2 */
		for (i = network2.input - 1; i >= 0; i--) {
			network2.nodes.splice(i, 1);
		}

		/* Change the node type of network1's output nodes (now hidden) */
		for (i = network1.nodes.length - network1.output; i < network1.nodes.length; i++) {
			network1.nodes[i].type = 'hidden';
		}

		/* Create one network from both networks */
		network1.connections = network1.connections.concat(network2.connections);
		network1.nodes = network1.nodes.concat(network2.nodes);

		return network1;
	}

	/* Create an offspring from two parent networks */
	static crossOver(network1, network2, equal) {
		if (network1.input !== network2.input || network1.output !== network2.output) {
			throw new Error("Networks don't have the same input/output size!");
		}

		/* Initialise offspring */
		let offspring = new Network(network1.input, network1.output);
		offspring.connections = [];
		offspring.nodes = [];

		/* Save scores and create a copy */
		let score1 = network1.score || 0;
		let score2 = network2.score || 0;

		/* Determine offspring node size */
		let size;
		if (equal || score1 === score2) {
			let max = Math.max(network1.nodes.length, network2.nodes.length);
			let min = Math.min(network1.nodes.length, network2.nodes.length);
			size = Math.floor(Math.random() * (max - min + 1) + min);
		} else if (score1 > score2) {
			size = network1.nodes.length;
		} else {
			size = network2.nodes.length;
		}

		/* Rename some variables for easier reading */
		let outputSize = network1.output;

		/* Set indexes so we don't need indexOf */
		let i;
		for (i = 0; i < network1.nodes.length; i++) {
			network1.nodes[i].index = i;
		}

		for (i = 0; i < network2.nodes.length; i++) {
			network2.nodes[i].index = i;
		}

		/* Assign nodes from parents to offspring */
		for (i = 0; i < size; i++) {
			/* Determine if an output node is needed */
			let node;
			if (i < size - outputSize) {
				let random = Math.random();
				node = random >= 0.5 ? network1.nodes[i] : network2.nodes[i];
				let other = random < 0.5 ? network1.nodes[i] : network2.nodes[i];

				if (typeof node === 'undefined' || node.type === 'output') {
					node = other;
				}
			} else {
				if (Math.random() >= 0.5) {
					node = network1.nodes[network1.nodes.length + i - size];
				} else {
					node = network2.nodes[network2.nodes.length + i - size];
				}
			}

			let newNode = new Node();
			newNode.bias = node.bias;
			newNode.squash = node.squash;
			newNode.type = node.type;

			offspring.nodes.push(newNode);
		}
		/* Create arrays of connection genes */
		let n1conns = {};
		let n2conns = {};

		/* Normal connections */
		for (i = 0; i < network1.connections.length; i++) {
			let conn = network1.connections[i];
			let data = {
				weight: conn.weight,
				from: conn.from.index,
				to: conn.to.index,
				gater: conn.gater != null ? conn.gater.index : -1
			};
			n1conns[Connection.innovationID(data.from, data.to)] = data;
		}

		/* Selfconnections */
		for (i = 0; i < network1.selfConns.length; i++) {
			let conn = network1.selfConns[i];
			let data = {
				weight: conn.weight,
				from: conn.from.index,
				to: conn.to.index,
				gater: conn.gater != null ? conn.gater.index : -1
			};
			n1conns[Connection.innovationID(data.from, data.to)] = data;
		}

		/* Normal connections */
		for (i = 0; i < network2.connections.length; i++) {
			let conn = network2.connections[i];
			let data = {
				weight: conn.weight,
				from: conn.from.index,
				to: conn.to.index,
				gater: conn.gater != null ? conn.gater.index : -1
			};
			n2conns[Connection.innovationID(data.from, data.to)] = data;
		}

		/* Selfconnections */
		for (i = 0; i < network2.selfConns.length; i++) {
			let conn = network2.selfConns[i];
			let data = {
				weight: conn.weight,
				from: conn.from.index,
				to: conn.to.index,
				gater: conn.gater != null ? conn.gater.index : -1
			};
			n2conns[Connection.innovationID(data.from, data.to)] = data;
		}

		/* Split common conn genes from disjoint or excess conn genes */
		const connections = [];
		let keys1 = Object.keys(n1conns);
		let keys2 = Object.keys(n2conns);
		for (i = keys1.length - 1; i >= 0; i--) {
			/* Common gene */
			if (typeof n2conns[keys1[i]] !== 'undefined') {
				let conn = Math.random() >= 0.5 ? n1conns[keys1[i]] : n2conns[keys1[i]];
				connections.push(conn);

				/* Because deleting is expensive, just set it to some value */
				n2conns[keys1[i]] = undefined;
			} else if (score1 >= score2 || equal) {
				connections.push(n1conns[keys1[i]]);
			}
		}

		/* Excess/disjoint gene */
		if (score2 >= score1 || equal) {
			for (i = 0; i < keys2.length; i++) {
				if (typeof n2conns[keys2[i]] !== 'undefined') {
					connections.push(n2conns[keys2[i]]);
				}
			}
		}

		/* Add common conn genes uniformly */
		for (i = 0; i < connections.length; i++) {
			let connData = connections[i];
			if (connData.to < size && connData.from < size) {
				let from = offspring.nodes[connData.from];
				let to = offspring.nodes[connData.to];
				let conn = offspring.connect(from, to)[0];

				conn.weight = connData.weight;

				if (connData.gater !== -1 && connData.gater < size) {
					offspring.gate(offspring.nodes[connData.gater], conn);
				}
			}
		}

		return offspring;
	}
};
