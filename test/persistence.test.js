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
  
  
  // This test is a bit complicated since it depends on the time actions take to execute
  // It may not work as expected on all machines as it is timed for my machine
  // That's why it is skipped, but all versions of nedb pass this test
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
      
      p.ensureDatafileIntegrity(function (err) {
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
      
      p.ensureDatafileIntegrity(function (err) {
        assert.isNull(err);

        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~').should.equal(false);
        
        fs.readFileSync('workspace/it.db', 'utf8').should.equal('something');
        
        done();
      });
    });
    
    it('If only temp datafile exists, ensureDatafileIntegrity will use it', function (done) {
      var p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });
    
      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~')) { fs.unlinkSync('workspace/it.db~'); }
      
      fs.writeFileSync('workspace/it.db~', 'something', 'utf8');
      
      fs.existsSync('workspace/it.db').should.equal(false);
      fs.existsSync('workspace/it.db~').should.equal(true);      
      
      p.ensureDatafileIntegrity(function (err) {
        assert.isNull(err);
        
        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~').should.equal(false);
        
        fs.readFileSync('workspace/it.db', 'utf8').should.equal('something');
        
        done();
      });
    });
  
    it('If both files exist and datafile is not empty, ensureDatafileIntegrity will use the datafile', function (done) {
      var p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });
    
      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~')) { fs.unlinkSync('workspace/it.db~'); }
      
      fs.writeFileSync('workspace/it.db', 'something', 'utf8');
      fs.writeFileSync('workspace/it.db~', 'other', 'utf8');
      
      fs.existsSync('workspace/it.db').should.equal(true);
      fs.existsSync('workspace/it.db~').should.equal(true);      
      
      p.ensureDatafileIntegrity(function (err) {
        assert.isNull(err);
        
        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~').should.equal(false);
        
        fs.readFileSync('workspace/it.db', 'utf8').should.equal('something');
        
        done();
      });
    });
    
    it('If both files exist and datafile is empty, ensureDatafileIntegrity will use the datafile', function (done) {
      var p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });
    
      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~')) { fs.unlinkSync('workspace/it.db~'); }
      
      fs.writeFileSync('workspace/it.db', '', 'utf8');
      fs.writeFileSync('workspace/it.db~', 'other', 'utf8');
      
      fs.existsSync('workspace/it.db').should.equal(true);
      fs.existsSync('workspace/it.db~').should.equal(true);
      
      p.ensureDatafileIntegrity(function (err) {
        assert.isNull(err);
        
        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~').should.equal(false);
        
        fs.readFileSync('workspace/it.db', 'utf8').should.equal('other');
        
        done();
      });
    });
  
    it('persistCachedDatabase should update the contents of the datafile', function (done) {
      d.insert({ hello: 'world' }, function () {
        d.find({}, function (err, docs) {
          docs.length.should.equal(1);
          
          fs.unlinkSync(testDb);
          fs.existsSync(testDb).should.equal(false);
          
          d.persistence.persistCachedDatabase(function (err) {
            var contents = fs.readFileSync(testDb, 'utf8');
            assert.isNull(err);
            if (!contents.match(/^{"hello":"world","_id":"[0-9a-zA-Z]{16}"}\n$/)) {
              throw "Datafile contents not as expected";
            }
            done();
          });
        });
      });
    });    
  
    it.skip('If system crashes during a loadDatabase, the former version is not lost', function (done) {
      var cp, N = 150000, toWrite = "", i;

      // Creating a db file with 150k records (a bit long to load)
      for (i = 0; i < N; i += 1) {
        toWrite += model.serialize({ _id: customUtils.uid(16), hello: 'world' }) + '\n';
      }        
      fs.writeFileSync('workspace/lac.db', toWrite, 'utf8');

      // Loading it in a separate process that'll crash before finishing the load
      cp = child_process.fork('test_lac/loadAndCrash.test')
      cp.on('message', function (msg) {
        // Let the child process enough time to crash
        setTimeout(function () {
//          fs.readFileSync('workspace/lac.db', 'utf8').length.should.not.equal(0);
          console.log(fs.readFileSync('workspace/lac.db').length);
          console.log(fs.readFileSync('workspace/lac.db~').length);
          done();
        }, 100);
      });
    });
  
  });

});
