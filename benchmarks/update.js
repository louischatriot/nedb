var Datastore = require('../lib/datastore')
  , benchDb = 'workspace/update.bench.db'
  , fs = require('fs')
  , path = require('path')
  , async = require('async')
  , commonUtilities = require('./commonUtilities')
  , execTime = require('exec-time')
  , profiler = new execTime('UPDATE BENCH')
  , d = new Datastore(benchDb)
  , n = 10000
  ;

if (process.argv[2]) { n = parseInt(process.argv[2], 10); }

async.waterfall([
  async.apply(commonUtilities.prepareDb, benchDb)
, function (cb) { d.loadDatabase(cb); }
, function (cb) { profiler.beginProfiling(); return cb(); }
, async.apply(commonUtilities.insertDocs, d, n, profiler)

// Test with update only one document
, function (cb) { profiler.step('MULTI: FALSE'); return cb(); }
, async.apply(commonUtilities.updateDocs, { multi: false }, d, n, profiler)

// Test with multiple documents
, async.apply(commonUtilities.prepareDb, benchDb)
, function (cb) { d.loadDatabase(cb); }
, async.apply(commonUtilities.insertDocs, d, n, profiler)
, function (cb) { profiler.step('MULTI: TRUE'); return cb(); }
, async.apply(commonUtilities.updateDocs, { multi: true }, d, n, profiler)
], function (err) {
  profiler.step("Benchmark finished");

  if (err) { return console.log("An error was encountered: ", err); }
});
