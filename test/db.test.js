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
  var d = new Datastore(testDb);

  beforeEach(function (done) {
    async.waterfall([
      function (cb) {
        customUtils.ensureDirectoryExists(path.dirname(testDb), function () {
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
          return cb();
        });
      }
    ], done);

  });

  describe('Insert', function () {

    it('Able to insert a document in the database, setting an _id if none provided, and retrieve it even after a reload', function (done) {
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

    it('Can insert multiple documents in the database', function (done) {
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

    it('Can insert and get back from DB complex objects with all primitive and secondary types', function (done) {
      var da = new Date()
        , obj = { a: ['ee', 'ff', 42], date: da, subobj: { a: 'b', b: 'c' } }
        ;

      d.insert(obj, function (err) {
        d.findOne({}, function (err, res) {
          assert.isNull(err);
          res.a.length.should.equal(3);
          res.a[0].should.equal('ee');
          res.a[1].should.equal('ff');
          res.a[2].should.equal(42);
          res.date.getTime().should.equal(da.getTime());
          res.subobj.a.should.equal('b');
          res.subobj.b.should.equal('c');

          done();
        });
      });
    });

    it('If an object returned from the DB is modified and refetched, the original value should be found', function (done) {
      d.insert({ a: 'something' }, function () {
        d.findOne({}, function (err, doc) {
          doc.a.should.equal('something');
          doc.a = 'another thing';
          doc.a.should.equal('another thing');

          // Re-fetching with findOne should yield the persisted value
          d.findOne({}, function (err, doc) {
            doc.a.should.equal('something');
            doc.a = 'another thing';
            doc.a.should.equal('another thing');

            // Re-fetching with find should yield the persisted value
            d.find({}, function (err, docs) {
              docs[0].a.should.equal('something');

              done();
            });
          });
        });
      });
    });

    it('Cannot insert a doc that has a field beginning with a $ sign', function (done) {
      d.insert({ $something: 'atest' }, function (err) {
        assert.isDefined(err);
        done();
      });
    });

    it('If an _id is already given when we insert a document, use it and not the default uid', function (done) {
      d.insert({ _id: 'test', stuff: true }, function (err, newDoc) {
        if (err) { return done(err); }

        newDoc.stuff.should.equal(true);
        newDoc._id.should.equal('test');

        done();
      });
    });

  });   // ==== End of 'Insert' ==== //


  describe('Find', function () {

    it('Can find all documents if an empty query is used', function (done) {
      async.waterfall([
      function (cb) {
        d.insert({ somedata: 'ok' }, function (err) {
          d.insert({ somedata: 'another', plus: 'additional data' }, function (err) {
            d.insert({ somedata: 'again' }, function (err) { return cb(err); });
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
      async.waterfall([
      function (cb) {
        d.insert({ somedata: 'ok' }, function (err) {
          d.insert({ somedata: 'again', plus: 'additional data' }, function (err) {
            d.insert({ somedata: 'again' }, function (err) { return cb(err); });
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
      async.waterfall([
      function (cb) {
        d.insert({ somedata: 'ok' }, function (err) {
          d.insert({ somedata: 'again', plus: 'additional data' }, function (err) {
            d.insert({ somedata: 'again' }, function (err) { return cb(err); });
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

    it('Can find dates and objects (non JS-native types)', function (done) {
      var date1 = new Date(1234543)
        , date2 = new Date(9999)
        ;

      d.insert({ now: date1, sth: { name: 'nedb' } }, function () {
        d.findOne({ now: date1 }, function (err, doc) {
          assert.isNull(err);
          doc.sth.name.should.equal('nedb');

          d.findOne({ now: date2 }, function (err, doc) {
            assert.isNull(err);
            assert.isNull(doc);

            d.findOne({ sth: { name: 'nedb' } }, function (err, doc) {
              assert.isNull(err);
              doc.sth.name.should.equal('nedb');

              d.findOne({ sth: { name: 'other' } }, function (err, doc) {
                assert.isNull(err);
                assert.isNull(doc);

                done();
              });
            });
          });
        });
      });
    });

    it('Can use dot-notation to query subfields', function (done) {
      d.insert({ greeting: { english: 'hello' } }, function () {
        d.findOne({ "greeting.english": 'hello' }, function (err, doc) {
          assert.isNull(err);
          doc.greeting.english.should.equal('hello');

          d.findOne({ "greeting.english": 'hellooo' }, function (err, doc) {
            assert.isNull(err);
            assert.isNull(doc);

            d.findOne({ "greeting.englis": 'hello' }, function (err, doc) {
              assert.isNull(err);
              assert.isNull(doc);

              done();
            });
          });
        });
      });
    });

    it('Array fields match if any element matches', function (done) {
      d.insert({ fruits: ['pear', 'apple', 'banana'] }, function (err, doc1) {
        d.insert({ fruits: ['coconut', 'orange', 'pear'] }, function (err, doc2) {
          d.insert({ fruits: ['banana'] }, function (err, doc3) {
            d.find({ fruits: 'pear' }, function (err, docs) {
              assert.isNull(err);
              docs.length.should.equal(2);
              _.pluck(docs, '_id').should.contain(doc1._id);
              _.pluck(docs, '_id').should.contain(doc2._id);

              d.find({ fruits: 'banana' }, function (err, docs) {
                assert.isNull(err);
                docs.length.should.equal(2);
                _.pluck(docs, '_id').should.contain(doc1._id);
                _.pluck(docs, '_id').should.contain(doc3._id);

                d.find({ fruits: 'doesntexist' }, function (err, docs) {
                  assert.isNull(err);
                  docs.length.should.equal(0);

                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Returns an error if the query is not well formed', function (done) {
      d.insert({ hello: 'world' }, function () {
        d.find({ $or: { hello: 'world' } }, function (err, docs) {
          assert.isDefined(err);
          assert.isUndefined(docs);

          d.findOne({ $or: { hello: 'world' } }, function (err, doc) {
            assert.isDefined(err);
            assert.isUndefined(doc);

            done();
          });
        });
      });
    });

  });   // ==== End of 'Find' ==== //


  describe('Update', function () {

    it("If the query doesn't match anything, database is not modified", function (done) {
      async.waterfall([
      function (cb) {
        d.insert({ somedata: 'ok' }, function (err) {
          d.insert({ somedata: 'again', plus: 'additional data' }, function (err) {
            d.insert({ somedata: 'another' }, function (err) { return cb(err); });
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
      var id1, id2, id3;

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
      var id1, id2, id3;

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

    it('Can perform upserts if needed', function (done) {
      d.update({ impossible: 'db is empty anyway' }, { newDoc: true }, {}, function (err, nr, upsert) {
        assert.isNull(err);
        nr.should.equal(0);
        assert.isUndefined(upsert);

        d.find({}, function (err, docs) {
          docs.length.should.equal(0);   // Default option for upsert is false

          d.update({ impossible: 'db is empty anyway' }, { newDoc: true }, { upsert: true }, function (err, nr, upsert) {
            assert.isNull(err);
            nr.should.equal(1);
            upsert.should.equal(true);

            d.find({}, function (err, docs) {
              docs.length.should.equal(1);   // Default option for upsert is false
              docs[0].newDoc.should.equal(true);

              done();
            });
          });
        });
      });
    });

    it('Cannot perform update if the update query is not either registered-modifiers-only or copy-only, or contain badly formatted fields', function (done) {
      d.insert({ something: 'yup' }, function () {
        d.update({}, { boom: { $badfield: 5 } }, { multi: false }, function (err) {
          assert.isDefined(err);

          d.update({}, { boom: { "bad.field": 5 } }, { multi: false }, function (err) {
            assert.isDefined(err);

            d.update({}, { $inc: { test: 5 }, mixed: 'rrr' }, { multi: false }, function (err) {
              assert.isDefined(err);

              d.update({}, { $inexistent: { test: 5 } }, { multi: false }, function (err) {
                assert.isDefined(err);

                done();
              });
            });
          });
        });
      });
    });

    it('Can update documents using multiple modifiers', function (done) {
      var id;

      d.insert({ something: 'yup', other: 40 }, function (err, newDoc) {
        id = newDoc._id;

        d.update({}, { $set: { something: 'changed' }, $inc: { other: 10 } }, { multi: false }, function (err, nr) {
          assert.isNull(err);
          nr.should.equal(1);

          d.findOne({ _id: id }, function (err, doc) {
            Object.keys(doc).length.should.equal(3);
            doc._id.should.equal(id);
            doc.something.should.equal('changed');
            doc.other.should.equal(50);

            done();
          });
        });
      });
    });

    it('Can upsert a document even with modifiers', function (done) {
      d.update({ bloup: 'blap' }, { $set: { hello: 'world' } }, { upsert: true }, function (err, nr, upsert) {
        assert.isNull(err);
        nr.should.equal(1);
        upsert.should.equal(true);

        d.find({}, function (err, docs) {
          docs.length.should.equal(1);
          Object.keys(docs[0]).length.should.equal(3);
          docs[0].hello.should.equal('world');
          docs[0].bloup.should.equal('blap');
          assert.isDefined(docs[0]._id);

          done();
        });
      });
    });

    it('When using modifiers, the only way to update subdocs is with the dot-notation', function (done) {
      d.insert({ bloup: { blip: "blap", other: true } }, function () {
        // Correct methos
        d.update({}, { $set: { "bloup.blip": "hello" } }, {}, function () {
          d.findOne({}, function (err, doc) {
            doc.bloup.blip.should.equal("hello");
            doc.bloup.other.should.equal(true);

            // Wrong
            d.update({}, { $set: { bloup: { blip: "ola" } } }, {}, function () {
              d.findOne({}, function (err, doc) {
                doc.bloup.blip.should.equal("ola");
                assert.isUndefined(doc.bloup.other);   // This information was lost

                done();
              });
            });
          });
        });
      });
    });

    it('Returns an error if the query is not well formed', function (done) {
      d.insert({ hello: 'world' }, function () {
        d.update({ $or: { hello: 'world' } }, { a: 1 }, {}, function (err, nr, upsert) {
          assert.isDefined(err);
          assert.isUndefined(nr);
          assert.isUndefined(upsert);

          done();
        });
      });
    });

  });   // ==== End of 'Update' ==== //


  describe('Remove', function () {

    it('Can remove multiple documents', function (done) {
      var id1, id2, id3;

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

    // This tests concurrency issues
    it('Remove can be called multiple times in parallel and everything that needs to be removed will be', function (done) {
      d.insert({ planet: 'Earth' }, function () {
        d.insert({ planet: 'Mars' }, function () {
          d.insert({ planet: 'Saturn' }, function () {
            d.find({}, function (err, docs) {
              docs.length.should.equal(3);

              // Remove two docs simultaneously
              var toRemove = ['Mars', 'Saturn'];
              async.each(toRemove, function(planet, cb) {
                d.remove({ planet: planet }, function (err) { return cb(err); });
              }, function (err) {
                d.find({}, function (err, docs) {
                  docs.length.should.equal(1);

                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Returns an error if the query is not well formed', function (done) {
      d.insert({ hello: 'world' }, function () {
        d.remove({ $or: { hello: 'world' } }, {}, function (err, nr, upsert) {
          assert.isDefined(err);
          assert.isUndefined(nr);
          assert.isUndefined(upsert);

          done();
        });
      });
    });

  });   // ==== End of 'Remove' ==== //


});
