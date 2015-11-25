var should = require('chai').should()
  , assert = require('chai').assert
  , testDb = 'workspace/test.db'
  , fs = require('fs')
  , path = require('path')
  , _ = require('underscore')
  , async = require('async')
  , model = require('../lib/model')
  , customUtils = require('../lib/customUtils')
  , Datastore = require('../lib/datastore')
  , Persistence = require('../lib/persistence')
  , storage = require('../lib/storage')
  , child_process = require('child_process')
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
      , treatedData = d.persistence.treatRawData(rawData).data
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
      , treatedData = d.persistence.treatRawData(rawData).data
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
      , treatedData = d.persistence.treatRawData(rawData).data
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
      , treatedData = d.persistence.treatRawData(rawData).data
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
      , treatedData = d.persistence.treatRawData(rawData).data
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
      , treatedData = d.persistence.treatRawData(rawData).data
    ;

    treatedData.sort(function (a, b) { return a._id - b._id; });
    treatedData.length.should.equal(2);
    _.isEqual(treatedData[0], { _id: "1", a: 2, ages: [1, 5, 12] }).should.equal(true);
    _.isEqual(treatedData[1], { _id: "3", today: now }).should.equal(true);
  });

  it('If a doc contains $$indexCreated, no error is thrown during treatRawData and we can get the index options', function () {
    var now = new Date()
      , rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
    model.serialize({ $$indexCreated: { fieldName: "test", unique: true } }) + '\n' +
    model.serialize({ _id: "3", today: now })
      , treatedData = d.persistence.treatRawData(rawData).data
      , indexes = d.persistence.treatRawData(rawData).indexes
    ;

    Object.keys(indexes).length.should.equal(1);
    assert.deepEqual(indexes.test, { fieldName: "test", unique: true });

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

  it("When treating raw data, refuse to proceed if too much data is corrupt, to avoid data loss", function (done) {
    var corruptTestFilename = 'workspace/corruptTest.db'
      , fakeData = '{"_id":"one","hello":"world"}\n' + 'Some corrupt data\n' + '{"_id":"two","hello":"earth"}\n' + '{"_id":"three","hello":"you"}\n'
      , d
    ;
    fs.writeFileSync(corruptTestFilename, fakeData, "utf8");

    // Default corruptAlertThreshold
    d = new Datastore({ filename: corruptTestFilename });
    d.loadDatabase(function (err) {
      assert.isDefined(err);
      assert.isNotNull(err);

      fs.writeFileSync(corruptTestFilename, fakeData, "utf8");
      d = new Datastore({ filename: corruptTestFilename, corruptAlertThreshold: 1 });
      d.loadDatabase(function (err) {
        assert.isNull(err);

        fs.writeFileSync(corruptTestFilename, fakeData, "utf8");
        d = new Datastore({ filename: corruptTestFilename, corruptAlertThreshold: 0 });
        d.loadDatabase(function (err) {
          assert.isDefined(err);
          assert.isNotNull(err);

          done();
        });
      });
    });
  });


  describe('Serialization hooks', function () {
    var as = function (s) { return "before_" + s + "_after"; }
      , bd = function (s) { return s.substring(7, s.length - 6); }

    it("Declaring only one hook will throw an exception to prevent data loss", function (done) {
      var hookTestFilename = 'workspace/hookTest.db'
      storage.ensureFileDoesntExist(hookTestFilename, function () {
        fs.writeFileSync(hookTestFilename, "Some content", "utf8");

        (function () {
          new Datastore({ filename: hookTestFilename, autoload: true
                        , afterSerialization: as
          });
        }).should.throw();

        // Data file left untouched
        fs.readFileSync(hookTestFilename, "utf8").should.equal("Some content");

        (function () {
          new Datastore({ filename: hookTestFilename, autoload: true
                        , beforeDeserialization: bd
          });
        }).should.throw();

        // Data file left untouched
        fs.readFileSync(hookTestFilename, "utf8").should.equal("Some content");

        done();
      });
    });

    it("Declaring two hooks that are not reverse of one another will cause an exception to prevent data loss", function (done) {
      var hookTestFilename = 'workspace/hookTest.db'
      storage.ensureFileDoesntExist(hookTestFilename, function () {
        fs.writeFileSync(hookTestFilename, "Some content", "utf8");

        (function () {
          new Datastore({ filename: hookTestFilename, autoload: true
                        , afterSerialization: as
                        , beforeDeserialization: function (s) { return s; }
          });
        }).should.throw();

        // Data file left untouched
        fs.readFileSync(hookTestFilename, "utf8").should.equal("Some content");

        done();
      });
    });

    it("A serialization hook can be used to transform data before writing new state to disk", function (done) {
      var hookTestFilename = 'workspace/hookTest.db'
      storage.ensureFileDoesntExist(hookTestFilename, function () {
        var d = new Datastore({ filename: hookTestFilename, autoload: true
          , afterSerialization: as
          , beforeDeserialization: bd
        })
        ;

        d.insert({ hello: "world" }, function () {
          var _data = fs.readFileSync(hookTestFilename, 'utf8')
            , data = _data.split('\n')
            , doc0 = bd(data[0])
          ;

          data.length.should.equal(2);

          data[0].substring(0, 7).should.equal('before_');
          data[0].substring(data[0].length - 6).should.equal('_after');

          doc0 = model.deserialize(doc0);
          Object.keys(doc0).length.should.equal(2);
          doc0.hello.should.equal('world');

          d.insert({ p: 'Mars' }, function () {
            var _data = fs.readFileSync(hookTestFilename, 'utf8')
              , data = _data.split('\n')
              , doc0 = bd(data[0])
              , doc1 = bd(data[1])
            ;

            data.length.should.equal(3);

            data[0].substring(0, 7).should.equal('before_');
            data[0].substring(data[0].length - 6).should.equal('_after');
            data[1].substring(0, 7).should.equal('before_');
            data[1].substring(data[1].length - 6).should.equal('_after');

            doc0 = model.deserialize(doc0);
            Object.keys(doc0).length.should.equal(2);
            doc0.hello.should.equal('world');

            doc1 = model.deserialize(doc1);
            Object.keys(doc1).length.should.equal(2);
            doc1.p.should.equal('Mars');

            d.ensureIndex({ fieldName: 'idefix' }, function () {
              var _data = fs.readFileSync(hookTestFilename, 'utf8')
                , data = _data.split('\n')
                , doc0 = bd(data[0])
                , doc1 = bd(data[1])
                , idx = bd(data[2])
              ;

              data.length.should.equal(4);

              data[0].substring(0, 7).should.equal('before_');
              data[0].substring(data[0].length - 6).should.equal('_after');
              data[1].substring(0, 7).should.equal('before_');
              data[1].substring(data[1].length - 6).should.equal('_after');

              doc0 = model.deserialize(doc0);
              Object.keys(doc0).length.should.equal(2);
              doc0.hello.should.equal('world');

              doc1 = model.deserialize(doc1);
              Object.keys(doc1).length.should.equal(2);
              doc1.p.should.equal('Mars');

              idx = model.deserialize(idx);
              assert.deepEqual(idx, { '$$indexCreated': { fieldName: 'idefix' } });

              done();
            });
          });
        });
      });
    });

    it("Use serialization hook when persisting cached database or compacting", function (done) {
      var hookTestFilename = 'workspace/hookTest.db'
      storage.ensureFileDoesntExist(hookTestFilename, function () {
        var d = new Datastore({ filename: hookTestFilename, autoload: true
          , afterSerialization: as
          , beforeDeserialization: bd
        })
        ;

        d.insert({ hello: "world" }, function () {
          d.update({ hello: "world" }, { $set: { hello: "earth" } }, {}, function () {
            d.ensureIndex({ fieldName: 'idefix' }, function () {
              var _data = fs.readFileSync(hookTestFilename, 'utf8')
                , data = _data.split('\n')
                , doc0 = bd(data[0])
                , doc1 = bd(data[1])
                , idx = bd(data[2])
                , _id
              ;

              data.length.should.equal(4);

              doc0 = model.deserialize(doc0);
              Object.keys(doc0).length.should.equal(2);
              doc0.hello.should.equal('world');

              doc1 = model.deserialize(doc1);
              Object.keys(doc1).length.should.equal(2);
              doc1.hello.should.equal('earth');

              doc0._id.should.equal(doc1._id);
              _id = doc0._id;

              idx = model.deserialize(idx);
              assert.deepEqual(idx, { '$$indexCreated': { fieldName: 'idefix' } });

              d.persistence.persistCachedDatabase(function () {
                var _data = fs.readFileSync(hookTestFilename, 'utf8')
                  , data = _data.split('\n')
                  , doc0 = bd(data[0])
                  , idx = bd(data[1])
                ;

                data.length.should.equal(3);

                doc0 = model.deserialize(doc0);
                Object.keys(doc0).length.should.equal(2);
                doc0.hello.should.equal('earth');

                doc0._id.should.equal(_id);

                idx = model.deserialize(idx);
                assert.deepEqual(idx, { '$$indexCreated': { fieldName: 'idefix', unique: false, sparse: false } });

                done();
              });
            });
          });
        });
      });
    });

    it("Deserialization hook is correctly used when loading data", function (done) {
      var hookTestFilename = 'workspace/hookTest.db'
      storage.ensureFileDoesntExist(hookTestFilename, function () {
        var d = new Datastore({ filename: hookTestFilename, autoload: true
          , afterSerialization: as
          , beforeDeserialization: bd
        })
        ;

        d.insert({ hello: "world" }, function (err, doc) {
          var _id = doc._id;
          d.insert({ yo: "ya" }, function () {
            d.update({ hello: "world" }, { $set: { hello: "earth" } }, {}, function () {
              d.remove({ yo: "ya" }, {}, function () {
                d.ensureIndex({ fieldName: 'idefix' }, function () {
                  var _data = fs.readFileSync(hookTestFilename, 'utf8')
                    , data = _data.split('\n')
                  ;

                  data.length.should.equal(6);

                  // Everything is deserialized correctly, including deletes and indexes
                  var d = new Datastore({ filename: hookTestFilename
                    , afterSerialization: as
                    , beforeDeserialization: bd
                  })
                  ;
                  d.loadDatabase(function () {
                    d.find({}, function (err, docs) {
                      docs.length.should.equal(1);
                      docs[0].hello.should.equal("earth");
                      docs[0]._id.should.equal(_id);

                      Object.keys(d.indexes).length.should.equal(2);
                      Object.keys(d.indexes).indexOf("idefix").should.not.equal(-1);

                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

  });   // ==== End of 'Serialization hooks' ==== //

  describe('Prevent dataloss when persisting data', function () {

    it('Creating a datastore with in memory as true and a bad filename wont cause an error', function () {
      new Datastore({ filename: 'workspace/bad.db~', inMemoryOnly: true });
    })

    it('Creating a persistent datastore with a bad filename will cause an error', function () {
      (function () { new Datastore({ filename: 'workspace/bad.db~' }); }).should.throw();
    })

    it('If no file exists, ensureDatafileIntegrity creates an empty datafile', function (done) {
      var p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });

      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~')) { fs.unlinkSync('workspace/it.db~'); }

      fs.existsSync('workspace/it.db').should.equal(false);
      fs.existsSync('workspace/it.db~').should.equal(false);

      storage.ensureDatafileIntegrity(p.filename, function (err) {
        assert.isNull(err);

        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~').should.equal(false);

        fs.readFileSync('workspace/it.db', 'utf8').should.equal('');

        done();
      });
    });

    it('If only datafile exists, ensureDatafileIntegrity will use it', function (done) {
      var p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });

      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~')) { fs.unlinkSync('workspace/it.db~'); }

      fs.writeFileSync('workspace/it.db', 'something', 'utf8');

      fs.existsSync('workspace/it.db').should.equal(true);
      fs.existsSync('workspace/it.db~').should.equal(false);

      storage.ensureDatafileIntegrity(p.filename, function (err) {
        assert.isNull(err);

        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~').should.equal(false);

        fs.readFileSync('workspace/it.db', 'utf8').should.equal('something');

        done();
      });
    });

    it('If temp datafile exists and datafile doesnt, ensureDatafileIntegrity will use it (cannot happen except upon first use)', function (done) {
      var p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });

      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~')) { fs.unlinkSync('workspace/it.db~~'); }

      fs.writeFileSync('workspace/it.db~', 'something', 'utf8');

      fs.existsSync('workspace/it.db').should.equal(false);
      fs.existsSync('workspace/it.db~').should.equal(true);

      storage.ensureDatafileIntegrity(p.filename, function (err) {
        assert.isNull(err);

        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~').should.equal(false);

        fs.readFileSync('workspace/it.db', 'utf8').should.equal('something');

        done();
      });
    });

    // Technically it could also mean the write was successful but the rename wasn't, but there is in any case no guarantee that the data in the temp file is whole so we have to discard the whole file
    it('If both temp and current datafiles exist, ensureDatafileIntegrity will use the datafile, as it means that the write of the temp file failed', function (done) {
      var theDb = new Datastore({ filename: 'workspace/it.db' });

      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~')) { fs.unlinkSync('workspace/it.db~'); }

      fs.writeFileSync('workspace/it.db', '{"_id":"0","hello":"world"}', 'utf8');
      fs.writeFileSync('workspace/it.db~', '{"_id":"0","hello":"other"}', 'utf8');

      fs.existsSync('workspace/it.db').should.equal(true);
      fs.existsSync('workspace/it.db~').should.equal(true);

      storage.ensureDatafileIntegrity(theDb.persistence.filename, function (err) {
        assert.isNull(err);

        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~').should.equal(true);

        fs.readFileSync('workspace/it.db', 'utf8').should.equal('{"_id":"0","hello":"world"}');

        theDb.loadDatabase(function (err) {
          assert.isNull(err);
          theDb.find({}, function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(1);
            docs[0].hello.should.equal("world");
            fs.existsSync('workspace/it.db').should.equal(true);
            fs.existsSync('workspace/it.db~').should.equal(false);
            done();
          });
        });
      });
    });

    it('persistCachedDatabase should update the contents of the datafile and leave a clean state', function (done) {
      d.insert({ hello: 'world' }, function () {
        d.find({}, function (err, docs) {
          docs.length.should.equal(1);

          if (fs.existsSync(testDb)) { fs.unlinkSync(testDb); }
          if (fs.existsSync(testDb + '~')) { fs.unlinkSync(testDb + '~'); }
          fs.existsSync(testDb).should.equal(false);

          fs.writeFileSync(testDb + '~', 'something', 'utf8');
          fs.existsSync(testDb + '~').should.equal(true);

          d.persistence.persistCachedDatabase(function (err) {
            var contents = fs.readFileSync(testDb, 'utf8');
            assert.isNull(err);
            fs.existsSync(testDb).should.equal(true);
            fs.existsSync(testDb + '~').should.equal(false);
            if (!contents.match(/^{"hello":"world","_id":"[0-9a-zA-Z]{16}"}\n$/)) {
              throw "Datafile contents not as expected";
            }
            done();
          });
        });
      });
    });

    it('After a persistCachedDatabase, there should be no temp or old filename', function (done) {
      d.insert({ hello: 'world' }, function () {
        d.find({}, function (err, docs) {
          docs.length.should.equal(1);

          if (fs.existsSync(testDb)) { fs.unlinkSync(testDb); }
          if (fs.existsSync(testDb + '~')) { fs.unlinkSync(testDb + '~'); }
          fs.existsSync(testDb).should.equal(false);
          fs.existsSync(testDb + '~').should.equal(false);

          fs.writeFileSync(testDb + '~', 'bloup', 'utf8');
          fs.existsSync(testDb + '~').should.equal(true);

          d.persistence.persistCachedDatabase(function (err) {
            var contents = fs.readFileSync(testDb, 'utf8');
            assert.isNull(err);
            fs.existsSync(testDb).should.equal(true);
            fs.existsSync(testDb + '~').should.equal(false);
            if (!contents.match(/^{"hello":"world","_id":"[0-9a-zA-Z]{16}"}\n$/)) {
              throw "Datafile contents not as expected";
            }
            done();
          });
        });
      });
    });

    it('persistCachedDatabase should update the contents of the datafile and leave a clean state even if there is a temp datafile', function (done) {
      d.insert({ hello: 'world' }, function () {
        d.find({}, function (err, docs) {
          docs.length.should.equal(1);

          if (fs.existsSync(testDb)) { fs.unlinkSync(testDb); }
          fs.writeFileSync(testDb + '~', 'blabla', 'utf8');
          fs.existsSync(testDb).should.equal(false);
          fs.existsSync(testDb + '~').should.equal(true);

          d.persistence.persistCachedDatabase(function (err) {
            var contents = fs.readFileSync(testDb, 'utf8');
            assert.isNull(err);
            fs.existsSync(testDb).should.equal(true);
            fs.existsSync(testDb + '~').should.equal(false);
            if (!contents.match(/^{"hello":"world","_id":"[0-9a-zA-Z]{16}"}\n$/)) {
              throw "Datafile contents not as expected";
            }
            done();
          });
        });
      });
    });

    it('persistCachedDatabase should update the contents of the datafile and leave a clean state even if there is a temp datafile', function (done) {
      var dbFile = 'workspace/test2.db', theDb;

      if (fs.existsSync(dbFile)) { fs.unlinkSync(dbFile); }
      if (fs.existsSync(dbFile + '~')) { fs.unlinkSync(dbFile + '~'); }

      theDb = new Datastore({ filename: dbFile });

      theDb.loadDatabase(function (err) {
        var contents = fs.readFileSync(dbFile, 'utf8');
        assert.isNull(err);
        fs.existsSync(dbFile).should.equal(true);
        fs.existsSync(dbFile + '~').should.equal(false);
        if (contents != "") {
          throw "Datafile contents not as expected";
        }
        done();
      });
    });

    it('Persistence works as expected when everything goes fine', function (done) {
      var dbFile = 'workspace/test2.db', theDb, theDb2, doc1, doc2;

      async.waterfall([
          async.apply(storage.ensureFileDoesntExist, dbFile)
        , async.apply(storage.ensureFileDoesntExist, dbFile + '~')
        , function (cb) {
          theDb = new Datastore({ filename: dbFile });
          theDb.loadDatabase(cb);
        }
        , function (cb) {
          theDb.find({}, function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(0);
            return cb();
          });
        }
      , function (cb) {
        theDb.insert({ a: 'hello' }, function (err, _doc1) {
        assert.isNull(err);
          doc1 = _doc1;
          theDb.insert({ a: 'world' }, function (err, _doc2) {
            assert.isNull(err);
            doc2 = _doc2;
            return cb();
          });
        });
      }
      , function (cb) {
        theDb.find({}, function (err, docs) {
          assert.isNull(err);
          docs.length.should.equal(2);
          _.find(docs, function (item) { return item._id === doc1._id }).a.should.equal('hello');
          _.find(docs, function (item) { return item._id === doc2._id }).a.should.equal('world');
          return cb();
        });
      }
      , function (cb) {
        theDb.loadDatabase(cb);
      }
      , function (cb) {   // No change
        theDb.find({}, function (err, docs) {
          assert.isNull(err);
          docs.length.should.equal(2);
          _.find(docs, function (item) { return item._id === doc1._id }).a.should.equal('hello');
          _.find(docs, function (item) { return item._id === doc2._id }).a.should.equal('world');
          return cb();
        });
      }
      , function (cb) {
        fs.existsSync(dbFile).should.equal(true);
        fs.existsSync(dbFile + '~').should.equal(false);
        return cb();
      }
      , function (cb) {
        theDb2 = new Datastore({ filename: dbFile });
        theDb2.loadDatabase(cb);
      }
      , function (cb) {   // No change in second db
        theDb2.find({}, function (err, docs) {
          assert.isNull(err);
          docs.length.should.equal(2);
          _.find(docs, function (item) { return item._id === doc1._id }).a.should.equal('hello');
          _.find(docs, function (item) { return item._id === doc2._id }).a.should.equal('world');
          return cb();
        });
      }
      , function (cb) {
        fs.existsSync(dbFile).should.equal(true);
        fs.existsSync(dbFile + '~').should.equal(false);
        return cb();
      }
      ], done);
    });

    // The child process will load the database with the given datafile, but the fs.writeFile function
    // is rewritten to crash the process before it finished (after 5000 bytes), to ensure data was not lost
    it('If system crashes during a loadDatabase, the former version is not lost', function (done) {
      var N = 500, toWrite = "", i, doc_i;

      // Ensuring the state is clean
      if (fs.existsSync('workspace/lac.db')) { fs.unlinkSync('workspace/lac.db'); }
      if (fs.existsSync('workspace/lac.db~')) { fs.unlinkSync('workspace/lac.db~'); }

      // Creating a db file with 150k records (a bit long to load)
      for (i = 0; i < N; i += 1) {
        toWrite += model.serialize({ _id: 'anid_' + i, hello: 'world' }) + '\n';
      }
      fs.writeFileSync('workspace/lac.db', toWrite, 'utf8');

      var datafileLength = fs.readFileSync('workspace/lac.db', 'utf8').length;

      // Loading it in a separate process that we will crash before finishing the loadDatabase
      child_process.fork('test_lac/loadAndCrash.test').on('exit', function (code) {
        code.should.equal(1);   // See test_lac/loadAndCrash.test.js

        fs.existsSync('workspace/lac.db').should.equal(true);
        fs.existsSync('workspace/lac.db~').should.equal(true);
        fs.readFileSync('workspace/lac.db', 'utf8').length.should.equal(datafileLength);
        fs.readFileSync('workspace/lac.db~', 'utf8').length.should.equal(5000);

        // Reload database without a crash, check that no data was lost and fs state is clean (no temp file)
        var db = new Datastore({ filename: 'workspace/lac.db' });
        db.loadDatabase(function (err) {
          assert.isNull(err);

          fs.existsSync('workspace/lac.db').should.equal(true);
          fs.existsSync('workspace/lac.db~').should.equal(false);
          fs.readFileSync('workspace/lac.db', 'utf8').length.should.equal(datafileLength);

          db.find({}, function (err, docs) {
            docs.length.should.equal(N);
            for (i = 0; i < N; i += 1) {
              doc_i = _.find(docs, function (d) { return d._id === 'anid_' + i; });
              assert.isDefined(doc_i);
              assert.deepEqual({ hello: 'world', _id: 'anid_' + i }, doc_i);
            }
            return done();
          });
        });
      });
    });

    // Not run on Windows as there is no clean way to set maximum file descriptors. Not an issue as the code itself is tested.
    it("Cannot cause EMFILE errors by opening too many file descriptors", function (done) {
      if (process.platform === 'win32' || process.platform === 'win64') { return done(); }
      child_process.execFile('test_lac/openFdsLaunch.sh', function (err, stdout, stderr) {
        if (err) { return done(err); }

        // The subprocess will not output anything to stdout unless part of the test fails
        if (stdout.length !== 0) {
          return done(stdout);
        } else {
          return done();
        }
      });
    });

  });   // ==== End of 'Prevent dataloss when persisting data' ====


  describe('ensureFileDoesntExist', function () {

    it('Doesnt do anything if file already doesnt exist', function (done) {
      storage.ensureFileDoesntExist('workspace/nonexisting', function (err) {
        assert.isNull(err);
        fs.existsSync('workspace/nonexisting').should.equal(false);
        done();
      });
    });

    it('Deletes file if it exists', function (done) {
      fs.writeFileSync('workspace/existing', 'hello world', 'utf8');
      fs.existsSync('workspace/existing').should.equal(true);

      storage.ensureFileDoesntExist('workspace/existing', function (err) {
        assert.isNull(err);
        fs.existsSync('workspace/existing').should.equal(false);
        done();
      });
    });

  });   // ==== End of 'ensureFileDoesntExist' ====


});
