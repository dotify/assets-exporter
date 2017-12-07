"use strict";

const {round} = require('./round');

/**
 * Convert a value to percents
 * @param {number} value
 * @param {number} reference
 * @return {number}
 */
exports.toPercent = function toPercent(value, reference) {
    return round(value / reference * 100);
};
