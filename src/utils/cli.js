'use strict';

var _system = require('system');

// Default options
var options = {
    version: false,
    compare: false,
    color: false,
    reformat: false,
    debug: false,
    faildump: '',
    passdump: '',
    timeout: 5000,
    step: 10,
    parallel: 1,
    silent: false,
    newdumps: false,
    xunit: '',
    files: []
};


// The first arg is the path to scout.js
var args = _system.args.slice(1);
args.forEach(function(arg) {
    var bool_matches = arg.match(/^--(\w+)$/);
    var value_matches = arg.match(/^--(\w+)=([^ ]+)$/);

    if (value_matches && value_matches.length === 3) {
        // Translate --optionName=value args to options.optionName = value;
        // Convert to int if possible
        var num_val = parseInt(value_matches[2], 10);
        options[value_matches[1]] = isNaN(num_val) ? value_matches[2] : num_val;
    } else if (bool_matches && bool_matches.length) {
        // Translate --optionName args to options.optionName = true;
        options[bool_matches[1]] = true;
    } else {
        // Anything else is a file/directory
        options.files.push(arg);
    }
});

module.exports = options;
