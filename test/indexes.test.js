var Index = require('../lib/indexes')
  , customUtils = require('../lib/customUtils')
  , should = require('chai').should()
  , assert = require('chai').assert
  , _ = require('underscore')
  , async = require('async')
  , model = require('../lib/model')
  ;

describe('Indexes', function () {

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

    it('Works with dot notation', function () {
      var idx = new Index({ fieldName: 'tf.nested' })
        , doc1 = { a: 5, tf: { nested: 'hello' } }
        , doc2 = { a: 8, tf: { nested: 'world', additional: true } }
        , doc3 = { a: 2, tf: { nested: 'bloup', age: 42 } }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      // The underlying BST now has 3 nodes which contain the docs where it's expected
      idx.tree.getNumberOfKeys().should.equal(3);
      assert.deepEqual(idx.tree.search('hello'), [doc1]);
      assert.deepEqual(idx.tree.search('world'), [doc2]);
      assert.deepEqual(idx.tree.search('bloup'), [doc3]);

      // The nodes contain pointers to the actual documents
      idx.tree.search('bloup')[0].a = 42;
      doc3.a.should.equal(42);
    });

    it('Can insert an array of documents', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        ;

      idx.insert([doc1, doc2, doc3]);
      idx.tree.getNumberOfKeys().should.equal(3);
      assert.deepEqual(idx.tree.search('hello'), [doc1]);
      assert.deepEqual(idx.tree.search('world'), [doc2]);
      assert.deepEqual(idx.tree.search('bloup'), [doc3]);
    });

    it('When inserting an array of elements, if an error is thrown all inserts need to be rolled back', function () {
      var idx = new Index({ fieldName: 'tf', unique: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc2b = { a: 84, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        ;

      try {
        idx.insert([doc1, doc2, doc2b, doc3]);
      } catch (e) {
        e.errorType.should.equal('uniqueViolated');
      }
      idx.tree.getNumberOfKeys().should.equal(0);
      assert.deepEqual(idx.tree.search('hello'), []);
      assert.deepEqual(idx.tree.search('world'), []);
      assert.deepEqual(idx.tree.search('bloup'), []);
    });

  });   // ==== End of 'Insertion' ==== //


  describe('Removal', function () {

    it('Can remove pointers from the index, even when multiple documents have the same key', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , doc4 = { a: 23, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.insert(doc4);
      idx.tree.getNumberOfKeys().should.equal(3);

      idx.remove(doc1);
      idx.tree.getNumberOfKeys().should.equal(2);
      idx.tree.search('hello').length.should.equal(0);

      idx.remove(doc2);
      idx.tree.getNumberOfKeys().should.equal(2);
      idx.tree.search('world').length.should.equal(1);
      idx.tree.search('world')[0].should.equal(doc4);
    });

    it('If we have a sparse index, we remove the doc from the nonindexedDocs array', function () {
      var idx = new Index({ fieldName: 'nope', sparse: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 5, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.tree.getNumberOfKeys().should.equal(0);
      assert.deepEqual(idx.nonindexedDocs, [doc1, doc2]);

      idx.remove(doc1);
      idx.tree.getNumberOfKeys().should.equal(0);
      assert.deepEqual(idx.nonindexedDocs, [doc2]);
    });

    it('Works with dot notation', function () {
      var idx = new Index({ fieldName: 'tf.nested' })
        , doc1 = { a: 5, tf: { nested: 'hello' } }
        , doc2 = { a: 8, tf: { nested: 'world', additional: true } }
        , doc3 = { a: 2, tf: { nested: 'bloup', age: 42 } }
        , doc4 = { a: 2, tf: { nested: 'world', fruits: ['apple', 'carrot'] } }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.insert(doc4);
      idx.tree.getNumberOfKeys().should.equal(3);

      idx.remove(doc1);
      idx.tree.getNumberOfKeys().should.equal(2);
      idx.tree.search('hello').length.should.equal(0);

      idx.remove(doc2);
      idx.tree.getNumberOfKeys().should.equal(2);
      idx.tree.search('world').length.should.equal(1);
      idx.tree.search('world')[0].should.equal(doc4);
    });

    it('Can remove an array of documents', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        ;

      idx.insert([doc1, doc2, doc3]);
      idx.tree.getNumberOfKeys().should.equal(3);
      idx.remove([doc1, doc3]);
      idx.tree.getNumberOfKeys().should.equal(1);
      assert.deepEqual(idx.tree.search('hello'), []);
      assert.deepEqual(idx.tree.search('world'), [doc2]);
      assert.deepEqual(idx.tree.search('bloup'), []);
    });

  });   // ==== End of 'Removal' ==== //


  describe('Update', function () {

    it('Can update a document whose key did or didnt change', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , doc4 = { a: 23, tf: 'world' }
        , doc5 = { a: 1, tf: 'changed' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.tree.getNumberOfKeys().should.equal(3);
      assert.deepEqual(idx.tree.search('world'), [doc2]);

      idx.update(doc2, doc4);
      idx.tree.getNumberOfKeys().should.equal(3);
      assert.deepEqual(idx.tree.search('world'), [doc4]);

      idx.update(doc1, doc5);
      idx.tree.getNumberOfKeys().should.equal(3);
      assert.deepEqual(idx.tree.search('hello'), []);
      assert.deepEqual(idx.tree.search('changed'), [doc5]);
    });

    it('If a simple update violates a unique constraint, changes are rolled back and an error thrown', function () {
      var idx = new Index({ fieldName: 'tf', unique: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , bad = { a: 23, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      idx.tree.getNumberOfKeys().should.equal(3);
      assert.deepEqual(idx.tree.search('hello'), [doc1]);
      assert.deepEqual(idx.tree.search('world'), [doc2]);
      assert.deepEqual(idx.tree.search('bloup'), [doc3]);

      try {
        idx.update(doc3, bad);
      } catch (e) {
        e.errorType.should.equal('uniqueViolated');
      }

      // No change
      idx.tree.getNumberOfKeys().should.equal(3);
      assert.deepEqual(idx.tree.search('hello'), [doc1]);
      assert.deepEqual(idx.tree.search('world'), [doc2]);
      assert.deepEqual(idx.tree.search('bloup'), [doc3]);
    });

    it('Can update an array of documents', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , doc1b = { a: 23, tf: 'world' }
        , doc2b = { a: 1, tf: 'changed' }
        , doc3b = { a: 44, tf: 'bloup' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.tree.getNumberOfKeys().should.equal(3);

      idx.update([{ oldDoc: doc1, newDoc: doc1b }, { oldDoc: doc2, newDoc: doc2b }, { oldDoc: doc3, newDoc: doc3b }]);

      idx.tree.getNumberOfKeys().should.equal(3);
      idx.getMatching('world').length.should.equal(1);
      idx.getMatching('world')[0].should.equal(doc1b);
      idx.getMatching('changed').length.should.equal(1);
      idx.getMatching('changed')[0].should.equal(doc2b);
      idx.getMatching('bloup').length.should.equal(1);
      idx.getMatching('bloup')[0].should.equal(doc3b);
    });

    it('If a unique constraint is violated during an array-update, all changes are rolled back and an error thrown', function () {
      var idx = new Index({ fieldName: 'tf', unique: true })
        , doc0 = { a: 432, tf: 'notthistoo' }
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , doc1b = { a: 23, tf: 'changed' }
        , doc2b = { a: 1, tf: 'changed' }   // Will violate the constraint (first try)
        , doc2c = { a: 1, tf: 'notthistoo' }   // Will violate the constraint (second try)
        , doc3b = { a: 44, tf: 'alsochanged' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.tree.getNumberOfKeys().should.equal(3);

      try {
        idx.update([{ oldDoc: doc1, newDoc: doc1b }, { oldDoc: doc2, newDoc: doc2b }, { oldDoc: doc3, newDoc: doc3b }]);
      } catch (e) {
        e.errorType.should.equal('uniqueViolated');
      }

      idx.tree.getNumberOfKeys().should.equal(3);
      idx.getMatching('hello').length.should.equal(1);
      idx.getMatching('hello')[0].should.equal(doc1);
      idx.getMatching('world').length.should.equal(1);
      idx.getMatching('world')[0].should.equal(doc2);
      idx.getMatching('bloup').length.should.equal(1);
      idx.getMatching('bloup')[0].should.equal(doc3);

      try {
        idx.update([{ oldDoc: doc1, newDoc: doc1b }, { oldDoc: doc2, newDoc: doc2b }, { oldDoc: doc3, newDoc: doc3b }]);
      } catch (e) {
        e.errorType.should.equal('uniqueViolated');
      }

      idx.tree.getNumberOfKeys().should.equal(3);
      idx.getMatching('hello').length.should.equal(1);
      idx.getMatching('hello')[0].should.equal(doc1);
      idx.getMatching('world').length.should.equal(1);
      idx.getMatching('world')[0].should.equal(doc2);
      idx.getMatching('bloup').length.should.equal(1);
      idx.getMatching('bloup')[0].should.equal(doc3);
    });

    it('If an update doesnt change a document, the unique constraint is not violated', function () {
      var idx = new Index({ fieldName: 'tf', unique: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , noChange = { a: 8, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.tree.getNumberOfKeys().should.equal(3);
      assert.deepEqual(idx.tree.search('world'), [doc2]);

      idx.update(doc2, noChange);   // No error thrown
      idx.tree.getNumberOfKeys().should.equal(3);
      assert.deepEqual(idx.tree.search('world'), [noChange]);
    });

    it('Can revert simple and batch updates', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , doc1b = { a: 23, tf: 'world' }
        , doc2b = { a: 1, tf: 'changed' }
        , doc3b = { a: 44, tf: 'bloup' }
        , batchUpdate = [{ oldDoc: doc1, newDoc: doc1b }, { oldDoc: doc2, newDoc: doc2b }, { oldDoc: doc3, newDoc: doc3b }]
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.tree.getNumberOfKeys().should.equal(3);

      idx.update(batchUpdate);

      idx.tree.getNumberOfKeys().should.equal(3);
      idx.getMatching('world').length.should.equal(1);
      idx.getMatching('world')[0].should.equal(doc1b);
      idx.getMatching('changed').length.should.equal(1);
      idx.getMatching('changed')[0].should.equal(doc2b);
      idx.getMatching('bloup').length.should.equal(1);
      idx.getMatching('bloup')[0].should.equal(doc3b);

      idx.revertUpdate(batchUpdate);

      idx.tree.getNumberOfKeys().should.equal(3);
      idx.getMatching('hello').length.should.equal(1);
      idx.getMatching('hello')[0].should.equal(doc1);
      idx.getMatching('world').length.should.equal(1);
      idx.getMatching('world')[0].should.equal(doc2);
      idx.getMatching('bloup').length.should.equal(1);
      idx.getMatching('bloup')[0].should.equal(doc3);

      // Now a simple update
      idx.update(doc2, doc2b);

      idx.tree.getNumberOfKeys().should.equal(3);
      idx.getMatching('hello').length.should.equal(1);
      idx.getMatching('hello')[0].should.equal(doc1);
      idx.getMatching('changed').length.should.equal(1);
      idx.getMatching('changed')[0].should.equal(doc2b);
      idx.getMatching('bloup').length.should.equal(1);
      idx.getMatching('bloup')[0].should.equal(doc3);

      idx.revertUpdate(doc2, doc2b);

      idx.tree.getNumberOfKeys().should.equal(3);
      idx.getMatching('hello').length.should.equal(1);
      idx.getMatching('hello')[0].should.equal(doc1);
      idx.getMatching('world').length.should.equal(1);
      idx.getMatching('world')[0].should.equal(doc2);
      idx.getMatching('bloup').length.should.equal(1);
      idx.getMatching('bloup')[0].should.equal(doc3);
    });

  });   // ==== End of 'Update' ==== //


  describe('Get matching documents', function () {

    it('Get all documents where fieldName is equal to the given value, or an empty array if no match', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , doc4 = { a: 23, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.insert(doc4);

      assert.deepEqual(idx.getMatching('bloup'), [doc3]);
      assert.deepEqual(idx.getMatching('world'), [doc2, doc4]);
      assert.deepEqual(idx.getMatching('nope'), []);
    });

  });   // ==== End of 'Get matching documents' ==== //


  describe('Resetting', function () {

    it('Can reset an index without any new data, the index will be empty afterwards', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      idx.tree.getNumberOfKeys().should.equal(3);
      idx.getMatching('hello').length.should.equal(1);
      idx.getMatching('world').length.should.equal(1);
      idx.getMatching('bloup').length.should.equal(1);

      idx.reset();
      idx.tree.getNumberOfKeys().should.equal(0);
      idx.getMatching('hello').length.should.equal(0);
      idx.getMatching('world').length.should.equal(0);
      idx.getMatching('bloup').length.should.equal(0);
    });

    it('Can reset an index and initialize it with one document', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , newDoc = { a: 555, tf: 'new' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      idx.tree.getNumberOfKeys().should.equal(3);
      idx.getMatching('hello').length.should.equal(1);
      idx.getMatching('world').length.should.equal(1);
      idx.getMatching('bloup').length.should.equal(1);

      idx.reset(newDoc);
      idx.tree.getNumberOfKeys().should.equal(1);
      idx.getMatching('hello').length.should.equal(0);
      idx.getMatching('world').length.should.equal(0);
      idx.getMatching('bloup').length.should.equal(0);
      idx.getMatching('new')[0].a.should.equal(555);
    });

    it('Can reset an index and initialize it with an array of documents', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , newDocs = [{ a: 555, tf: 'new' }, { a: 666, tf: 'again' }]
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      idx.tree.getNumberOfKeys().should.equal(3);
      idx.getMatching('hello').length.should.equal(1);
      idx.getMatching('world').length.should.equal(1);
      idx.getMatching('bloup').length.should.equal(1);

      idx.reset(newDocs);
      idx.tree.getNumberOfKeys().should.equal(2);
      idx.getMatching('hello').length.should.equal(0);
      idx.getMatching('world').length.should.equal(0);
      idx.getMatching('bloup').length.should.equal(0);
      idx.getMatching('new')[0].a.should.equal(555);
      idx.getMatching('again')[0].a.should.equal(666);
    });

    it('Resetting a sparse index resets the nonindexed docs array', function () {
      var idx = new Index({ fieldName: 'tf', sparse: true})
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, no: 'world' }
        , doc3 = { a: 2, no: 'bloup' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      idx.tree.getNumberOfKeys().should.equal(1);
      idx.getMatching('hello').length.should.equal(1);
      idx.nonindexedDocs.length.should.equal(2);

      idx.reset();
      idx.tree.getNumberOfKeys().should.equal(0);
      idx.nonindexedDocs.length.should.equal(0);
    });

  });   // ==== End of 'Resetting' ==== //

  it('Get all elements in the index', function () {
    var idx = new Index({ fieldName: 'a' })
      , doc1 = { a: 5, tf: 'hello' }
      , doc2 = { a: 8, tf: 'world' }
      , doc3 = { a: 2, tf: 'bloup' }
      ;

    idx.insert(doc1);
    idx.insert(doc2);
    idx.insert(doc3);

    assert.deepEqual(idx.getAll(), [{ a: 2, tf: 'bloup' }, { a: 5, tf: 'hello' }, { a: 8, tf: 'world' }]);
  });


});
