var Config = require('bower-config');
var Q = require('q');
var path = require('path');
var mout = require('mout');
var cmd = require('../util/cmd');

var orderedByDependencies = function (packages, installed, json) {
	packages = mout.object.mixIn({}, packages); //clone
	var ordered = [];
	installed = mout.object.keys(installed);

	var depsSatisfied = function (module) {
		var satisfied = true;
		mout.object.keys(module.dependencies).forEach(function (dep) {
			satisfied = satisfied ? mout.array.contains(installed, dep) || mout.array.contains(ordered, dep) : false;
		});
		return satisfied;
	};

	if (json && json.dependencies) {
		//attempt to order the dependencies how they're ordered in bower.json
		mout.object.keys(json.dependencies).forEach(function (dep) {
			//if its being installed
			if (packages[dep] && depsSatisfied(packages[dep])) {
				ordered.push(dep);
				delete packages[dep];
			}
		});
	}

	//now loop over the incoming again and order them by dependency needs
	//keepGoing tells us that we processed at least one package so there's a reason
	//to loop again (so we dont somehow end in an infinite loop)
	var keepGoing = true;
	while (keepGoing) {
		keepGoing = false;
		mout.object.forOwn(packages, function (val, key) {
			if (depsSatisfied(val)) {
				ordered.push(key);
				delete packages[key];
				keepGoing = true;
			}
		});
	}

	//if we have anything left because of some weird dependency circular type issue then
	//just add the rest to the end
	mout.object.forOwn(packages, function (val, key) {
		ordered.push(key);
	});

	return ordered;
};

var run = function (cmdString, action, logger, config) {
	logger.action(action, cmdString);

	var args = cmdString.split(' ');
	var cmdName = args[0];
	mout.array.remove(args, cmdName); //no rest() in mout

	var options = {
		cwd: config.cwd,
		//pass env + bower_pid so callees can identify a preinstall+postinstall from the same bower instance
		env: mout.object.mixIn({ 'bower_pid': process.pid }, process.env)
	};

	var promise = cmd(cmdName, args, options);

	promise.progress(function (progress) {
		progress.split('\n').forEach(function (line) {
			if (line) {
				logger.action(action, line);
			}
		});
	});

	return promise;
};

var hook = function (action, ordered, config, logger, packages, installed, json) {
	var orderedPackages = ordered ? orderedByDependencies(packages, installed, json) : mout.object.keys(packages);
	var packageNames = orderedPackages.join(' ');
	var componentsDir = path.join(config.cwd, config.directory);
    var promise = Q();

	var _addPromise = function (config, meta, action, names, logger) {
		if (meta && meta.scripts && meta.scripts[action]) {
			var commands = meta.scripts[action];
			if (!Array.isArray(commands)) {
				commands = [commands];
			}

			commands.forEach(function(cmd) {
				var cmdString = mout.string.replace(cmd, '%', names);
				// run commands in sequence rather than in parallel
				promise = promise.then(function() {
					return run(cmdString, action, logger, config);
				});
			});
		}
	};

	var flattened = mout.object.mixIn({}, installed, packages);
	Object.keys(flattened).forEach(function (name) {
		var pkgPath = path.join(componentsDir, name);
		_addPromise(Config.read(pkgPath), flattened[name].pkgMeta, action, packageNames, logger);
	});

    _addPromise(config, json, action, packageNames, logger);

    return promise;
};

module.exports = {
	preuninstall: mout.function.partial(hook, 'preuninstall', false),
	preinstall: mout.function.partial(hook, 'preinstall', true),
	postinstall: mout.function.partial(hook, 'postinstall', true)
};
