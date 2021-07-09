/**
 * Testing the browser version of NeDB
 * The goal of these tests is not to be exhaustive, we have the server-side NeDB tests for that
 * This is more of a sanity check which executes most of the code at least once and checks
 * it behaves as the server version does
 */

var assert = chai.assert;

/**
 * Given a docs array and an id, return the document whose id matches, or null if none is found
 */
function findById (docs, id) {
  return _.find(docs, function (doc) { return doc._id === id; }) || null;
}


describe('Basic CRUD functionality', function () {

  it('Able to create a database object in the browser', function () {
    var db = new Nedb();

    assert.equal(db.inMemoryOnly, true);
    assert.equal(db.persistence.inMemoryOnly, true);
  });

  it('Insertion and querying', function (done) {
    var db = new Nedb();

    db.insert({ a: 4 }, function (err, newDoc1) {
      assert.isNull(err);
      db.insert({ a: 40 }, function (err, newDoc2) {
        assert.isNull(err);
        db.insert({ a: 400 }, function (err, newDoc3) {
          assert.isNull(err);

          db.find({ a: { $gt: 36 } }, function (err, docs) {
            var doc2 = _.find(docs, function (doc) { return doc._id === newDoc2._id; })
              , doc3 = _.find(docs, function (doc) { return doc._id === newDoc3._id; })
              ;

            assert.isNull(err);
            assert.equal(docs.length, 2);
            assert.equal(doc2.a, 40);
            assert.equal(doc3.a, 400);

            db.find({ a: { $lt: 36 } }, function (err, docs) {
              assert.isNull(err);
              assert.equal(docs.length, 1);
              assert.equal(docs[0].a, 4);
              done();
            });
          });
        });
      });
    });
  });

  it('Querying with regular expressions', function (done) {
    var db = new Nedb();

    db.insert({ planet: 'Earth' }, function (err, newDoc1) {
      assert.isNull(err);
      db.insert({ planet: 'Mars' }, function (err, newDoc2) {
        assert.isNull(err);
        db.insert({ planet: 'Jupiter' }, function (err, newDoc3) {
          assert.isNull(err);
          db.insert({ planet: 'Eaaaaaarth' }, function (err, newDoc4) {
            assert.isNull(err);
            db.insert({ planet: 'Maaaars' }, function (err, newDoc5) {
              assert.isNull(err);

              db.find({ planet: /ar/ }, function (err, docs) {
                assert.isNull(err);
                assert.equal(docs.length, 4);
                assert.equal(_.find(docs, function (doc) { return doc._id === newDoc1._id; }).planet, 'Earth');
                assert.equal(_.find(docs, function (doc) { return doc._id === newDoc2._id; }).planet, 'Mars');
                assert.equal(_.find(docs, function (doc) { return doc._id === newDoc4._id; }).planet, 'Eaaaaaarth');
                assert.equal(_.find(docs, function (doc) { return doc._id === newDoc5._id; }).planet, 'Maaaars');

                db.find({ planet: /aa+r/ }, function (err, docs) {
                  assert.isNull(err);
                  assert.equal(docs.length, 2);
                  assert.equal(_.find(docs, function (doc) { return doc._id === newDoc4._id; }).planet, 'Eaaaaaarth');
                  assert.equal(_.find(docs, function (doc) { return doc._id === newDoc5._id; }).planet, 'Maaaars');

                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  it('Updating documents', function (done) {
    var db = new Nedb();

    db.insert({ planet: 'Eaaaaarth' }, function (err, newDoc1) {
      db.insert({ planet: 'Maaaaars' }, function (err, newDoc2) {
        // Simple update
        db.update({ _id: newDoc2._id }, { $set: { planet: 'Saturn' } }, {}, function (err, nr) {
          assert.isNull(err);
          assert.equal(nr, 1);

          db.find({}, function (err, docs) {
            assert.equal(docs.length, 2);
            assert.equal(findById(docs, newDoc1._id).planet, 'Eaaaaarth');
            assert.equal(findById(docs, newDoc2._id).planet, 'Saturn');

            // Failing update
            db.update({ _id: 'unknown' }, { $inc: { count: 1 } }, {}, function (err, nr) {
              assert.isNull(err);
              assert.equal(nr, 0);

              db.find({}, function (err, docs) {
                assert.equal(docs.length, 2);
                assert.equal(findById(docs, newDoc1._id).planet, 'Eaaaaarth');
                assert.equal(findById(docs, newDoc2._id).planet, 'Saturn');

                // Document replacement
                db.update({ planet: 'Eaaaaarth' }, { planet: 'Uranus' }, { multi: false }, function (err, nr) {
                  assert.isNull(err);
                  assert.equal(nr, 1);

                  db.find({}, function (err, docs) {
                    assert.equal(docs.length, 2);
                    assert.equal(findById(docs, newDoc1._id).planet, 'Uranus');
                    assert.equal(findById(docs, newDoc2._id).planet, 'Saturn');

                    // Multi update
                    db.update({}, { $inc: { count: 3 } }, { multi: true }, function (err, nr) {
                      assert.isNull(err);
                      assert.equal(nr, 2);

                      db.find({}, function (err, docs) {
                        assert.equal(docs.length, 2);
                        assert.equal(findById(docs, newDoc1._id).planet, 'Uranus');
                        assert.equal(findById(docs, newDoc1._id).count, 3);
                        assert.equal(findById(docs, newDoc2._id).planet, 'Saturn');
                        assert.equal(findById(docs, newDoc2._id).count, 3);

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
    });
  });

  it('Updating documents: special modifiers', function (done) {
    var db = new Nedb();

    db.insert({ planet: 'Earth' }, function (err, newDoc1) {
      // Pushing to an array
      db.update({}, { $push: { satellites: 'Phobos' } }, {}, function (err, nr) {
        assert.isNull(err);
        assert.equal(nr, 1);

        db.findOne({}, function (err, doc) {
          assert.deepEqual(doc, { planet: 'Earth', _id: newDoc1._id, satellites: ['Phobos'] });

          db.update({}, { $push: { satellites: 'Deimos' } }, {}, function (err, nr) {
            assert.isNull(err);
            assert.equal(nr, 1);

            db.findOne({}, function (err, doc) {
              assert.deepEqual(doc, { planet: 'Earth', _id: newDoc1._id, satellites: ['Phobos', 'Deimos'] });

              done();
            });
          });
        });
      });
    });
  });

  it('Upserts', function (done) {
    var db = new Nedb();

    db.update({ a: 4 }, { $inc: { b: 1 } }, { upsert: true }, function (err, nr, upsert) {
      assert.isNull(err);
      // Return upserted document
      assert.equal(upsert.a, 4);
      assert.equal(upsert.b, 1);
      assert.equal(nr, 1);

      db.find({}, function (err, docs) {
        assert.equal(docs.length, 1);
        assert.equal(docs[0].a, 4);
        assert.equal(docs[0].b, 1);

        done();
      });
    });
  });

  it('Removing documents', function (done) {
    var db = new Nedb();

    db.insert({ a: 2 });
    db.insert({ a: 5 });
    db.insert({ a: 7 });

    // Multi remove
    db.remove({ a: { $in: [ 5, 7 ] } }, { multi: true }, function (err, nr) {
      assert.isNull(err);
      assert.equal(nr, 2);

      db.find({}, function (err, docs) {
        assert.equal(docs.length, 1);
        assert.equal(docs[0].a, 2);

        // Remove with no match
        db.remove({ b: { $exists: true } }, { multi: true }, function (err, nr) {
          assert.isNull(err);
          assert.equal(nr, 0);

          db.find({}, function (err, docs) {
            assert.equal(docs.length, 1);
            assert.equal(docs[0].a, 2);

            // Simple remove
            db.remove({ a: { $exists: true } }, { multi: true }, function (err, nr) {
              assert.isNull(err);
              assert.equal(nr, 1);

              db.find({}, function (err, docs) {
                assert.equal(docs.length, 0);

                done();
              });
            });
          });
        });
      });
    });
  });

});   // ==== End of 'Basic CRUD functionality' ==== //


describe('Indexing', function () {

  it('getCandidates works as expected', function (done) {
    var db = new Nedb();

    db.insert({ a: 4 }, function () {
      db.insert({ a: 6 }, function () {
        db.insert({ a: 7 }, function () {
          db.getCandidates({ a: 6 }, function (err, candidates) {
            console.log(candidates);
            assert.equal(candidates.length, 3);
            assert.isDefined(_.find(candidates, function (doc) { return doc.a === 4; }));
            assert.isDefined(_.find(candidates, function (doc) { return doc.a === 6; }));
            assert.isDefined(_.find(candidates, function (doc) { return doc.a === 7; }));

            db.ensureIndex({ fieldName: 'a' });

            db.getCandidates({ a: 6 }, function (err, candidates) {
              assert.equal(candidates.length, 1);
              assert.isDefined(_.find(candidates, function (doc) { return doc.a === 6; }));

              done();
            });
          });
        });
      });
    });
  });

  it('Can use indexes to enforce a unique constraint', function (done) {
    var db = new Nedb();

    db.ensureIndex({ fieldName: 'u', unique: true });

    db.insert({ u : 5 }, function (err) {
      assert.isNull(err);

      db.insert({ u : 98 }, function (err) {
        assert.isNull(err);

        db.insert({ u : 5 }, function (err) {
          assert.equal(err.errorType, 'uniqueViolated');

          done();
        });
      });
    });
  });

});   // ==== End of 'Indexing' ==== //


describe("Don't forget to launch persistence tests!", function () {

  it("See file testPersistence.html", function (done) {
    done();
  });

});   // ===== End of 'persistent in-browser database' =====


