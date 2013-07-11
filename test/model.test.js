var model = require('../lib/model')
  , should = require('chai').should()
  , assert = require('chai').assert
  , _ = require('underscore')
  , async = require('async')
  , util = require('util')
  ;


describe('Model', function () {

  describe('Serialization, deserialization', function () {

    it('Can serialize and deserialize strings', function () {
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
    });

    it('Can serialize and deserialize booleans', function () {
      var a, b, c;

      a = { test: true };
      b = model.serialize(a);
      c = model.deserialize(b);
      b.indexOf('\n').should.equal(-1);
      c.test.should.equal(true);
    });

    it('Can serialize and deserialize numbers', function () {
      var a, b, c;

      a = { test: 5 };
      b = model.serialize(a);
      c = model.deserialize(b);
      b.indexOf('\n').should.equal(-1);
      c.test.should.equal(5);
    });

    it('Can serialize and deserialize null', function () {
      var a, b, c;

      a = { test: null };
      b = model.serialize(a);
      c = model.deserialize(b);
      b.indexOf('\n').should.equal(-1);
      assert.isNull(a.test);
    });

    it('undefined fields are removed when serialized', function() {
      var a = { bloup: undefined, hello: 'world' }
        , b = model.serialize(a)
        , c = model.deserialize(b)
        ;

      Object.keys(c).length.should.equal(1);
      c.hello.should.equal('world');
      assert.isUndefined(c.bloup);
    });

    it('Can serialize and deserialize a date', function () {
      var a, b, c
        , d = new Date();

      a = { test: d };
      b = model.serialize(a);
      c = model.deserialize(b);
      b.indexOf('\n').should.equal(-1);
      util.isDate(c.test).should.equal(true);
      c.test.getTime().should.equal(d.getTime());
    });

    it('Can serialize and deserialize sub objects', function () {
      var a, b, c
        , d = new Date();

      a = { test: { something: 39, also: d, yes: { again: 'yes' } } };
      b = model.serialize(a);
      c = model.deserialize(b);
      b.indexOf('\n').should.equal(-1);
      c.test.something.should.equal(39);
      c.test.also.getTime().should.equal(d.getTime());
      c.test.yes.again.should.equal('yes');
    });

    it('Can serialize and deserialize sub arrays', function () {
      var a, b, c
        , d = new Date();

      a = { test: [ 39, d, { again: 'yes' } ] };
      b = model.serialize(a);
      c = model.deserialize(b);
      b.indexOf('\n').should.equal(-1);
      c.test[0].should.equal(39);
      c.test[1].getTime().should.equal(d.getTime());
      c.test[2].again.should.equal('yes');
    });

    it('Reject field names beginning with a $ sign or containing a dot, except the two edge cases', function () {
      var a1 = { $something: 'totest' }
        , a2 = { "with.dot": 'totest' }
        , e1 = { $$date: 4321 }
        , e2 = { $$deleted: true }
        , b;

      // Normal cases
      (function () { b = model.serialize(a1); }).should.throw();
      (function () { b = model.serialize(a2); }).should.throw();

      // Edge cases
      b = model.serialize(e1);
      b = model.serialize(e2);
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

    it('Properties with a null value dont trigger an error', function () {
      var obj = { prop: null };

      model.checkObject(obj);
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

    it('Throw an error if trying to change the _id field in a copy-type modification', function () {
      var obj = { some: 'thing', _id: 'keepit' }
        , updateQuery = { replace: 'done', bloup: [ 1, 8], _id: 'donttryit' }
        ;

      (function () {
        model.modify(obj, updateQuery);
      }).should.throw();

      updateQuery._id = 'keepit';
      model.modify(obj, updateQuery);   // No error thrown
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
    });   // End of '$set modifier'

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
    });   // End of '$inc modifier'

    describe('$push modifier', function () {

      it('Can push an element to the end of an array', function () {
        var obj = { arr: ['hello'] }
          , modified;

        modified = model.modify(obj, { $push: { arr: 'world' } });
        assert.deepEqual(modified, { arr: ['hello', 'world'] });
      });

      it('Can push an element to a non-existent field and will create the array', function () {
        var obj = {}
          , modified;

        modified = model.modify(obj, { $push: { arr: 'world' } });
        assert.deepEqual(modified, { arr: ['world'] });
      });

      it('Can push on nested fields', function () {
        var obj = { arr: { nested: ['hello'] } }
          , modified;

        modified = model.modify(obj, { $push: { "arr.nested": 'world' } });
        assert.deepEqual(modified, { arr: { nested: ['hello', 'world'] } });

        obj = { arr: { a: 2 }};
        modified = model.modify(obj, { $push: { "arr.nested": 'world' } });
        assert.deepEqual(modified, { arr: { a: 2, nested: ['world'] } });
      });

      it('Throw if we try to push to a non-array', function () {
        var obj = { arr: 'hello' }
          , modified;

        (function () {
          modified = model.modify(obj, { $push: { arr: 'world' } });
        }).should.throw();

        obj = { arr: { nested: 45 } };
        (function () {
          modified = model.modify(obj, { $push: { "arr.nested": 'world' } });
        }).should.throw();
      });

      it('Can use the $each modifier to add multiple values to an array at once', function () {
        var obj = { arr: ['hello'] }
          , modified;

        modified = model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'] } } });
        assert.deepEqual(modified, { arr: ['hello', 'world', 'earth', 'everything'] });

        (function () {
          modified = model.modify(obj, { $push: { arr: { $each: 45 } } });
        }).should.throw();

        (function () {
          modified = model.modify(obj, { $push: { arr: { $each: ['world'], unauthorized: true } } });
        }).should.throw();
      });

    });   // End of '$push modifier'

    describe('$addToSet modifier', function () {

      it('Can add an element to a set', function () {
        var obj = { arr: ['hello'] }
          , modified;

        modified = model.modify(obj, { $addToSet: { arr: 'world' } });
        assert.deepEqual(modified, { arr: ['hello', 'world'] });

        obj = { arr: ['hello'] };
        modified = model.modify(obj, { $addToSet: { arr: 'hello' } });
        assert.deepEqual(modified, { arr: ['hello'] });
      });

      it('Can add an element to a non-existent set and will create the array', function () {
        var obj = { arr: [] }
          , modified;

        modified = model.modify(obj, { $addToSet: { arr: 'world' } });
        assert.deepEqual(modified, { arr: ['world'] });
      });

      it('Throw if we try to addToSet to a non-array', function () {
        var obj = { arr: 'hello' }
          , modified;

        (function () {
          modified = model.modify(obj, { $addToSet: { arr: 'world' } });
        }).should.throw();
      });

      it('Use deep-equality to check whether we can add a value to a set', function () {
        var obj = { arr: [ { b: 2 } ] }
          , modified;

        modified = model.modify(obj, { $addToSet: { arr: { b: 3 } } });
        assert.deepEqual(modified, { arr: [{ b: 2 }, { b: 3 }] });

        obj = { arr: [ { b: 2 } ] }
        modified = model.modify(obj, { $addToSet: { arr: { b: 2 } } });
        assert.deepEqual(modified, { arr: [{ b: 2 }] });
      });

      it('Can use the $each modifier to add multiple values to a set at once', function () {
        var obj = { arr: ['hello'] }
          , modified;

        modified = model.modify(obj, { $addToSet: { arr: { $each: ['world', 'earth', 'hello', 'earth'] } } });
        assert.deepEqual(modified, { arr: ['hello', 'world', 'earth'] });

        (function () {
          modified = model.modify(obj, { $addToSet: { arr: { $each: 45 } } });
        }).should.throw();

        (function () {
          modified = model.modify(obj, { $addToSet: { arr: { $each: ['world'], unauthorized: true } } });
        }).should.throw();
      });

    });   // End of '$addToSet modifier'

    describe('$pop modifier', function () {

      it('Throw if called on a non array, a non defined field or a non integer', function () {
        var obj = { arr: 'hello' }
          , modified;

        (function () {
          modified = model.modify(obj, { $pop: { arr: 1 } });
        }).should.throw();

        obj = { bloup: 'nope' };
        (function () {
          modified = model.modify(obj, { $pop: { arr: 1 } });
        }).should.throw();

        obj = { arr: [1, 4, 8] };
        (function () {
          modified = model.modify(obj, { $pop: { arr: true } });
        }).should.throw();
      });

      it('Can remove the first and last element of an array', function () {
        var obj
          , modified;

        obj = { arr: [1, 4, 8] };
        modified = model.modify(obj, { $pop: { arr: 1 } });
        assert.deepEqual(modified, { arr: [1, 4] });

        obj = { arr: [1, 4, 8] };
        modified = model.modify(obj, { $pop: { arr: -1 } });
        assert.deepEqual(modified, { arr: [4, 8] });

        // Empty arrays are not changed
        obj = { arr: [] };
        modified = model.modify(obj, { $pop: { arr: 1 } });
        assert.deepEqual(modified, { arr: [] });
        modified = model.modify(obj, { $pop: { arr: -1 } });
        assert.deepEqual(modified, { arr: [] });
      });

    });   // End of '$pop modifier'

  });   // ==== End of 'Modifying documents' ==== //


  describe('Comparing things', function () {

    it('undefined is the smallest', function () {
      var otherStuff = [null, "string", "", -1, 0, 5.3, 12, true, false, new Date(12345), {}, { hello: 'world' }, [], ['quite', 5]];

      model.compareThings(undefined, undefined).should.equal(0);

      otherStuff.forEach(function (stuff) {
        model.compareThings(undefined, stuff).should.equal(-1);
        model.compareThings(stuff, undefined).should.equal(1);
      });
    });

    it('Then null', function () {
      var otherStuff = ["string", "", -1, 0, 5.3, 12, true, false, new Date(12345), {}, { hello: 'world' }, [], ['quite', 5]];

      model.compareThings(null, null).should.equal(0);

      otherStuff.forEach(function (stuff) {
        model.compareThings(null, stuff).should.equal(-1);
        model.compareThings(stuff, null).should.equal(1);
      });
    });

    it('Then numbers', function () {
      var otherStuff = ["string", "", true, false, new Date(4312), {}, { hello: 'world' }, [], ['quite', 5]]
        , numbers = [-12, 0, 12, 5.7];

      model.compareThings(-12, 0).should.equal(-1);
      model.compareThings(0, -3).should.equal(1);
      model.compareThings(5.7, 2).should.equal(1);
      model.compareThings(5.7, 12.3).should.equal(-1);
      model.compareThings(0, 0).should.equal(0);
      model.compareThings(-2.6, -2.6).should.equal(0);
      model.compareThings(5, 5).should.equal(0);

      otherStuff.forEach(function (stuff) {
        numbers.forEach(function (number) {
          model.compareThings(number, stuff).should.equal(-1);
          model.compareThings(stuff, number).should.equal(1);
        });
      });
    });

    it('Then strings', function () {
      var otherStuff = [true, false, new Date(4321), {}, { hello: 'world' }, [], ['quite', 5]]
        , strings = ['', 'string', 'hello world'];

      model.compareThings('', 'hey').should.equal(-1);
      model.compareThings('hey', '').should.equal(1);
      model.compareThings('hey', 'hew').should.equal(1);
      model.compareThings('hey', 'hey').should.equal(0);

      otherStuff.forEach(function (stuff) {
        strings.forEach(function (string) {
          model.compareThings(string, stuff).should.equal(-1);
          model.compareThings(stuff, string).should.equal(1);
        });
      });
    });

    it('Then booleans', function () {
      var otherStuff = [new Date(4321), {}, { hello: 'world' }, [], ['quite', 5]]
        , bools = [true, false];

      model.compareThings(true, true).should.equal(0);
      model.compareThings(false, false).should.equal(0);
      model.compareThings(true, false).should.equal(1);
      model.compareThings(false, true).should.equal(-1);

      otherStuff.forEach(function (stuff) {
        bools.forEach(function (bool) {
          model.compareThings(bool, stuff).should.equal(-1);
          model.compareThings(stuff, bool).should.equal(1);
        });
      });
    });

    it('Then dates', function () {
      var otherStuff = [{}, { hello: 'world' }, [], ['quite', 5]]
        , dates = [new Date(-123), new Date(), new Date(5555), new Date(0)]
        , now = new Date();

      model.compareThings(now, now).should.equal(0);
      model.compareThings(new Date(54341), now).should.equal(-1);
      model.compareThings(now, new Date(54341)).should.equal(1);
      model.compareThings(new Date(0), new Date(-54341)).should.equal(1);
      model.compareThings(new Date(123), new Date(4341)).should.equal(-1);

      otherStuff.forEach(function (stuff) {
        dates.forEach(function (date) {
          model.compareThings(date, stuff).should.equal(-1);
          model.compareThings(stuff, date).should.equal(1);
        });
      });
    });

    it('Then arrays', function () {
      var otherStuff = [{}, { hello: 'world' }]
        , arrays = [[], ['yes'], ['hello', 5]]
        ;

      model.compareThings([], []).should.equal(0);
      model.compareThings(['hello'], []).should.equal(1);
      model.compareThings([], ['hello']).should.equal(-1);
      model.compareThings(['hello'], ['hello', 'world']).should.equal(-1);
      model.compareThings(['hello', 'earth'], ['hello', 'world']).should.equal(-1);
      model.compareThings(['hello', 'zzz'], ['hello', 'world']).should.equal(1);
      model.compareThings(['hello', 'world'], ['hello', 'world']).should.equal(0);

      otherStuff.forEach(function (stuff) {
        arrays.forEach(function (array) {
          model.compareThings(array, stuff).should.equal(-1);
          model.compareThings(stuff, array).should.equal(1);
        });
      });
    });

    it('And finally objects', function () {
      model.compareThings({}, {}).should.equal(0);
      model.compareThings({ a: 42 }, { a: 312}).should.equal(-1);
      model.compareThings({ a: '42' }, { a: '312'}).should.equal(1);
      model.compareThings({ a: 42, b: 312 }, { b: 312, a: 42 }).should.equal(0);
      model.compareThings({ a: 42, b: 312, c: 54 }, { b: 313, a: 42 }).should.equal(-1);
    });

  });   // ==== End of 'Comparing things' ==== //


  describe('Querying', function () {

    describe('Comparing things', function () {

      it('Two things of different types cannot be equal, two identical native things are equal', function () {
        var toTest = [null, 'somestring', 42, true, new Date(72998322), { hello: 'world' }]
          , toTestAgainst = [null, 'somestring', 42, true, new Date(72998322), { hello: 'world' }]   // Use another array so that we don't test pointer equality
          , i, j
          ;

        for (i = 0; i < toTest.length; i += 1) {
          for (j = 0; j < toTestAgainst.length; j += 1) {
            model.areThingsEqual(toTest[i], toTestAgainst[j]).should.equal(i === j);
          }
        }
      });

      it('Can test native types null undefined string number boolean date equality', function () {
        var toTest = [null, undefined, 'somestring', 42, true, new Date(72998322), { hello: 'world' }]
          , toTestAgainst = [undefined, null, 'someotherstring', 5, false, new Date(111111), { hello: 'mars' }]
          , i
          ;

        for (i = 0; i < toTest.length; i += 1) {
          model.areThingsEqual(toTest[i], toTestAgainst[i]).should.equal(false);
        }
      });

      it('If one side is an array or undefined, comparison fails', function () {
        var toTestAgainst = [null, undefined, 'somestring', 42, true, new Date(72998322), { hello: 'world' }]
          , i
          ;

        for (i = 0; i < toTestAgainst.length; i += 1) {
          model.areThingsEqual([1, 2, 3], toTestAgainst[i]).should.equal(false);
          model.areThingsEqual(toTestAgainst[i], []).should.equal(false);

          model.areThingsEqual(undefined, toTestAgainst[i]).should.equal(false);
          model.areThingsEqual(toTestAgainst[i], undefined).should.equal(false);
        }
      });

      it('Can test objects equality', function () {
        model.areThingsEqual({ hello: 'world' }, {}).should.equal(false);
        model.areThingsEqual({ hello: 'world' }, { hello: 'mars' }).should.equal(false);
        model.areThingsEqual({ hello: 'world' }, { hello: 'world', temperature: 42 }).should.equal(false);
        model.areThingsEqual({ hello: 'world', other: { temperature: 42 }}, { hello: 'world', other: { temperature: 42 }}).should.equal(true);
      });

    });


    describe('Getting a fields value in dot notation', function () {

      it('Return first-level and nested values', function () {
        model.getDotValue({ hello: 'world' }, 'hello').should.equal('world');
        model.getDotValue({ hello: 'world', type: { planet: true, blue: true } }, 'type.planet').should.equal(true);
      });

      it('Return undefined if the field cannot be found in the object', function () {
        assert.isUndefined(model.getDotValue({ hello: 'world' }, 'helloo'));
        assert.isUndefined(model.getDotValue({ hello: 'world', type: { planet: true } }, 'type.plane'));
      });

    });


    describe('Field equality', function () {

      it('Can find documents with simple fields', function () {
        model.match({ test: 'yeah' }, { test: 'yea' }).should.equal(false);
        model.match({ test: 'yeah' }, { test: 'yeahh' }).should.equal(false);
        model.match({ test: 'yeah' }, { test: 'yeah' }).should.equal(true);
      });

      it('Can find documents with the dot-notation', function () {
        model.match({ test: { ooo: 'yeah' } }, { "test.ooo": 'yea' }).should.equal(false);
        model.match({ test: { ooo: 'yeah' } }, { "test.oo": 'yeah' }).should.equal(false);
        model.match({ test: { ooo: 'yeah' } }, { "tst.ooo": 'yeah' }).should.equal(false);
        model.match({ test: { ooo: 'yeah' } }, { "test.ooo": 'yeah' }).should.equal(true);
      });

      it('Cannot find undefined', function () {
        model.match({ test: undefined }, { test: undefined }).should.equal(false);
        model.match({ test: { pp: undefined } }, { "test.pp": undefined }).should.equal(false);
      });

      it('Nested objects are deep-equality matched and not treated as sub-queries', function () {
        model.match({ a: { b: 5 } }, { a: { b: 5 } }).should.equal(true);
        model.match({ a: { b: 5, c: 3 } }, { a: { b: 5 } }).should.equal(false);

        model.match({ a: { b: 5 } }, { a: { b: { $lt: 10 } } }).should.equal(false);
        (function () { model.match({ a: { b: 5 } }, { a: { $or: [ { b: 10 }, { b: 5 } ] } }) }).should.throw();
      });

    });


    describe('Regular expression matching', function () {

      it('Matching a non-string to a regular expression always yields false', function () {
        var d = new Date()
          , r = new RegExp(d.getTime());

        model.match({ test: true }, { test: /true/ }).should.equal(false);
        model.match({ test: null }, { test: /null/ }).should.equal(false);
        model.match({ test: 42 }, { test: /42/ }).should.equal(false);
        model.match({ test: d }, { test: r }).should.equal(false);
      });

      it('Can match strings using basic querying', function () {
        model.match({ test: 'true' }, { test: /true/ }).should.equal(true);
        model.match({ test: 'babaaaar' }, { test: /aba+r/ }).should.equal(true);
        model.match({ test: 'babaaaar' }, { test: /^aba+r/ }).should.equal(false);
        model.match({ test: 'true' }, { test: /t[ru]e/ }).should.equal(false);
      });

      it('Can match strings using the $regex operator', function () {
        model.match({ test: 'true' }, { test: { $regex: /true/ } }).should.equal(true);
        model.match({ test: 'babaaaar' }, { test: { $regex: /aba+r/ } }).should.equal(true);
        model.match({ test: 'babaaaar' }, { test: { $regex: /^aba+r/ } }).should.equal(false);
        model.match({ test: 'true' }, { test: { $regex: /t[ru]e/ } }).should.equal(false);
      });

      it('Will throw if $regex operator is used with a non regex value', function () {
        (function () {
          model.match({ test: 'true' }, { test: { $regex: 42 } })
        }).should.throw();

        (function () {
          model.match({ test: 'true' }, { test: { $regex: 'true' } })
        }).should.throw();
      });

      it('Can use the $regex operator in cunjunction with other operators', function () {
        model.match({ test: 'helLo' }, { test: { $regex: /ll/i, $nin: ['helL', 'helLop'] } }).should.equal(true);
        model.match({ test: 'helLo' }, { test: { $regex: /ll/i, $nin: ['helLo', 'helLop'] } }).should.equal(false);
      });

      it('Can use dot-notation', function () {
        model.match({ test: { nested: 'true' } }, { 'test.nested': /true/ }).should.equal(true);
        model.match({ test: { nested: 'babaaaar' } }, { 'test.nested': /^aba+r/ }).should.equal(false);

        model.match({ test: { nested: 'true' } }, { 'test.nested': { $regex: /true/ } }).should.equal(true);
        model.match({ test: { nested: 'babaaaar' } }, { 'test.nested': { $regex: /^aba+r/ } }).should.equal(false);
      });

    });


    describe('$lt', function () {

      it('Cannot compare a field to an object, an array, null or a boolean, it will return false', function () {
        model.match({ a: 5 }, { a: { $lt: { a: 6 } } }).should.equal(false);
        model.match({ a: 5 }, { a: { $lt: [6, 7] } }).should.equal(false);
        model.match({ a: 5 }, { a: { $lt: null } }).should.equal(false);
        model.match({ a: 5 }, { a: { $lt: true } }).should.equal(false);
      });

      it('Can compare numbers, with or without dot notation', function () {
        model.match({ a: 5 }, { a: { $lt: 6 } }).should.equal(true);
        model.match({ a: 5 }, { a: { $lt: 5 } }).should.equal(false);
        model.match({ a: 5 }, { a: { $lt: 4 } }).should.equal(false);

        model.match({ a: { b: 5 } }, { "a.b": { $lt: 6 } }).should.equal(true);
        model.match({ a: { b: 5 } }, { "a.b": { $lt: 3 } }).should.equal(false);
      });

      it('Can compare strings, with or without dot notation', function () {
        model.match({ a: "nedb" }, { a: { $lt: "nedc" } }).should.equal(true);
        model.match({ a: "nedb" }, { a: { $lt: "neda" } }).should.equal(false);

        model.match({ a: { b: "nedb" } }, { "a.b": { $lt: "nedc" } }).should.equal(true);
        model.match({ a: { b: "nedb" } }, { "a.b": { $lt: "neda" } }).should.equal(false);
      });

      it('If field is an array field, a match means a match on at least one element', function () {
        model.match({ a: [5, 10] }, { a: { $lt: 4 } }).should.equal(false);
        model.match({ a: [5, 10] }, { a: { $lt: 6 } }).should.equal(true);
        model.match({ a: [5, 10] }, { a: { $lt: 11 } }).should.equal(true);
      });

      it('Works with dates too', function () {
        model.match({ a: new Date(1000) }, { a: { $gte: new Date(1001) } }).should.equal(false);
        model.match({ a: new Date(1000) }, { a: { $lt: new Date(1001) } }).should.equal(true);
      });

    });


    // General behaviour is tested in the block about $lt. Here we just test operators work
    describe('Other comparison operators: $lte, $gt, $gte, $ne, $in, $exists', function () {

      it('$lte', function () {
        model.match({ a: 5 }, { a: { $lte: 6 } }).should.equal(true);
        model.match({ a: 5 }, { a: { $lte: 5 } }).should.equal(true);
        model.match({ a: 5 }, { a: { $lte: 4 } }).should.equal(false);
      });

      it('$gt', function () {
        model.match({ a: 5 }, { a: { $gt: 6 } }).should.equal(false);
        model.match({ a: 5 }, { a: { $gt: 5 } }).should.equal(false);
        model.match({ a: 5 }, { a: { $gt: 4 } }).should.equal(true);
      });

      it('$gte', function () {
        model.match({ a: 5 }, { a: { $gte: 6 } }).should.equal(false);
        model.match({ a: 5 }, { a: { $gte: 5 } }).should.equal(true);
        model.match({ a: 5 }, { a: { $gte: 4 } }).should.equal(true);
      });

      it('$ne', function () {
        model.match({ a: 5 }, { a: { $ne: 4 } }).should.equal(true);
        model.match({ a: 5 }, { a: { $ne: 5 } }).should.equal(false);
        model.match({ a: 5 }, { b: { $ne: 5 } }).should.equal(true);
      });

      it('$in', function () {
        model.match({ a: 5 }, { a: { $in: [6, 8, 9] } }).should.equal(false);
        model.match({ a: 6 }, { a: { $in: [6, 8, 9] } }).should.equal(true);
        model.match({ a: 7 }, { a: { $in: [6, 8, 9] } }).should.equal(false);
        model.match({ a: 8 }, { a: { $in: [6, 8, 9] } }).should.equal(true);
        model.match({ a: 9 }, { a: { $in: [6, 8, 9] } }).should.equal(true);

        (function () { model.match({ a: 5 }, { a: { $in: 5 } }); }).should.throw();
      });

      it('$nin', function () {
        model.match({ a: 5 }, { a: { $nin: [6, 8, 9] } }).should.equal(true);
        model.match({ a: 6 }, { a: { $nin: [6, 8, 9] } }).should.equal(false);
        model.match({ a: 7 }, { a: { $nin: [6, 8, 9] } }).should.equal(true);
        model.match({ a: 8 }, { a: { $nin: [6, 8, 9] } }).should.equal(false);
        model.match({ a: 9 }, { a: { $nin: [6, 8, 9] } }).should.equal(false);

        // Matches if field doesn't exist
        model.match({ a: 9 }, { b: { $nin: [6, 8, 9] } }).should.equal(true);

        (function () { model.match({ a: 5 }, { a: { $in: 5 } }); }).should.throw();
      });

      it('$exists', function () {
        model.match({ a: 5 }, { a: { $exists: 1 } }).should.equal(true);
        model.match({ a: 5 }, { a: { $exists: true } }).should.equal(true);
        model.match({ a: 5 }, { a: { $exists: new Date() } }).should.equal(true);
        model.match({ a: 5 }, { a: { $exists: '' } }).should.equal(true);
        model.match({ a: 5 }, { a: { $exists: [] } }).should.equal(true);
        model.match({ a: 5 }, { a: { $exists: {} } }).should.equal(true);

        model.match({ a: 5 }, { a: { $exists: 0 } }).should.equal(false);
        model.match({ a: 5 }, { a: { $exists: false } }).should.equal(false);
        model.match({ a: 5 }, { a: { $exists: null } }).should.equal(false);
        model.match({ a: 5 }, { a: { $exists: undefined } }).should.equal(false);

        model.match({ a: 5 }, { b: { $exists: true } }).should.equal(false);

        model.match({ a: 5 }, { b: { $exists: false } }).should.equal(true);
      });

    });


    describe('Logical operators $or, $and, $not', function () {

      it('Any of the subqueries should match for an $or to match', function () {
        model.match({ hello: 'world' }, { $or: [ { hello: 'pluton' }, { hello: 'world' } ] }).should.equal(true);
        model.match({ hello: 'pluton' }, { $or: [ { hello: 'pluton' }, { hello: 'world' } ] }).should.equal(true);
        model.match({ hello: 'nope' }, { $or: [ { hello: 'pluton' }, { hello: 'world' } ] }).should.equal(false);
        model.match({ hello: 'world', age: 15 }, { $or: [ { hello: 'pluton' }, { age: { $lt: 20 } } ] }).should.equal(true);
        model.match({ hello: 'world', age: 15 }, { $or: [ { hello: 'pluton' }, { age: { $lt: 10 } } ] }).should.equal(false);
      });

      it('All of the subqueries should match for an $and to match', function () {
        model.match({ hello: 'world', age: 15 }, { $and: [ { age: 15 }, { hello: 'world' } ] }).should.equal(true);
        model.match({ hello: 'world', age: 15 }, { $and: [ { age: 16 }, { hello: 'world' } ] }).should.equal(false);
        model.match({ hello: 'world', age: 15 }, { $and: [ { hello: 'world' }, { age: { $lt: 20 } } ] }).should.equal(true);
        model.match({ hello: 'world', age: 15 }, { $and: [ { hello: 'pluton' }, { age: { $lt: 20 } } ] }).should.equal(false);
      });

      it('Subquery should not match for a $not to match', function () {
        model.match({ a: 5, b: 10 }, { a: 5 }).should.equal(true);
        model.match({ a: 5, b: 10 }, { $not: { a: 5 } }).should.equal(false);
      });

      it('Logical operators are all top-level, only other logical operators can be above', function () {
        (function () { model.match({ a: { b: 7 } }, { a: { $or: [ { b: 5 }, { b: 7 } ] } })}).should.throw();
        model.match({ a: { b: 7 } }, { $or: [ { "a.b": 5 }, { "a.b": 7 } ] }).should.equal(true);
      });

      it('Logical operators can be combined as long as they are on top of the decision tree', function () {
        model.match({ a: 5, b: 7, c: 12 }, { $or: [ { $and: [ { a: 5 }, { b: 8 } ] }, { $and: [{ a: 5 }, { c : { $lt: 40 } }] } ] }).should.equal(true);
        model.match({ a: 5, b: 7, c: 12 }, { $or: [ { $and: [ { a: 5 }, { b: 8 } ] }, { $and: [{ a: 5 }, { c : { $lt: 10 } }] } ] }).should.equal(false);
      });

      it('Should throw an error if a logical operator is used without an array or if an unknown logical operator is used', function () {
        (function () { model.match({ a: 5 }, { $or: { a: 5, a: 6 } }); }).should.throw();
        (function () { model.match({ a: 5 }, { $and: { a: 5, a: 6 } }); }).should.throw();
        (function () { model.match({ a: 5 }, { $unknown: [ { a: 5 } ] }); }).should.throw();
      });

    });


    describe('Array fields', function () {

      it('Field equality', function () {
        model.match({ tags: ['node', 'js', 'db'] }, { tags: 'python' }).should.equal(false);
        model.match({ tags: ['node', 'js', 'db'] }, { tagss: 'js' }).should.equal(false);
        model.match({ tags: ['node', 'js', 'db'] }, { tags: 'js' }).should.equal(true);
        model.match({ tags: ['node', 'js', 'db'] }, { tags: 'js', tags: 'node' }).should.equal(true);

        // Mixed matching with array and non array
        model.match({ tags: ['node', 'js', 'db'], nedb: true }, { tags: 'js', nedb: true }).should.equal(true);

        // Nested matching
        model.match({ number: 5, data: { tags: ['node', 'js', 'db'] } }, { "data.tags": 'js' }).should.equal(true);
        model.match({ number: 5, data: { tags: ['node', 'js', 'db'] } }, { "data.tags": 'j' }).should.equal(false);
      });

      it('With one comparison operator', function () {
        model.match({ ages: [3, 7, 12] }, { ages: { $lt: 2 } }).should.equal(false);
        model.match({ ages: [3, 7, 12] }, { ages: { $lt: 3 } }).should.equal(false);
        model.match({ ages: [3, 7, 12] }, { ages: { $lt: 4 } }).should.equal(true);
        model.match({ ages: [3, 7, 12] }, { ages: { $lt: 8 } }).should.equal(true);
        model.match({ ages: [3, 7, 12] }, { ages: { $lt: 13 } }).should.equal(true);
      });

      it('Works also with arrays that are in subdocuments', function () {
        model.match({ children: { ages: [3, 7, 12] } }, { "children.ages": { $lt: 2 } }).should.equal(false);
        model.match({ children: { ages: [3, 7, 12] } }, { "children.ages": { $lt: 3 } }).should.equal(false);
        model.match({ children: { ages: [3, 7, 12] } }, { "children.ages": { $lt: 4 } }).should.equal(true);
        model.match({ children: { ages: [3, 7, 12] } }, { "children.ages": { $lt: 8 } }).should.equal(true);
        model.match({ children: { ages: [3, 7, 12] } }, { "children.ages": { $lt: 13 } }).should.equal(true);
      });

    });

  });   // ==== End of 'Finding documents' ==== //

});
