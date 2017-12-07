"use strict";

const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const aeToJSON = require('ae-to-json/after-effects');
const ae = require('after-effects');
const beautify = require('js-beautify');
const mkdirp = require('mkdirp');
const {ncp} = require('ncp');
const yaml = require('js-yaml');

const {argv} = require('./modules/argv');
const {slugify} = require('./modules/slugify');
const {round} = require('./modules/round');
const {percentToDecimal} = require('./modules/percent-to-decimal');
const {toPercent} = require('./modules/to-percent');
const {convertKeyframes} = require('./modules/convert-keyframes');
const {convertBgColorToRGB} = require('./modules/convert-bg-to-rgb');
const {pathCleanUp} = require('./modules/path-cleanup');
const {getFootageLayerName} = require('./modules/get-footage-layer-name');

const args = argv.parse({
    'module': '[0-9]+',
    'scene': '[0-9]+',
    'dump': 'true',
    'force': 'true',
});

args.module = parseInt(args.module, 10);
args.scene = parseInt(args.scene, 10);

// build file name
let sceneId = args.scene ? formatSceneNumber(args.scene) : 999,
    slideName = `safran_m${args.module}_slide${sceneId}`,
    shortName = `m${args.module}s${sceneId}`,
    jsonFile = `${slideName}.json`;

// load config
const config = yaml.safeLoad(fs.readFileSync(path.normalize(__dirname + '/../_config_scenes.yml')));
const sceneConfig = config && config[shortName] ? config[shortName] : null;

console.log("Exporting to", jsonFile, "\n");

// define the folders
let folders = {root: path.dirname(__dirname)};
folders.dest = path.normalize(`${folders.root}/src/_animations/module-${args.module}/scene-${sceneId}`);
folders.sounds = path.normalize(`${folders.root}/src/_animations/module-${args.module}/scene-${sceneId}/sounds`);
folders.videos = path.normalize(`${folders.root}/src/_animations/module-${args.module}/scene-${sceneId}/videos`);
folders.jekyll = path.normalize(`${folders.root}/src/module_${args.module}/scene-${sceneId}`);
folders.jekyllViews = path.normalize(`${folders.root}/src/module_${args.module}/views`);
folders.webpack = path.normalize(`${folders.root}/src/_webpack`);
folders.qcm = path.normalize(`${folders.root}/src/_webpack/qcm`);

// global footage list
let footage = [];

// dump file if --dump=true or file doesn't exist
createAllFolders(folders)
    .then(() => {
        if (args.dump || !fs.existsSync(`${folders.dest}/${jsonFile}`)) {
            ae.execute(getCompositionMarkers)
                .then(dumpAeProject)
                .then(readFile)
                .then(mapCompositions)
                .catch(console.log);
        } else {
            readFile(`${folders.dest}/${jsonFile}`)
                .then(mapCompositions)
                .catch(console.log);
        }
    });

function formatSceneNumber(num) {
    num = parseInt(num, 10);
    if (num < 10) {
        return '00' + num;
    }
    if (num < 100) {
        return '0' + num;
    }

    return num;
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        fs.readFile(file, {encoding: "utf-8"}, (err, data) => {
            if (err) return reject(err);
            resolve(data);
        });
    });
}

function createAllFolders(folders) {
    let promises = [];
    [
        folders.dest,
        folders.jekyll,
        folders.jekyllViews,
    ].map(folder => {
        promises.push(new Promise((resolve, reject) => {
            mkdirp(folder, err => err ? reject(err) : resolve());
        }));
    });

    return Promise.all(promises);
}

