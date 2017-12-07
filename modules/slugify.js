"use strict";

/**
 * Clean up strings
 *
 * @param str
 * @return {string}
 */
exports.slugify = function slugify(str) {
    str = str.replace(/^\s+|\s+$/g, ''); // trim
    str = str.toLowerCase();

    // remove accents
    // const from = "àáäâèéëêìíïîòóöôùúüûñç";
    // const to = "aaaaeeeeiiiioooouuuunc";
    // for (let i = 0, l = from.length; i < l; i++) {
    //     str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    // }

    return str
        .replace(/\s+/g, '_') // collapse whitespace and replace by _
        .replace(/-+/g, '_') // collapse dashes
        .replace(/[^a-z0-9-_\.]/g, '') // remove invalid chars
        .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''); // remove weird chars from beginning and end
};
