var assert = chai.assert;
chai.should();


describe('Basic test', function () {

  it('Can create a database, insert some docs and query them', function () {
    var db = new Nedb();

    // Can use callback-less syntax since commands are queued
    db.insert({ a: 4 });
    db.insert({ a: 40 });
    db.insert({ a: 400 });
    db.find({ a: { $gt: 36 } }, function (err, docs) {
      docs.length.should.equal(2);

      db.find({ a: { $lt: 36 } }, function (err, docs) {
        docs.length.should.equal(1);
        docs[0].a.should.equal(4);
      });
    });
  });

});
