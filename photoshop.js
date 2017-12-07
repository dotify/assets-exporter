"use strict";

const path = require('path');

const photoshop = require('photoshop');
const mkdirp = require('mkdirp');
const {argv} = require('./modules/argv');
const {ncp} = require('ncp');

function exportLayersToPNG(folders) {

    /**
     * Slugify function is from ./modules/slugify
     * require() doesn't work here...
     *
     * @param str
     * @return {string|*}
     */
    function slugify(str) {
        str = str.replace(/^\s+|\s+$/g, ''); // trim
        str = str.toLowerCase();

        // remove accents
        // var from = "àáäâèéëêìíïîòóöôùúüûñç";
        // var to = "aaaaeeeeiiiioooouuuunc";
        // for (var i = 0, l = from.length; i < l; i++) {
        //     str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
        // }

        return str
            .replace(/\s+/g, '_') // collapse whitespace and replace by _
            .replace(/-+/g, '_') // collapse dashes
            .replace(/[^a-z0-9 -_]/g, '') // remove invalid chars
            .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''); // remove weird chars from beginning and end
    }

    function cTID(s) {
        return app.charIDToTypeID(s);
    }

    function sTID(s) {
        return app.stringIDToTypeID(s);
    }

// Trim a layer
    function trimLayer(helperDoc, layer, imgPath, pngOptions, outLayer) {
        helperDoc.crop(layer.bounds);
        var desc = new ActionDescriptor();
        desc.putEnumerated(sTID("trimBasedOn"), sTID("trimBasedOn"), cTID("Trns"));
        desc.putBoolean(cTID("Left"), true);
        desc.putBoolean(cTID("Top "), true);
        desc.putBoolean(cTID("Rght"), false);
        desc.putBoolean(cTID("Btom"), false);
        //executeAction(sTID("trim"), desc, DialogModes.NO);
        outLayer.left += outLayer.width - helperDoc.width.value;
        outLayer.top += outLayer.height - helperDoc.height.value;
        desc.putBoolean(cTID("Left"), false);
        desc.putBoolean(cTID("Top "), false);
        desc.putBoolean(cTID("Rght"), true);
        desc.putBoolean(cTID("Btom"), true);
        //executeAction(sTID("trim"), desc, DialogModes.NO);
        outLayer.width = helperDoc.width.value;
        outLayer.height = helperDoc.height.value;
        helperDoc.saveAs(new File(imgPath), pngOptions, true, Extension.LOWERCASE);

        return outLayer;
    }

    function renderLayer(doc, layer) {
        layer.visible = true;

        app.activeDocument = doc;
        app.preferences.rulerUnits = Units.PIXELS;
        app.activeDocument.activeLayer = layer;

        var outLayer = {
            left: layer.bounds[0].value,
            top: layer.bounds[1].value,
            width: layer.bounds[2].value - layer.bounds[0].value,
            height: layer.bounds[3].value - layer.bounds[1].value,
            name: slugify(layer.name),
            style: "",
            content: null
        };

        var helperDoc = doc.duplicate();
        var imgRelPath = outLayer.name + ".png";
        var imgPath = folder.fullName + "/" + imgRelPath;
        var pngOptions = new PNGSaveOptions;
        pngOptions.interlaced = false;

        // trim the layer
        outLayer = trimLayer(helperDoc, layer, imgPath, pngOptions, outLayer);

        helperDoc.close(SaveOptions.DONOTSAVECHANGES);

        layer.visible = false;

        return outLayer;
    }

