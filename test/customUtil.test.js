var should = require('chai').should()
  , assert = require('chai').assert
  , customUtils = require('../lib/customUtils')
  , fs = require('fs')
  ;


describe('customUtils', function () {

  describe('uid', function () {

    it('Generates a string of the expected length', function () {
      customUtils.uid(3).length.should.equal(3);
      customUtils.uid(16).length.should.equal(16);
      customUtils.uid(42).length.should.equal(42);
      customUtils.uid(1000).length.should.equal(1000);
    });

    // Very small probability of conflict
    it('Generated uids should not be the same', function () {
      customUtils.uid(56).should.not.equal(customUtils.uid(56));
    });

  });

});
