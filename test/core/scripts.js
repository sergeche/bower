var path = require('path');
var bower = require('../../lib/index.js');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var fs = require('fs');
var expect = require('expect.js');

describe('scripts', function () {

    var tempDir = path.join(__dirname, '../assets/temp-scripts');
    var packageName = 'package-zip.zip';
    var packageDir = path.join('..', packageName);

    var config = {
        cwd: tempDir,
        scripts: {
            preinstall: 'touch preinstall_%',
            postinstall: 'touch postinstall_%',
            preuninstall: 'touch preuninstall_%'
        }
    };

    before(function (next) {
        mkdirp(tempDir, next);
    });

    after(function (next) {
        rimraf(tempDir,  next);
    });

    it('should run preinstall and postinstall hooks.', function (next) {

        bower.commands
        .install([packageDir], undefined, config)
        .on('end', function (installed) {

            expect(fs.existsSync(path.join(tempDir, 'preinstall_' + packageName))).to.be(true);
            expect(fs.existsSync(path.join(tempDir, 'postinstall_' + packageName))).to.be(true);

            next();
        });

    });

    it('should run preuninstall hook.', function (next) {

        bower.commands
        .uninstall([packageName], undefined, config)
        .on('end', function (installed) {

            expect(fs.existsSync(path.join(tempDir, 'preuninstall_' + packageName))).to.be(true);

            next();
        });

    });

});