function getCompositionMarkers() {
    // fix missing JSON
    var JSON = JSON || {};
    (function () {
        /** Format integers to have at least two digits. @param {number} n @return {number} */ function f(n) {
            return n < 10 ? '0' + n : n;
        }

        /* JSON polyfills*/
        if (typeof Date.prototype.toJSON !== 'function') {
            Date.prototype.toJSON = function () {
                return isFinite(this.valueOf()) ? this.getUTCFullYear() + '-' + f(this.getUTCMonth() + 1) + '-' + f(this.getUTCDate()) + 'T' + f(this.getUTCHours()) + ':' + f(this.getUTCMinutes()) + ':' + f(this.getUTCSeconds()) + 'Z' : null;
            };
            String.prototype.toJSON = Number.prototype.toJSON = Boolean.prototype.toJSON = function () {
                return this.valueOf();
            };
        }
        var cx, escapable, gap, indent, meta, rep;

        /** Wrap with quotes If the string contains no control characters, no quote characters, and no backslash characters, then we can safely slap some quotes around it. Otherwise we must also replace the offending characters with safe escape sequences. @param {string} string @return {string} */ function quote(string) {
            escapable.lastIndex = 0;
            return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
                    var c = meta[a];
                    return typeof c === 'string' ? c : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                }) + '"' : '"' + string + '"';
        }

        /** Produce a string from holder[key] @param key @param holder */ function str(key, holder) {
            var i, /* The loop counter.*/ k, /* The member key.*/ v, /* The member value.*/ length, mind = gap, partial,
                value = holder[key];
            /* If the value has a toJSON method, call it to obtain a replacement value.*/
            if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
                value = value.toJSON(key);
            }
            /* If we were called with a replacer function, then call the replacer to obtain a replacement value.*/
            if (typeof rep === 'function') {
                value = rep.call(holder, key, value);
            }
            /* What happens next depends on the value's type.*/
            switch (typeof value) {
                case 'string':
                    return quote(value); /* JSON numbers must be finite. Encode non-finite numbers as null.*/
                case 'number':
                    return isFinite(value) ? String(value) : 'null'; /* If the value is a boolean or null, convert it to a string. Note: typeof null does not produce 'null'. The case is included here in the remote chance that this gets fixed someday.*/
                case 'boolean':
                case 'null':
                    return String(value); /* If the type is 'object', we might be dealing with an object or an array or null.*/
                case 'object': /* Due to a specification blunder in ECMAScript, typeof null is 'object', so watch out for that case.*/
                    if (!value) {
                        return 'null';
                    }
                    /* Make an array to hold the partial results of stringifying this object value.*/
                    gap += indent;
                    partial = [];
                    /* Is the value an array?*/
                    if (Object.prototype.toString.apply(value) === '[object Array]') { /* The value is an array. Stringify every element. Use null as a placeholder for non-JSON values.*/
                        length = value.length;
                        for (i = 0; i < length; i += 1) {
                            partial[i] = str(i, value) || 'null';
                        }
                        /* Join all of the elements together, separated with commas, and wrap them in brackets.*/
                        v = partial.length === 0 ? '[]' : gap ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' : '[' + partial.join(',') + ']';
                        gap = mind;
                        return v;
                    }
                    /* If the replacer is an array, use it to select the members to be stringified.*/
                    if (rep && typeof rep === 'object') {
                        length = rep.length;
                        for (i = 0; i < length; i += 1) {
                            if (typeof rep[i] === 'string') {
                                k = rep[i];
                                v = str(k, value);
                                if (v) {
                                    partial.push(quote(k) + (gap ? ': ' : ':') + v);
                                }
                            }
                        }
                    } /* Otherwise, iterate through all of the tinyPngKeys in the object.*/ else {
                        for (k in value) {
                            if (Object.prototype.hasOwnProperty.call(value, k)) {
                                v = str(k, value);
                                if (v) {
                                    partial.push(quote(k) + (gap ? ': ' : ':') + v);
                                }
                            }
                        }
                    }
                    /* Join all of the member texts together, separated with commas, and wrap them in braces.*/
                    v = partial.length === 0 ? '{}' : gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' : '{' + partial.join(',') + '}';
                    gap = mind;
                    return v;
            }
        }

        /* If the JSON object does not yet have a stringify method, give it one.*/
        if (typeof JSON.stringify !== 'function') {
            escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
            meta = {
                /* table of character substitutions*/
                '\b': '\\b',
                '\t': '\\t',
                '\n': '\\n',
                '\f': '\\f',
                '\r': '\\r',
                '"': '\\"',
                '\\': '\\\\'
            };
            JSON.stringify = function (value, replacer, space) { /* The stringify method takes a value and an optional replacer, and an optional space parameter, and returns a JSON text. The replacer can be a function that can replace values, or an array of strings that will select the tinyPngKeys. A default replacer method can be provided. Use of the space parameter can produce text that is more easily readable.*/
                var i;
                gap = '';
                indent = '';
                /* If the space parameter is a number, make an indent string containing that many spaces.*/
                if (typeof space === 'number') {
                    for (i = 0; i < space; i += 1) {
                        indent += ' ';
                    }
                    // If the space parameter is a string, it will be used as the indent string.
                } else if (typeof space === 'string') {
                    indent = space;
                }

                // If there is a replacer, it must be a function or an array.
                // Otherwise, throw an error.
                rep = replacer;
                if (replacer && typeof replacer !== 'function' &&
                    (typeof replacer !== 'object' ||
                    typeof replacer.length !== 'number')) {
                    throw new Error('JSON.stringify');
                }

                // Make a fake root object containing our value under the key of ''.
                // Return the result of stringifying the value.
                return str('', {'': value});
            };
        }


        // If the JSON object does not yet have a parse method, give it one.
        if (typeof JSON.parse !== 'function') {
            cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
            JSON.parse = function (text, reviver) {
                // The parse method takes a text and an optional reviver function, and returns
                // a JavaScript value if the text is a valid JSON text.
                var j;

                function walk(holder, key) {
                    // The walk method is used to recursively walk the resulting structure so
                    // that modifications can be made.
                    var k, v, value = holder[key];
                    if (value && typeof value === 'object') {
                        for (k in value) {
                            if (Object.prototype.hasOwnProperty.call(value, k)) {
                                v = walk(value, k);
                                if (v !== undefined) {
                                    value[k] = v;
                                } else {
                                    delete value[k];
                                }
                            }
                        }
                    }
                    return reviver.call(holder, key, value);
                }


                // Parsing happens in four stages. In the first stage, we replace certain
                // Unicode characters with escape sequences. JavaScript handles many characters
                // incorrectly, either silently deleting them, or treating them as line endings.
                text = String(text);
                cx.lastIndex = 0;
                if (cx.test(text)) {
                    text = text.replace(cx, function (a) {
                        return '\\u' +
                            ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                    });
                }

                // In the second stage, we run the text against regular expressions that look
                // for non-JSON patterns. We are especially concerned with '()' and 'new'
                // because they can cause invocation, and '=' because it can cause mutation.
                // But just to be safe, we want to reject all unexpected forms.

                // We split the second stage into 4 regexp operations in order to work around
                // crippling inefficiencies in IE's and Safari's regexp engines. First we
                // replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
                // replace all simple value tokens with ']' characters. Third, we delete all
                // open brackets that follow a colon or comma or that begin the text. Finally,
                // we look to see that the remaining characters are only whitespace or ']' or
                // ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.
                if (/^[\],:{}\s]*$/
                        .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                            .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                            .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

                    // In the third stage we use the eval function to compile the text into a
                    // JavaScript structure. The '{' operator is subject to a syntactic ambiguity
                    // in JavaScript: it can begin a block or an object literal. We wrap the text
                    // in parens to eliminate the ambiguity.
                    j = eval('(' + text + ')');

                    // In the optional fourth stage, we recursively walk the new structure, passing
                    // each name/value pair to a reviver function for possible transformation.
                    return typeof reviver === 'function' ? walk({'': j}, '') : j;
                }

                // If the text is not JSON parseable, then a SyntaxError is thrown.
                throw new SyntaxError('JSON.parse');
            };
        }
    }());

    if (typeof JSON !== 'object') {
        throw "After Effects has crashed. Please re-launch it and run the dump again."
    }

    const comp = app.project.activeItem;

    if (!comp) {
        throw new Error('Please select a composition before exporting');
    }

    const props = comp.markerProperty;

    let markers = [];

    for (let i = 1; i <= props.numKeys; i++) {
        let marker = JSON.parse(JSON.stringify(props.keyValue(i)));
        marker = marker || {};
        marker.position = props.keyTime(i);
        markers.push(marker);
    }

    return {comp: comp.id, markers: markers};
}

