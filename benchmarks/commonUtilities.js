/**
 * Functions that are used in several benchmark tests
 */

var customUtils = require('../lib/customUtils')
  , fs = require('fs')
  , path = require('path')
  ;


/**
 * Ensure the workspace exists and the db is empty
 */
module.exports.prepareDb = function (filename, cb) {
  customUtils.ensureDirectoryExists(path.dirname(filename), function () {
    fs.exists(filename, function (exists) {
      if (exists) {
        fs.unlink(filename, cb);
      } else { return cb(); }
    });
  });
};


/**
 * Return an array with the numbers from 0 to n-1, in a random order
 * Useful to get fair tests
 */
function getRandomArray (n) {
  var res, next;

  if (n === 0) { return []; }
  if (n === 1) { return [0]; }

  res = getRandomArray(n - 1);
  next = Math.floor(Math.random() * n);
  res.splice(next, 0, n - 1);   // Add n-1 at a random position in the array

  return res;
};
module.exports.getRandomArray = getRandomArray;


/**
 * Insert a certain number of documents for testing
 * @param {Datastore} d
 * @param {Number} n
 * @param {Profiler} profiler
 */
module.exports.insertDocs = function (d, n, profiler, cb) {
  var beg = new Date()
    , i = 0;

  profiler.step('Begin inserting ' + n + ' docs');

  function insertOne(i) {
    if (i === n) {   // Finished
      console.log("Average time for one insert: " + (profiler.elapsedSinceLastStep() / n) + "ms");
      profiler.step('Finished inserting ' + n + ' docs');
      return cb();
    }

    d.insert({ docNumber: i }, function (err) {
      process.nextTick(function () {
        insertOne(i + 1);
      });
    });
  }
  insertOne(0);
};


/**
 * Insert a certain number of documents for testing
 * @param {Datastore} d
 * @param {Number} n
 * @param {Profiler} profiler
 */
module.exports.findDocs = function (d, n, profiler, cb) {
  var beg = new Date()
    , order = getRandomArray(n)
    , i = 0;

  profiler.step("Finding " + n + " documents");

  function find(i) {
    if (i === n) {   // Finished
      console.log("Average time for one find in a collection of " + n + " docs: " + (profiler.elapsedSinceLastStep() / n) + "ms");
      profiler.step('Finished finding ' + n + ' docs');
      return cb();
    }

    d.find({ docNumber: order[i] }, function (err, docs) {
      if (docs.length !== 1 || docs[0].docNumber !== order[i]) { return cb('One find didnt work'); }
      process.nextTick(function () {
        find(i + 1);
      });
    });
  }
  find(0);
};