///////////////////////////////////////////////////////////////////////////////
// Function: rasterizeLayer
// Usage: rasterize the current layer to pixels
// Input: <none> Must have an open document
// Return: <none>
///////////////////////////////////////////////////////////////////////////////
    function rasterizeLayer() {
        try {
            var id1242 = stringIDToTypeID("rasterizeLayer");
            var desc245 = new ActionDescriptor();
            var id1243 = charIDToTypeID("null");
            var ref184 = new ActionReference();
            var id1244 = charIDToTypeID("Lyr ");
            var id1245 = charIDToTypeID("Ordn");
            var id1246 = charIDToTypeID("Trgt");
            ref184.putEnumerated(id1244, id1245, id1246);
            desc245.putReference(id1243, ref184);
            executeAction(id1242, desc245, DialogModes.NO);
        } catch (e) {
            ; // do nothing
        }
    }

    function hideArtLayers(doc) {
        var tmpDoc = app.activeDocument;
        app.activeDocument = doc;

        var idselectAllLayers = sTID("selectAllLayers");
        var desc6 = new ActionDescriptor();
        var idnull = cTID("null");
        var ref5 = new ActionReference();
        var idLyr = cTID("Lyr ");
        var idOrdn = cTID("Ordn");
        var idTrgt = cTID("Trgt");
        ref5.putEnumerated(idLyr, idOrdn, idTrgt);
        desc6.putReference(idnull, ref5);
        executeAction(idselectAllLayers, desc6, DialogModes.NO);

        var idHd = cTID("Hd  ");
        var desc8 = new ActionDescriptor();
        var idnull = cTID("null");
        var list3 = new ActionList();
        var ref7 = new ActionReference();
        var idLyr = cTID("Lyr ");
        var idOrdn = cTID("Ordn");
        var idTrgt = cTID("Trgt");
        ref7.putEnumerated(idLyr, idOrdn, idTrgt);
        list3.putReference(ref7);
        desc8.putList(idnull, list3);
        executeAction(idHd, desc8, DialogModes.NO);

        showLayerSets(doc);

        app.activeDocument = tmpDoc;
    }

    function showLayerSets(obj) {
        for (var i = 0; i < obj.layerSets.length; ++i) {
            obj.layerSets[i].visible = true;
            showLayerSets(obj.layerSets[i]);
        }
    }

    function processLayers(doc, mainDoc, folder) {
        return processLayers.traverse(doc, mainDoc, doc.layers, mainDoc.layers, folder);
    }

    // function slugify(str) {
    //     str = str.replace(/^\s+|\s+$/g, ''); // trim
    //     str = str.toLowerCase();
    //
    //     // remove accents
    //     var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
    //     var to = "aaaaeeeeiiiioooouuuunc------";
    //     for (var i = 0, l = from.length; i < l; i++) {
    //         str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    //     }
    //
    //     str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    //         .replace(/\s+/g, '_') // collapse whitespace and replace by _
    //         .replace(/-+/g, '_'); // collapse dashes
    //
    //     return str;
    // }

    // do the export. data is saved to outputContent
    var originalRulerUnits = preferences.rulerUnits;
    var mainDoc = app.activeDocument;

    // duplicate the current document
    var doc = mainDoc.duplicate();

    // create folders
    var folder = new Folder(folders.jekyll);
    var imagesFolder = new Folder(folder.fullName);

    if (!imagesFolder.exists) {
        imagesFolder.create();
    }

    // set the rulers to pixels
    preferences.rulerUnits = Units.PIXELS;

    // set the duplicated document as current document
    app.activeDocument = doc;
    doc.layerSets.visible = false;

    hideArtLayers(doc);

    // process the layers. data is added to outputContent
    for (var i = app.activeDocument.artLayers.length - 1; i >= 0; i--) {
        renderLayer(doc, app.activeDocument.artLayers[i]);
    }

    // close the duplicated document without saving changes
    doc.close(SaveOptions.DONOTSAVECHANGES);

    // reset the document rulers' unit
    preferences.rulerUnits = originalRulerUnits;
}

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

/**
 * NodeJS part
 */
const args = argv.parse({
    'module': '[0-9]+',
    'scene': '[0-9]+',
});

args.module = parseInt(args.module, 10);
args.scene = parseInt(args.scene, 10);

let sceneId = args.scene ? formatSceneNumber(args.scene) : 999;

// define the folders
let folders = {root: path.dirname(__dirname)};
folders.dest = path.normalize(`${folders.root}/src/_animations/module-${args.module}/scene-${sceneId}`);
folders.jekyll = path.normalize(`${folders.root}/src/module_${args.module}/scene-${sceneId}`);

// create the folder and run the Ps script
mkdirp(folders.jekyll, err => {
    if (err) {
        return console.log(err);
    }

    photoshop.invoke(exportLayersToPNG, [folders], err => {
        if (err) {
            return console.log(err);
        }

        console.log(`Exported layers to ${folders.jekyll}`);
        console.log('Open you After Effects comp and run the next command:');
        console.log(`$ npm run ae-export -- module=${args.module} scene=${sceneId}`);
    });
});
