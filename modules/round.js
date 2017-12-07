"use strict";

/**
 * Round a number
 *
 * @param number
 * @param precision
 */
exports.round = function round(number, precision = 2) {
    number = parseFloat(number);

    if (isNaN(number)) return 0;

    return Math.round(number * Math.pow(10, precision)) / Math.pow(10, precision);
};
