const NeatML = {
	architect: require('./architecture/architect'),
	Neat: require('./neat'),
	Network: require('./architecture/network'),
	Connection: require('./architecture/connection'),
	Layer: require('./architecture/layer'),
	Group: require('./architecture/group'),
	Node: require('./architecture/node'),
	methods: require('./methods/methods'),
	config: require('./config'),
	multi: require('./multithreading/multi')
};

/* CommonJS & AMD */
/* eslint-disable no-undef */
if (typeof define !== 'undefined' && define.amd) {
	define([], function () {
		return NeatML;
	});
}
/* eslint-enable no-undef */

/* Node.js */
if (typeof module !== 'undefined' && module.exports) {
	module.exports = NeatML;
}

/* Browser */
if (typeof window === 'object') {
	(function () {
		var old = window['neatml'];
		NeatML.ninja = function () {
			window['neatml'] = old;
			return NeatML;
		};
	})();

	window['neatml'] = NeatML;
}
