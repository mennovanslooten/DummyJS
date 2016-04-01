'use strict';

var _fs = require('fs');
var _cli = require('../utils/cli');
var _remember = require('../utils/remember');
//var _logger = require('../logger/logger');

exports.create = function(path) {
    var _page               = require('./page').create();
    var _handlers           = require('./handlers').create(_page, path);
    var _ignore_list        = ['log', 'htmldump', 'screendump', 'mockRequest', 'unmockRequest'];


    function parseArguments(args) {
        return args.map(function(arg) {
            var result;
            var variable = /{([a-z_]+)}/g;
            var generator = /{{([^}]+)}}/g;

            if (generator.test(arg)) {
                result = arg.replace(generator, function(whatever, match) {
                    var props = match.split(':');
                    var variable_name = '';
                    var length = 0;
                    var chars = '';

                    props.forEach(function(prop) {
                        if (/^[a-z_]+$/.test(prop)) {
                            variable_name = prop;
                        } else if (/^\d+$/.test(prop)) {
                            length = parseInt(prop, 10);
                        } else if (/^".+"$/.test(prop)) {
                            chars = prop;
                        }
                    });

                    if (!length) {
                        return match;
                    }

                    var random = generateRandomString(length, chars);
                    if (variable_name) {
                        _remember.set(variable_name, random);
                    }
                    return random;
                });

                return result;
            }

            if (variable.test(arg)) {
                // Strings of this form:
                // {variable_name}
                // will be replaced with the value of _remember.get(variable_name)
                // if it exists
                result = arg.replace(variable, function(match, variable_name) {
                    return _remember.get(variable_name) || _cli[variable_name] || variable_name;
                });
                return result;
            }

            return arg;
        });
    }


    function generateRandomString(length, chars) {
        chars = chars || 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-.0123456789'.split('');
        length = parseInt(length, 10);
        var generated = '';
        for (var i = 0; i < length; i++) {
            generated += chars[Math.floor(Math.random() * chars.length)];
        }
        return generated;
    }


    /**
     * Execute conditionCallback() repeatedly until it returns an empty string
     * ("" = no error), then call passCallback. If conditionCallback does not
     * return "" within a given time, call failCallback
     */
    function waitFor(action_data, conditionCallback, passCallback, skipCallback, failCallback, remaining_time) {
        if (remaining_time < 0) {
            failCallback(action_data.message);
            return;
        }

        var d1 = new Date();
        var is_passed = false;

        action_data.tries++;

        if (!_page.is_loading && _page.is_loaded) {
            var is_reload_action = ['open', 'back', 'forward'].indexOf(action_data.type) > -1;

            if (is_reload_action) {
                if (action_data.tries === 1) {
                    //_logger.comment('waitFor: RELOAD START', action_data.type);
                    action_data.message = conditionCallback();
                } else {
                    //_logger.comment('waitFor: RELOAD DONE', action_data.type);
                    action_data.message = '';
                    is_passed = true;
                }
            } else if (action_data.message === '') {
                //_logger.comment('waitFor: ACTION DONE', action_data.type);
                is_passed = true;
            } else {
                //_logger.comment('waitFor: ACTION START', action_data.type);
                action_data.message = conditionCallback();
            }
        }

        if (is_passed) {
            passCallback();
        } else if (action_data.optional) {
            // If it didn't pass but is optional skip it
            skipCallback(action_data.message);
        } else {
            // otherwise schedule another try
            setTimeout(function() {
                var d2 = new Date();
                var elapsed = d2 - d1;
                remaining_time -= elapsed;

                waitFor(action_data, conditionCallback, passCallback, skipCallback, failCallback, remaining_time);
            }, _cli.step);
        }
    }


    return {
        close: function() {
            _page.close();
        },


        failDump: function(action_data, test_data) {
            if (_cli.faildump) {
                var title = 'faildump__' + test_data.path.replace(/\.?\//g, '_');
                if (typeof _cli.faildump === 'string') {
                    title = _cli.faildump + _fs.separator + title;
                }
                _page.dump(title, null, action_data);
            }
        },


        passDump: function(action_data, test_data) {
            var ignore = _ignore_list.indexOf(action_data.type) > -1;
            if (_cli.passdump && !ignore) {
                var title = 'passdump__' + test_data.path.replace(/\.?\//g, '_');
                title += '__' + new Date().valueOf();
                if (typeof _cli.passdump === 'string') {
                    title = _cli.passdump + _fs.separator + title;
                }
                _page.dump(title, null, action_data);
            }
        },


        runAction: function(action_data, passCallback, skipCallback, failCallback) {
            var handler = _handlers.getHandler(action_data.type);
            action_data.args = parseArguments(action_data.args);
            action_data.tries = 0;
            action_data.start_time = new Date();

            if (handler) {
                waitFor(
                    action_data,

                    // Keep executing until it returns ""
                    function() {
                        return handler.apply(null, action_data.args);
                    },

                    // Run when "" is returned
                    function() {
                        action_data.message = '';
                        action_data.end_time = new Date();
                        passCallback(action_data);
                    },

                    // Or run this when the action is skipped
                    function(result) {
                        action_data.message = result;
                        skipCallback(action_data);
                    },

                    // Or run this after timeout is reached...
                    function(result) {
                        action_data.message = result;
                        failCallback(action_data);
                    },

                    // ...which is this long:
                    _cli.timeout);
            } else {
                action_data.message = 'Unknown action: <' + action_data.type + '>';
                failCallback(action_data);
            }
        }

    };
};
