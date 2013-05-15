var model = require('../lib/model')
  , should = require('chai').should()
  , assert = require('chai').assert
  , _ = require('underscore')
  , async = require('async')
  ;


describe('Model', function () {

  describe('Serialization, deserialization', function () {

    it('Can serialize and deserialize strings', function (done) {
      var a, b, c;

      a = { test: "Some string" };
      b = model.serialize(a);
      c = model.deserialize(b);
      b.indexOf('\n').should.equal(-1);
      c.test.should.equal("Some string");

      // Even if a property is a string containing a new line, the serialized
      // version doesn't. The new line must still be there upon deserialization
      a = { test: "With a new\nline" };
      b = model.serialize(a);
      c = model.deserialize(b);
      c.test.should.equal("With a new\nline");
      a.test.indexOf('\n').should.not.equal(-1);
      b.indexOf('\n').should.equal(-1);
      c.test.indexOf('\n').should.not.equal(-1);

      done();
    });

    it('Can serialize and deserialize booleans', function (done) {
      var a, b, c;

      a = { test: true };
      b = model.serialize(a);
      c = model.deserialize(b);
      b.indexOf('\n').should.equal(-1);
      c.test.should.equal(true);

      done();
    });

    it('Can serialize and deserialize numbers', function (done) {
      var a, b, c;

      a = { test: 5 };
      b = model.serialize(a);
      c = model.deserialize(b);
      b.indexOf('\n').should.equal(-1);
      c.test.should.equal(5);

      done();
    });

    it('Can serialize and deserialize null', function (done) {
      var a, b, c;

      a = { test: null };
      b = model.serialize(a);
      c = model.deserialize(b);
      b.indexOf('\n').should.equal(-1);
      assert.isNull(a.test);

      done();
    });

    it('Can serialize and deserialize a date', function (done) {
      var a, b, c
        , d = new Date();

      a = { test: d };
      b = model.serialize(a);
      c = model.deserialize(b);
      b.indexOf('\n').should.equal(-1);
      c.test.constructor.name.should.equal('Date');
      c.test.getTime().should.equal(d.getTime());

      done();
    });

    it('Can serialize and deserialize sub objects', function (done) {
      var a, b, c
        , d = new Date();

      a = { test: { something: 39, also: d, yes: { again: 'yes' } } };
      b = model.serialize(a);
      c = model.deserialize(b);
      b.indexOf('\n').should.equal(-1);
      c.test.something.should.equal(39);
      c.test.also.getTime().should.equal(d.getTime());
      c.test.yes.again.should.equal('yes');

      done();
    });

    it('Can serialize and deserialize sub arrays', function (done) {
      var a, b, c
        , d = new Date();

      a = { test: [ 39, d, { again: 'yes' } ] };
      b = model.serialize(a);
      c = model.deserialize(b);
      b.indexOf('\n').should.equal(-1);
      c.test[0].should.equal(39);
      c.test[1].getTime().should.equal(d.getTime());
      c.test[2].again.should.equal('yes');

      done();
    });

    it('Reject field names beginning with a $ sign', function (done) {
      var a = { $something: 'totest' }
        , b;

      try {
        b = model.serialize(a);
        return done('An error should have been thrown');
      } catch (e) {
        return done();
      }
    });

  });   // ==== End of 'Serialization, deserialization' ==== //


  describe('Object checking', function () {

    it('Field names beginning with a $ sign are forbidden', function () {
      assert.isDefined(model.checkObject);

      (function () {
        model.checkObject({ $bad: true });
      }).should.throw();

      (function () {
        model.checkObject({ some: 42, nested: { again: "no", $worse: true } });
      }).should.throw();

      // This shouldn't throw since "$actuallyok" is not a field name
      model.checkObject({ some: 42, nested: [ 5, "no", "$actuallyok", true ] });

      (function () {
        model.checkObject({ some: 42, nested: [ 5, "no", "$actuallyok", true, { $hidden: "useless" } ] });
      }).should.throw();
    });

    it('Field names cannot contain a .', function () {
      assert.isDefined(model.checkObject);

      (function () {
        model.checkObject({ "so.bad": true });
      }).should.throw();

      // Recursive behaviour testing done in the above test on $ signs
    });

  });   // ==== End of 'Object checking' ==== //


  describe('Deep copying', function () {

    it('Should be able to deep copy any serializable model', function () {
      var d = new Date()
        , obj = { a: ['ee', 'ff', 42], date: d, subobj: { a: 'b', b: 'c' } }
        , res = model.deepCopy(obj);
        ;

      res.a.length.should.equal(3);
      res.a[0].should.equal('ee');
      res.a[1].should.equal('ff');
      res.a[2].should.equal(42);
      res.date.getTime().should.equal(d.getTime());
      res.subobj.a.should.equal('b');
      res.subobj.b.should.equal('c');

      obj.a.push('ggg');
      obj.date = 'notadate';
      obj.subobj = [];

      // Even if the original object is modified, the copied one isn't
      res.a.length.should.equal(3);
      res.a[0].should.equal('ee');
      res.a[1].should.equal('ff');
      res.a[2].should.equal(42);
      res.date.getTime().should.equal(d.getTime());
      res.subobj.a.should.equal('b');
      res.subobj.b.should.equal('c');
    });

  });   // ==== End of 'Deep copying' ==== //


  describe('Modifying documents', function () {

    it('Queries not containing any modifier just replace the document by the contents of the query but keep its _id', function () {
      var obj = { some: 'thing', _id: 'keepit' }
        , updateQuery = { replace: 'done', bloup: [ 1, 8] }
        , t
        ;

      t = model.modify(obj, updateQuery);
      t.replace.should.equal('done');
      t.bloup.length.should.equal(2);
      t.bloup[0].should.equal(1);
      t.bloup[1].should.equal(8);

      assert.isUndefined(t.some);
      t._id.should.equal('keepit');
    });

    it('Throw an error if trying to replace the _id field in a copy-type modification', function () {
      var obj = { some: 'thing', _id: 'keepit' }
        , updateQuery = { replace: 'done', bloup: [ 1, 8], _id: 'donttryit' }
        ;

      (function () {
        model.modify(obj, updateQuery);
      }).should.throw();
    });

    it('Throw an error if trying to use modify in a mixed copy+modify way', function () {
      var obj = { some: 'thing' }
        , updateQuery = { replace: 'me', $modify: 'metoo' };

      (function () {
        model.modify(obj, updateQuery);
      }).should.throw();
    });

    it('Throw an error if trying to use an inexistent modifier', function () {
      var obj = { some: 'thing' }
        , updateQuery = { $set: 'this exists', $modify: 'not this one' };

      (function () {
        model.modify(obj, updateQuery);
      }).should.throw();
    });

    it('Throw an error if a modifier is used with a non-object argument', function () {
      var obj = { some: 'thing' }
        , updateQuery = { $set: 'this exists' };

      (function () {
        model.modify(obj, updateQuery);
      }).should.throw();
    });

    describe('$set modifier', function () {
      it('Can change already set fields without modfifying the underlying object', function () {
        var obj = { some: 'thing', yup: 'yes', nay: 'noes' }
          , updateQuery = { $set: { some: 'changed', nay: 'yes indeed' } }
          , modified = model.modify(obj, updateQuery);

        Object.keys(modified).length.should.equal(3);
        modified.some.should.equal('changed');
        modified.yup.should.equal('yes');
        modified.nay.should.equal('yes indeed');

        Object.keys(obj).length.should.equal(3);
        obj.some.should.equal('thing');
        obj.yup.should.equal('yes');
        obj.nay.should.equal('noes');
      });

      it('Creates fields to set if they dont exist yet', function () {
        var obj = { yup: 'yes' }
          , updateQuery = { $set: { some: 'changed', nay: 'yes indeed' } }
          , modified = model.modify(obj, updateQuery);

        Object.keys(modified).length.should.equal(3);
        modified.some.should.equal('changed');
        modified.yup.should.equal('yes');
        modified.nay.should.equal('yes indeed');
      });

      it('Can set sub-fields and create them if necessary', function () {
        var obj = { yup: { subfield: 'bloup' } }
          , updateQuery = { $set: { "yup.subfield": 'changed', "yup.yop": 'yes indeed', "totally.doesnt.exist": 'now it does' } }
          , modified = model.modify(obj, updateQuery);

        _.isEqual(modified, { yup: { subfield: 'changed', yop: 'yes indeed' }, totally: { doesnt: { exist: 'now it does' } } }).should.equal(true);
      });
    });

    describe('$inc modifier', function () {
      it('Throw an error if you try to use it with a non-number or on a non number field', function () {
        (function () {
        var obj = { some: 'thing', yup: 'yes', nay: 2 }
          , updateQuery = { $inc: { nay: 'notanumber' } }
          , modified = model.modify(obj, updateQuery);
        }).should.throw();

        (function () {
        var obj = { some: 'thing', yup: 'yes', nay: 'nope' }
          , updateQuery = { $inc: { nay: 1 } }
          , modified = model.modify(obj, updateQuery);
        }).should.throw();
      });

      it('Can increment number fields or create and initialize them if needed', function () {
        var obj = { some: 'thing', nay: 40 }
          , modified;

        modified = model.modify(obj, { $inc: { nay: 2 } });
        _.isEqual(modified, { some: 'thing', nay: 42 }).should.equal(true);

        // Incidentally, this tests that obj was not modified
        modified = model.modify(obj, { $inc: { inexistent: -6 } });
        _.isEqual(modified, { some: 'thing', nay: 40, inexistent: -6 }).should.equal(true);
      });

      it('Works recursively', function () {
        var obj = { some: 'thing', nay: { nope: 40 } }
          , modified;

        modified = model.modify(obj, { $inc: { "nay.nope": -2, "blip.blop": 123 } });
        _.isEqual(modified, { some: 'thing', nay: { nope: 38 }, blip: { blop: 123 } }).should.equal(true);
      });
    });

  });   // ==== End of 'Modifying documents' ==== //

});
