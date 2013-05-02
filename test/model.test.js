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

  });   // ==== End of 'Serialization, deserialization' ==== //

});
