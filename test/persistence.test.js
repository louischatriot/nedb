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
      Persistence.ensureFileDoesntExist(hookTestFilename, function () {
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
      Persistence.ensureFileDoesntExist(hookTestFilename, function () {
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
      Persistence.ensureFileDoesntExist(hookTestFilename, function () {
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
      Persistence.ensureFileDoesntExist(hookTestFilename, function () {
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
      Persistence.ensureFileDoesntExist(hookTestFilename, function () {
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

  describe('First line of datastore', function () {
    var firstLineTestFilename = 'workspace/firstLineTest.db';
    
    it('firstLine option can take a string', function (done) {
      Persistence.ensureFileDoesntExist(firstLineTestFilename, function () {
        d = new Datastore({ filename: firstLineTestFilename
                           , firstLine: 'Some content'
                           });
        
        d.loadDatabase(function (err) {
          assert.isNull(err);
        
          d.persistence.getFirstLine(function (err, firstLine) {
            assert.isNull(err);
            
            firstLine.should.equal('Some content');
            
            done();
          });
        });
      });
    });
    
    it('firstLine option can take a function', function (done) {
      Persistence.ensureFileDoesntExist(firstLineTestFilename, function () {
        d = new Datastore({ filename: firstLineTestFilename
                           , firstLine: function() {
                               return 'Some dynamically generated content';
                             }
                           });
        
        d.loadDatabase(function (err) {
          assert.isNull(err);
        
          d.persistence.getFirstLine(function (err, firstLine) {
            assert.isNull(err);
            
            firstLine.should.equal('Some dynamically generated content');
            
            done();
          });
        });
      });
    });
    
    it("firstLine option can't take anything else", function (done) {
      Persistence.ensureFileDoesntExist(firstLineTestFilename, function () {
        (function () {
          new Datastore({ filename: firstLineTestFilename
                         , firstLine: 42
                         });
        }).should.throw();
        
        done();
      });
    });
    
    it('Metadata is stored as the first line of the file', function (done) {
      Persistence.ensureFileDoesntExist(firstLineTestFilename, function () {
        d = new Datastore({ filename: firstLineTestFilename
                           , firstLine: 'Some content'
                           });
        
        d.loadDatabase(function (err) {
          assert.isNull(err);
          
          fs.readFileSync(firstLineTestFilename, 'utf8').split('\n')[0].should.equal('Some content');
          
          done();
        });
      });
    });
    
    it('Metadata is not being parsed as document', function (done) {
      Persistence.ensureFileDoesntExist(firstLineTestFilename, function () {
        var rawData = model.serialize({ _id: "1", lorem: 'ipsum' }) + '\n' + 
                      model.serialize({ _id: "2", a: 2, ages: [1, 5, 12] }) + '\n' +
                      model.serialize({ _id: "3", hello: 'world' }) + '\n' +
                      model.serialize({ _id: "4", nested: { hello: 'world' } });
        
        fs.writeFileSync(firstLineTestFilename, rawData, "utf8");
        
        d = new Datastore({ filename: firstLineTestFilename
                           , firstLine: 'Some new content'
                           });
        
        d.loadDatabase(function (err) {
          assert.isNull(err);
          
          d.count({}, function (err, count) {
            assert.isNull(err);
            
            count.should.equal(3);
            
            d.persistence.getFirstLine(function (err, firstLine) {
              assert.isNull(err);
              
              // Should have overwritten the line
              firstLine.should.equal('Some new content');
              fs.readFileSync(firstLineTestFilename, 'utf8').split('\n').shift().should.equal('Some new content');
          
              done();
            });
          });
        });
      });
    });

    it('getFirstLine() can be called statically', function (done) {
      Persistence.ensureFileDoesntExist(firstLineTestFilename, function () {
        var rawData = 'Some content' + '\n' + 
                      model.serialize({ _id: "2", a: 2, ages: [1, 5, 12] }) + '\n' +
                      model.serialize({ _id: "3", hello: 'world' }) + '\n' +
                      model.serialize({ _id: "4", nested: { hello: 'world' } });
        
        fs.writeFileSync(firstLineTestFilename, rawData, "utf8");
        
        Persistence.getFirstLine(firstLineTestFilename, function (err, firstLine) {
          assert.isNull(err);
        
          firstLine.should.equal('Some content');
      
          done();
        });
      });
    });
    
    it('Does not throw on in-memory datastores', function (done) {
      d = new Datastore({ firstLine: 'Some content' });
      
      d.getFirstLine(function (err, firstLine) {
        assert.isNull(err);
      
        firstLine.should.equal('');
    
        done();
      });
    });
    
    it('Persistence.getFirstLine() is aliased to Datastore.getFirstLine()', function (done) {
      Persistence.ensureFileDoesntExist(firstLineTestFilename, function () {
        var rawData = 'Some content' + '\n' + 
                      model.serialize({ _id: "2", a: 2, ages: [1, 5, 12] }) + '\n' +
                      model.serialize({ _id: "3", hello: 'world' }) + '\n' +
                      model.serialize({ _id: "4", nested: { hello: 'world' } });
        
        fs.writeFileSync(firstLineTestFilename, rawData, "utf8");
        
        Datastore.getFirstLine(firstLineTestFilename, function (err, firstLine) {
          assert.isNull(err);
        
          firstLine.should.equal('Some content');
      
          done();
        });
      });
    });
    
    it('Persistence.prototype.getFirstLine() is aliased to Datastore.prototype.getFirstLine()', function (done) {
      Persistence.ensureFileDoesntExist(firstLineTestFilename, function () {
        var rawData = 'Some content' + '\n' + 
                      model.serialize({ _id: "2", a: 2, ages: [1, 5, 12] }) + '\n' +
                      model.serialize({ _id: "3", hello: 'world' }) + '\n' +
                      model.serialize({ _id: "4", nested: { hello: 'world' } });
        
        fs.writeFileSync(firstLineTestFilename, rawData, "utf8");
        
        d = new Datastore({ filename: firstLineTestFilename
                           , firstLine: 'Some content'
                           });
        
        d.getFirstLine(function (err, firstLine) {
          assert.isNull(err);
        
          firstLine.should.equal('Some content');
      
          done();
        });
      });
    });
    
  });   // ==== End of 'First line of datastore' ==== //
  
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
      if (fs.existsSync('workspace/it.db~~')) { fs.unlinkSync('workspace/it.db~~'); }
      
      fs.existsSync('workspace/it.db').should.equal(false);
      fs.existsSync('workspace/it.db~~').should.equal(false);      
      
      p.ensureDatafileIntegrity(function (err) {
        assert.isNull(err);
        
        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~~').should.equal(false);
        
        fs.readFileSync('workspace/it.db', 'utf8').should.equal('');
        
        done();
      });
    });
  
    it('If only datafile exists, ensureDatafileIntegrity will use it', function (done) {
      var p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });
    
      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~~')) { fs.unlinkSync('workspace/it.db~~'); }
      
      fs.writeFileSync('workspace/it.db', 'something', 'utf8');

      fs.existsSync('workspace/it.db').should.equal(true);
      fs.existsSync('workspace/it.db~~').should.equal(false);      
      
      p.ensureDatafileIntegrity(function (err) {
        assert.isNull(err);

        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~~').should.equal(false);
        
        fs.readFileSync('workspace/it.db', 'utf8').should.equal('something');
        
        done();
      });
    });
    
    it('If old datafile exists and datafile doesnt, ensureDatafileIntegrity will use it', function (done) {
      var p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });
    
      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~~')) { fs.unlinkSync('workspace/it.db~~'); }
      
      fs.writeFileSync('workspace/it.db~~', 'something', 'utf8');
      
      fs.existsSync('workspace/it.db').should.equal(false);
      fs.existsSync('workspace/it.db~~').should.equal(true);      
      
      p.ensureDatafileIntegrity(function (err) {
        assert.isNull(err);
        
        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~~').should.equal(false);
        
        fs.readFileSync('workspace/it.db', 'utf8').should.equal('something');
        
        done();
      });
    });
    
    it('If both old and current datafiles exist, ensureDatafileIntegrity will use the datafile, it means step 4 of persistence failed', function (done) {
      var theDb = new Datastore({ filename: 'workspace/it.db' });
    
      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~~')) { fs.unlinkSync('workspace/it.db~~'); }
      
      fs.writeFileSync('workspace/it.db', '{"_id":"0","hello":"world"}', 'utf8');
      fs.writeFileSync('workspace/it.db~~', '{"_id":"0","hello":"other"}', 'utf8');
      
      fs.existsSync('workspace/it.db').should.equal(true);
      fs.existsSync('workspace/it.db~~').should.equal(true);      
      
      theDb.persistence.ensureDatafileIntegrity(function (err) {
        assert.isNull(err);
        
        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~~').should.equal(true);
        
        fs.readFileSync('workspace/it.db', 'utf8').should.equal('{"_id":"0","hello":"world"}');
        
        theDb.loadDatabase(function (err) {
          assert.isNull(err);
          theDb.find({}, function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(1);
            docs[0].hello.should.equal("world");
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
          if (fs.existsSync(testDb + '~~')) { fs.unlinkSync(testDb + '~~'); }
          fs.existsSync(testDb).should.equal(false);
          
          fs.writeFileSync(testDb + '~', 'something', 'utf8');
          fs.writeFileSync(testDb + '~~', 'something else', 'utf8');
          fs.existsSync(testDb + '~').should.equal(true);
          fs.existsSync(testDb + '~~').should.equal(true);
          
          d.persistence.persistCachedDatabase(function (err) {
            var contents = fs.readFileSync(testDb, 'utf8');
            assert.isNull(err);
            fs.existsSync(testDb).should.equal(true);
            fs.existsSync(testDb + '~').should.equal(false);            
            fs.existsSync(testDb + '~~').should.equal(false);            
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
          if (fs.existsSync(testDb + '~~')) { fs.unlinkSync(testDb + '~~'); }
          fs.existsSync(testDb).should.equal(false);
          
          fs.writeFileSync(testDb + '~', 'bloup', 'utf8');
          fs.writeFileSync(testDb + '~~', 'blap', 'utf8');
          fs.existsSync(testDb + '~').should.equal(true);
          fs.existsSync(testDb + '~~').should.equal(true);
          
          d.persistence.persistCachedDatabase(function (err) {
            var contents = fs.readFileSync(testDb, 'utf8');
            assert.isNull(err);
            fs.existsSync(testDb).should.equal(true);
            fs.existsSync(testDb + '~').should.equal(false);            
            fs.existsSync(testDb + '~~').should.equal(false);            
            if (!contents.match(/^{"hello":"world","_id":"[0-9a-zA-Z]{16}"}\n$/)) {
              throw "Datafile contents not as expected";
            }
            done();
          });
        });
      });    
    });
    
    it('persistCachedDatabase should update the contents of the datafile and leave a clean state even if there is a temp or old datafile', function (done) {
      d.insert({ hello: 'world' }, function () {
        d.find({}, function (err, docs) {
          docs.length.should.equal(1);
          
          if (fs.existsSync(testDb)) { fs.unlinkSync(testDb); }
          fs.writeFileSync(testDb + '~', 'blabla', 'utf8');
          fs.writeFileSync(testDb + '~~', 'bloblo', 'utf8');
          fs.existsSync(testDb).should.equal(false);
          fs.existsSync(testDb + '~').should.equal(true);
          fs.existsSync(testDb + '~~').should.equal(true);
          
          d.persistence.persistCachedDatabase(function (err) {
            var contents = fs.readFileSync(testDb, 'utf8');
            assert.isNull(err);
            fs.existsSync(testDb).should.equal(true);
            fs.existsSync(testDb + '~').should.equal(false);            
            fs.existsSync(testDb + '~~').should.equal(false);            
            if (!contents.match(/^{"hello":"world","_id":"[0-9a-zA-Z]{16}"}\n$/)) {
              throw "Datafile contents not as expected";
            }
            done();
          });
        });
      });
    });
    
    it('persistCachedDatabase should update the contents of the datafile and leave a clean state even if there is a temp or old datafile', function (done) {
      var dbFile = 'workspace/test2.db', theDb;
    
      if (fs.existsSync(dbFile)) { fs.unlinkSync(dbFile); }
      if (fs.existsSync(dbFile + '~')) { fs.unlinkSync(dbFile + '~'); }
      if (fs.existsSync(dbFile + '~~')) { fs.unlinkSync(dbFile + '~~'); }
      
      theDb = new Datastore({ filename: dbFile });
      
      theDb.loadDatabase(function (err) {
        var contents = fs.readFileSync(dbFile, 'utf8');
        assert.isNull(err);
        fs.existsSync(dbFile).should.equal(true);
        fs.existsSync(dbFile + '~').should.equal(false);            
        fs.existsSync(dbFile + '~~').should.equal(false);            
        if (contents != "") {
          throw "Datafile contents not as expected";
        }
        done();
      });
    });

    it('Persistence works as expected when everything goes fine', function (done) {
      var dbFile = 'workspace/test2.db', theDb, theDb2, doc1, doc2;
      
      async.waterfall([
        async.apply(Persistence.ensureFileDoesntExist, dbFile)
      , async.apply(Persistence.ensureFileDoesntExist, dbFile + '~')
      , async.apply(Persistence.ensureFileDoesntExist, dbFile + '~~')
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
        fs.existsSync(dbFile + '~~').should.equal(false);
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
        fs.existsSync(dbFile + '~~').should.equal(false);
        return cb();
      } 
      ], done);
    });
    
  
    // This test is a bit complicated since it depends on the time I/O actions take to execute
    // That depends on the machine and the load on the machine when the tests are run
    // It is timed for my machine with nothing else running but may not work as expected on others (it will not fail but may not be a proof)
    // Every new version of NeDB passes it on my machine before rtelease
    it('If system crashes during a loadDatabase, the former version is not lost', function (done) {
      var cp, N = 150000, toWrite = "", i;
      
      // Ensuring the state is clean
      if (fs.existsSync('workspace/lac.db')) { fs.unlinkSync('workspace/lac.db'); }
      if (fs.existsSync('workspace/lac.db~')) { fs.unlinkSync('workspace/lac.db~'); }

      // Creating a db file with 150k records (a bit long to load)
      for (i = 0; i < N; i += 1) {
        toWrite += model.serialize({ _id: customUtils.uid(16), hello: 'world' }) + '\n';
      }        
      fs.writeFileSync('workspace/lac.db', toWrite, 'utf8');
      
      // Loading it in a separate process that we will crash before finishing the loadDatabase
      cp = child_process.fork('test_lac/loadAndCrash.test')
      
      // Kill the child process when we're at step 3 of persistCachedDatabase (during write to datafile)
      setTimeout(function() {
        cp.kill('SIGINT');
        
        // If the timing is correct, only the temp datafile contains data
        // The datafile was in the middle of being written and is empty
        
        // Let the process crash be finished then load database without a crash, and test we didn't lose data
        setTimeout(function () {
          var db = new Datastore({ filename: 'workspace/lac.db' });
          db.loadDatabase(function (err) {
            assert.isNull(err);
            
            db.count({}, function (err, n) {
              // Data has not been lost
              assert.isNull(err);
              n.should.equal(150000);
              
              // State is clean, the temp datafile has been erased and the datafile contains all the data
              fs.existsSync('workspace/lac.db').should.equal(true);
              fs.existsSync('workspace/lac.db~').should.equal(false);
              
              done();
            });
          });
        }, 100);        
      }, 2000);
    });
  
  });   // ==== End of 'Prevent dataloss when persisting data' ====


  describe('ensureFileDoesntExist', function () {
  
    it('Doesnt do anything if file already doesnt exist', function (done) {
      Persistence.ensureFileDoesntExist('workspace/nonexisting', function (err) {
        assert.isNull(err);
        fs.existsSync('workspace/nonexisting').should.equal(false);
        done();
      });
    });

    it('Deletes file if it exists', function (done) {
      fs.writeFileSync('workspace/existing', 'hello world', 'utf8');
      fs.existsSync('workspace/existing').should.equal(true);
    
      Persistence.ensureFileDoesntExist('workspace/existing', function (err) {
        assert.isNull(err);
        fs.existsSync('workspace/existing').should.equal(false);
        done();
      });
    });
    
  });   // ==== End of 'ensureFileDoesntExist' ====


});
