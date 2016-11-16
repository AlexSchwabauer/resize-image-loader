// @flow
"use strict"

const path = require('path')
const loaderUtils = require('loader-utils');
const queue = require('queue');
const fs = require('fs');

const gm = require('gm').subClass({ imageMagick: true });
// const gm = require('gm');
const sizeOf = require('image-size');



function createResizedImage(resourcePath, size, originalDestinationPath, emitFile) {
    return new Promise((resolve, reject) => {

        fs.readFile(resourcePath, (err, fileBuffer) => {
            const extname = path.extname(originalDestinationPath);
            const originalFileName = path.basename(originalDestinationPath, extname);

            let dirname = path.dirname(originalDestinationPath)


            gm(fileBuffer)
                .resize(size)
                .toBuffer((err, buffer) => {

                    let resizedPath = dirname + '/' + originalFileName + '.' + size.toString() + extname;

                    emitFile(resizedPath, buffer);


                    // for display, dirname needs to have prepending /
                    if (resizedPath.charAt(0) !== '/')
                        resizedPath = '/' + resizedPath;
                    resolve({
                        path: resizedPath,
                        size
                    });
                })

        });

    });
}



module.exports = function(fileLoader) {
    let originalDestinationPath;
    try {
        originalDestinationPath = eval(fileLoader.toString().split('+').pop());

    }
    catch (e) {
        throw new Error('This loader needs to be follwed by file-loader')
    }


    let query = (this.query !== '' ? this.query : this.loaders[0].query);
    query = loaderUtils.parseQuery(query);




    const callback = this.async();

    if (!this.emitFile) throw new Error("emitFile is required from module system");

    this.cacheable && this.cacheable();
    this.addDependency(this.resourcePath);


    const sizes = (query.s || query.sizes).map(size => parseInt(size));

    const promises = sizes.map(size => createResizedImage(this.resourcePath, size, originalDestinationPath, this.emitFile))

    Promise.all(promises)
        .then(result => {

            // create valid srcset string
            let data = {}

            data.srcset = result.reduce((str, obj, i) => {
                let srcset = str + `${obj.path} ${obj.size}w`;

                if (i + 1 !== result.length)
                    srcset += ', '

                return srcset;
            }, '');

            data.resized = result.reduce((obj, d) => {
                obj[d.size] = d
                return obj;
            }, {});

            data.resized.smallest = data.resized[Math.min.apply(null, sizes)];
            data.resized.biggest = data.resized[Math.max.apply(null, sizes)];

            data.original = originalDestinationPath



            callback(null, "module.exports = " + JSON.stringify(data));
        })



}
module.exports.raw = true; // get buffer stream instead of utf8 string
