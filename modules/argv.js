"use strict";

const _ = require('lodash');

let argv = {
    parse(allowedArgs = {}, args = null) {
        const keys = Object.keys(allowedArgs);
        let list = {};

        args = args || process.argv;

        for (let i = 2; i < args.length; i++) {
            let parts = args[i].split('=');

            // validate argument
            if (!parts[0] || -1 === keys.indexOf(parts[0])) continue;

            // validate value
            if (!parts[1] || parts[1] == '') continue;

            // enum of allowedValues is tested too
            if (Array.isArray(allowedArgs[parts[0]]) && -1 == allowedArgs[parts[0]].indexOf(parts[1])) continue;

            // test with a regular expression
            if (_.isString(allowedArgs[parts[0]]) && false === new RegExp(allowedArgs[parts[0]]).test(parts[1])) continue;

            // add the argument
            list[parts[0]] = parts[1];
        }

        return list;
    }
};

exports.argv = argv;
