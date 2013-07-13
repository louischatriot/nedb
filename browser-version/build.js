/**
 * Build the browser version of nedb
 */

var fs = require('fs-extra')
  , path = require('path')
  , child_process = require('child_process')
  , async = require('async')
  //, rimraf = require('rimraf')
  , srcContents = fs.readdirSync(path.join(__dirname, 'src'))
  , toCopy = ['lib', 'node_modules']
  ;

child_process.exec('npm install rimraf', function (err, stdout, stderr) {
  console.log("==============");
  console.log(stdout);

});


//async.waterfall([
//function (cb) {
  //console.log("Removing contents of the src directory");

  //srcContents.forEach(function (item) {
    //var fullPath = path.join(__dirname, 'src', item);
    //rimraf.sync(fullPath);
  //});

  //return cb();
//}
//, function (cb) {
  //console.log("Copying source files");

  //async.eachSeries(toCopy, function (item, _cb) {
    //fs.copy(path.join(__dirname, '..', item), path.join(__dirname, 'src', item), _cb);
  //}, cb);
//}
//, function (cb) {
  //console.log("Copying browser specific files");

  //async.eachSeries(fs.readdirSync(path.join(__dirname, 'browser-specific')), function (item, _cb) {
    //fs.copy(path.join(__dirname, 'browser-specific', item), path.join(__dirname, 'src', item), _cb);
  //}, cb);
//}



//], function (err) {
  //if (err) {
    //console.log("Error during build");
    //console.log(err);
  //} else {
    //console.log("Build finished with success");
  //}
//});




