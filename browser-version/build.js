/**
 * Build the browser version of nedb
 */

var fs = require('fs')
  , path = require('path')
  , child_process = require('child_process')
  , toCopy = ['lib', 'node_modules']
  , async, browserify, uglify
  ;

// Ensuring both node_modules (the source one and build one), src and out directories exist
function ensureDirExists (name) {
  try {
    fs.mkdirSync(path.join(__dirname, name));
  } catch (e) {
    if (e.code !== 'EEXIST') {
      console.log("Error ensuring that node_modules exists");
      process.exit(1);
    }
  }
}
ensureDirExists('../node_modules');
ensureDirExists('node_modules');
ensureDirExists('out');
ensureDirExists('src');


// Installing build dependencies and require them
console.log("Installing build dependencies");
child_process.exec('npm install', { cwd: __dirname }, function (err, stdout, stderr) {
  if (err) { console.log("Error reinstalling dependencies"); process.exit(1); }

  fs = require('fs-extra');
  async = require('async');
  browserify = require('browserify');
  uglify = require('uglify-js');

  async.waterfall([
  function (cb) {
    console.log("Installing source dependencies if needed");

    child_process.exec('npm install', { cwd: path.join(__dirname, '..') }, function (err) { return cb(err); });
  }
  , function (cb) {
    console.log("Removing contents of the src directory");

    async.eachSeries(fs.readdirSync(path.join(__dirname, 'src')), function (item, _cb) {
      fs.remove(path.join(__dirname, 'src', item), _cb);
    }, cb);
  }
  , function (cb) {
    console.log("Copying source files");

    async.eachSeries(toCopy, function (item, _cb) {
      fs.copy(path.join(__dirname, '..', item), path.join(__dirname, 'src', item), _cb);
    }, cb);
  }
  , function (cb) {
    console.log("Copying browser specific files to replace their server-specific counterparts");

    async.eachSeries(fs.readdirSync(path.join(__dirname, 'browser-specific')), function (item, _cb) {
      fs.copy(path.join(__dirname, 'browser-specific', item), path.join(__dirname, 'src', item), _cb);
    }, cb);
  }
  , function (cb) {
    console.log("Browserifying the code");

    var b = browserify()
      , srcPath = path.join(__dirname, 'src/lib/datastore.js');

    b.add(srcPath);
    b.bundle({ standalone: 'Nedb' }, function (err, out) {
      if (err) { return cb(err); }
      fs.writeFile(path.join(__dirname, 'out/nedb.js'), out, 'utf8', function (err) {
        if (err) {
          return cb(err);
        } else {
          return cb(null, out);
        }
      });
    });
  }
  , function (out, cb) {
      console.log("Creating the minified version");

      var compressedCode = uglify.minify(out, { fromString: true });
      fs.writeFile(path.join(__dirname, 'out/nedb.min.js'), compressedCode.code, 'utf8', cb);
  }
  ], function (err) {
    if (err) {
      console.log("Error during build");
      console.log(err);
    } else {
      console.log("Build finished with success");
    }
  });
});



