(function initialize(scope) {

	var isModule = false;

	// Export with CommonJS
	if (typeof module !== 'undefined' && typeof require !== 'undefined') {
		isModule = true;
	}

	if (typeof clearTimeout !== 'function' ){
		var clearTimeout = function(){};
		var setTimeout = function(){};
	}

	var options = {
		timeout: 500,
		callbackMode: false
	};

	function outputDOM(data) {
		String.prototype.color = function(color) {
			return '<span style="color:'+color+
			       ';font-weight:bold;">'+this+"</span>";
		};
		document.body.innerHTML = "<pre>"+getOutput(data)+"</pre>";
	}

	function outputConsole(data, options) {

		require('string-color');

		console.log(getOutput(data));

		process.exit(data.total-data.passed);

	}

	function outputMongoConsole(data, options){
		String.prototype.color = function() {
			if (!arguments) return this;
			var colors;
			if (arguments.length==1 && typeof(colors)=="string") colors = [arguments[i]];
			colors = arguments;
			var code = '';
			for (var i = 0;i<colors.length;i++) code+=ANSI.get(colors[i]);
			return code+this+ANSI.get('reset');
		};

		//ANSI color and style codes.
		var ANSI = {

			'prefix'    : "\u001B[",
			'suffix'    : "m",

			//Styles

			'reset'     :  0,
			'bold'      :  1,
			'/bold'     : 22,
			'italic'    :  3,
			'/italic'   : 23,
			'underline' :  4,
			'/underline': 24,
			'conceal'   :  8,
			'strike'    :  9,
			'/strike'   : 29,
			'reverse'   :  7,
			'blink'     :  5,
			'blink2'    :  6,

			//Colors

			'black'     : 30,
			'red'       : 31,
			'green'     : 32,
			'yellow'    : 33,
			'blue'      : 34,
			'purple'    : 35,
			'cyan'      : 36,
			'white'     : 37,
			'default'   : 39,

			//Backgrounds

			'bgblack'   : 40,
			'bgred'     : 41,
			'bggreen'   : 42,
			'bgyellow'  : 43,
			'bgblue'    : 44,
			'bgpurple'  : 45,
			'bgcyan'    : 46,
			'bgwhite'   : 47,
			'bgdefault' : 49,

			'get': function(color) {
				code = this[color];
				if (code===false) return 0;
				return this.prefix+code+this.suffix;
			}

		};

		print(getOutput(data));
	}

	function getOutput(data) {

		var output = "";

		for (var k in data.errors) {
			output += k.color('red')+"\n";
			output += (data.errors[k].stack || data.errors[k])+"\n";
		}

		if (data.passed!==data.total) output += "FAILED".color('red');
		else output += "PASSED".color('green');
		output += ": "+data.passed+" passed / "+data.total+" tests";

		return output;

	}

	function expect(subject, expected, callback, options) {
		options = options || {};
		if (subject && subject.then && options.callbackMode == "promises") {
			subject.then(function(data) {
				expect(data, expected, callback, options);
			}, callback);
		}
		if (expected===undefined) {
			expected = subject;
			subject  = null;
			return function(response,data) {
				if (options.callbackMode=='node') {
					if (response) {
						return callback(response);
					} else response = data;
				}
				expect(response, expected, callback, options);
			};
		}  else {
			if (subject&&subject.message) callback(subject);
			else if ((typeof deepEqual === "function" ? deepEqual(subject, expected) : subject == expected)||options.getError) callback(null);
			else callback(new Error("Expected "+expected+" but got "+subject));
		}
	}

	function runTest(fun, callback, options) {

		var done, timer, errorExpected;

		function respond(e, result) {
			if (done) return;
			done = true;
			if (errorExpected) {
				e = e.message || e;
				if (e && errorExpected == e) {
					e = null;
				} else {
					e = new Error("Expected error '"+errorExpected+"' but got "+e);
				}
			}
			callback(e, result);
			clearTimeout(timer);
		}

		try {
			let error = [];
			let result = fun.call({
				expect: function(a,b) {
					return expect(a, b, e => e ? error.push(e) : null, options);
				},
				expectError: function(a,b) {
					options.getError = true;
					errorExpected = b || a;
					return expect(a, b, respond, options);
				}
			});
			respond(error.length === 0 ? null : error.length === 1 ? error[0] : error, result)
		} catch (e) {
			respond(e);
			clearTimeout(timer);
		}

		var error = new Error("Test timeout after "+options.timeout+"ms");
		timer = setTimeout(function() {
			respond(error);
		}, options.timeout);

	}

	function Group(name, tests, config) {
		this.options = {};
		for (var k in options) this.options[k] = options[k];
		for (k in config) this.options[k] = config[k];
		this.tests = tests;
	}

	Group.prototype.execute = function(callback) {

		var pending = 0, results = {}, my = this, errors = {},
		    total   = 0, passed = 0,
		    hooks   = {beforeEach:0, beforeAll:0, afterEach:0, afterAll:0};

		for (var name in this.tests) {
			if (hooks[name]!==undefined) hooks[name] = this.tests[name];
			else if (this.tests.hasOwnProperty(name)) pending++;
		}

		if (hooks.beforeAll) hooks.beforeAll();
		for (name in this.tests) {
			if (hooks[name]!==undefined) continue;
			if (this.tests.hasOwnProperty(name)) (function(name){
				if (hooks.beforeEach) hooks.beforeEach();
				var returned = false;
				total++;
				runTest(my.tests[name], function(error, result) {
					if (returned) {
						results[name] = new Error("Duplicate callback");
						return;
					}
					returned = true;
					pending--;
					results[name] = error || result || null;
					if (error === null) passed++;
					else {
						errors[name] = error;
					}
					if (pending===0) {
						callback({
							total: total,
							passed: passed,
							results: results,
							errors: errors
						});
					}
				}, my.options);
			}(name));
			if (hooks.afterEach) hooks.afterEach();
		}
		if (hooks.afterAll) hooks.afterAll();

	};

	var results = {}, pendingGroups = 0, resultCallbacks = [];

	results.total   = 0;
	results.passed  = 0;
	results.errors  = {};
	results.results = {};

	function describe(name, tests, config) {
		pendingGroups++;
		new Group(name, tests, config).execute(function(data) {
			results.results[name] = data;
			results.total  += data.total;
			results.passed += data.passed;
			for (var k in data.errors) {
				results.errors[name+'#'+k] = data.errors[k];
			}
			pendingGroups--;
			if (pendingGroups===0) {
				var next = resultCallbacks.shift();
				while (next) {
					next(results);
					next = resultCallbacks.shift();
				}
			}
		});
	}

	describe.config = function(k,v) {
		if (v) options[k] = v;
		return options[k] || false;
	};

	describe.getResults = function(cb) {
		if (pendingGroups===0) cb(results);
		else resultCallbacks[resultCallbacks.length] = cb;
	};

	describe.logResults = function() {
		describe.getResults(function(data) {
			if (typeof window !== "undefined") outputDOM(data, options);
			else if (typeof Mongo !== "undefined") outputMongoConsole(data, options);
			else outputConsole(data, options);
		});
	};

	// allow to make other describe instances
	describe.new = function() {
		return initialize();
	};

	if (!scope) {
		return describe;
	}

	if (isModule) module.exports = describe;
	else scope.describe = describe;

}(this));
