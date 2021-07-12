const NeatML = {
	architect: require('./architecture/architect'),
	Network: require('./architecture/network'),
	Neat: require('./neat'),
	methods: require('./methods/methods'),
	Connection: require('./architecture/connection'),
	Group: require('./architecture/group'),
	config: require('./config'),
	Layer: require('./architecture/layer'),
	Node: require('./architecture/node'),
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
