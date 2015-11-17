var Datastore = require('../lib/datastore')
  , benchDb = 'workspace/find.bench.db'
  , fs = require('fs')
  , path = require('path')
  , async = require('async')
  , execTime = require('exec-time')
  , profiler = new execTime('FIND BENCH')
  , commonUtilities = require('./commonUtilities')
  , config = commonUtilities.getConfiguration(benchDb)
  , d = config.d
  , n = config.n
  ;

async.waterfall([
  async.apply(commonUtilities.prepareDb, benchDb)
, function (cb) {
    d.loadDatabase(function (err) {
      if (err) { return cb(err); }
      if (config.program.withIndex) { d.ensureIndex({ fieldName: 'docNumber' }); }
      cb();
    });
  }
, function (cb) { profiler.beginProfiling(); return cb(); }
, async.apply(commonUtilities.insertDocs, d, n, profiler)
, async.apply(commonUtilities.findDocsWithIn, d, n, profiler)
], function (err) {
  profiler.step("Benchmark finished");

  if (err) { return console.log("An error was encountered: ", err); }
});
