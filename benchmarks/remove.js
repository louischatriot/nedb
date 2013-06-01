var Datastore = require('../lib/datastore')
  , benchDb = 'workspace/remove.bench.db'
  , fs = require('fs')
  , path = require('path')
  , async = require('async')
  , commonUtilities = require('./commonUtilities')
  , execTime = require('exec-time')
  , profiler = new execTime('REMOVE BENCH')
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
console.log(program.withIndex ? "Use an index" : "Don't use an index");
console.log("----------------------------");

async.waterfall([
  async.apply(commonUtilities.prepareDb, benchDb)
, function (cb) {
    d.loadDatabase(function (err) {
      if (err) { return cb(err); }
      if (program.withIndex) {
        d.ensureIndex({ fieldName: 'docNumber' });
      }
      cb();
    });
  }
, function (cb) { profiler.beginProfiling(); return cb(); }
, async.apply(commonUtilities.insertDocs, d, n, profiler)

// Test with remove only one document
, function (cb) { profiler.step('MULTI: FALSE'); return cb(); }
, async.apply(commonUtilities.removeDocs, { multi: false }, d, n, profiler)

// Test with multiple documents
, async.apply(commonUtilities.prepareDb, benchDb)
, function (cb) { d.loadDatabase(cb); }
, async.apply(commonUtilities.insertDocs, d, n, profiler)
, function (cb) { profiler.step('MULTI: TRUE'); return cb(); }
, async.apply(commonUtilities.removeDocs, { multi: true }, d, n, profiler)
], function (err) {
  profiler.step("Benchmark finished");

  if (err) { return console.log("An error was encountered: ", err); }
});
