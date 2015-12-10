/* global ScoutClient */
'use strict';

exports.create = function(_page) {

    /**
     * Generic wrapper for in-page assertions and actions
     */
    function getRemoteHandler(type /*, args */) {
        return function() {
            // type = 'assertText'
            // args = ['.selector', 'Some text']
            var args = [].slice.call(arguments, 0);

            // args = ['assertText', '.selector', 'Some text']
            args.unshift(type);

            var remoteAssert = function(/* type, selector, args */) {
                var type = arguments[0];
                var selector = arguments[1];
                var args = [].slice.call(arguments, 2);

                return ScoutClient.run(type, selector, args);
            };

            // args = [remoteAssert, 'assertText', '.selector', 'Some text']
            args.unshift(remoteAssert);

            return _page.evaluate.apply(_page, args);
        };
    }

    var handlers = {};

    // All these asserts and actions are defined in lib/client.js and executed
    // in the context of the webpage
    [
        // 'displayActionData',
        'assertText',
        'assertExists',
        'assertIsA',
        'assertVisible',
        'assertHidden',
        'assertEmpty',
        'assertNotEmpty',
        'assertLength',
        'assertMinLength',
        'assertMaxLength',
        'assertValue',
        'assertHasClass',
        'assertNotHasClass',
        'assertDisabled',
        'choose',
        'getCoordinate',
        'getIframeDocumentOffset',
        'getBoundaries',
        'assertInViewport',
        'assertNotInViewport',
        'getValueOrText',
        'clearFocused'
        //'getViewPort'
    ].forEach(function(type) {
        handlers[type] = getRemoteHandler(type);
    });

    return handlers;
};
