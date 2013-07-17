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


describe('Persistence', function () {
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

  it('Every line represents a document', function () {
    var now = new Date()
      , rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
                  model.serialize({ _id: "2", hello: 'world' }) + '\n' +
                  model.serialize({ _id: "3", nested: { today: now } })
      , treatedData = Persistence.treatRawData(rawData)
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
      , treatedData = Persistence.treatRawData(rawData)
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
      , treatedData = Persistence.treatRawData(rawData)
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
      , treatedData = Persistence.treatRawData(rawData)
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
      , treatedData = Persistence.treatRawData(rawData)
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
      , treatedData = Persistence.treatRawData(rawData)
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

  it('Calling loadDatabase after the datafile was removed will reset the database', function (done) {
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

});
