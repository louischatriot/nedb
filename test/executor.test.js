var should = require('chai').should()
  , assert = require('chai').assert
  , testDb = 'workspace/test.db'
  , fs = require('fs')
  , path = require('path')
  , _ = require('underscore')
  , async = require('async')
  , model = require('../lib/model')
  , Datastore = require('../lib/datastore')
  , Persistence = require('../lib/persistence')
  ;


// Test that even if a callback throws an exception, the next DB operations will still be executed
// We prevent Mocha from catching the exception we throw on purpose by remembering all current handlers, remove them and register them back after test ends
function testThrowInCallback (d, done) {
  var currentUncaughtExceptionHandlers = process.listeners('uncaughtException');

  process.removeAllListeners('uncaughtException');

  process.on('uncaughtException', function (err) {
    // Do nothing with the error which is only there to test we stay on track
  });

  d.find({}, function (err) {
    process.nextTick(function () {
      d.insert({ bar: 1 }, function (err) {
        process.removeAllListeners('uncaughtException');
        for (var i = 0; i < currentUncaughtExceptionHandlers.length; i += 1) {
          process.on('uncaughtException', currentUncaughtExceptionHandlers[i]);
        }

        done();
      });
    });

    throw new Error('Some error');
  });
}

// Test that if the callback is falsy, the next DB operations will still be executed
function testFalsyCallback (d, done) {
  d.insert({ a: 1 }, null);
  process.nextTick(function () {
    d.update({ a: 1 }, { a: 2 }, {}, null);
    process.nextTick(function () {
      d.update({ a: 2 }, { a: 1 }, null);
      process.nextTick(function () {
        d.remove({ a: 2 }, {}, null);
        process.nextTick(function () {
          d.remove({ a: 2 }, null);
          process.nextTick(function () {
            d.find({}, done);
          });
        });
      });
    });
  });
}

// Test that operations are executed in the right order
// We prevent Mocha from catching the exception we throw on purpose by remembering all current handlers, remove them and register them back after test ends
function testRightOrder (d, done) {
  var currentUncaughtExceptionHandlers = process.listeners('uncaughtException');

  process.removeAllListeners('uncaughtException');

  process.on('uncaughtException', function (err) {
    // Do nothing with the error which is only there to test we stay on track
  });

  d.find({}, function (err, docs) {
    docs.length.should.equal(0);

    d.insert({ a: 1 }, function () {
      d.update({ a: 1 }, { a: 2 }, {}, function () {
        d.find({}, function (err, docs) {
          docs[0].a.should.equal(2);

          process.nextTick(function () {
            d.update({ a: 2 }, { a: 3 }, {}, function () {
              d.find({}, function (err, docs) {
                docs[0].a.should.equal(3);

                process.removeAllListeners('uncaughtException');
                for (var i = 0; i < currentUncaughtExceptionHandlers.length; i += 1) {
                  process.on('uncaughtException', currentUncaughtExceptionHandlers[i]);
                }

                done();
              });
            });
          });

          throw new Error('Some error');
        });
      });
    });
  });
}

// Note:  The following test does not have any assertion because it
// is meant to address the deprecation warning:
// (node) warning: Recursive process.nextTick detected. This will break in the next version of node. Please use setImmediate for recursive deferral.
// see
var testEventLoopStarvation = function(d, done){
   var times = 1001;
   var i = 0;
   while ( i <times) {
      i++;
     d.find({"bogus": "search"}, function (err, docs) {
     });
   }
   done();
};

// Test that operations are executed in the right order even with no callback
function testExecutorWorksWithoutCallback (d, done) {
  d.insert({ a: 1 });
  d.insert({ a: 2 }, false);
  d.find({}, function (err, docs) {
    docs.length.should.equal(2);
    done();
  });
}


describe('Executor', function () {

  describe('With persistent database', function () {
    var d;

    beforeEach(function (done) {
      d = new Datastore({ filename: testDb });
      d.filename.should.equal(testDb);
      d.inMemoryOnly.should.equal(false);

      async.waterfall([
        function (cb) {
          Persistence.ensureDirectoryExists(path.dirname(testDb), function () {
            fs.exists(testDb, function (exists) {
              if (exists) {
                fs.unlink(testDb, cb);
              } else { return cb(); }
            });
          });
        }
      , function (cb) {
          d.loadDatabase(function (err) {
            assert.isNull(err);
            d.getAllData().length.should.equal(0);
            return cb();
          });
        }
      ], done);
    });

    it('A throw in a callback doesnt prevent execution of next operations', function(done) {
      testThrowInCallback(d, done);
    });

    it('A falsy callback doesnt prevent execution of next operations', function(done) {
      testFalsyCallback(d, done);
    });

    it('Operations are executed in the right order', function(done) {
      testRightOrder(d, done);
    });

    it('Does not starve event loop and raise warning when more than 1000 callbacks are in queue', function(done){
      testEventLoopStarvation(d, done);
    });

    it('Works in the right order even with no supplied callback', function(done){
      testExecutorWorksWithoutCallback(d, done);
    });

  });   // ==== End of 'With persistent database' ====


  describe('With non persistent database', function () {
    var d;

    beforeEach(function (done) {
      d = new Datastore({ inMemoryOnly: true });
      d.inMemoryOnly.should.equal(true);

      d.loadDatabase(function (err) {
        assert.isNull(err);
        d.getAllData().length.should.equal(0);
        return done();
      });
    });

    it('A throw in a callback doesnt prevent execution of next operations', function(done) {
      testThrowInCallback(d, done);
    });

    it('A falsy callback doesnt prevent execution of next operations', function(done) {
      testFalsyCallback(d, done);
    });

    it('Operations are executed in the right order', function(done) {
      testRightOrder(d, done);
    });

    it('Works in the right order even with no supplied callback', function(done){
      testExecutorWorksWithoutCallback(d, done);
    });

  });   // ==== End of 'With non persistent database' ====

});
