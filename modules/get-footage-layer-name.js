"use strict";

const {slugify} = require('./slugify');

exports.getFootageLayerName = function getFootageLayerName(items, name) {
    let found = null;

    name = slugify(name.split('/')[0]);

    items.filter(item => {
        if (-1 === item.name.indexOf('.psd')) return false;
        let parts = item.name.split('/'),
            foundName = slugify(parts[0]);

        if (name === foundName) {
            found = foundName;
        }
    });

    return found;
};
