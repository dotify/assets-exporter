"use strict";

/**
 * Convert [R, G, B] to rgb() for CSS use
 * @param colors
 */
exports.convertBgColorToRGB = function convertBgColorToRGB(colors) {
    colors = colors.map(c => parseInt(c * 255));
    return `rgb(${colors[0]}, ${colors[1]}, ${colors[2]})`;
};
