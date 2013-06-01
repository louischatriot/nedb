var Datastore = require('../lib/datastore')
  , benchDb = 'workspace/insert.bench.db'
  , async = require('async')
  , commonUtilities = require('./commonUtilities')
  , execTime = require('exec-time')
  , profiler = new execTime('INSERT BENCH')
  , d = new Datastore(benchDb)
  , program = require('commander')
  , n
  ;

program
  .option('-n --number [number]', 'Size of the collection to test on', parseInt)
  .option('-i --with-index', 'Test with an index')
  .parse(process.argv);

n = program.number || 10000;

console.log("----------------------------");
console.log("Test with " + n + " documents");
console.log("----------------------------");

async.waterfall([
  async.apply(commonUtilities.prepareDb, benchDb)
, function (cb) {
    d.loadDatabase(function (err) {
      if (err) { return cb(err); }
      cb();
    });
  }
, function (cb) { profiler.beginProfiling(); return cb(); }
, async.apply(commonUtilities.insertDocs, d, n, profiler)
, function (cb) {
    var i;

    profiler.step('Begin calling ensureIndex ' + n + ' times');

    for (i = 0; i < n; i += 1) {
      d.ensureIndex({ fieldName: 'docNumber' });
      delete d.indexes.docNumber;
    }

    console.log("Average time for one ensureIndex: " + (profiler.elapsedSinceLastStep() / n) + "ms");
    profiler.step('Finished calling ensureIndex ' + n + ' times');
  }
], function (err) {
  profiler.step("Benchmark finished");

  if (err) { return console.log("An error was encountered: ", err); }
});

