var should = require('chai').should()
  , assert = require('chai').assert
  , testDb = 'workspace/test.db'
  , fs = require('fs')
  , path = require('path')
  , _ = require('underscore')
  , async = require('async')
  , Datastore = require('../lib/datastore')
  , customUtils = require('../lib/customUtils')
  , model = require('../lib/model')
  ;


describe('Database', function () {
  var d;

  beforeEach(function (done) {
    d = new Datastore({ filename: testDb });
    d.filename.should.equal(testDb);
    d.inMemoryOnly.should.equal(false);

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
          d.getAllData().length.should.equal(0);
          return cb();
        });
      }
    ], done);

  });

  it('Constructor compatibility with v0.6-', function () {
    var dbef = new Datastore('somefile');
    dbef.filename.should.equal('somefile');
    dbef.inMemoryOnly.should.equal(false);

    var dbef = new Datastore('');
    assert.isNull(dbef.filename);
    dbef.inMemoryOnly.should.equal(true);

    var dbef = new Datastore();
    assert.isNull(dbef.filename);
    dbef.inMemoryOnly.should.equal(true);
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

      d.getAllData().length.should.equal(0);
      d.datafileSize.should.equal(0);

      fs.writeFile(testDb, rawData, 'utf8', function () {
        d.loadDatabase(function () {
          d.getAllData().length.should.equal(3);
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

    it('Calling loadDatabase after the data was modified doesnt change its contents', function (done) {
      d.loadDatabase(function () {
        d.insert({ a: 1 }, function (err) {
          assert.isNull(err);
          d.insert({ a: 2 }, function (err) {
            var data = d.getAllData()
              , doc1 = _.find(data, function (doc) { return doc.a === 1; })
              , doc2 = _.find(data, function (doc) { return doc.a === 2; })
              ;
            assert.isNull(err);
            data.length.should.equal(2);
            doc1.a.should.equal(1);
            doc2.a.should.equal(2);

            d.loadDatabase(function (err) {
              var data = d.getAllData()
                , doc1 = _.find(data, function (doc) { return doc.a === 1; })
                , doc2 = _.find(data, function (doc) { return doc.a === 2; })
                ;
              assert.isNull(err);
              data.length.should.equal(2);
              doc1.a.should.equal(1);
              doc2.a.should.equal(2);

              done();
            });
          });
        });
      });
    });

    it('Calling loadDatabase after the datafile was removed with will reset the database', function (done) {
      d.loadDatabase(function () {
        d.insert({ a: 1 }, function (err) {
          assert.isNull(err);
          d.insert({ a: 2 }, function (err) {
            var data = d.getAllData()
              , doc1 = _.find(data, function (doc) { return doc.a === 1; })
              , doc2 = _.find(data, function (doc) { return doc.a === 2; })
              ;
            assert.isNull(err);
            data.length.should.equal(2);
            doc1.a.should.equal(1);
            doc2.a.should.equal(2);

            fs.unlink(testDb, function (err) {
              assert.isNull(err);
              d.loadDatabase(function (err) {
                assert.isNull(err);
                d.getAllData().length.should.equal(0);

                done();
              });
            });
          });
        });
      });
    });

    it('Calling loadDatabase after the datafile was modified loads the new data', function (done) {
      d.loadDatabase(function () {
        d.insert({ a: 1 }, function (err) {
          assert.isNull(err);
          d.insert({ a: 2 }, function (err) {
            var data = d.getAllData()
              , doc1 = _.find(data, function (doc) { return doc.a === 1; })
              , doc2 = _.find(data, function (doc) { return doc.a === 2; })
              ;
            assert.isNull(err);
            data.length.should.equal(2);
            doc1.a.should.equal(1);
            doc2.a.should.equal(2);

            fs.writeFile(testDb, '{"a":3,"_id":"aaa"}', 'utf8', function (err) {
              assert.isNull(err);
              d.loadDatabase(function (err) {
                var data = d.getAllData()
                , doc1 = _.find(data, function (doc) { return doc.a === 1; })
                , doc2 = _.find(data, function (doc) { return doc.a === 2; })
                , doc3 = _.find(data, function (doc) { return doc.a === 3; })
                ;
                assert.isNull(err);
                data.length.should.equal(1);
                doc3.a.should.equal(3);
                assert.isUndefined(doc1);
                assert.isUndefined(doc2);

                done();
              });
            });
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
      d.getAllData().length.should.equal(0);
      d.insert({ a: 3 }, function () {
        d.datafileSize.should.equal(1);
        d.getAllData().length.should.equal(1);
        d.insert({ a: 3 }, function () {
          d.datafileSize.should.equal(2);
          d.getAllData().length.should.equal(2);
          d.insert({ a: 3 }, function () {
            d.datafileSize.should.equal(3);
            d.getAllData().length.should.equal(3);
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


  describe('#getCandidates', function () {

    it('Can use an index to get docs with a basic match', function (done) {
      d.ensureIndex({ fieldName: 'tf' }, function (err) {
        d.insert({ tf: 4 }, function (err, _doc1) {
          d.insert({ tf: 6 }, function () {
            d.insert({ tf: 4, an: 'other' }, function (err, _doc2) {
              d.insert({ tf: 9 }, function () {
                var data = d.getCandidates({ r: 6, tf: 4 })
                  , doc1 = _.find(data, function (d) { return d._id === _doc1._id; })
                  , doc2 = _.find(data, function (d) { return d._id === _doc2._id; })
                  ;

                data.length.should.equal(2);
                assert.deepEqual(doc1, { _id: doc1._id, tf: 4 });
                assert.deepEqual(doc2, { _id: doc2._id, tf: 4, an: 'other' });

                done();
              });
            });
          });
        });
      });
    });

    it('Can use an index to get docs with a $in match', function (done) {
      d.ensureIndex({ fieldName: 'tf' }, function (err) {
        d.insert({ tf: 4 }, function (err) {
          d.insert({ tf: 6 }, function (err, _doc1) {
            d.insert({ tf: 4, an: 'other' }, function (err) {
              d.insert({ tf: 9 }, function (err, _doc2) {
                var data = d.getCandidates({ r: 6, tf: { $in: [6, 9, 5] } })
                  , doc1 = _.find(data, function (d) { return d._id === _doc1._id; })
                  , doc2 = _.find(data, function (d) { return d._id === _doc2._id; })
                  ;

                data.length.should.equal(2);
                assert.deepEqual(doc1, { _id: doc1._id, tf: 6 });
                assert.deepEqual(doc2, { _id: doc2._id, tf: 9 });

                done();
              });
            });
          });
        });
      });
    });

    it('If no index can be used, return the whole database', function (done) {
      d.ensureIndex({ fieldName: 'tf' }, function (err) {
        d.insert({ tf: 4 }, function (err, _doc1) {
          d.insert({ tf: 6 }, function (err, _doc2) {
            d.insert({ tf: 4, an: 'other' }, function (err, _doc3) {
              d.insert({ tf: 9 }, function (err, _doc4) {
                var data = d.getCandidates({ r: 6, notf: { $in: [6, 9, 5] } })
                  , doc1 = _.find(data, function (d) { return d._id === _doc1._id; })
                  , doc2 = _.find(data, function (d) { return d._id === _doc2._id; })
                  , doc3 = _.find(data, function (d) { return d._id === _doc3._id; })
                  , doc4 = _.find(data, function (d) { return d._id === _doc4._id; })
                  ;

                data.length.should.equal(4);
                assert.deepEqual(doc1, { _id: doc1._id, tf: 4 });
                assert.deepEqual(doc2, { _id: doc2._id, tf: 6 });
                assert.deepEqual(doc3, { _id: doc3._id, tf: 4, an: 'other' });
                assert.deepEqual(doc4, { _id: doc4._id, tf: 9 });

                done();
              });
            });
          });
        });
      });
    });

    it('Can use indexes for comparison matches', function (done) {
      d.ensureIndex({ fieldName: 'tf' }, function (err) {
        d.insert({ tf: 4 }, function (err, _doc1) {
          d.insert({ tf: 6 }, function (err, _doc2) {
            d.insert({ tf: 4, an: 'other' }, function (err, _doc3) {
              d.insert({ tf: 9 }, function (err, _doc4) {
                var data = d.getCandidates({ r: 6, tf: { $lte: 9, $gte: 6 } })
                  , doc2 = _.find(data, function (d) { return d._id === _doc2._id; })
                  , doc4 = _.find(data, function (d) { return d._id === _doc4._id; })
                  ;

                data.length.should.equal(2);
                assert.deepEqual(doc2, { _id: doc2._id, tf: 6 });
                assert.deepEqual(doc4, { _id: doc4._id, tf: 9 });

                done();
              });
            });
          });
        });
      });
    });

  });   // ==== End of '#getCandidates' ==== //


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

            assert.deepEqual(doc1, { _id: doc1._id, somedata: 'ok' });
            assert.deepEqual(doc2, { _id: doc2._id, somedata: 'again', plus: 'additional data' });
            assert.deepEqual(doc3, { _id: doc3._id, somedata: 'another' });

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
      , function (cb) {
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

          assert.deepEqual(doc1, { somedata: 'ok', _id: doc1._id });

          // doc2 or doc3 was modified. Since we sort on _id and it is random
          // it can be either of two situations
          try {
            assert.deepEqual(doc2, { newDoc: 'yes', _id: doc2._id });
            assert.deepEqual(doc3, { somedata: 'again', _id: doc3._id });
          } catch (e) {
            assert.deepEqual(doc2, { somedata: 'again', plus: 'additional data', _id: doc2._id });
            assert.deepEqual(doc3, { newDoc: 'yes', _id: doc3._id });
          }

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

    it('If an error is thrown by a modifier, the database state is not changed', function (done) {
      d.insert({ hello: 'world' }, function (err, newDoc) {
        d.update({}, { $inc: { hello: 4 } }, {}, function (err, nr) {
          assert.isDefined(err);
          assert.isUndefined(nr);

          d.find({}, function (err, docs) {
            assert.deepEqual(docs, [ { _id: newDoc._id, hello: 'world' } ]);

            done();
          });
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
            d.getAllData().length.should.equal(3);

            d.update({ a: 3 }, { $set: { a: 4 } }, {}, function () {
              d.datafileSize.should.equal(4);
              d.getAllData().length.should.equal(3);

              d.update({ a: { $in: [2, 4] } }, { $set: { a: 5 } }, { multi: true }, function () {
                d.datafileSize.should.equal(6);
                d.getAllData().length.should.equal(3);

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
            d.getAllData().length.should.equal(3);

            d.remove({ a: 3 }, {}, function () {
              d.datafileSize.should.equal(4);
              d.getAllData().length.should.equal(2);

              d.remove({ a: { $in: [2, 5] } }, { multi: true }, function () {
                d.datafileSize.should.equal(6);
                d.getAllData().length.should.equal(0);

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

        d.getAllData().length.should.equal(0);
        d.datafileSize.should.equal(0);

        fs.writeFile(testDb, rawData, 'utf8', function () {
          d.loadDatabase(function () {
            d.getAllData().length.should.equal(3);
            d.datafileSize.should.equal(3);

            assert.deepEqual(Object.keys(d.indexes), ['_id']);

            d.ensureIndex({ fieldName: 'z' });
            d.indexes.z.fieldName.should.equal('z');
            d.indexes.z.unique.should.equal(false);
            d.indexes.z.sparse.should.equal(false);
            d.indexes.z.tree.getNumberOfKeys().should.equal(3);
            d.indexes.z.tree.search('1')[0].should.equal(d.getAllData()[0]);
            d.indexes.z.tree.search('2')[0].should.equal(d.getAllData()[1]);
            d.indexes.z.tree.search('3')[0].should.equal(d.getAllData()[2]);

            done();
          });
        });
      });

      it('ensureIndex can be called after the data set was modified and the index still be correct', function (done) {
        var rawData = model.serialize({ _id: "aaa", z: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                      model.serialize({ _id: "bbb", z: "2", hello: 'world' })
          ;

        d.getAllData().length.should.equal(0);
        d.datafileSize.should.equal(0);

        fs.writeFile(testDb, rawData, 'utf8', function () {
          d.loadDatabase(function () {
            d.getAllData().length.should.equal(2);
            d.datafileSize.should.equal(2);

            assert.deepEqual(Object.keys(d.indexes), ['_id']);

            d.insert({ z: "12", yes: 'yes' }, function (err, newDoc1) {
              d.insert({ z: "14", nope: 'nope' }, function (err, newDoc2) {
                d.remove({ z: "2" }, {}, function () {
                  d.update({ z: "1" }, { $set: { 'yes': 'yep' } }, {}, function () {
                    assert.deepEqual(Object.keys(d.indexes), ['_id']);

                    d.ensureIndex({ fieldName: 'z' });
                    d.indexes.z.fieldName.should.equal('z');
                    d.indexes.z.unique.should.equal(false);
                    d.indexes.z.sparse.should.equal(false);
                    d.indexes.z.tree.getNumberOfKeys().should.equal(3);

                    // The pointers in the _id and z indexes are the same
                    d.indexes.z.tree.search('1')[0].should.equal(d.indexes._id.getMatching('aaa')[0]);
                    d.indexes.z.tree.search('12')[0].should.equal(d.indexes._id.getMatching(newDoc1._id)[0]);
                    d.indexes.z.tree.search('14')[0].should.equal(d.indexes._id.getMatching(newDoc2._id)[0]);

                    // The data in the z index is correct
                    d.find({}, function (err, docs) {
                      var doc0 = _.find(docs, function (doc) { return doc._id === 'aaa'; })
                        , doc1 = _.find(docs, function (doc) { return doc._id === newDoc1._id; })
                        , doc2 = _.find(docs, function (doc) { return doc._id === newDoc2._id; })
                        ;

                      docs.length.should.equal(3);

                      assert.deepEqual(doc0, { _id: "aaa", z: "1", a: 2, ages: [1, 5, 12], yes: 'yep' });
                      assert.deepEqual(doc1, { _id: newDoc1._id, z: "12", yes: 'yes' });
                      assert.deepEqual(doc2, { _id: newDoc2._id, z: "14", nope: 'nope' });

                      done();
                    });
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

        d.getAllData().length.should.equal(0);
        d.datafileSize.should.equal(0);

        d.ensureIndex({ fieldName: 'z' });
        d.indexes.z.fieldName.should.equal('z');
        d.indexes.z.unique.should.equal(false);
        d.indexes.z.sparse.should.equal(false);
        d.indexes.z.tree.getNumberOfKeys().should.equal(0);

        fs.writeFile(testDb, rawData, 'utf8', function () {
          d.loadDatabase(function () {
            var doc1 = _.find(d.getAllData(), function (doc) { return doc.z === "1"; })
              , doc2 = _.find(d.getAllData(), function (doc) { return doc.z === "2"; })
              , doc3 = _.find(d.getAllData(), function (doc) { return doc.z === "3"; })
              ;

            d.getAllData().length.should.equal(3);
            d.datafileSize.should.equal(3);

            d.indexes.z.tree.getNumberOfKeys().should.equal(3);
            d.indexes.z.tree.search('1')[0].should.equal(doc1);
            d.indexes.z.tree.search('2')[0].should.equal(doc2);
            d.indexes.z.tree.search('3')[0].should.equal(doc3);

            done();
          });
        });
      });

      it('Can initialize multiple indexes on a database load', function (done) {
        var now = new Date()
          , rawData = model.serialize({ _id: "aaa", z: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                      model.serialize({ _id: "bbb", z: "2", a: 'world' }) + '\n' +
                      model.serialize({ _id: "ccc", z: "3", a: { today: now } })
          ;

        d.getAllData().length.should.equal(0);
        d.datafileSize.should.equal(0);

        d.ensureIndex({ fieldName: 'z' });
        d.ensureIndex({ fieldName: 'a' });
        d.indexes.a.tree.getNumberOfKeys().should.equal(0);
        d.indexes.z.tree.getNumberOfKeys().should.equal(0);

        fs.writeFile(testDb, rawData, 'utf8', function () {
          d.loadDatabase(function () {
            var doc1 = _.find(d.getAllData(), function (doc) { return doc.z === "1"; })
              , doc2 = _.find(d.getAllData(), function (doc) { return doc.z === "2"; })
              , doc3 = _.find(d.getAllData(), function (doc) { return doc.z === "3"; })
              ;

            d.getAllData().length.should.equal(3);
            d.datafileSize.should.equal(3);

            d.indexes.z.tree.getNumberOfKeys().should.equal(3);
            d.indexes.z.tree.search('1')[0].should.equal(doc1);
            d.indexes.z.tree.search('2')[0].should.equal(doc2);
            d.indexes.z.tree.search('3')[0].should.equal(doc3);

            d.indexes.a.tree.getNumberOfKeys().should.equal(3);
            d.indexes.a.tree.search(2)[0].should.equal(doc1);
            d.indexes.a.tree.search('world')[0].should.equal(doc2);
            d.indexes.a.tree.search({ today: now })[0].should.equal(doc3);

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

        d.getAllData().length.should.equal(0);
        d.datafileSize.should.equal(0);

        d.ensureIndex({ fieldName: 'z', unique: true });
        d.indexes.z.tree.getNumberOfKeys().should.equal(0);

        fs.writeFile(testDb, rawData, 'utf8', function () {
          d.loadDatabase(function (err) {
            err.errorType.should.equal('uniqueViolated');
            err.key.should.equal("1");
            d.getAllData().length.should.equal(0);
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
                assert.isNull(err);

                d.ensureIndex({ fieldName: 'a', unique: true }, function (err) {
                  err.errorType.should.equal('uniqueViolated');
                  assert.deepEqual(Object.keys(d.indexes), ['_id', 'b']);

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

      it('If the index has a unique constraint, an error is thrown if it is violated and the data is not modified', function (done) {
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
            assert.deepEqual(d.getAllData(), [newDoc]);
            d.loadDatabase(function () {
              d.getAllData().length.should.equal(1);
              assert.deepEqual(d.getAllData()[0], newDoc);

              done();
            });
          });
        });
      });

      it('If an index has a unique constraint, other indexes cannot be modified when it raises an error', function (done) {
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

      it('Unique indexes prevent you from inserting two docs where the field is undefined except if theyre sparse', function (done) {
        d.ensureIndex({ fieldName: 'zzz', unique: true });
        d.indexes.zzz.tree.getNumberOfKeys().should.equal(0);

        d.insert({ a: 2, z: 'yes' }, function (err, newDoc) {
          d.indexes.zzz.tree.getNumberOfKeys().should.equal(1);
          assert.deepEqual(d.indexes.zzz.getMatching(undefined), [newDoc]);

          d.insert({ a: 5, z: 'other' }, function (err) {
            err.errorType.should.equal('uniqueViolated');
            assert.isUndefined(err.key);

            d.ensureIndex({ fieldName: 'yyy', unique: true, sparse: true });

            d.insert({ a: 5, z: 'other', zzz: 'set' }, function (err) {
              assert.isNull(err);
              d.indexes.yyy.getAll().length.should.equal(0);   // Nothing indexed
              d.indexes.zzz.getAll().length.should.equal(2);

              done();
            });
          });
        });
      });

      it('Insertion still works as before with indexing', function (done) {
        d.ensureIndex({ fieldName: 'a' });
        d.ensureIndex({ fieldName: 'b' });

        d.insert({ a: 1, b: 'hello' }, function (err, doc1) {
          d.insert({ a: 2, b: 'si' }, function (err, doc2) {
            d.find({}, function (err, docs) {
              assert.deepEqual(doc1, _.find(docs, function (d) { return d._id === doc1._id; }));
              assert.deepEqual(doc2, _.find(docs, function (d) { return d._id === doc2._id; }));

              done();
            });
          });
        });
      });

      it('All indexes point to the same data as the main index on _id', function (done) {
        d.ensureIndex({ fieldName: 'a' });

        d.insert({ a: 1, b: 'hello' }, function (err, doc1) {
          d.insert({ a: 2, b: 'si' }, function (err, doc2) {
            d.find({}, function (err, docs) {
              docs.length.should.equal(2);
              d.getAllData().length.should.equal(2);

              d.indexes._id.getMatching(doc1._id).length.should.equal(1);
              d.indexes.a.getMatching(1).length.should.equal(1);
              d.indexes._id.getMatching(doc1._id)[0].should.equal(d.indexes.a.getMatching(1)[0]);

              d.indexes._id.getMatching(doc2._id).length.should.equal(1);
              d.indexes.a.getMatching(2).length.should.equal(1);
              d.indexes._id.getMatching(doc2._id)[0].should.equal(d.indexes.a.getMatching(2)[0]);

              done();
            });
          });
        });
      });

      it('If a unique constraint is violated, no index is changed, including the main one', function (done) {
        d.ensureIndex({ fieldName: 'a', unique: true });

        d.insert({ a: 1, b: 'hello' }, function (err, doc1) {
          d.insert({ a: 1, b: 'si' }, function (err) {
            assert.isDefined(err);

            d.find({}, function (err, docs) {
              docs.length.should.equal(1);
              d.getAllData().length.should.equal(1);

              d.indexes._id.getMatching(doc1._id).length.should.equal(1);
              d.indexes.a.getMatching(1).length.should.equal(1);
              d.indexes._id.getMatching(doc1._id)[0].should.equal(d.indexes.a.getMatching(1)[0]);

              d.indexes.a.getMatching(2).length.should.equal(0);

              done();
            });
          });
        });
      });

    });   // ==== End of 'Indexing newly inserted documents' ==== //

    describe('Updating indexes upon document update', function () {

      it('Updating docs still works as before with indexing', function (done) {
        d.ensureIndex({ fieldName: 'a' });

        d.insert({ a: 1, b: 'hello' }, function (err, _doc1) {
          d.insert({ a: 2, b: 'si' }, function (err, _doc2) {
            d.update({ a: 1 }, { $set: { a: 456, b: 'no' } }, {}, function (err, nr) {
              var data = d.getAllData()
                , doc1 = _.find(data, function (doc) { return doc._id === _doc1._id; })
                , doc2 = _.find(data, function (doc) { return doc._id === _doc2._id; })
                ;

              assert.isNull(err);
              nr.should.equal(1);

              data.length.should.equal(2);
              assert.deepEqual(doc1, { a: 456, b: 'no', _id: _doc1._id });
              assert.deepEqual(doc2, { a: 2, b: 'si', _id: _doc2._id });

              d.update({}, { $inc: { a: 10 }, $set: { b: 'same' } }, { multi: true }, function (err, nr) {
                var data = d.getAllData()
                  , doc1 = _.find(data, function (doc) { return doc._id === _doc1._id; })
                  , doc2 = _.find(data, function (doc) { return doc._id === _doc2._id; })
                  ;

                assert.isNull(err);
                nr.should.equal(2);

                data.length.should.equal(2);
                assert.deepEqual(doc1, { a: 466, b: 'same', _id: _doc1._id });
                assert.deepEqual(doc2, { a: 12, b: 'same', _id: _doc2._id });

                done();
              });
            });
          });
        });
      });

      it('Indexes get updated when a document (or multiple documents) is updated', function (done) {
        d.ensureIndex({ fieldName: 'a' });
        d.ensureIndex({ fieldName: 'b' });

        d.insert({ a: 1, b: 'hello' }, function (err, doc1) {
          d.insert({ a: 2, b: 'si' }, function (err, doc2) {
            // Simple update
            d.update({ a: 1 }, { $set: { a: 456, b: 'no' } }, {}, function (err, nr) {
              assert.isNull(err);
              nr.should.equal(1);

              d.indexes.a.tree.getNumberOfKeys().should.equal(2);
              d.indexes.a.getMatching(456)[0]._id.should.equal(doc1._id);
              d.indexes.a.getMatching(2)[0]._id.should.equal(doc2._id);

              d.indexes.b.tree.getNumberOfKeys().should.equal(2);
              d.indexes.b.getMatching('no')[0]._id.should.equal(doc1._id);
              d.indexes.b.getMatching('si')[0]._id.should.equal(doc2._id);

              // The same pointers are shared between all indexes
              d.indexes.a.tree.getNumberOfKeys().should.equal(2);
              d.indexes.b.tree.getNumberOfKeys().should.equal(2);
              d.indexes._id.tree.getNumberOfKeys().should.equal(2);
              d.indexes.a.getMatching(456)[0].should.equal(d.indexes._id.getMatching(doc1._id)[0]);
              d.indexes.b.getMatching('no')[0].should.equal(d.indexes._id.getMatching(doc1._id)[0]);
              d.indexes.a.getMatching(2)[0].should.equal(d.indexes._id.getMatching(doc2._id)[0]);
              d.indexes.b.getMatching('si')[0].should.equal(d.indexes._id.getMatching(doc2._id)[0]);

              // Multi update
              d.update({}, { $inc: { a: 10 }, $set: { b: 'same' } }, { multi: true }, function (err, nr) {
                assert.isNull(err);
                nr.should.equal(2);

                d.indexes.a.tree.getNumberOfKeys().should.equal(2);
                d.indexes.a.getMatching(466)[0]._id.should.equal(doc1._id);
                d.indexes.a.getMatching(12)[0]._id.should.equal(doc2._id);

                d.indexes.b.tree.getNumberOfKeys().should.equal(1);
                d.indexes.b.getMatching('same').length.should.equal(2);
                _.pluck(d.indexes.b.getMatching('same'), '_id').should.contain(doc1._id);
                _.pluck(d.indexes.b.getMatching('same'), '_id').should.contain(doc2._id);

                // The same pointers are shared between all indexes
                d.indexes.a.tree.getNumberOfKeys().should.equal(2);
                d.indexes.b.tree.getNumberOfKeys().should.equal(1);
                d.indexes.b.getAll().length.should.equal(2);
                d.indexes._id.tree.getNumberOfKeys().should.equal(2);
                d.indexes.a.getMatching(466)[0].should.equal(d.indexes._id.getMatching(doc1._id)[0]);
                d.indexes.a.getMatching(12)[0].should.equal(d.indexes._id.getMatching(doc2._id)[0]);
                // Can't test the pointers in b as their order is randomized, but it is the same as with a

                done();
              });
            });
          });
        });
      });

      it('If a simple update violates a contraint, all changes are rolled back and an error is thrown', function (done) {
        d.ensureIndex({ fieldName: 'a', unique: true });
        d.ensureIndex({ fieldName: 'b', unique: true });
        d.ensureIndex({ fieldName: 'c', unique: true });

        d.insert({ a: 1, b: 10, c: 100 }, function (err, _doc1) {
          d.insert({ a: 2, b: 20, c: 200 }, function (err, _doc2) {
            d.insert({ a: 3, b: 30, c: 300 }, function (err, _doc3) {
              // Will conflict with doc3
              d.update({ a: 2 }, { $inc: { a: 10, c: 1000 }, $set: { b: 30 } }, {}, function (err) {
                var data = d.getAllData()
                  , doc1 = _.find(data, function (doc) { return doc._id === _doc1._id; })
                  , doc2 = _.find(data, function (doc) { return doc._id === _doc2._id; })
                  , doc3 = _.find(data, function (doc) { return doc._id === _doc3._id; })
                  ;

                err.errorType.should.equal('uniqueViolated');

                // Data left unchanged
                data.length.should.equal(3);
                assert.deepEqual(doc1, { a: 1, b: 10, c: 100, _id: _doc1._id });
                assert.deepEqual(doc2, { a: 2, b: 20, c: 200, _id: _doc2._id });
                assert.deepEqual(doc3, { a: 3, b: 30, c: 300, _id: _doc3._id });

                // All indexes left unchanged and pointing to the same docs
                d.indexes.a.tree.getNumberOfKeys().should.equal(3);
                d.indexes.a.getMatching(1)[0].should.equal(doc1);
                d.indexes.a.getMatching(2)[0].should.equal(doc2);
                d.indexes.a.getMatching(3)[0].should.equal(doc3);

                d.indexes.b.tree.getNumberOfKeys().should.equal(3);
                d.indexes.b.getMatching(10)[0].should.equal(doc1);
                d.indexes.b.getMatching(20)[0].should.equal(doc2);
                d.indexes.b.getMatching(30)[0].should.equal(doc3);

                d.indexes.c.tree.getNumberOfKeys().should.equal(3);
                d.indexes.c.getMatching(100)[0].should.equal(doc1);
                d.indexes.c.getMatching(200)[0].should.equal(doc2);
                d.indexes.c.getMatching(300)[0].should.equal(doc3);

                done();
              });
            });
          });
        });
      });

      it('If a multi update violates a contraint, all changes are rolled back and an error is thrown', function (done) {
        d.ensureIndex({ fieldName: 'a', unique: true });
        d.ensureIndex({ fieldName: 'b', unique: true });
        d.ensureIndex({ fieldName: 'c', unique: true });

        d.insert({ a: 1, b: 10, c: 100 }, function (err, _doc1) {
          d.insert({ a: 2, b: 20, c: 200 }, function (err, _doc2) {
            d.insert({ a: 3, b: 30, c: 300 }, function (err, _doc3) {
              // Will conflict with doc3
              d.update({ a: { $in: [1, 2] } }, { $inc: { a: 10, c: 1000 }, $set: { b: 30 } }, { multi: true }, function (err) {
                var data = d.getAllData()
                  , doc1 = _.find(data, function (doc) { return doc._id === _doc1._id; })
                  , doc2 = _.find(data, function (doc) { return doc._id === _doc2._id; })
                  , doc3 = _.find(data, function (doc) { return doc._id === _doc3._id; })
                  ;

                err.errorType.should.equal('uniqueViolated');

                // Data left unchanged
                data.length.should.equal(3);
                assert.deepEqual(doc1, { a: 1, b: 10, c: 100, _id: _doc1._id });
                assert.deepEqual(doc2, { a: 2, b: 20, c: 200, _id: _doc2._id });
                assert.deepEqual(doc3, { a: 3, b: 30, c: 300, _id: _doc3._id });

                // All indexes left unchanged and pointing to the same docs
                d.indexes.a.tree.getNumberOfKeys().should.equal(3);
                d.indexes.a.getMatching(1)[0].should.equal(doc1);
                d.indexes.a.getMatching(2)[0].should.equal(doc2);
                d.indexes.a.getMatching(3)[0].should.equal(doc3);

                d.indexes.b.tree.getNumberOfKeys().should.equal(3);
                d.indexes.b.getMatching(10)[0].should.equal(doc1);
                d.indexes.b.getMatching(20)[0].should.equal(doc2);
                d.indexes.b.getMatching(30)[0].should.equal(doc3);

                d.indexes.c.tree.getNumberOfKeys().should.equal(3);
                d.indexes.c.getMatching(100)[0].should.equal(doc1);
                d.indexes.c.getMatching(200)[0].should.equal(doc2);
                d.indexes.c.getMatching(300)[0].should.equal(doc3);

                done();
              });
            });
          });
        });
      });

    });   // ==== End of 'Updating indexes upon document update' ==== //

    describe('Updating indexes upon document remove', function () {

      it('Removing docs still works as before with indexing', function (done) {
        d.ensureIndex({ fieldName: 'a' });

        d.insert({ a: 1, b: 'hello' }, function (err, _doc1) {
          d.insert({ a: 2, b: 'si' }, function (err, _doc2) {
            d.insert({ a: 3, b: 'coin' }, function (err, _doc3) {
              d.remove({ a: 1 }, {}, function (err, nr) {
                var data = d.getAllData()
                , doc2 = _.find(data, function (doc) { return doc._id === _doc2._id; })
                , doc3 = _.find(data, function (doc) { return doc._id === _doc3._id; })
                ;

                assert.isNull(err);
                nr.should.equal(1);

                data.length.should.equal(2);
                assert.deepEqual(doc2, { a: 2, b: 'si', _id: _doc2._id });
                assert.deepEqual(doc3, { a: 3, b: 'coin', _id: _doc3._id });

                d.remove({ a: { $in: [2, 3] } }, { multi: true }, function (err, nr) {
                  var data = d.getAllData()
                  ;

                  assert.isNull(err);
                  nr.should.equal(2);
                  data.length.should.equal(0);

                  done();
                });
              });
            });
          });
        });
      });

      it('Indexes get updated when a document (or multiple documents) is removed', function (done) {
        d.ensureIndex({ fieldName: 'a' });
        d.ensureIndex({ fieldName: 'b' });

        d.insert({ a: 1, b: 'hello' }, function (err, doc1) {
          d.insert({ a: 2, b: 'si' }, function (err, doc2) {
            d.insert({ a: 3, b: 'coin' }, function (err, doc3) {
              // Simple remove
              d.remove({ a: 1 }, {}, function (err, nr) {
                assert.isNull(err);
                nr.should.equal(1);

                d.indexes.a.tree.getNumberOfKeys().should.equal(2);
                d.indexes.a.getMatching(2)[0]._id.should.equal(doc2._id);
                d.indexes.a.getMatching(3)[0]._id.should.equal(doc3._id);

                d.indexes.b.tree.getNumberOfKeys().should.equal(2);
                d.indexes.b.getMatching('si')[0]._id.should.equal(doc2._id);
                d.indexes.b.getMatching('coin')[0]._id.should.equal(doc3._id);

                // The same pointers are shared between all indexes
                d.indexes.a.tree.getNumberOfKeys().should.equal(2);
                d.indexes.b.tree.getNumberOfKeys().should.equal(2);
                d.indexes._id.tree.getNumberOfKeys().should.equal(2);
                d.indexes.a.getMatching(2)[0].should.equal(d.indexes._id.getMatching(doc2._id)[0]);
                d.indexes.b.getMatching('si')[0].should.equal(d.indexes._id.getMatching(doc2._id)[0]);
                d.indexes.a.getMatching(3)[0].should.equal(d.indexes._id.getMatching(doc3._id)[0]);
                d.indexes.b.getMatching('coin')[0].should.equal(d.indexes._id.getMatching(doc3._id)[0]);

                // Multi remove
                d.remove({}, { multi: true }, function (err, nr) {
                  assert.isNull(err);
                  nr.should.equal(2);

                  d.indexes.a.tree.getNumberOfKeys().should.equal(0);
                  d.indexes.b.tree.getNumberOfKeys().should.equal(0);
                  d.indexes._id.tree.getNumberOfKeys().should.equal(0);

                  done();
                });
              });
            });
          });
        });
      });

    });   // ==== End of 'Removing indexes upon document update' ==== //

  });   // ==== End of 'Using indexes' ==== //


});
