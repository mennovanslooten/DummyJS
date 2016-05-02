'use strict';

/**
 * The mouse is a virtual construct in PhantomJS: you can send events to
 * arbitrary coordinates on the page. This utility simulates a mouse pointer,
 * keeps track of its (virtual) position and simulates movement between
 * positions when triggering events.
 */
exports.create = function(_page) {
    // Contains the current (x, y) position of the mouse pointer
    var _is_moving = false;
    var _mouse_x = 0;
    var _mouse_y = 0;
    var _timeout;
    var _mouse = {};


    /**
     * Send the mouseevent "type" to the current mouse position
     */
    function sendEvent(type) {
        // _mouse_x and _mouse_y are relative to the top left of the document
        // sendEvent() is relative to the top left corner of the viewport
        var real_x = _mouse_x - _page.scrollPosition.left;
        var real_y = _mouse_y - _page.scrollPosition.top;
        _page.sendEvent(type, real_x, real_y);
    }


    /**
     * Scroll the page so (x, y) is in view if it isn't already
     * x and y are relative to the document
     */
    function scrollIntoView(x, y) {
        var top = _page.scrollPosition.top;
        var left = _page.scrollPosition.left;
        var height = _page.viewportSize.height;
        var width = _page.viewportSize.width;
        var doc = _page.evaluate(function() {
            return {
                width: document.body.scrollWidth,
                height: document.body.scrollHeight
            };
        });

        var is_y_in_viewport = y >= top && y <= top + height;
        var is_x_in_viewport = x >= left && x <= left + width;

        var scroll_top;
        var scroll_left;
        if (!is_y_in_viewport) {
            scroll_top = Math.max(0, y - Math.round(height / 2));
            scroll_top = Math.min(scroll_top, doc.height - height);
        }

        if (!is_x_in_viewport) {
            scroll_left = Math.max(0, x - Math.round(width / 2));
            scroll_left = Math.min(scroll_left, doc.width - width);
        }

        // Scroll (x, y) into view
        if (!is_y_in_viewport || !is_x_in_viewport) {
            _page.scrollPosition = {
                top: scroll_top,
                left: scroll_left
            };

            _mouse_y += (scroll_top - top);
            _mouse_x += (scroll_left - left);
        }
    }


    /**
     * Trigger a series of timeout-separated mousemove events towards (x, y)
     * x and y are relative to the document
     */
    function moveTo(x, y) {
        if (isHovering(x, y)) {
            _is_moving = false;
            return;
        }

        moveTowards(x, y);

        // If another mousemove was scheduled, it should be canceled
        clearTimeout(_timeout);
        _timeout = setTimeout(moveTo, 15, x, y);
    }



    /**
     * Move the mouse a step in the direction of (x, y)
     * x and y are relative to the document
     */
    function moveTowards(x, y) {
        // Move the mouse a step into the direction of (x, y)
        //var mouse_step = (12500 / _cli.timeout) * _cli.step;
        var mouse_step = 100;
        var delta_x = x - _mouse_x;
        var delta_y = y - _mouse_y;

        if (delta_x > mouse_step) {
            _mouse_x += mouse_step;
        } else if (delta_x < mouse_step * -1) {
            _mouse_x -= mouse_step;
        } else {
            _mouse_x = x;
        }

        if (delta_y > mouse_step) {
            _mouse_y += mouse_step;
        } else if (delta_y < mouse_step * -1) {
            _mouse_y -= mouse_step;
        } else {
            _mouse_y = y;
        }

        sendEvent('mousemove');
    }


    /**
     * Is the current mouse position (x, y)?
     */
    function isHovering(x, y) {
        var result = (x === _mouse_x && y === _mouse_y);
        //console.log(' >> isHovering', x, ',', y, ' -- ', _mouse_x, ', ', _mouse_y, result);
        return result;
    }


    /**
     * Update the scroll coordinates and move the mouse to the top left corner
     */
    _mouse.reset = function() {
        if (!_page.url) return;

        var scroll = _page.evaluate(function() {
            return {
                top: window.scrollY,
                left: window.scrollX
            };
        });

        _page.scrollPosition = {
            top: scroll.top,
            left: scroll.left
        };

        _mouse_x = scroll.left;
        _mouse_y = scroll.top;
    };


    /**
     * Trigger event "type" at (x, y) if the mouse is there or
     * start moving the mouse in that direction
     */
    _mouse.sendEvent = function(type, x, y) {
        if (_is_moving) return false;

        if (isHovering(x, y)) {
            sendEvent(type);
            return true;
        }

        _is_moving = true;
        scrollIntoView(x, y);
        moveTo(x, y);
        return false;
    };

    return _mouse;
};
