var should = require('chai').should()
  , customUtils = require('../lib/customUtils')
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

  describe('convertDotToObj', function () {

    it('Should leave an object with normal properties intact' , function () {
      var normalObj = { foo: 'bar', norm: 'al', number: 44, embed: { de: 1, d: false } };
      
      customUtils.convertDotToObj(normalObj).should.deep.equal(normalObj);
    });

    it('Should convert an object with a single dot notation' , function () {
      var input = { 'addresses.home.number': 1 }
        , expectedResult = { addresses: { home: { number: 1 } } }
        ;
      customUtils.convertDotToObj(input).should.deep.equal(expectedResult);
    });

    it('Should convert an object with multiple dot notations' , function () {
      var input = { 'addresses.home.number': 1, 'addresses.home.address': 'somewhere', 'phones.work.available': true } 
        , expectedResult = { addresses: { home: { number: 1, address: 'somewhere' } }, phones: { work: { available: true } } } 
        ;
      customUtils.convertDotToObj(input).should.deep.equal(expectedResult);
    });

    it('Should convert an object which includes a mixture of normal and dot notated fields', function () {
      var input = { foo: 'bar', vari: 24, 'addresses.home.number': 1, 'addresses.home.address': 'somewhere', 'phones.work.available': true } 
        , expectedResult = { foo: 'bar', vari: 24, addresses: { home: { number: 1, address: 'somewhere' } }, phones: { work:{ available: true } } } 
        ;
      customUtils.convertDotToObj(input).should.deep.equal(expectedResult);
    });

  });

  describe('pick', function () {

    var inputDoc = { num: 4, foo: 'bar', blean: false, addresses: { home: { number: 56, address: 'somewhere' } }, elems: [{ poso: 'akoma', test: 'thelei' }, { poso: 'ligo', test: 'emeine' }] }
      ;

    it('Should leave the source doc intact after selection of properties', function () {
      // Create a copy of the source doc
      var sourceCopy = { num: 4, foo: 'bar', blean: false, addresses: { home: { number: 56, address: 'somewhere' } }, elems: [{ poso: 'akoma', test: 'thelei' }, { poso: 'ligo', test: 'emeine' }] }
        ;
      customUtils.pick(inputDoc, { foo: 1 });   // Just call the function with some input to execute
      sourceCopy.should.deep.equal(inputDoc);   // make sure it stayed the same
    });

    it('Should correctly pick base level properties from source doc', function () {
      var selection = { num: 1, blean: 1 }
        , expectedResult = { num: 4, blean: false }
        ;
      customUtils.pick(inputDoc, selection).should.deep.equal(expectedResult);
    });

    it('Should not have trouble handling non existing properties', function () {
      var selection = { denyparxei: 1, foo: 1 }
        , expectedResult = { foo: 'bar' }
        ;
      customUtils.pick(inputDoc, selection).should.deep.equal(expectedResult);
    });

    it('Should correctly pick properties that are nested', function () {
      var selection = { blean: 1, addresses: { home: { number: 1 } } }
        , expectedResult = { blean: false, addresses: { home: { number: 56 } } }
        ;
      customUtils.pick(inputDoc, selection).should.deep.equal(expectedResult);
    });

    it('Should correctly pick properties from arrays', function () {
      var selection = { blean: 1, elems: { poso: 1 } }
        , expectedResult = { blean: false, elems: [{poso: 'akoma' }, { poso: 'ligo' }] }
        ;
      customUtils.pick(inputDoc, selection).should.deep.equal(expectedResult);
    });


    describe('Positional operator on array elements', function () {

      it('Should just skip it when positional operator applied on non-array element', function () {
        var selection = { foo: 1, addresses: { $: 1 } }
          , expectedResult = { foo: 'bar' }
          ;
        customUtils.pick(inputDoc, selection).should.deep.equal(expectedResult);
      });

      it('Should apply the matching function on every array element', function () {
        var query = { num: 4, 'addresses.home.number': 56, 'elems.poso': 'akoma' }
          , selection = { num: 1, addresses: 1, elems: { $: 1 } }
          , expectedResult = { num: 4, addresses: { home: {  number: 56, address: 'somewhere' } }, elems: [{ poso: 'akoma', test: 'thelei' }] }
        ;
        customUtils.pick(inputDoc, selection, query).should.deep.equal(expectedResult);
      });

    });

  });

  describe('omit', function () {

    var inputDoc = { num:4, foo: 'bar', blean: false, addresses: { home: { number: 56, address: 'somewhere' } }, elems: [{ poso: 'akoma', test: 'thelei' }, { poso: 'ligo', test: 'emeine' }] }
      ;

    it('Should leave the source doc intact when applying ommision', function (){
      var origCopy = { num: 4, foo: 'bar', blean: false, addresses: { home: { number: 56, address: 'somewhere' } }, elems: [{ poso: 'akoma', test: 'thelei' }, { poso: 'ligo', test: 'emeine' }] }
      ;
      customUtils.omit(inputDoc, { num: false });
      inputDoc.should.deep.equal(origCopy);
    });

    it('Should omit base level properties from doc', function () {
      var selection = { num: 0, addresses: 0 }
        , expectedResult = { foo: 'bar', blean: false, elems: [{ poso: 'akoma', test: 'thelei' }, { poso: 'ligo', test: 'emeine' }] }
        ;
      customUtils.omit(inputDoc, selection).should.deep.equal(expectedResult);
    });

    it('Should omit embedded properties', function () {
      var selection = { num: 0, addresses: { home: { address: 0 } } }
        , expectedResult = { foo: 'bar', blean: false, addresses: { home: { number: 56 } }, elems: [{ poso: 'akoma', test: 'thelei' }, { poso: 'ligo', test: 'emeine' }] }
        ;
      customUtils.omit(inputDoc, selection).should.deep.equal(expectedResult);
    });

    it('Should omit properties from arrays', function () {
      var selection = { num: 0, elems: { poso: 0 } }
        , expectedResult = { foo: 'bar', blean: false, addresses: { home: { number: 56, address: 'somewhere' } }, elems: [{ test: 'thelei' }, { test: 'emeine' }] }
        ;
      customUtils.omit(inputDoc, selection).should.deep.equal(expectedResult);
    });

    it('Should omit properties correctly from a mixed selection on arrays and embedded', function () {
      var selection = { num: 0, addresses: { home: { number: 0 } }, elems: { poso: 0 } }
        , expectedResult = { foo: 'bar', blean: false, addresses: { home: { address: 'somewhere' } }, elems: [{ test: 'thelei' }, { test: 'emeine' }] }
        ;
      customUtils.omit(inputDoc, selection).should.deep.equal(expectedResult);
    });

  });

  describe('getFieldPath', function () {
    var inputDoc = { num: 4, foo: 'bar', blean: false, addresses: { home: { number: 56, address: 'somewhere' } }, elems: [{ poso: 'akoma', test: 'thelei' }, { poso: 'ligo', test: 'emeine' }] }
    ;

    it('Should correctly return the primitive value selected', function () {
      var path = 'blean';
      customUtils.getFieldPath(inputDoc, path).should.equal(false);
    });

    it('Should return whole embedded doc correctly', function () {
      var path = 'addresses';
      customUtils.getFieldPath(inputDoc, path).should.deep.equal({ home: { number: 56, address: 'somewhere' }
      });
    });

    it('Should return whole embedded doc property correctly', function () {
      var path = 'addresses.home.address';
      customUtils.getFieldPath(inputDoc, path).should.equal('somewhere');
    });

    it('should return undefined when not existent property requested', function () {
      should.not.exist(customUtils.getFieldPath(inputDoc, 'num.wrong'));
      should.not.exist(customUtils.getFieldPath(inputDoc, 'sdf.asdf'));
    });

  });

});
