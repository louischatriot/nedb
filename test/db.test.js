var Datastore = require('../lib/datastore')
  , testDb = 'workspace/test.db'
  , fs = require('fs')
  , path = require('path')
  , customUtils = require('../lib/customUtils')
  , should = require('chai').should()
  , assert = require('chai').assert
  , _ = require('underscore')
  , async = require('async')
  , model = require('../lib/model')
  ;


describe('Database', function () {
  var d;

  beforeEach(function (done) {
    d = new Datastore(testDb);

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
          d.datafileSize.should.equal(0);
          d.data.length.should.equal(0);
          return cb();
        });
      }
    ], done);

  });


  describe('Loading the database data from file and persistence', function () {

    it('Every line represents a document', function () {
      var now = new Date()
        , rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                    model.serialize({ _id: "2", hello: 'world' }) + '\n' +
                    model.serialize({ _id: "3", nested: { today: now } })
        , treatedData = Datastore.treatRawData(rawData)
        ;

      treatedData.sort(function (a, b) { return a._id - b._id; });
      treatedData.length.should.equal(3);
      _.isEqual(treatedData[0], { _id: "1", a: 2, ages: [1, 5, 12] }).should.equal(true);
      _.isEqual(treatedData[1], { _id: "2", hello: 'world' }).should.equal(true);
      _.isEqual(treatedData[2], { _id: "3", nested: { today: now } }).should.equal(true);
    });

    it('Badly formatted lines have no impact on the treated data', function () {
      var now = new Date()
        , rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                    'garbage\n' +
                    model.serialize({ _id: "3", nested: { today: now } })
        , treatedData = Datastore.treatRawData(rawData)
        ;

      treatedData.sort(function (a, b) { return a._id - b._id; });
      treatedData.length.should.equal(2);
      _.isEqual(treatedData[0], { _id: "1", a: 2, ages: [1, 5, 12] }).should.equal(true);
      _.isEqual(treatedData[1], { _id: "3", nested: { today: now } }).should.equal(true);
    });

    it('Well formatted lines that have no _id are not included in the data', function () {
      var now = new Date()
        , rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                    model.serialize({ _id: "2", hello: 'world' }) + '\n' +
                    model.serialize({ nested: { today: now } })
        , treatedData = Datastore.treatRawData(rawData)
        ;

      treatedData.sort(function (a, b) { return a._id - b._id; });
      treatedData.length.should.equal(2);
      _.isEqual(treatedData[0], { _id: "1", a: 2, ages: [1, 5, 12] }).should.equal(true);
      _.isEqual(treatedData[1], { _id: "2", hello: 'world' }).should.equal(true);
    });

    it('If two lines concern the same doc (= same _id), the last one is the good version', function () {
      var now = new Date()
        , rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                    model.serialize({ _id: "2", hello: 'world' }) + '\n' +
                    model.serialize({ _id: "1", nested: { today: now } })
        , treatedData = Datastore.treatRawData(rawData)
        ;

      treatedData.sort(function (a, b) { return a._id - b._id; });
      treatedData.length.should.equal(2);
      _.isEqual(treatedData[0], { _id: "1", nested: { today: now } }).should.equal(true);
      _.isEqual(treatedData[1], { _id: "2", hello: 'world' }).should.equal(true);
    });

    it('If a doc contains $$deleted: true, that means we need to remove it from the data', function () {
      var now = new Date()
        , rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                    model.serialize({ _id: "2", hello: 'world' }) + '\n' +
                    model.serialize({ _id: "1", $$deleted: true }) + '\n' +
                    model.serialize({ _id: "3", today: now })
        , treatedData = Datastore.treatRawData(rawData)
        ;

      treatedData.sort(function (a, b) { return a._id - b._id; });
      treatedData.length.should.equal(2);
      _.isEqual(treatedData[0], { _id: "2", hello: 'world' }).should.equal(true);
      _.isEqual(treatedData[1], { _id: "3", today: now }).should.equal(true);
    });

    it('If a doc contains $$deleted: true, no error is thrown if the doc wasnt in the list before', function () {
      var now = new Date()
        , rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                    model.serialize({ _id: "2", $$deleted: true }) + '\n' +
                    model.serialize({ _id: "3", today: now })
        , treatedData = Datastore.treatRawData(rawData)
        ;

      treatedData.sort(function (a, b) { return a._id - b._id; });
      treatedData.length.should.equal(2);
      _.isEqual(treatedData[0], { _id: "1", a: 2, ages: [1, 5, 12] }).should.equal(true);
      _.isEqual(treatedData[1], { _id: "3", today: now }).should.equal(true);
    });

    it('Compact database on load', function (done) {
      d.insert({ a: 2 }, function () {
        d.insert({ a: 4 }, function () {
          d.remove({ a: 2 }, {}, function () {
            // Here, the underlying file is 3 lines long for only one document
            var data = fs.readFileSync(d.filename, 'utf8').split('\n')
              , filledCount = 0;

            data.forEach(function (item) { if (item.length > 0) { filledCount += 1; } });
            filledCount.should.equal(3);

            d.loadDatabase(function (err) {
              assert.isNull(err);

              // Now, the file has been compacted and is only 1 line long
              var data = fs.readFileSync(d.filename, 'utf8').split('\n')
                , filledCount = 0;

              data.forEach(function (item) { if (item.length > 0) { filledCount += 1; } });
              filledCount.should.equal(1);

              done();
            });
          })
        });
      });
    });

    it('datafileSize is the size of the dataset upon a databaseLoad', function (done) {
      var now = new Date()
        , rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                    model.serialize({ _id: "2", hello: 'world' }) + '\n' +
                    model.serialize({ _id: "3", nested: { today: now } })
        ;

      d.data.length.should.equal(0);
      d.datafileSize.should.equal(0);

      fs.writeFile(testDb, rawData, 'utf8', function () {
        d.loadDatabase(function () {
          d.data.length.should.equal(3);
          d.datafileSize.should.equal(3);

          d.find({}, function (err, docs) {
            docs.sort(function (a, b) { return a._id - b._id; });
            docs.length.should.equal(3);
            _.isEqual(docs[0], { _id: "1", a: 2, ages: [1, 5, 12] }).should.equal(true);
            _.isEqual(docs[1], { _id: "2", hello: 'world' }).should.equal(true);
            _.isEqual(docs[2], { _id: "3", nested: { today: now } }).should.equal(true);

            done();
          });
        });
      });
    });

  });   // ==== End of 'Loading the database data from file and persistence' ==== //


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

    it('If an _id is already given when we insert a document, dont use it but use an automatic one', function (done) {
      d.insert({ _id: 'test', stuff: true }, function (err, newDoc) {
        if (err) { return done(err); }

        newDoc.stuff.should.equal(true);
        newDoc._id.should.not.equal('test');

        done();
      });
    });

    it('datafileSize is incremented by 1 upon every insert', function (done) {
      d.datafileSize.should.equal(0);
      d.data.length.should.equal(0);
      d.insert({ a: 3 }, function () {
        d.datafileSize.should.equal(1);
        d.data.length.should.equal(1);
        d.insert({ a: 3 }, function () {
          d.datafileSize.should.equal(2);
          d.data.length.should.equal(2);
          d.insert({ a: 3 }, function () {
            d.datafileSize.should.equal(3);
            d.data.length.should.equal(3);
            done();
          });
        });
      });
    });

    it('Modifying the insertedDoc after an insert doesnt change the copy saved in the database', function (done) {
      d.insert({ a: 2, hello: 'world' }, function (err, newDoc) {
        newDoc.hello = 'changed';

        d.findOne({ a: 2 }, function (err, doc) {
          doc.hello.should.equal('world');
          done();
        });
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

    it('Changing the documents returned by find or findOne do not change the database state', function (done) {
      d.insert({ a: 2, hello: 'world' }, function () {
        d.findOne({ a: 2 }, function (err, doc) {
          doc.hello = 'changed';

          d.findOne({ a: 2 }, function (err, doc) {
            doc.hello.should.equal('world');

            d.find({ a: 2 }, function (err, docs) {
              docs[0].hello = 'changed';

              d.findOne({ a: 2 }, function (err, doc) {
                doc.hello.should.equal('world');

                done();
              });
            });
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

    it('Cant change the _id of a document', function (done) {
      d.insert({ a: 2 }, function (err, newDoc) {
        d.update({ a: 2 }, { a: 2, _id: 'nope' }, {}, function (err) {
          assert.isDefined(err);

          d.find({}, function (err, docs) {
            docs.length.should.equal(1);
            Object.keys(docs[0]).length.should.equal(2);
            docs[0].a.should.equal(2);
            docs[0]._id.should.equal(newDoc._id);

            d.update({ a: 2 }, { $set: { _id: 'nope' } }, {}, function (err) {
              assert.isDefined(err);

              d.find({}, function (err, docs) {
                docs.length.should.equal(1);
                Object.keys(docs[0]).length.should.equal(2);
                docs[0].a.should.equal(2);
                docs[0]._id.should.equal(newDoc._id);

                done();
              });
            });
          });
        });
      });
    });

    it('Non-multi updates are persistent', function (done) {
      d.insert({ a:1, hello: 'world' }, function (err, doc1) {
        d.insert({ a:2, hello: 'earth' }, function (err, doc2) {
          d.update({ a: 2 }, { $set: { hello: 'changed' } }, {}, function (err) {
            assert.isNull(err);

            d.find({}, function (err, docs) {
              docs.sort(function (a, b) { return a.a - b.a; });
              docs.length.should.equal(2);
              _.isEqual(docs[0], { _id: doc1._id, a:1, hello: 'world' }).should.equal(true);
              _.isEqual(docs[1], { _id: doc2._id, a:2, hello: 'changed' }).should.equal(true);

              // Even after a reload the database state hasn't changed
              d.loadDatabase(function (err) {
                assert.isNull(err);

                d.find({}, function (err, docs) {
                  docs.sort(function (a, b) { return a.a - b.a; });
                  docs.length.should.equal(2);
                  _.isEqual(docs[0], { _id: doc1._id, a:1, hello: 'world' }).should.equal(true);
                  _.isEqual(docs[1], { _id: doc2._id, a:2, hello: 'changed' }).should.equal(true);

                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Multi updates are persistent', function (done) {
      d.insert({ a:1, hello: 'world' }, function (err, doc1) {
        d.insert({ a:2, hello: 'earth' }, function (err, doc2) {
          d.insert({ a:5, hello: 'pluton' }, function (err, doc3) {
            d.update({ a: { $in: [1, 2] } }, { $set: { hello: 'changed' } }, { multi: true }, function (err) {
              assert.isNull(err);

              d.find({}, function (err, docs) {
                docs.sort(function (a, b) { return a.a - b.a; });
                docs.length.should.equal(3);
                _.isEqual(docs[0], { _id: doc1._id, a:1, hello: 'changed' }).should.equal(true);
                _.isEqual(docs[1], { _id: doc2._id, a:2, hello: 'changed' }).should.equal(true);
                _.isEqual(docs[2], { _id: doc3._id, a:5, hello: 'pluton' }).should.equal(true);

                // Even after a reload the database state hasn't changed
                d.loadDatabase(function (err) {
                  assert.isNull(err);

                  d.find({}, function (err, docs) {
                    docs.sort(function (a, b) { return a.a - b.a; });
                    docs.length.should.equal(3);
                    _.isEqual(docs[0], { _id: doc1._id, a:1, hello: 'changed' }).should.equal(true);
                    _.isEqual(docs[1], { _id: doc2._id, a:2, hello: 'changed' }).should.equal(true);
                    _.isEqual(docs[2], { _id: doc3._id, a:5, hello: 'pluton' }).should.equal(true);

                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    it('datafileSize stays correct upon updates', function (done) {
      d.insert({ a: 2 }, function () {
        d.insert({ a: 3 }, function () {
          d.insert({ a: 5 }, function () {
            d.datafileSize.should.equal(3);
            d.data.length.should.equal(3);

            d.update({ a: 3 }, { $set: { a: 4 } }, {}, function () {
              d.datafileSize.should.equal(4);
              d.data.length.should.equal(3);

              d.update({ a: { $in: [2, 4] } }, { $set: { a: 5 } }, { multi: true }, function () {
                d.datafileSize.should.equal(6);
                d.data.length.should.equal(3);

                done();
              });
            });
          });
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

    it('Non-multi removes are persistent', function (done) {
      d.insert({ a:1, hello: 'world' }, function (err, doc1) {
        d.insert({ a:2, hello: 'earth' }, function (err, doc2) {
          d.insert({ a:3, hello: 'moto' }, function (err, doc3) {
            d.remove({ a: 2 }, {}, function (err) {
              assert.isNull(err);

              d.find({}, function (err, docs) {
                docs.sort(function (a, b) { return a.a - b.a; });
                docs.length.should.equal(2);
                _.isEqual(docs[0], { _id: doc1._id, a:1, hello: 'world' }).should.equal(true);
                _.isEqual(docs[1], { _id: doc3._id, a:3, hello: 'moto' }).should.equal(true);

                // Even after a reload the database state hasn't changed
                d.loadDatabase(function (err) {
                  assert.isNull(err);

                  d.find({}, function (err, docs) {
                    docs.sort(function (a, b) { return a.a - b.a; });
                    docs.length.should.equal(2);
                    _.isEqual(docs[0], { _id: doc1._id, a:1, hello: 'world' }).should.equal(true);
                    _.isEqual(docs[1], { _id: doc3._id, a:3, hello: 'moto' }).should.equal(true);

                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    it('Multi removes are persistent', function (done) {
      d.insert({ a:1, hello: 'world' }, function (err, doc1) {
        d.insert({ a:2, hello: 'earth' }, function (err, doc2) {
          d.insert({ a:3, hello: 'moto' }, function (err, doc3) {
            d.remove({ a: { $in: [1, 3] } }, { multi: true }, function (err) {
              assert.isNull(err);

              d.find({}, function (err, docs) {
                docs.length.should.equal(1);
                _.isEqual(docs[0], { _id: doc2._id, a:2, hello: 'earth' }).should.equal(true);

                // Even after a reload the database state hasn't changed
                d.loadDatabase(function (err) {
                  assert.isNull(err);

                  d.find({}, function (err, docs) {
                    docs.length.should.equal(1);
                    _.isEqual(docs[0], { _id: doc2._id, a:2, hello: 'earth' }).should.equal(true);

                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    it('datafileSize stays correct upon removes', function (done) {
      d.insert({ a: 2 }, function () {
        d.insert({ a: 3 }, function () {
          d.insert({ a: 5 }, function () {
            d.datafileSize.should.equal(3);
            d.data.length.should.equal(3);

            d.remove({ a: 3 }, {}, function () {
              d.datafileSize.should.equal(4);
              d.data.length.should.equal(2);

              d.remove({ a: { $in: [2, 5] } }, { multi: true }, function () {
                d.datafileSize.should.equal(6);
                d.data.length.should.equal(0);

                done();
              });
            });
          });
        });
      });
    });

  });   // ==== End of 'Remove' ==== //


  describe('Using indexes', function () {

    describe('ensureIndex and index initialization in database loading', function () {

      it('ensureIndex can be called right after a loadDatabase and be initialized and filled correctly', function (done) {
        var now = new Date()
          , rawData = model.serialize({ _id: "aaa", z: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                      model.serialize({ _id: "bbb", z: "2", hello: 'world' }) + '\n' +
                      model.serialize({ _id: "ccc", z: "3", nested: { today: now } })
          ;

        d.data.length.should.equal(0);
        d.datafileSize.should.equal(0);

        fs.writeFile(testDb, rawData, 'utf8', function () {
          d.loadDatabase(function () {
            d.data.length.should.equal(3);
            d.datafileSize.should.equal(3);

            assert.deepEqual(d.indexes, {});

            d.ensureIndex({ fieldName: 'z' });
            d.indexes.z.fieldName.should.equal('z');
            d.indexes.z.unique.should.equal(false);
            d.indexes.z.sparse.should.equal(false);
            d.indexes.z.tree.getNumberOfKeys().should.equal(3);
            d.indexes.z.tree.search('1')[0].should.equal(d.data[0]);
            d.indexes.z.tree.search('2')[0].should.equal(d.data[1]);
            d.indexes.z.tree.search('3')[0].should.equal(d.data[2]);

            done();
          });
        });
      });

      it('ensureIndex can be called after the data set was modified and still be correct', function (done) {
        var rawData = model.serialize({ _id: "aaa", z: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                      model.serialize({ _id: "bbb", z: "2", hello: 'world' })
          ;

        d.data.length.should.equal(0);
        d.datafileSize.should.equal(0);

        fs.writeFile(testDb, rawData, 'utf8', function () {
          d.loadDatabase(function () {
            d.data.length.should.equal(2);
            d.datafileSize.should.equal(2);

            assert.deepEqual(d.indexes, {});

            d.insert({ z: "12", yes: 'yes' }, function (err, newDoc1) {
              d.insert({ z: "14", nope: 'nope' }, function (err, newDoc2) {
                d.remove({ z: "2" }, {}, function () {
                  d.update({ z: "1" }, { $set: { 'yes': 'yep' } }, {}, function () {
                    assert.deepEqual(d.indexes, {});

                    d.ensureIndex({ fieldName: 'z' });
                    d.indexes.z.fieldName.should.equal('z');
                    d.indexes.z.unique.should.equal(false);
                    d.indexes.z.sparse.should.equal(false);
                    d.indexes.z.tree.getNumberOfKeys().should.equal(3);

                    d.indexes.z.tree.search('1')[0].should.equal(d.data[0]);
                    assert.deepEqual(d.data[0], { _id: "aaa", z: "1", a: 2, ages: [1, 5, 12], yes: 'yep' });

                    d.indexes.z.tree.search('12')[0].should.equal(d.data[1]);
                    assert.deepEqual(d.data[1], { _id: newDoc1._id, z: "12", yes: 'yes' });

                    d.indexes.z.tree.search('14')[0].should.equal(d.data[2]);
                    assert.deepEqual(d.data[2], { _id: newDoc2._id, z: "14", nope: 'nope' });

                    done();
                  });
                });
              });
            });
          });
        });
      });

      it('ensureIndex can be called before a loadDatabase and still be initialized and filled correctly', function (done) {
        var now = new Date()
          , rawData = model.serialize({ _id: "aaa", z: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                      model.serialize({ _id: "bbb", z: "2", hello: 'world' }) + '\n' +
                      model.serialize({ _id: "ccc", z: "3", nested: { today: now } })
          ;

        d.data.length.should.equal(0);
        d.datafileSize.should.equal(0);

        d.ensureIndex({ fieldName: 'z' });
        d.indexes.z.fieldName.should.equal('z');
        d.indexes.z.unique.should.equal(false);
        d.indexes.z.sparse.should.equal(false);
        d.indexes.z.tree.getNumberOfKeys().should.equal(0);

        fs.writeFile(testDb, rawData, 'utf8', function () {
          d.loadDatabase(function () {
            d.data.length.should.equal(3);
            d.datafileSize.should.equal(3);

            d.indexes.z.tree.getNumberOfKeys().should.equal(3);
            d.indexes.z.tree.search('1')[0].should.equal(d.data[0]);
            d.indexes.z.tree.search('2')[0].should.equal(d.data[1]);
            d.indexes.z.tree.search('3')[0].should.equal(d.data[2]);

            done();
          });
        });
      });

      it('Can initialize multiple indexes', function (done) {
        var now = new Date()
          , rawData = model.serialize({ _id: "aaa", z: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                      model.serialize({ _id: "bbb", z: "2", a: 'world' }) + '\n' +
                      model.serialize({ _id: "ccc", z: "3", a: { today: now } })
          ;

        d.data.length.should.equal(0);
        d.datafileSize.should.equal(0);

        d.ensureIndex({ fieldName: 'z' });
        d.ensureIndex({ fieldName: 'a' });
        d.indexes.a.tree.getNumberOfKeys().should.equal(0);
        d.indexes.z.tree.getNumberOfKeys().should.equal(0);

        fs.writeFile(testDb, rawData, 'utf8', function () {
          d.loadDatabase(function () {
            d.data.length.should.equal(3);
            d.datafileSize.should.equal(3);

            d.indexes.z.tree.getNumberOfKeys().should.equal(3);
            d.indexes.z.tree.search('1')[0].should.equal(d.data[0]);
            d.indexes.z.tree.search('2')[0].should.equal(d.data[1]);
            d.indexes.z.tree.search('3')[0].should.equal(d.data[2]);

            d.indexes.a.tree.getNumberOfKeys().should.equal(3);
            d.indexes.a.tree.search(2)[0].should.equal(d.data[0]);
            d.indexes.a.tree.search('world')[0].should.equal(d.data[1]);
            d.indexes.a.tree.search({ today: now })[0].should.equal(d.data[2]);

            done();
          });
        });
      });

      it('If a unique constraint is not respected, database loading will not work and no data will be inserted', function (done) {
        var now = new Date()
          , rawData = model.serialize({ _id: "aaa", z: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                      model.serialize({ _id: "bbb", z: "2", a: 'world' }) + '\n' +
                      model.serialize({ _id: "ccc", z: "1", a: { today: now } })
          ;

        d.data.length.should.equal(0);
        d.datafileSize.should.equal(0);

        d.ensureIndex({ fieldName: 'z', unique: true });
        d.indexes.z.tree.getNumberOfKeys().should.equal(0);

        fs.writeFile(testDb, rawData, 'utf8', function () {
          d.loadDatabase(function (err) {
            err.errorType.should.equal('uniqueViolated');
            err.key.should.equal("1");
            d.data.length.should.equal(0);
            d.datafileSize.should.equal(0);
            d.indexes.z.tree.getNumberOfKeys().should.equal(0);

            done();
          });
        });
      });

      it('If a unique constraint is not respected, ensureIndex will return an error and not create an index', function (done) {
        d.insert({ a: 1, b: 4 }, function () {
          d.insert({ a: 2, b: 45 }, function () {
            d.insert({ a: 1, b: 3 }, function () {
              d.ensureIndex({ fieldName: 'b' }, function (err) {
                assert.isUndefined(err);

                d.ensureIndex({ fieldName: 'a', unique: true }, function (err) {
                  err.errorType.should.equal('uniqueViolated');
                  assert.deepEqual(Object.keys(d.indexes), ['b']);

                  done();
                });
              });
            });
          });
        });
      });

    });   // ==== End of 'ensureIndex and index initialization in database loading' ==== //

    describe('Indexing newly inserted documents', function () {

      it('Newly inserted documents are indexed', function (done) {
        d.ensureIndex({ fieldName: 'z' });
        d.indexes.z.tree.getNumberOfKeys().should.equal(0);

        d.insert({ a: 2, z: 'yes' }, function (err, newDoc) {
          d.indexes.z.tree.getNumberOfKeys().should.equal(1);
          assert.deepEqual(d.indexes.z.getMatching('yes'), [newDoc]);

          d.insert({ a: 5, z: 'nope' }, function (err, newDoc) {
            d.indexes.z.tree.getNumberOfKeys().should.equal(2);
            assert.deepEqual(d.indexes.z.getMatching('nope'), [newDoc]);

            done();
          });
        });
      });

      it('If multiple indexes are defined, the document is inserted in all of them', function (done) {
        d.ensureIndex({ fieldName: 'z' });
        d.ensureIndex({ fieldName: 'ya' });
        d.indexes.z.tree.getNumberOfKeys().should.equal(0);

        d.insert({ a: 2, z: 'yes', ya: 'indeed' }, function (err, newDoc) {
          d.indexes.z.tree.getNumberOfKeys().should.equal(1);
          d.indexes.ya.tree.getNumberOfKeys().should.equal(1);
          assert.deepEqual(d.indexes.z.getMatching('yes'), [newDoc]);
          assert.deepEqual(d.indexes.ya.getMatching('indeed'), [newDoc]);

          d.insert({ a: 5, z: 'nope', ya: 'sure' }, function (err, newDoc2) {
            d.indexes.z.tree.getNumberOfKeys().should.equal(2);
            d.indexes.ya.tree.getNumberOfKeys().should.equal(2);
            assert.deepEqual(d.indexes.z.getMatching('nope'), [newDoc2]);
            assert.deepEqual(d.indexes.ya.getMatching('sure'), [newDoc2]);

            done();
          });
        });
      });

      it('Can insert two docs at the same key for a non unique index', function (done) {
        d.ensureIndex({ fieldName: 'z' });
        d.indexes.z.tree.getNumberOfKeys().should.equal(0);

        d.insert({ a: 2, z: 'yes' }, function (err, newDoc) {
          d.indexes.z.tree.getNumberOfKeys().should.equal(1);
          assert.deepEqual(d.indexes.z.getMatching('yes'), [newDoc]);

          d.insert({ a: 5, z: 'yes' }, function (err, newDoc2) {
            d.indexes.z.tree.getNumberOfKeys().should.equal(1);
            assert.deepEqual(d.indexes.z.getMatching('yes'), [newDoc, newDoc2]);

            done();
          });
        });
      });

      it('If the index has a unique constraint, an error is thrown if it is violated and the data didnt change', function (done) {
        d.ensureIndex({ fieldName: 'z', unique: true });
        d.indexes.z.tree.getNumberOfKeys().should.equal(0);

        d.insert({ a: 2, z: 'yes' }, function (err, newDoc) {
          d.indexes.z.tree.getNumberOfKeys().should.equal(1);
          assert.deepEqual(d.indexes.z.getMatching('yes'), [newDoc]);

          d.insert({ a: 5, z: 'yes' }, function (err) {
            err.errorType.should.equal('uniqueViolated');
            err.key.should.equal('yes');

            // Index didn't change
            d.indexes.z.tree.getNumberOfKeys().should.equal(1);
            assert.deepEqual(d.indexes.z.getMatching('yes'), [newDoc]);

            // Data didn't change
            assert.deepEqual(d.data, [newDoc]);
            d.loadDatabase(function () {
              d.data.length.should.equal(1);
              assert.deepEqual(d.data[0], newDoc);

              done();
            });
          });
        });
      });

      it('If the index has a unique constraint, others cannot be modified when it raises an error', function (done) {
        d.ensureIndex({ fieldName: 'nonu1' });
        d.ensureIndex({ fieldName: 'uni', unique: true });
        d.ensureIndex({ fieldName: 'nonu2' });

        d.insert({ nonu1: 'yes', nonu2: 'yes2', uni: 'willfail' }, function (err, newDoc) {
          assert.isNull(err);
          d.indexes.nonu1.tree.getNumberOfKeys().should.equal(1);
          d.indexes.uni.tree.getNumberOfKeys().should.equal(1);
          d.indexes.nonu2.tree.getNumberOfKeys().should.equal(1);

          d.insert({ nonu1: 'no', nonu2: 'no2', uni: 'willfail' }, function (err) {
            err.errorType.should.equal('uniqueViolated');

            // No index was modified
            d.indexes.nonu1.tree.getNumberOfKeys().should.equal(1);
            d.indexes.uni.tree.getNumberOfKeys().should.equal(1);
            d.indexes.nonu2.tree.getNumberOfKeys().should.equal(1);

            assert.deepEqual(d.indexes.nonu1.getMatching('yes'), [newDoc]);
            assert.deepEqual(d.indexes.uni.getMatching('willfail'), [newDoc]);
            assert.deepEqual(d.indexes.nonu2.getMatching('yes2'), [newDoc]);

            done();
          });
        });
      });

    });   // ==== End of 'Indexing newly inserted documents' ==== //





  });   // ==== End of 'Using indexes' ==== //


});