function dumpAeProject({comp, markers}) {
    return ae.execute(aeToJSON)
        .then(json => {
            let filename = jsonFile;

            // Configure all allowed extensions for images, audio and video layers
            // They will be categorized by extension later on
            const imageLayerExtensions = ['png', 'jpg', 'peg', 'gif', 'psd'];
            const audioLayerExtensions = ['wav', 'mp3', 'm4a'];
            const videoLayerExtensions = ['mp4', 'mov', 'webm', 'ogv'];
            const allowedLayerExtensions = imageLayerExtensions
                .concat(audioLayerExtensions)
                .concat(videoLayerExtensions);

            json.project.items.map(item => {
                // add markers to JSON
                if (item.id === comp) {
                    item.markers = markers;
                }

                // clean up unwanted data
                if ('composition' === item.typeName.toLowerCase()) {
                    item.layers.map((layer, layerIndex) => {
                        if (!layer.source) {
                            return;
                        }

                        // skip layer starting with --
                        if ('--' === layer.name.replace(/^\s+|\s+$/g, '').substr(0, 2)) {
                            console.log(`> skip layer ${layer.name}`);
                            return;
                        }

                        // Support only layers from images, sounds or videos
                        let layerExtension = path.extname(layer.source).replace('.', '');
                        if (-1 === allowedLayerExtensions.indexOf(layerExtension)) {
                            delete item.layers[layerIndex];
                            return;
                        } else {
                            // categorise layers
                            item.layers[layerIndex].isImageLayer = (-1 < imageLayerExtensions.indexOf(layerExtension));
                            item.layers[layerIndex].isAudioLayer = (-1 < audioLayerExtensions.indexOf(layerExtension));
                            item.layers[layerIndex].isVideoLayer = (-1 < videoLayerExtensions.indexOf(layerExtension));
                        }

                        // if "eye" is unchecked, skip the layer, if image
                        // if (!layer.enabled && (!layer.hasAudio || !layer.hasVideo)) {
                        if (!layer.enabled && layer.isImageLayer) {
                            return;
                        }

                        // Delete non-transform properties
                        for (const prop in layer.properties) {
                            if (layer.properties.hasOwnProperty(prop)) {
                                if ('transform' !== prop.toLowerCase()) {
                                    delete layer.properties[prop];
                                } else {
                                    for (const transProp in layer.properties[prop]) {
                                        if (layer.properties[prop].hasOwnProperty(transProp)) {
                                            if (-1 === [
                                                    'anchor point',
                                                    'position',
                                                    'scale',
                                                    'opacity',
                                                    'rotation'
                                                ].indexOf(transProp.toLowerCase())) {
                                                delete layer.properties[prop][transProp];
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        console.log(`> export layer ${layer.name}`);
                    });
                }
            });

            // filter out null items
            json.project.items = json.project.items.filter(i => !!i);

            // set the path
            const filepath = path.normalize(`${folders.dest}/${filename}`);

            // create the path if needed and save the file
            return new Promise((resolve, reject) => {
                fs.writeFile(filepath, beautify(JSON.stringify(json)), err => {
                    if (err) {
                        return reject(err);
                    }

                    // console.log(`The file ${filename} was saved!`);
                    // console.log('Run the next command:');
                    // console.log(`$ npm run ae-slide -- module=${args.module} scene=${args.scene} file=safran_m${args.module}_slide${(args.scene < 10 ? '0' : '') + args.scene}.json`);
                    resolve(filepath);
                });
            });
        });
}

function mapCompositions(data) {
    if (_.isError(data)) {
        throw data;
    }

    const json = JSON.parse(data);

    // extract compositions
    let compositions = [];
    json.project.items.forEach(item => {
        if (-1 < ['Composition'].indexOf(item.typeName)) {
            compositions.push(item);
        }
        if (-1 < ['Footage'].indexOf(item.typeName)) {
            footage.push(item);
        }
    });

    compositions.map(compositionToScene);
}

function compositionToScene(composition) {
    // const sceneId = args.scene < 10 ? `0${args.scene}` : args.scene;
    // const name = `safran_m${args.module}_slide${sceneId}`;
    const prefix = `m${args.module}s${sceneId}_`;
    const sceneName = `scene_${slideName}`;
    const screenName = `screen_${slideName}`;
    const publicUrl = folders.dest.replace(`${folders.root}/src/_animations/module-`, 'module_');
    const bgColorRGB = convertBgColorToRGB(composition.bgColor);

    // define the screenType from config
    let screenType = (config[shortName] && config[shortName].type) ? config[shortName].type : 'multi_layer';

    let audioLayers = {},
        videoLayers = {},
        targetLayers = {};

    // Check if this scene has a QCM
    // returns false or the name of the qcm screen
    const qcmScreenName = fs.readdirSync(folders.qcm)
        .reduce((p, c) => new RegExp(`^m${args.module}s${sceneId}-`, 'i').test(c) ? c.replace('.yml', '') : p, false);

    // Open JS script
    let js = "\t\t\tlet timeline = new TimelineMax;\n";

    // sort layers by index in the HTML order
    const sortedLayers = _.sortBy(composition.layers, 'index').reverse();

    // find audio and video layers and set the proper path
    // find target layers too for drag and drop screens
    sortedLayers.forEach((layer, layerIndex) => {
        if (layer.isAudioLayer === true && layer.parent !== null) {
            audioLayers[layer.parent] = {
                source: layer.source,
                url: `${publicUrl}/${path.basename(layer.source)}`
            };
        }

        if (layer.isVideoLayer === true && layer.parent !== null) {
            videoLayers[layer.parent] = {
                source: layer.source,
                url: `${publicUrl}/${path.basename(layer.source)}`,
                start: round(layer.inPoint),
                duration: round(layer.outPoint - layer.inPoint)
            };

            // starting at 0 fails to launch the video
            if (videoLayers[layer.parent].start <= 0) {
                videoLayers[layer.parent].start = 0.1;
            }

            // default the duration to comp length - start if weird values
            if (videoLayers[layer.parent].duration <= 0) {
                videoLayers[layer.parent].duration = composition.duration - videoLayers[layer.parent].start;
            }
        }

        // map drag_and_drop targets from the configuration
        if (layer.isImageLayer === true && sceneConfig && sceneConfig.targets && _.isObject(sceneConfig.targets)) {
            const reverseIndex = sortedLayers.length - layerIndex;
            if (null !== sceneConfig.targets[reverseIndex] && 'undefined' !== typeof sceneConfig.targets[reverseIndex]) {
                if (-1 === sceneConfig.targets[reverseIndex]) {
                    screenType = 'drag_and_drop';
                    layer.target = 'fake';
                } else {
                    const target = _.find(sortedLayers, l => l.index === sceneConfig.targets[reverseIndex]);
                    if (target) {
                        screenType = 'drag_and_drop';
                        layer.target = prefix + getFootageLayerName(footage, target.name) + '-' + (sortedLayers.length - target.index);
                    }
                }
            }
        }
    });

    // open scene
    let html = `<div class="scene ${sceneName}" data-scene="${sceneName}" style="background-color: ${bgColorRGB}">\n`;

    // open screen
    html += `\t<div class="screen float" data-screen="${screenType}" data-screen-name="${screenName}" data-screen-size="${composition.width} ${composition.height}">\n`;

    sortedLayers.forEach((layer, layerIndex) => {
        if (!layer || !layer.source || !layer.active || layer.hasAudio) {
            return;
        }

        // get the source file from supported formats or force png
        let source = path.basename(layer.source);
        let ext = path.extname(source).toLowerCase();
        let layerName = slugify(source.replace(ext, ''));

        // add sounds list if a sound layer is mapped to our current layer
        if (audioLayers[layerIndex] && audioLayers[layerIndex] !== '') {
            layer.audio = audioLayers[layerIndex];

            // copy audio source file
            const sourceAudio = pathCleanUp(audioLayers[layerIndex].source);
            if (fs.existsSync(sourceAudio)) {
                console.log("> copy sound", sourceAudio);
                fs.createReadStream(sourceAudio).pipe(fs.createWriteStream(`${folders.jekyll}/${path.basename(sourceAudio)}`));
            }
        }

        // add videos list if a video layer is mapped to our current layer
        if (videoLayers[layerIndex] && videoLayers[layerIndex].source) {
            layer.video = videoLayers[layerIndex];

            // copy audio source file
            const sourceVideo = pathCleanUp(videoLayers[layerIndex].source);
            if (fs.existsSync(sourceVideo)) {
                console.log("> copy video", sourceVideo);
                fs.createReadStream(sourceVideo).pipe(fs.createWriteStream(`${folders.jekyll}/${path.basename(sourceVideo)}`));
            }
        }

        // replace .psd ext by .png to avoid having to replace all footage
        // in after effects.
        // When using the PSD directly, the layer.name looks like {layer_name}/{source_name}.psd
        if ('.psd' === ext) {
            let footageLayerName = getFootageLayerName(footage, layer.name);

            if (footageLayerName) {
                layerName = footageLayerName;
            }

            source = layerName + '.png';
            ext = '.png';
        }

        // when the extension isn't a .psd, we want to copy the file to the images directory
        else {
            let layerSource = pathCleanUp(layer.source);
            if (fs.existsSync(layerSource)) {
                console.log("> copy source", layerSource);
                fs.createReadStream(layerSource).pipe(fs.createWriteStream(`${folders.jekyll}/${path.basename(layerSource)}`));
            }
        }

        // validate source file extension
        if (-1 === ['.png', '.jpg', '.jpeg'].indexOf(ext)) {
            console.log(`> UNSUPPORTED ext: ${ext}`);
            return;
        }

        // Find and prepare transforms
        // - Anchor Point
        // - Position
        // - Scale
        // - Rotation
        // - Opacity
        let transforms = {
            pivot: {left: 0, top: 0},
            position: {left: 0, top: 0},
            scale: {x: 1, y: 1},
            rotation: {value: 0},
            opacity: {value: 0}
        };
        if (layer.properties) {
            for (const propName in layer.properties) {
                if (layer.properties.hasOwnProperty(propName)) {
                    if (-1 < ['transform'].indexOf(propName.toLowerCase())) {
                        const prop = layer.properties[propName];

                        // Loop through transforms
                        for (const transName in prop) {
                            if (prop.hasOwnProperty(transName)) {
                                const trans = prop[transName];

                                // Anchor Point in pixels
                                if (-1 < ['anchor point'].indexOf(transName.toLowerCase())) {
                                    if (trans.keyframes && trans.keyframes.length) {
                                        transforms.pivot.keyframes = convertKeyframes(trans.keyframes, ['left', 'top'], round);
                                        transforms.pivot.left = transforms.pivot.keyframes[0].left;
                                        transforms.pivot.top = transforms.pivot.keyframes[0].top;
                                    }
                                }

                                // Position in pixels
                                if (-1 < ['position'].indexOf(transName.toLowerCase())) {
                                    if (trans.keyframes && trans.keyframes.length) {
                                        transforms.position.keyframes = convertKeyframes(trans.keyframes, ['left', 'top'], round);
                                        transforms.position.left = transforms.position.keyframes[0].left;
                                        transforms.position.top = transforms.position.keyframes[0].top;
                                    }
                                }

                                // Scale in decimal
                                if (-1 < ['scale'].indexOf(transName.toLowerCase())) {
                                    if (trans.keyframes && trans.keyframes.length) {
                                        transforms.scale.keyframes = convertKeyframes(trans.keyframes, ['x', 'y'], percentToDecimal);
                                        transforms.scale.x = transforms.scale.keyframes[0].x;
                                        transforms.scale.y = transforms.scale.keyframes[0].y;
                                    }
                                }

                                // Rotation in degrees
                                if (-1 < ['rotation'].indexOf(transName.toLowerCase())) {
                                    if (trans.keyframes && trans.keyframes.length) {
                                        transforms.rotation.keyframes = convertKeyframes(trans.keyframes, [], round);
                                        transforms.scale.value = transforms.scale.keyframes[0].value;
                                    }
                                }

                                // Opacity in decimal
                                if (-1 < ['opacity'].indexOf(transName.toLowerCase())) {
                                    if (trans.keyframes && trans.keyframes.length) {
                                        transforms.opacity.keyframes = convertKeyframes(trans.keyframes, [], percentToDecimal);
                                        transforms.opacity.value = transforms.opacity.keyframes[0].value;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // fix weirdies...
        layer.width = layer.width || 0;
        layer.height = layer.height || 0;

        // define the layer type
        let layerType = 'layer';
        if (layer.audio && layer.audio !== '') {
            layerType = 'audio';
        }
        if (layer.video && layer.video !== '') {
            layerType = 'video';
        }

        // Build Markup
        html += `\t\t<div class="tm-${layerType}"`
            + ` data-layer-name="${prefix + layerName}-${layerIndex}"`
            + ` data-layer-size="${layer.width} ${layer.height}"`
            + ` data-layer-pivot="${transforms.pivot.left} ${transforms.pivot.top}"`
            + ` data-layer-pos="${transforms.position.left} ${transforms.position.top}"`;

        // avoid bloating markup with default values
        if (transforms.opacity.value !== 1) {
            html += ` data-layer-opacity="${transforms.opacity.value}"`;
        }

        if (transforms.rotation.value !== 0) {
            html += ` data-layer-rotation="${transforms.rotation.value}"`;
        }

        if (transforms.scale.x !== 1 || transforms.scale.y !== 1) {
            html += ` data-layer-scale="${transforms.scale.x} ${transforms.scale.y}"`;
        }

        if (layerType === 'audio') {
            html += ` data-load-audio="${layer.audio.url}"`;
        }

        if (layerType === 'video') {
            html += ` data-load-video="${layer.video.url}"`;
        }

        if (layer.target && layer.target !== '') {
            html += ` data-dnd-target="${layer.target}"`;
        }

        html += ` data-load-image="${publicUrl}/${source}"></div>\n`;

        // Build JS from transforms
        let timeline = {};
        for (const transName in transforms) {
            if (transforms.hasOwnProperty(transName)) {
                const trans = transforms[transName];
                if (trans.keyframes) {
                    trans.keyframes.forEach(kf => {
                        if (!kf.duration) return;

                        timeline[kf.time] = timeline[kf.time] || {};
                        timeline[kf.time].duration = kf.duration;

                        switch (transName) {
                            case 'opacity':
                            case 'rotation':
                                timeline[kf.time][transName] = kf.value;
                                break;
                            case 'position':
                                timeline[kf.time]['left'] = `${toPercent(kf.left, composition.width)}%`;
                                timeline[kf.time]['top'] = `${toPercent(kf.top, composition.height)}%`;
                                break;
                            case 'scale':
                                timeline[kf.time]['scaleX'] = kf.x;
                                timeline[kf.time]['scaleY'] = kf.y;
                                break;
                            case 'pivot':
                                timeline[kf.time]['marginLeft'] = `${-1 * kf.left}px`;
                                timeline[kf.time]['marginTop'] = `${-1 * kf.top}px`;
                                timeline[kf.time]['transformOrigin'] = `${kf.left}px ${kf.top}px`;
                                break;
                        }
                    });

                }
            }
        }

        // Write Timeline JS
        let positions = Object.keys(timeline).sort();
        for (let i = 0; i < positions.length; i++) {
            if (positions[i] < composition.duration) {
                // duration in not passed as arguments to TimelineMax
                let duration = timeline[positions[i]].duration;

                // force duration to max as comp duration - inPoint
                duration = (duration > composition.duration - positions[i]) ? composition.duration - positions[i] : duration;

                delete timeline[positions[i]].duration;

                // TimelineMax.to() syntax
                js += `\t\t\ttimeline.to(scr.layers['${prefix + layerName}-${layerIndex}'], ${duration}, ${JSON.stringify(timeline[positions[i]])}, ${positions[i]});\n`;
            }
        }

        // write VideoMax callback to position the video start and stop in the timeline
        if (layer.video) {
            js += `\t\t\ttimeline.add(VideoMax.video(scr.layers['${prefix + layerName}-${layerIndex}'].video, ${layer.video.duration}), ${layer.video.start});\n`;
        }

    }); // end each sortedLayers

    // close screen
    html += "\t</div>\n";

    // add a QCM screen if needed
    if (qcmScreenName) {
        let qcmObject = null;
        let qcmPosition = '';

        try {
            qcmObject = yaml.safeLoad(fs.readFileSync(`${folders.qcm}/${qcmScreenName}.yml`, {encoding: 'utf8'}));
            if (qcmObject && (qcmObject.left || qcmObject.top)) {
                let left = qcmObject.left || '50%';
                let top = qcmObject.top || '50%';

                qcmPosition = ` data-qcm-position="${left} ${top}"`;
            }
        } catch (e) {
            console.log(e);
        }

        html += `\n\t\<div class="screen float" data-screen="qcm" data-screen-name="${qcmScreenName}"${qcmPosition}></div>\n`;
    }

    // close scene
    html += "</div>\n";

    // add stepLabels from the cue points
    if (composition.markers) {
        js += "\n";
        composition.markers.forEach((marker, markerIndex) => {
            // skip out of bounds markers
            if (marker.position > composition.duration) {
                return;
            }

            let stepOptions = '{}';
            if (marker.comment && marker.comment !== '') {
                let markerOptions = yaml.safeLoad(marker.comment);
                if (markerOptions && _.isObject(markerOptions)) {
                    stepOptions = JSON.stringify(markerOptions);
                }
            }

            js += `\t\t\ttimeline.addStepLabel('${screenName}.label-${markerIndex}', ${stepOptions}, ${round(marker.position)});\n`;
        });
        js += "\n";
    }

    // write a SCSS class
    let scss = `.scene_${slideName} {\n\t\n}\n`;

    // create QCM injectors
    if (qcmScreenName) {
        writeQcmInjectors(qcmScreenName);
    }

    // write to file
    writeHTML(`${slideName}.html`, html);
    writeJS(`${slideName}.js`, js);
    // writeSCSS(`${slideName}.scss`, scss);

}

function writeHTML(filename, content) {
    // replace tabs by spaces
    content = content.replace("\t", '    ');

    // write in _animations folder
    fs.writeFile(`${folders.dest}/${filename}`, content, {encoding: 'utf-8'}, err => {
        if (err) {
            throw new Error(err);
        }

        console.log(`${filename} exported successfully`);
    });

    // Export blade file to resources/views directly for ease of integration
    let jekyllFile = path.normalize(`${folders.jekyllViews}/scene_${filename}`);
    if (args.force || !fs.existsSync(jekyllFile)) {
        console.log("> copy to Jekyll file");
        fs.writeFile(jekyllFile, content, {encoding: 'utf-8'});
    }
}

function writeJS(filename, content) {
    const template = fs.readFileSync(`${__dirname}/scene_template.txt`, {encoding: 'utf-8'});

    let preBuild = fs.existsSync(`${folders.dest}/inject_${slideName}_pre_build.js`)
        ? fs.readFileSync(`${folders.dest}/inject_${slideName}_pre_build.js`) : '';

    let postBuildBefore = fs.existsSync(`${folders.dest}/inject_${slideName}_post_build_before.js`)
        ? fs.readFileSync(`${folders.dest}/inject_${slideName}_post_build_before.js`) : '';

    let postBuildAfter = fs.existsSync(`${folders.dest}/inject_${slideName}_post_build_after.js`)
        ? fs.readFileSync(`${folders.dest}/inject_${slideName}_post_build_after.js`) : '';

    let scene = template
        .replace(/\{\{SCENE_ID\}\}/g, `scene_${slideName}`)
        .replace('{{CONTENT}}', content)
        .replace('{{GET_SCREEN_OBJECT}}', `\tlet scr = this.getScreen("screen_${slideName}");\n`)
        .replace('{{PRE_BUILD}}', preBuild)
        .replace('{{POST_BUILD_BEFORE}}', postBuildBefore)
        .replace('{{POST_BUILD_AFTER}}', postBuildAfter)
        .replace('{{ADD_TO_TIMELINE}}', `\t\t\tthis.addTimeline(timeline, 'scene_${slideName}');\n`)
        .replace("\t", '    ');

    // Export scene file to be used in the project directly when not existing already
    if (args.force || !fs.existsSync(`${folders.webpack}/scenes/scene_${filename}`)) {
        fs.writeFile(`${folders.webpack}/scenes/scene_${filename}`, scene, {encoding: 'utf-8'}, err => {
            if (err) {
                throw new Error(err);
            }

            console.log(`Scene ${filename} exported successfully`);
        });
    }

    // Write animation JS file to export folder
    fs.writeFile(`${folders.dest}/${filename}`, scene, {encoding: 'utf-8'}, err => {
        if (err) {
            throw new Error(err);
        }

        console.log(`${filename} exported successfully`);
    });
}

function writeSCSS(filename, content) {
    content = content.replace("\t", '    ');
    // Export scene file to be used in the project directly when not existing already
    if (args.force || !fs.existsSync(`${folders.dest}/scene_${filename}`)) {
        fs.writeFile(`${folders.dest}/scene_${filename}`, content, {encoding: 'utf-8'}, err => {
            if (err) {
                throw new Error(err);
            }

            console.log(`Scene ${filename} style created successfully`);
        });
    }
}

/**
 * Write the JS injectors
 * writeFileSync is used to make sure the injectors have finished writing before writeJS() is called
 *
 * the file is NOT overwritten by force=true CLI arg !
 *
 * @param qcmScreenName
 */
function writeQcmInjectors(qcmScreenName) {
    const afterFile = `${folders.dest}/inject_${slideName}_post_build_after.js`;

    if (!fs.existsSync(afterFile)) {
        let content = `const qcm = this.getScreen("${qcmScreenName}");\n`;
        content += 'timeline.add(function () {';
        content += 'qcm.onComplete = function () { SceneManager.unlockScroll(true); };';
        content += 'qcm.show();';
        content += '}, 0.1);\n';

        fs.writeFileSync(afterFile, content, {encoding: 'utf-8'});
    }
}
