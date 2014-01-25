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
  , Cursor = require('../lib/cursor')
  ;


describe.only('Cursor', function () {
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
  
  describe('Querying without modifier', function () {

    it('Without query, an empty query or a simple query', function (done) {
      async.waterfall([
        function (cb) {
          d.insert({ age: 5 }, function (err) {
            d.insert({ age: 57 }, function (err) {
              d.insert({ age: 52 }, function (err) {
                d.insert({ age: 23 }, function (err) {
                  d.insert({ age: 89 }, function (err) {
                    return cb();
                  });
                });
              });
            });
          });
        }
      , function (cb) {
        var cursor = new Cursor(d);
        cursor.exec(function (err, docs) {
          assert.isNull(err);
          docs.length.should.equal(5);
          _.filter(docs, function(doc) { return doc.age === 5; })[0].age.should.equal(5);
          _.filter(docs, function(doc) { return doc.age === 57; })[0].age.should.equal(57);
          _.filter(docs, function(doc) { return doc.age === 52; })[0].age.should.equal(52);
          _.filter(docs, function(doc) { return doc.age === 23; })[0].age.should.equal(23);
          _.filter(docs, function(doc) { return doc.age === 89; })[0].age.should.equal(89);
          cb();
        });
      }
      , function (cb) {
        var cursor = new Cursor(d, {});
        cursor.exec(function (err, docs) {
          assert.isNull(err);
          docs.length.should.equal(5);
          _.filter(docs, function(doc) { return doc.age === 5; })[0].age.should.equal(5);
          _.filter(docs, function(doc) { return doc.age === 57; })[0].age.should.equal(57);
          _.filter(docs, function(doc) { return doc.age === 52; })[0].age.should.equal(52);
          _.filter(docs, function(doc) { return doc.age === 23; })[0].age.should.equal(23);
          _.filter(docs, function(doc) { return doc.age === 89; })[0].age.should.equal(89);
          cb();
        });
      }
      , function (cb) {
        var cursor = new Cursor(d, { age: { $gt: 23 } });
        cursor.exec(function (err, docs) {
          assert.isNull(err);
          docs.length.should.equal(3);
          // _.filter(docs, function(doc) { return doc.age === 5; })[0].age.should.equal(5);
          _.filter(docs, function(doc) { return doc.age === 57; })[0].age.should.equal(57);
          _.filter(docs, function(doc) { return doc.age === 52; })[0].age.should.equal(52);
          // _.filter(docs, function(doc) { return doc.age === 23; })[0].age.should.equal(23);
          _.filter(docs, function(doc) { return doc.age === 89; })[0].age.should.equal(89);
          cb();
        });
      }
      ], done);
    });
    
  });   // ===== End of 'Querying without modifier' =====
  
  
  describe('Sorting of the results', function () {

    it('Using one sort', function (done) {
      var cursor, i;
      // We don't know the order in which docs wil be inserted but we ensure correctness by testing both sort orders
      d.insert({ age: 5 }, function (err) {
        d.insert({ age: 57 }, function (err) {
          d.insert({ age: 52 }, function (err) {
            d.insert({ age: 23 }, function (err) {
              d.insert({ age: 89 }, function (err) {
                cursor = new Cursor(d, {});
                cursor.sort({ age: 1 });
                cursor.exec(function (err, docs) {
                  assert.isNull(err);
                  // Results are in ascending order
                  for (i = 0; i < docs.length - 1; i += 1) {
                    assert(docs[i].age < docs[i + 1].age)
                  }
                  
                  cursor.sort({ age: -1 });
                  cursor.exec(function (err, docs) {
                    assert.isNull(err);
                    // Results are in descending order
                    for (i = 0; i < docs.length - 1; i += 1) {
                      assert(docs[i].age > docs[i + 1].age)
                    }

                    done();
                  });          
                });
              });
            });
          });
        });
      });
    });
    
    it('With an empty collection', function (done) {
      async.waterfall([
        function (cb) {
        var cursor = new Cursor(d);
        cursor.sort({ age: 1 });
        cursor.exec(function (err, docs) {
          assert.isNull(err);
          docs.length.should.equal(0);
          cb();
        });
      }
      ], done);
    });
    
    it('Ability to chain sorting and exec', function (done) {
      var i;    
      async.waterfall([
        function (cb) {
          d.insert({ age: 5 }, function (err) {
            d.insert({ age: 57 }, function (err) {
              d.insert({ age: 52 }, function (err) {
                d.insert({ age: 23 }, function (err) {
                  d.insert({ age: 89 }, function (err) {
                    return cb();
                  });
                });
              });
            });
          });
        }
      , function (cb) {
          var cursor = new Cursor(d);
          cursor.sort({ age: 1 }).exec(function (err, docs) {
            assert.isNull(err);
            // Results are in ascending order
            for (i = 0; i < docs.length - 1; i += 1) {
              assert(docs[i].age < docs[i + 1].age)
            }
            cb();
          });
        }
      , function (cb) {
          var cursor = new Cursor(d);
          cursor.sort({ age: -1 }).exec(function (err, docs) {
            assert.isNull(err);
            // Results are in descending order
            for (i = 0; i < docs.length - 1; i += 1) {
              assert(docs[i].age > docs[i + 1].age)
            }
            cb();
          });
        }
      ], done);
    });

    it('Using limiting and sorting', function (done) {
      var i;    
      async.waterfall([
        function (cb) {
          d.insert({ age: 5 }, function (err) {
            d.insert({ age: 57 }, function (err) {
              d.insert({ age: 52 }, function (err) {
                d.insert({ age: 23 }, function (err) {
                  d.insert({ age: 89 }, function (err) {
                    return cb();
                  });
                });
              });
            });
          });
        }
      , function (cb) {
          var cursor = new Cursor(d);
          cursor.sort({ age: 1 }).limit(3).exec(function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(3);
            docs[0].age.should.equal(5);
            docs[1].age.should.equal(23);
            docs[2].age.should.equal(52);
            cb();
          });
        }
      , function (cb) {
          var cursor = new Cursor(d);
          cursor.sort({ age: -1 }).limit(2).exec(function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(2);
            docs[0].age.should.equal(89);
            docs[1].age.should.equal(57);
            cb();
          });
        }
      ], done);
    });


    
    
  
  });   // ===== End of 'Sorting' =====
  
});


