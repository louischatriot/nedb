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


describe('Cursor', function () {
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
  
  describe('Without sorting', function () {

    beforeEach(function (done) {
      d.insert({ age: 5 }, function (err) {
        d.insert({ age: 57 }, function (err) {
          d.insert({ age: 52 }, function (err) {
            d.insert({ age: 23 }, function (err) {
              d.insert({ age: 89 }, function (err) {
                return done();
              });
            });
          });
        });
      });
    });
  
    it('Without query, an empty query or a simple query and no skip or limit', function (done) {
      async.waterfall([
        function (cb) {
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
          _.filter(docs, function(doc) { return doc.age === 57; })[0].age.should.equal(57);
          _.filter(docs, function(doc) { return doc.age === 52; })[0].age.should.equal(52);
          _.filter(docs, function(doc) { return doc.age === 89; })[0].age.should.equal(89);
          cb();
        });
      }
      ], done);
    });
    
    it('With an empty collection', function (done) {
      async.waterfall([
        function (cb) {
          d.remove({}, { multi: true }, function(err) { return cb(err); })
        }
      , function (cb) {
          var cursor = new Cursor(d);
          cursor.exec(function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(0);
            cb();
          });
        }
      ], done);
    });
    
    it('With a limit', function (done) {
      var cursor = new Cursor(d);
      cursor.limit(3);
      cursor.exec(function (err, docs) {
        assert.isNull(err);
        docs.length.should.equal(3);
        // No way to predict which results are returned of course ...
        done();
      });
    });

    it('With a skip', function (done) {
      var cursor = new Cursor(d);
      cursor.skip(2).exec(function (err, docs) {
        assert.isNull(err);
        docs.length.should.equal(3);
        // No way to predict which results are returned of course ...
        done();
      });
    });
    
    it('With a limit and a skip and method chaining', function (done) {
      var cursor = new Cursor(d);
      cursor.limit(4).skip(3);   // Only way to know that the right number of results was skipped is if limit + skip > number of results
      cursor.exec(function (err, docs) {
        assert.isNull(err);
        docs.length.should.equal(2);
        // No way to predict which results are returned of course ...
        done();
      });
    });
    
  });   // ===== End of 'Without sorting' =====
  
  
  describe('Sorting of the results', function () {

    beforeEach(function (done) {
      // We don't know the order in which docs wil be inserted but we ensure correctness by testing both sort orders
      d.insert({ age: 5 }, function (err) {
        d.insert({ age: 57 }, function (err) {
          d.insert({ age: 52 }, function (err) {
            d.insert({ age: 23 }, function (err) {
              d.insert({ age: 89 }, function (err) {
                return done();
              });
            });
          });
        });
      });
    });
  
    it('Using one sort', function (done) {
      var cursor, i;

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
    
    it('With an empty collection', function (done) {
      async.waterfall([
        function (cb) {
          d.remove({}, { multi: true }, function(err) { return cb(err); })
        }
      , function (cb) {
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

    it('Using limit and sort', function (done) {
      var i;    
      async.waterfall([
        function (cb) {
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

    it('Using a limit higher than total number of docs shouldnt cause an error', function (done) {
      var i;    
      async.waterfall([
        function (cb) {
          var cursor = new Cursor(d);
          cursor.sort({ age: 1 }).limit(7).exec(function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(5);
            docs[0].age.should.equal(5);
            docs[1].age.should.equal(23);
            docs[2].age.should.equal(52);
            docs[3].age.should.equal(57);
            docs[4].age.should.equal(89);
            cb();
          });
        }
      ], done);
    });

    it('Using limit and skip with sort', function (done) {
      var i;    
      async.waterfall([
        function (cb) {
          var cursor = new Cursor(d);
          cursor.sort({ age: 1 }).limit(1).skip(2).exec(function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(1);
            docs[0].age.should.equal(52);
            cb();
          });
        }
      , function (cb) {
          var cursor = new Cursor(d);
          cursor.sort({ age: 1 }).limit(3).skip(1).exec(function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(3);
            docs[0].age.should.equal(23);
            docs[1].age.should.equal(52);
            docs[2].age.should.equal(57);
            cb();
          });
        }
      , function (cb) {
          var cursor = new Cursor(d);
          cursor.sort({ age: -1 }).limit(2).skip(2).exec(function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(2);
            docs[0].age.should.equal(52);
            docs[1].age.should.equal(23);
            cb();
          });
        }
      ], done);
    });
    
    it('Using too big a limit and a skip with sort', function (done) {
      var i;    
      async.waterfall([
        function (cb) {
          var cursor = new Cursor(d);
          cursor.sort({ age: 1 }).limit(8).skip(2).exec(function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(3);
            docs[0].age.should.equal(52);
            docs[1].age.should.equal(57);
            docs[2].age.should.equal(89);
            cb();
          });
        }
      ], done);
    });

    it('Using too big a skip with sort should return no result', function (done) {
      var i;    
      async.waterfall([
        function (cb) {
          var cursor = new Cursor(d);
          cursor.sort({ age: 1 }).skip(5).exec(function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(0);
            cb();
          });
        }
      , function (cb) {
          var cursor = new Cursor(d);
          cursor.sort({ age: 1 }).skip(7).exec(function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(0);
            cb();
          });
        }
      , function (cb) {
          var cursor = new Cursor(d);
          cursor.sort({ age: 1 }).limit(3).skip(7).exec(function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(0);
            cb();
          });
        }
      , function (cb) {
          var cursor = new Cursor(d);
          cursor.sort({ age: 1 }).limit(6).skip(7).exec(function (err, docs) {
            assert.isNull(err);
            docs.length.should.equal(0);
            cb();
          });
        }
      ], done);
    });
    
    it('Sorting strings', function (done) {
      async.waterfall([
        function (cb) {
          d.remove({}, { multi: true }, function (err) {
            if (err) { return cb(err); }

            d.insert({ name: 'jako'}, function () {
              d.insert({ name: 'jakeb' }, function () {
                d.insert({ name: 'sue' }, function () {
                  return cb();
                });
              });            
            });
          });
        }
      , function (cb) {
          var cursor = new Cursor(d, {});
          cursor.sort({ name: 1 }).exec(function (err, docs) {
            docs.length.should.equal(3);
            docs[0].name.should.equal('jakeb');
            docs[1].name.should.equal('jako');
            docs[2].name.should.equal('sue');
            return cb();
          });
        }
      , function (cb) {
          var cursor = new Cursor(d, {});
          cursor.sort({ name: -1 }).exec(function (err, docs) {
            docs.length.should.equal(3);
            docs[0].name.should.equal('sue');
            docs[1].name.should.equal('jako');
            docs[2].name.should.equal('jakeb');
            return cb();
          });
        }
      ], done);
    });
    
    it('Sorting nested fields with dates', function (done) {
      var doc1, doc2, doc3;
      
      async.waterfall([
        function (cb) {
          d.remove({}, { multi: true }, function (err) {
            if (err) { return cb(err); }

            d.insert({ event: { recorded: new Date(400) } }, function (err, _doc1) {
              doc1 = _doc1;
              d.insert({ event: { recorded: new Date(60000) } }, function (err, _doc2) {
                doc2 = _doc2;
                d.insert({ event: { recorded: new Date(32) } }, function (err, _doc3) {
                  doc3 = _doc3;
                  return cb();
                });
              });            
            });
          });
        }
      , function (cb) {
          var cursor = new Cursor(d, {});
          cursor.sort({ "event.recorded": 1 }).exec(function (err, docs) {
            docs.length.should.equal(3);
            docs[0]._id.should.equal(doc3._id);
            docs[1]._id.should.equal(doc1._id);
            docs[2]._id.should.equal(doc2._id);
            return cb();
          });
        }
      , function (cb) {
          var cursor = new Cursor(d, {});
          cursor.sort({ "event.recorded": -1 }).exec(function (err, docs) {
            docs.length.should.equal(3);
            docs[0]._id.should.equal(doc2._id);
            docs[1]._id.should.equal(doc1._id);
            docs[2]._id.should.equal(doc3._id);
            return cb();
          });
        }
      ], done);
    });
    
    it('Sorting when some fields are undefined', function (done) {      
      async.waterfall([
        function (cb) {
          d.remove({}, { multi: true }, function (err) {
            if (err) { return cb(err); }

            d.insert({ name: 'jako', other: 2 }, function () {
              d.insert({ name: 'jakeb', other: 3 }, function () {
                d.insert({ name: 'sue' }, function () {
                  d.insert({ name: 'henry', other: 4 }, function () {
                    return cb();
                  });
                });
              });            
            });
          });
        }
      , function (cb) {
          var cursor = new Cursor(d, {});
          cursor.sort({ other: 1 }).exec(function (err, docs) {
            docs.length.should.equal(4);
            docs[0].name.should.equal('sue');
            assert.isUndefined(docs[0].other);
            docs[1].name.should.equal('jako');
            docs[1].other.should.equal(2);
            docs[2].name.should.equal('jakeb');
            docs[2].other.should.equal(3);
            docs[3].name.should.equal('henry');
            docs[3].other.should.equal(4);
            return cb();
          });
        }
      , function (cb) {
          var cursor = new Cursor(d, { name: { $in: [ 'suzy', 'jakeb', 'jako' ] } });
          cursor.sort({ other: -1 }).exec(function (err, docs) {
            docs.length.should.equal(2);
            docs[0].name.should.equal('jakeb');
            docs[0].other.should.equal(3);
            docs[1].name.should.equal('jako');
            docs[1].other.should.equal(2);
            return cb();
          });
        }
      ], done);
    });
    
    it('Sorting when all fields are undefined', function (done) {      
      async.waterfall([
        function (cb) {
          d.remove({}, { multi: true }, function (err) {
            if (err) { return cb(err); }

            d.insert({ name: 'jako'}, function () {
              d.insert({ name: 'jakeb' }, function () {
                d.insert({ name: 'sue' }, function () {
                  return cb();
                });
              });            
            });
          });
        }
      , function (cb) {
          var cursor = new Cursor(d, {});
          cursor.sort({ other: 1 }).exec(function (err, docs) {
            docs.length.should.equal(3);
            return cb();
          });
        }
      , function (cb) {
          var cursor = new Cursor(d, { name: { $in: [ 'sue', 'jakeb', 'jakob' ] } });
          cursor.sort({ other: -1 }).exec(function (err, docs) {
            docs.length.should.equal(2);
            return cb();
          });
        }
      ], done);
    });

    it('Multiple consecutive sorts', function(done) {
      async.waterfall([
        function (cb) {
          d.remove({}, { multi: true }, function (err) {
            if (err) { return cb(err); }

            d.insert({ name: 'jako', age: 43, nid: 1 }, function () {
              d.insert({ name: 'jakeb', age: 43, nid: 2 }, function () {
                d.insert({ name: 'sue', age: 12, nid: 3 }, function () {
                  d.insert({ name: 'zoe', age: 23, nid: 4 }, function () {
                    d.insert({ name: 'jako', age: 35, nid: 5 }, function () {
                      return cb();
                    });
                  });
                });
              });            
            });
          });
        }
      , function (cb) {
          var cursor = new Cursor(d, {});
          cursor.sort({ name: 1, age: -1 }).exec(function (err, docs) {
            docs.length.should.equal(5);
            
            docs[0].nid.should.equal(2);
            docs[1].nid.should.equal(1);
            docs[2].nid.should.equal(5);
            docs[3].nid.should.equal(3);
            docs[4].nid.should.equal(4);
            return cb();
          });
        }
        , function (cb) {
          var cursor = new Cursor(d, {});
          cursor.sort({ name: 1, age: 1 }).exec(function (err, docs) {
            docs.length.should.equal(5);
            
            docs[0].nid.should.equal(2);
            docs[1].nid.should.equal(5);
            docs[2].nid.should.equal(1);
            docs[3].nid.should.equal(3);
            docs[4].nid.should.equal(4);
            return cb();
          });
        }
        , function (cb) {
          var cursor = new Cursor(d, {});
          cursor.sort({ age: 1, name: 1 }).exec(function (err, docs) {
            docs.length.should.equal(5);
            
            docs[0].nid.should.equal(3);
            docs[1].nid.should.equal(4);
            docs[2].nid.should.equal(5);
            docs[3].nid.should.equal(2);
            docs[4].nid.should.equal(1);
            return cb();
          });
        }
        , function (cb) {
          var cursor = new Cursor(d, {});
          cursor.sort({ age: 1, name: -1 }).exec(function (err, docs) {
            docs.length.should.equal(5);
            
            docs[0].nid.should.equal(3);
            docs[1].nid.should.equal(4);
            docs[2].nid.should.equal(5);
            docs[3].nid.should.equal(1);
            docs[4].nid.should.equal(2);
            return cb();
          });
        }
      ], done);    });

    it('Similar data, multiple consecutive sorts', function(done) {
      var i, j, id
        , companies = [ 'acme', 'milkman', 'zoinks' ]
        , entities = []
        ;
    
      async.waterfall([
        function (cb) {
          d.remove({}, { multi: true }, function (err) {
            if (err) { return cb(err); }
            
            id = 1;
            for (i = 0; i < companies.length; i++) {
              for (j = 5; j <= 100; j += 5) {
                entities.push({
                  company: companies[i],
                  cost: j,
                  nid: id
                });
                id++;
              }
            }

            async.each(entities, function(entity, callback) {
              d.insert(entity, function() {
                callback();
              });
            }, function(err) {
              return cb();
            });
          });
        }
      , function (cb) {
          var cursor = new Cursor(d, {});
          cursor.sort({ company: 1, cost: 1 }).exec(function (err, docs) {
            docs.length.should.equal(60);
            
            for (var i = 0; i < docs.length; i++) {
              docs[i].nid.should.equal(i+1);
            };
            return cb();
          });
        }
      ], done);    });

  });   // ===== End of 'Sorting' =====
  
});








