"use strict";

const path = require('path');

exports.pathCleanUp = function pathCleanUp(filePath) {
    return path.normalize(filePath
        .replace('/Partage/Projets', '/Volumes/Partage/Projets') // Adesias specifics
        .replace('/HDD/', '/Volumes/HDD/')
        .replace('~', process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'])
        .replace(/\%20/g, ' '))
};
