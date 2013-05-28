var Index = require('../lib/indexes')
  , customUtils = require('../lib/customUtils')
  , should = require('chai').should()
  , assert = require('chai').assert
  , _ = require('underscore')
  , async = require('async')
  , model = require('../lib/model')
  ;

describe('Indexing', function () {

  describe('Insertion', function () {

    it('Can insert pointers to documents in the index correctly when they have the field', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      // The underlying BST now has 3 nodes which contain the docs where it's expected
      idx.tree.getNumberOfKeys().should.equal(3);
      assert.deepEqual(idx.tree.search('hello'), [{ a: 5, tf: 'hello' }]);
      assert.deepEqual(idx.tree.search('world'), [{ a: 8, tf: 'world' }]);
      assert.deepEqual(idx.tree.search('bloup'), [{ a: 2, tf: 'bloup' }]);

      // The nodes contain pointers to the actual documents
      idx.tree.search('world')[0].should.equal(doc2);
      idx.tree.search('bloup')[0].a = 42;
      doc3.a.should.equal(42);
    });

    it('Inserting twice for the same fieldName in a unique index will result in an error thrown', function () {
      var idx = new Index({ fieldName: 'tf', unique: true })
        , doc1 = { a: 5, tf: 'hello' }
        ;

      idx.insert(doc1);
      idx.tree.getNumberOfKeys().should.equal(1);
      (function () { idx.insert(doc1); }).should.throw();
    });

    it('Inserting twice for a fieldName the docs dont have with a unique index results in an error thrown', function () {
      var idx = new Index({ fieldName: 'nope', unique: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 5, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.tree.getNumberOfKeys().should.equal(1);
      (function () { idx.insert(doc2); }).should.throw();
    });

    it('Inserting twice for a fieldName the docs dont have with a unique and sparse index will not throw, since the docs will be non indexed', function () {
      var idx = new Index({ fieldName: 'nope', unique: true, sparse: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 5, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.tree.getNumberOfKeys().should.equal(0);   // Docs are not indexed
      assert.deepEqual(idx.nonindexedDocs, [doc1, doc2]);   // Pointers are stored in the non indexed documents
      idx.nonindexedDocs[1].a = 12;
      doc2.a.should.equal(12);
    });

  });   // ==== End of 'Insertion' ==== //

});
