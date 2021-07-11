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
				/* Has no effect on input node, so they are excluded */
				let index = Math.floor(Math.random() * (this.nodes.length - this.input) + this.input);
				let node = this.nodes[index];
				node.mutate(method);
				break;
			}
		}
	}
}
