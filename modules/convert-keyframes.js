"use strict";

const {round} = require('./round');

/**
 * Convert keyframes to seconds format
 *
 * key
 * 0: time
 * 1: value / values
 * 2: options
 *
 * @param {Array} kf
 * @param {Array} keys
 * @param {Function} filter
 */
exports.convertKeyframes = function convertKeyframes(kf, keys = [], filter = null) {
    filter = filter || function (v) {
            return v;
        };

    let timeAdjustment = 0.02,
        list = [],
        previousTime = 0;
    kf.forEach((key, keyIndex, arr) => {
        let out = {
            time: key[0] > 0 ? round(parseFloat(key[0]) + timeAdjustment, 5) : 0
        };

        // move the keyframe time by the duration time
        // as TimelineMax.to is diff from real keyframes
        // and animates from the previous position
        let duration = round(out.time - previousTime);

        previousTime = out.time;

        out.time = round(out.time - duration);
        out.duration = duration;

        // // set the animation duration between keyframes
        // if (arr.length > 0 && keyIndex > 0) {
        //     out.duration = round(out.time - parseFloat(arr[keyIndex - 1][0]));
        // }
        //
        // out.time = out.time - out.duration || 0;
        //
        // console.log(">", out.time, out.duration);

        // When key[1] is an Array, we try to map
        // the tinyPngKeys' names or use the index
        if (Array.isArray(key[1])) {
            keys.map((k, i) => {
                out[k] = filter(key[1][i]);
            });
        } else {
            out.value = filter(key[1]);
        }

        list.push(out);
    });

    return list;
};
