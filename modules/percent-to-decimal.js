"use strict";

const {round} = require('./round');

/**
 * Convert a % number to decimal
 * e.g. 50% = 0.5
 *
 * @param number
 * @return {*}
 */
exports.percentToDecimal = function percentToDecimal(number) {
    return round(parseFloat(number) / 100);
};
