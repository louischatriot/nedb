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
 */
module.exports.insertDocs = function (d, n, profiler, cb) {
  var beg = new Date()
    ;

  profiler.step('Begin inserting ' + n + ' docs');

  function runFrom(i) {
    if (i === n) {   // Finished
      console.log("Average time for one insert: " + (profiler.elapsedSinceLastStep() / n) + "ms");
      profiler.step('Finished inserting ' + n + ' docs');
      return cb();
    }

    d.insert({ docNumber: i }, function (err) {
      process.nextTick(function () {
        runFrom(i + 1);
      });
    });
  }
  runFrom(0);
};


/**
 * Find documents with find
 */
module.exports.findDocs = function (d, n, profiler, cb) {
  var beg = new Date()
    , order = getRandomArray(n)
    ;

  profiler.step("Finding " + n + " documents");

  function runFrom(i) {
    if (i === n) {   // Finished
      console.log("Average time for one find in a collection of " + n + " docs: " + (profiler.elapsedSinceLastStep() / n) + "ms");
      profiler.step('Finished finding ' + n + ' docs');
      return cb();
    }

    d.find({ docNumber: order[i] }, function (err, docs) {
      if (docs.length !== 1 || docs[0].docNumber !== order[i]) { return cb('One find didnt work'); }
      process.nextTick(function () {
        runFrom(i + 1);
      });
    });
  }
  runFrom(0);
};


/**
 * Find documents with findOne
 */
module.exports.findOneDocs = function (d, n, profiler, cb) {
  var beg = new Date()
    , order = getRandomArray(n)
    ;

  profiler.step("FindingOne " + n + " documents");

  function runFrom(i) {
    if (i === n) {   // Finished
      console.log("Average time for one findOne in a collection of " + n + " docs: " + (profiler.elapsedSinceLastStep() / n) + "ms");
      profiler.step('Finished finding ' + n + ' docs');
      return cb();
    }

    d.findOne({ docNumber: order[i] }, function (err, doc) {
      if (!doc || doc.docNumber !== order[i]) { return cb('One find didnt work'); }
      process.nextTick(function () {
        runFrom(i + 1);
      });
    });
  }
  runFrom(0);
};


/**
 * Update documents
 * options is the same as the options object for update
 */
module.exports.updateDocs = function (options, d, n, profiler, cb) {
  var beg = new Date()
    , order = getRandomArray(n)
    ;

  profiler.step("Updating " + n + " documents");

  function runFrom(i) {
    if (i === n) {   // Finished
      console.log("Average time for one update in a collection of " + n + " docs: " + (profiler.elapsedSinceLastStep() / n) + "ms");
      profiler.step('Finished updating ' + n + ' docs');
      return cb();
    }

    d.update({ docNumber: order[i] }, { newDocNumber: i }, options, function (err, nr) {
      if (nr !== 1) { return cb('One update didnt work'); }
      process.nextTick(function () {
        runFrom(i + 1);
      });
    });
  }
  runFrom(0);
};


/**
 * Remove documents
 * options is the same as the options object for update
 */
module.exports.removeDocs = function (options, d, n, profiler, cb) {
  var beg = new Date()
    , order = getRandomArray(n)
    ;

  profiler.step("Removing " + n + " documents");

  function runFrom(i) {
    if (i === n) {   // Finished
      console.log("Average time for one remove in a collection of " + n + " docs: " + (profiler.elapsedSinceLastStep() / n) + "ms");
      profiler.step('Finished removing ' + n + ' docs');
      return cb();
    }

    d.remove({ docNumber: order[i] }, options, function (err, nr) {
      if (nr !== 1) { return cb('One remove didnt work'); }
      d.insert({ docNumber: order[i] }, function (err) {   // Reinserting just removed document so that the collection size doesn't change
                                                           // Time is about 70x smaller for an insert so the impact on the results is minimal
        process.nextTick(function () {
          runFrom(i + 1);
        });
      });
    });
  }
  runFrom(0);
};





