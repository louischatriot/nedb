/**
 * Functions that are used in several benchmark tests
 */

var customUtils = require('../lib/customUtils')
  , fs = require('fs')
  , path = require('path')
  , Datastore = require('../lib/datastore')
  , Persistence = require('../lib/persistence')
  , executeAsap   // process.nextTick or setImmediate depending on your Node version
  ;

try {
  executeAsap = setImmediate;
} catch (e) {
  executeAsap = process.nextTick;
}


/**
 * Configure the benchmark
 */
module.exports.getConfiguration = function (benchDb) {
  var d, n
    , program = require('commander')
    ;

  program
    .option('-n --number [number]', 'Size of the collection to test on', parseInt)
    .option('-i --with-index', 'Use an index')
    .option('-m --in-memory', 'Test with an in-memory only store')
    .parse(process.argv);

  n = program.number || 10000;

  console.log("----------------------------");
  console.log("Test with " + n + " documents");
  console.log(program.withIndex ? "Use an index" : "Don't use an index");
  console.log(program.inMemory ? "Use an in-memory datastore" : "Use a persistent datastore");
  console.log("----------------------------");

  d = new Datastore({ filename: benchDb
                    , inMemoryOnly: program.inMemory
                    });

  return { n: n, d: d, program: program };
};


/**
 * Ensure the workspace exists and the db datafile is empty
 */
module.exports.prepareDb = function (filename, cb) {
  Persistence.ensureDirectoryExists(path.dirname(filename), function () {
    fs.exists(filename, function (exists) {
      if (exists) {
        fs.unlink(filename, cb);
      } else { return cb(); }
    });
  });
};


/**
 * Return an array with the numbers from 0 to n-1, in a random order
 * Uses Fisher Yates algorithm
 * Useful to get fair tests
 */
function getRandomArray (n) {
  var res = []
    , i, j, temp
    ;

  for (i = 0; i < n; i += 1) { res[i] = i; }

  for (i = n - 1; i >= 1; i -= 1) {
    j = Math.floor((i + 1) * Math.random());
    temp = res[i];
    res[i] = res[j];
    res[j] = temp;
  }

  return res;
};
module.exports.getRandomArray = getRandomArray;


/**
 * Insert a certain number of documents for testing
 */
module.exports.insertDocs = function (d, n, profiler, cb) {
  var beg = new Date()
    , order = getRandomArray(n)
    ;

  profiler.step('Begin inserting ' + n + ' docs');

  function runFrom(i) {
    if (i === n) {   // Finished
      var opsPerSecond = Math.floor(1000* n / profiler.elapsedSinceLastStep());
      console.log("===== RESULT (insert) ===== " + opsPerSecond + " ops/s");
      profiler.step('Finished inserting ' + n + ' docs');
      profiler.insertOpsPerSecond = opsPerSecond;
      return cb();
    }

    d.insert({ docNumber: order[i] }, function (err) {
      executeAsap(function () {
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
      console.log("===== RESULT (find) ===== " + Math.floor(1000* n / profiler.elapsedSinceLastStep()) + " ops/s");
      profiler.step('Finished finding ' + n + ' docs');
      return cb();
    }

    d.find({ docNumber: order[i] }, function (err, docs) {
      if (docs.length !== 1 || docs[0].docNumber !== order[i]) { return cb('One find didnt work'); }
      executeAsap(function () {
        runFrom(i + 1);
      });
    });
  }
  runFrom(0);
};


/**
 * Find documents with find and the $in operator
 */
module.exports.findDocsWithIn = function (d, n, profiler, cb) {
  var beg = new Date()
    , order = getRandomArray(n)
    , ins = [], i, j
    , arraySize = Math.min(10, n)   // The array for $in needs to be smaller than n (inclusive)
    ;

  // Preparing all the $in arrays, will take some time
  for (i = 0; i < n; i += 1) {
    ins[i] = [];

    for (j = 0; j < arraySize; j += 1) {
      ins[i].push((i + j) % n);
    }
  }

  profiler.step("Finding " + n + " documents WITH $IN OPERATOR");

  function runFrom(i) {
    if (i === n) {   // Finished
      console.log("===== RESULT (find with in selector) ===== " + Math.floor(1000* n / profiler.elapsedSinceLastStep()) + " ops/s");
      profiler.step('Finished finding ' + n + ' docs');
      return cb();
    }

    d.find({ docNumber: { $in: ins[i] } }, function (err, docs) {
      if (docs.length !== arraySize) { return cb('One find didnt work'); }
      executeAsap(function () {
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
      console.log("===== RESULT (findOne) ===== " + Math.floor(1000* n / profiler.elapsedSinceLastStep()) + " ops/s");
      profiler.step('Finished finding ' + n + ' docs');
      return cb();
    }

    d.findOne({ docNumber: order[i] }, function (err, doc) {
      if (!doc || doc.docNumber !== order[i]) { return cb('One find didnt work'); }
      executeAsap(function () {
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
      console.log("===== RESULT (update) ===== " + Math.floor(1000* n / profiler.elapsedSinceLastStep()) + " ops/s");
      profiler.step('Finished updating ' + n + ' docs');
      return cb();
    }

    // Will not actually modify the document but will take the same time
    d.update({ docNumber: order[i] }, { docNumber: order[i] }, options, function (err, nr) {
      if (err) { return cb(err); }
      if (nr !== 1) { return cb('One update didnt work'); }
      executeAsap(function () {
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
      // opsPerSecond corresponds to 1 insert + 1 remove, needed to keep collection size at 10,000
      // We need to subtract the time taken by one insert to get the time actually taken by one remove
      var opsPerSecond = Math.floor(1000 * n / profiler.elapsedSinceLastStep());
      var removeOpsPerSecond = Math.floor(1 / ((1 / opsPerSecond) - (1 / profiler.insertOpsPerSecond)))
      console.log("===== RESULT (remove) ===== " + removeOpsPerSecond + " ops/s");
      profiler.step('Finished removing ' + n + ' docs');
      return cb();
    }

    d.remove({ docNumber: order[i] }, options, function (err, nr) {
      if (err) { return cb(err); }
      if (nr !== 1) { return cb('One remove didnt work'); }
      d.insert({ docNumber: order[i] }, function (err) {   // We need to reinsert the doc so that we keep the collection's size at n
                                                           // So actually we're calculating the average time taken by one insert + one remove
        executeAsap(function () {
          runFrom(i + 1);
        });
      });
    });
  }
  runFrom(0);
};


/**
 * Load database
 */
module.exports.loadDatabase = function (d, n, profiler, cb) {
  var beg = new Date()
    , order = getRandomArray(n)
    ;

  profiler.step("Loading the database " + n + " times");

  function runFrom(i) {
    if (i === n) {   // Finished
      console.log("===== RESULT ===== " + Math.floor(1000* n / profiler.elapsedSinceLastStep()) + " ops/s");
      profiler.step('Finished loading a database' + n + ' times');
      return cb();
    }

    d.loadDatabase(function (err) {
      executeAsap(function () {
        runFrom(i + 1);
      });
    });
  }
  runFrom(0);
};




