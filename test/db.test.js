var Datastore = require('../lib/datastore')
  , testDb = 'workspace/test.db'
  , fs = require('fs')
  , path = require('path')
  , customUtils = require('../lib/customUtils')
  , should = require('chai').should()
  , assert = require('chai').assert
  , _ = require('underscore')
  , async = require('async')
  ;


describe('Database', function () {
  beforeEach(function (done) {
    customUtils.ensureDirectoryExists(path.dirname(testDb), function () {
      fs.exists(testDb, function (exists) {
        if (exists) {
          fs.unlink(testDb, done);
        } else { return done(); }
      });
    });
  });

  describe('Insert', function () {

    it('Able to insert a document in the database and retrieve it even after a reload', function (done) {
      var d = new Datastore(testDb);
      d.loadDatabase(function (err) {
        assert.isNull(err);
        d.find({}, function (err, docs) {
          docs.length.should.equal(0);

          d.insert({ somedata: 'ok' }, function (err) {
            // The data was correctly updated
            d.find({}, function (err, docs) {
              assert.isNull(err);
              docs.length.should.equal(1);
              Object.keys(docs[0]).length.should.equal(2);
              docs[0].somedata.should.equal('ok');
              assert.isDefined(docs[0]._id);

              // After a reload the data has been correctly persisted
              d.loadDatabase(function (err) {
                d.find({}, function (err, docs) {
                  assert.isNull(err);
                  docs.length.should.equal(1);
                  Object.keys(docs[0]).length.should.equal(2);
                  docs[0].somedata.should.equal('ok');
                  assert.isDefined(docs[0]._id);


                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Can insert multiple documents in the database', function (done) {
      var d = new Datastore(testDb);
      d.loadDatabase(function (err) {
        assert.isNull(err);
        d.find({}, function (err, docs) {
          docs.length.should.equal(0);

          d.insert({ somedata: 'ok' }, function (err) {
            d.insert({ somedata: 'another' }, function (err) {
              d.insert({ somedata: 'again' }, function (err) {
                d.find({}, function (err, docs) {
                  docs.length.should.equal(3);
                  _.pluck(docs, 'somedata').should.contain('ok');
                  _.pluck(docs, 'somedata').should.contain('another');
                  _.pluck(docs, 'somedata').should.contain('again');
                  done();
                });
              });
            });
          });
        });
      });
    });

  });   // ==== End of 'Insert' ==== //


  describe('Find', function () {

    it('Can find all documents an empty query is used', function (done) {
      var d = new Datastore(testDb);

      async.waterfall([
      function (cb) {
        d.loadDatabase(function (err) {
          d.insert({ somedata: 'ok' }, function (err) {
            d.insert({ somedata: 'another', plus: 'additional data' }, function (err) {
              d.insert({ somedata: 'again' }, function (err) { return cb(err); });
            });
          });
        });
      }
      , function (cb) {   // Test with empty object
        d.find({}, function (err, docs) {
          assert.isNull(err);
          docs.length.should.equal(3);
          _.pluck(docs, 'somedata').should.contain('ok');
          _.pluck(docs, 'somedata').should.contain('another');
          _.find(docs, function (d) { return d.somedata === 'another' }).plus.should.equal('additional data');
          _.pluck(docs, 'somedata').should.contain('again');
          return cb();
        });
      }
      ], done);
    });

    it('Can find all documents matching a basic query', function (done) {
      var d = new Datastore(testDb);

      async.waterfall([
      function (cb) {
        d.loadDatabase(function (err) {
          d.insert({ somedata: 'ok' }, function (err) {
            d.insert({ somedata: 'again', plus: 'additional data' }, function (err) {
              d.insert({ somedata: 'again' }, function (err) { return cb(err); });
            });
          });
        });
      }
      , function (cb) {   // Test with query that will return docs
        d.find({ somedata: 'again' }, function (err, docs) {
          assert.isNull(err);
          docs.length.should.equal(2);
          _.pluck(docs, 'somedata').should.not.contain('ok');
          return cb();
        });
      }
      , function (cb) {   // Test with query that doesn't match anything
        d.find({ somedata: 'nope' }, function (err, docs) {
          assert.isNull(err);
          docs.length.should.equal(0);
          return cb();
        });
      }
      ], done);
    });

    it('Can find one document matching a basic query and return null if none is found', function (done) {
      var d = new Datastore(testDb);

      async.waterfall([
      function (cb) {
        d.loadDatabase(function (err) {
          d.insert({ somedata: 'ok' }, function (err) {
            d.insert({ somedata: 'again', plus: 'additional data' }, function (err) {
              d.insert({ somedata: 'again' }, function (err) { return cb(err); });
            });
          });
        });
      }
      , function (cb) {   // Test with query that will return docs
        d.findOne({ somedata: 'ok' }, function (err, doc) {
          assert.isNull(err);
          Object.keys(doc).length.should.equal(2);
          doc.somedata.should.equal('ok');
          assert.isDefined(doc._id);
          return cb();
        });
      }
      , function (cb) {   // Test with query that doesn't match anything
        d.findOne({ somedata: 'nope' }, function (err, doc) {
          assert.isNull(err);
          assert.isNull(doc);
          return cb();
        });
      }
      ], done);
    });

  });   // ==== End of 'Find' ==== //


  describe('Update', function () {

    it("If the query doesn't match anything, database is not modified", function (done) {
      var d = new Datastore(testDb);

      async.waterfall([
      function (cb) {
        d.loadDatabase(function (err) {
          d.insert({ somedata: 'ok' }, function (err) {
            d.insert({ somedata: 'again', plus: 'additional data' }, function (err) {
              d.insert({ somedata: 'another' }, function (err) { return cb(err); });
            });
          });
        });
      }
      , function (cb) {   // Test with query that doesn't match anything
        d.update({ somedata: 'nope' }, { newDoc: 'yes' }, { multi: true }, function (err, n) {
          assert.isNull(err);
          n.should.equal(0);

          d.find({}, function (err, docs) {
            var doc1 = _.find(docs, function (d) { return d.somedata === 'ok'; })
              , doc2 = _.find(docs, function (d) { return d.somedata === 'again'; })
              , doc3 = _.find(docs, function (d) { return d.somedata === 'another'; })
              ;

            docs.length.should.equal(3);
            assert.isUndefined(_.find(docs, function (d) { return d.newDoc === 'yes'; }));

            Object.keys(doc1).length.should.equal(2);
            doc1.somedata.should.equal('ok');
            assert.isDefined(doc1._id);

            Object.keys(doc2).length.should.equal(3);
            doc2.somedata.should.equal('again');
            doc2.plus.should.equal('additional data');
            assert.isDefined(doc2._id);

            Object.keys(doc3).length.should.equal(2);
            doc3.somedata.should.equal('another');
            assert.isDefined(doc3._id);
            return cb();
          });
        });
      }
      ], done);
    });

    it("Can update multiple documents matching the query", function (done) {
      var d = new Datastore(testDb)
        , id1, id2, id3;

      // Test DB state after update and reload
      function testPostUpdateState (cb) {
        d.find({}, function (err, docs) {
          var doc1 = _.find(docs, function (d) { return d._id === id1; })
            , doc2 = _.find(docs, function (d) { return d._id === id2; })
            , doc3 = _.find(docs, function (d) { return d._id === id3; })
            ;

          docs.length.should.equal(3);

          Object.keys(doc1).length.should.equal(2);
          doc1.somedata.should.equal('ok');
          doc1._id.should.equal(id1);

          Object.keys(doc2).length.should.equal(2);
          doc2.newDoc.should.equal('yes');
          doc2._id.should.equal(id2);

          Object.keys(doc3).length.should.equal(2);
          doc3.newDoc.should.equal('yes');
          doc3._id.should.equal(id3);

          return cb();
        });
      }

      // Actually launch the tests
      async.waterfall([
      function (cb) {
        d.loadDatabase(function (err) {
          d.insert({ somedata: 'ok' }, function (err, doc1) {
            id1 = doc1._id;
            d.insert({ somedata: 'again', plus: 'additional data' }, function (err, doc2) {
              id2 = doc2._id;
              d.insert({ somedata: 'again' }, function (err, doc3) {
                id3 = doc3._id;
                return cb(err);
              });
            });
          });
        });
      }
      , function (cb) {   // Test with query that doesn't match anything
        d.update({ somedata: 'again' }, { newDoc: 'yes' }, { multi: true }, function (err, n) {
          assert.isNull(err);
          n.should.equal(2);
          return cb();
        });
      }
      , async.apply(testPostUpdateState)
      , function (cb) {
        d.loadDatabase(function (err) { cb(err); });
      }
      , async.apply(testPostUpdateState)
      ], done);
    });

    it("Can update only one document matching the query", function (done) {
      var d = new Datastore(testDb)
        , id1, id2, id3;

      // Test DB state after update and reload
      function testPostUpdateState (cb) {
        d.find({}, function (err, docs) {
          var doc1 = _.find(docs, function (d) { return d._id === id1; })
            , doc2 = _.find(docs, function (d) { return d._id === id2; })
            , doc3 = _.find(docs, function (d) { return d._id === id3; })
            ;

          docs.length.should.equal(3);

          Object.keys(doc1).length.should.equal(2);
          doc1.somedata.should.equal('ok');
          doc1._id.should.equal(id1);

          Object.keys(doc2).length.should.equal(2);
          doc2.newDoc.should.equal('yes');
          doc2._id.should.equal(id2);

          // Third object was not updated
          Object.keys(doc3).length.should.equal(2);
          doc3.somedata.should.equal('again');
          doc3._id.should.equal(id3);

          return cb();
        });
      }

      // Actually launch the test
      async.waterfall([
      function (cb) {
        d.loadDatabase(function (err) {
          d.insert({ somedata: 'ok' }, function (err, doc1) {
            id1 = doc1._id;
            d.insert({ somedata: 'again', plus: 'additional data' }, function (err, doc2) {
              id2 = doc2._id;
              d.insert({ somedata: 'again' }, function (err, doc3) {
                id3 = doc3._id;
                return cb(err);
              });
            });
          });
        });
      }
      , function (cb) {   // Test with query that doesn't match anything
        d.update({ somedata: 'again' }, { newDoc: 'yes' }, { multi: false }, function (err, n) {
          assert.isNull(err);
          n.should.equal(1);
          return cb();
        });
      }
      , async.apply(testPostUpdateState)
      , function (cb) {
        d.loadDatabase(function (err) { return cb(err); });
      }
      , async.apply(testPostUpdateState)   // The persisted state has been updated
      ], done);
    });

  });   // ==== End of 'Update' ==== //


  describe('Remove', function () {

    it('Can remove multiple documents', function (done) {
      var d = new Datastore(testDb)
        , id1, id2, id3;

      // Test DB status
      function testPostUpdateState (cb) {
        d.find({}, function (err, docs) {
          docs.length.should.equal(1);

          Object.keys(docs[0]).length.should.equal(2);
          docs[0]._id.should.equal(id1);
          docs[0].somedata.should.equal('ok');

          return cb();
        });
      }

      // Actually launch the test
      async.waterfall([
      function (cb) {
        d.loadDatabase(function (err) {
          d.insert({ somedata: 'ok' }, function (err, doc1) {
            id1 = doc1._id;
            d.insert({ somedata: 'again', plus: 'additional data' }, function (err, doc2) {
              id2 = doc2._id;
              d.insert({ somedata: 'again' }, function (err, doc3) {
                id3 = doc3._id;
                return cb(err);
              });
            });
          });
        });
      }
      , function (cb) {   // Test with query that doesn't match anything
        d.remove({ somedata: 'again' }, { multi: true }, function (err, n) {
          assert.isNull(err);
          n.should.equal(2);
          return cb();
        });
      }
      , async.apply(testPostUpdateState)
      , function (cb) {
        d.loadDatabase(function (err) { return cb(err); });
      }
      , async.apply(testPostUpdateState)
      ], done);
    });


  });   // ==== End of 'Remove' ==== //




});
