'use strict';

exports.create = function(_page, test_path) {
    var base_path = test_path.substr(0, test_path.lastIndexOf('/'));

    var _focused            = '';
    var _mouse              = require('./mouse').create(_page);
    var _keyboard           = require('./keyboard').create(_page);
    var _remote             = require('./remote').create(_page);
    var _request            = require('./request').create(_page, base_path);
    var _remember           = require('../utils/remember');
    var _fs                 = require('fs');
    var _dumps              = require('./screendumps').create(_page);


    function getCoordinates(destination) {
        // destination can be either a string containing "123, 567" or a css
        // selector
        var coordinates_rx = /(\d+), ?(\d+)/;
        var coordinates = destination.match(coordinates_rx);

        if (coordinates && coordinates.length) {
            return {
                left: parseInt(coordinates[0], 10),
                top: parseInt(coordinates[1], 10)
            };
        } else if (_remote.assertVisible(destination) === '') {
            return _remote.getCoordinate(destination);
        }

        return null;
    }


    var local = {
        open: function(url, dimensions) {
            if (url.indexOf('./') === 0) {
                url = base_path + url.substr(1);
            }

            if (dimensions) {
                local.resize(dimensions);
            } else {
                _page.viewportSize = {
                    width: 1280,
                    height: 1280
                };
            }

            _mouse.reset();
            return _page.goto(url);
        },

        back: function() {
            _page.goBack();
            return '';
        },

        forward: function() {
            _page.goForward();
            return '';
        },

        assertTitle: function(sub_title) {
            var title = _page.evaluate(function() {
                return document.title;
            });

            if (title.indexOf(sub_title) !== -1) {
                return '';
            }

            return '<' + sub_title + '> is not a substring of <' + title + '>';
        },

        assertPage: function(sub_url) {
            var url = _page.getURL();
            if (url.indexOf(sub_url) !== -1) {
                return '';
            }

            try {
                if (new RegExp(sub_url).test(url)) {
                    return '';
                }
            } catch (ex) { }

            return '<' + sub_url + '> does not match <' + url + '>';
        },

        assertUrl: function(sub_url) {
            return local.assertPage(sub_url);
        },

        assertResembles: function(orig_filename /*, selector, min_perc*/) {
            var selector;
            var min_perc = 100;

            var args = [].slice.call(arguments, 0);
            switch (args.length) {
                case 2: {
                    var parsed = parseFloat(args[1]);
                    if (isNaN(parsed)) {
                        selector = args[1];
                    } else {
                        min_perc = parsed;
                    }
                    break;
                }

                case 3: {
                    selector = args[1];
                    min_perc = parseFloat(args[2]);
                    break;
                }
            }

            var boundaries;
            if (selector) {
                boundaries = _remote.getBoundaries(selector);
            }
            var result = _dumps.compare(boundaries, orig_filename, min_perc);
            return result;
        },

        log: function(/* message */) {
            return '';
        },

        type: function(selector, text, is_replace) {
            var error = _remote.assertVisible(selector);
            if (error) return error;

            if (!text.length) {
                return '';
            }

            if (_focused !== selector) {
                if (local.click(selector)) {
                    return 'Element not focused';
                }

                if (is_replace === 'true') {
                    _remote.clearFocused();
                }
            }

            var result = _keyboard.type(text);

            // Reset focused element, as keyevent may have triggered a blur()
            if (!result) _focused = '';

            return result;
        },

        uploadFile: function(selector, filename) {
            var error = _remote.assertVisible(selector) || _remote.assertIsA(selector, ':file');
            if (error) return error;

            if (!filename.length) {
                return 'No filename specified for uploadFile';
            }

            var filepath = base_path + _fs.separator + filename;
            var file_exists = _fs.isReadable(filepath) && _fs.isFile(filepath);

            if (!file_exists) {
                return 'Cannot upload unreadable file <' + filepath + '>';
            }

            _page.uploadFile(selector, filepath);
            return '';
        },

        click: function(destination) {
            var center = getCoordinates(destination);
            if (!center) return 'No coordinates for element';

            if (_mouse.sendEvent('click', center.left, center.top)) {
                _focused = destination;
                return '';
            }
            return 'Mouse not over element';
        },

        moveMouseTo: function(destination) {
            var center = getCoordinates(destination);
            if (!center) return 'No coordinates for element';

            if (_mouse.sendEvent('mousemove', center.left, center.top)) {
                return '';
            }
            return 'Mouse not over element';
        },

        dblclick: function(destination) {
            var center = getCoordinates(destination);
            if (!center) return 'No coordinates for element';

            if (_mouse.sendEvent('doubleclick', center.left, center.top)) {
                _focused = destination;
                return '';
            }
            return 'Mouse not over element';
        },

        resize: function(dimensions) {
            var widthxheight = /^(\d+)x(\d+)$/;
            var matches;
            try {
                matches = dimensions.match(widthxheight);
            } catch (ex) { }

            if (matches && matches.length === 3) {
                _page.viewportSize = {
                    width: parseInt(matches[1], 10),
                    height: parseInt(matches[2], 10)
                };
                return '';
            }

            return 'Resize dimensions could not be parsed';

        },

        screendump: function(filename, selector) {
            var boundaries;
            if (selector) {
                boundaries = _remote.getBoundaries(selector);
                if (!boundaries) {
                    return 'Could not determine boundaries for <' + selector + '>';
                }
            }
            _dumps.dump(filename, boundaries);
            return '';
        },

        set: function(name, value) {
            _page.set(name, value);
            return '';
        },

        remember: function(selector, variable_name) {
            var error = _remote.assertVisible(selector);
            if (error) return error;

            var value_or_text = _remote.getValueOrText(selector);
            _remember.set(variable_name, value_or_text);

            return '';
        },

        mockRequest: function(pattern, mock_path) {
            return _request.addMock(pattern, mock_path);
        },

        unmockRequest: function(/* pattern, mock_path */) {
            return _request.removeMock.apply(_request, arguments);
        }
    };

    return {
        getHandler: function(type) {
            return local[type] || _remote[type];
        }
    };

};
