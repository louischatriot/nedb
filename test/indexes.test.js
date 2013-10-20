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
	
	describe('Array fields', function () {
	
	  it('Inserts one entry per array element in the index', function () {
      var obj = { tf: ['aa', 'bb'], really: 'yeah' }
        , obj2 = { tf: 'normal', yes: 'indeed' }
        , idx = new Index({ fieldName: 'tf' })
        ;
      
      idx.insert(obj);
      idx.getAll().length.should.equal(2);
      idx.getAll()[0].should.equal(obj);
      idx.getAll()[1].should.equal(obj);

      idx.insert(obj2);
      idx.getAll().length.should.equal(3);
	  });

	  it('Inserts one entry per array element in the index, type-checked', function () {
      var obj = { tf: ['42', 42, new Date(42), 42], really: 'yeah' }
        , idx = new Index({ fieldName: 'tf' })
        ;
      
      idx.insert(obj);
      idx.getAll().length.should.equal(3);
      idx.getAll()[0].should.equal(obj);
      idx.getAll()[1].should.equal(obj);
      idx.getAll()[2].should.equal(obj);
	  });
    
	  it('Inserts one entry per unique array element in the index, the unique constraint only holds across documents', function () {
      var obj = { tf: ['aa', 'aa'], really: 'yeah' }
        , obj2 = { tf: ['cc', 'yy', 'cc'], yes: 'indeed' }
        , idx = new Index({ fieldName: 'tf', unique: true })
        ;
      
      idx.insert(obj);
      idx.getAll().length.should.equal(1);
      idx.getAll()[0].should.equal(obj);

      idx.insert(obj2);
      idx.getAll().length.should.equal(3);
	  });

	  it('The unique constraint holds across documents', function () {
      var obj = { tf: ['aa', 'aa'], really: 'yeah' }
        , obj2 = { tf: ['cc', 'aa', 'cc'], yes: 'indeed' }
        , idx = new Index({ fieldName: 'tf', unique: true })
        ;
      
      idx.insert(obj);
      idx.getAll().length.should.equal(1);
      idx.getAll()[0].should.equal(obj);

      (function () { idx.insert(obj2); }).should.throw();
	  });
    
    it('When removing a document, remove it from the index at all unique array elements', function () {
      var obj = { tf: ['aa', 'aa'], really: 'yeah' }
        , obj2 = { tf: ['cc', 'aa', 'cc'], yes: 'indeed' }
        , idx = new Index({ fieldName: 'tf' })
        ;
      
      idx.insert(obj);
      idx.insert(obj2);
      idx.getMatching('aa').length.should.equal(2);
      idx.getMatching('aa').indexOf(obj).should.not.equal(-1);
      idx.getMatching('aa').indexOf(obj2).should.not.equal(-1);
      idx.getMatching('cc').length.should.equal(1);

      idx.remove(obj2);
      idx.getMatching('aa').length.should.equal(1);
      idx.getMatching('aa').indexOf(obj).should.not.equal(-1);
      idx.getMatching('aa').indexOf(obj2).should.equal(-1);
      idx.getMatching('cc').length.should.equal(0);      
    });
    
    it('If a unique constraint is violated when inserting an array key, roll back all inserts before the key', function () {
      var obj = { tf: ['aa', 'bb'], really: 'yeah' }
        , obj2 = { tf: ['cc', 'dd', 'aa', 'ee'], yes: 'indeed' }
        , idx = new Index({ fieldName: 'tf', unique: true })
        ;

      idx.insert(obj);
      idx.getAll().length.should.equal(2);
      idx.getMatching('aa').length.should.equal(1);
      idx.getMatching('bb').length.should.equal(1);
      idx.getMatching('cc').length.should.equal(0);
      idx.getMatching('dd').length.should.equal(0);
      idx.getMatching('ee').length.should.equal(0);
      
      (function () { idx.insert(obj2); }).should.throw();
      idx.getAll().length.should.equal(2);
      idx.getMatching('aa').length.should.equal(1);
      idx.getMatching('bb').length.should.equal(1);
      idx.getMatching('cc').length.should.equal(0);
      idx.getMatching('dd').length.should.equal(0);      
      idx.getMatching('ee').length.should.equal(0);
    });
	
	});   // ==== End of 'Array fields' ==== //

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

    it('If we have a sparse index, removing a non indexed doc has no effect', function () {
      var idx = new Index({ fieldName: 'nope', sparse: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 5, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.tree.getNumberOfKeys().should.equal(0);

      idx.remove(doc1);
      idx.tree.getNumberOfKeys().should.equal(0);
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

    it('Can get all documents for a given key in a unique index', function () {
      var idx = new Index({ fieldName: 'tf', unique: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      assert.deepEqual(idx.getMatching('bloup'), [doc3]);
      assert.deepEqual(idx.getMatching('world'), [doc2]);
      assert.deepEqual(idx.getMatching('nope'), []);
    });

    it('Can get all documents for which a field is undefined', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 2, nottf: 'bloup' }
        , doc3 = { a: 8, tf: 'world' }
        , doc4 = { a: 7, nottf: 'yes' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      assert.deepEqual(idx.getMatching('bloup'), []);
      assert.deepEqual(idx.getMatching('hello'), [doc1]);
      assert.deepEqual(idx.getMatching('world'), [doc3]);
      assert.deepEqual(idx.getMatching('yes'), []);
      assert.deepEqual(idx.getMatching(undefined), [doc2]);

      idx.insert(doc4);

      assert.deepEqual(idx.getMatching('bloup'), []);
      assert.deepEqual(idx.getMatching('hello'), [doc1]);
      assert.deepEqual(idx.getMatching('world'), [doc3]);
      assert.deepEqual(idx.getMatching('yes'), []);
      assert.deepEqual(idx.getMatching(undefined), [doc2, doc4]);
    });

    it('Can get all documents for which a field is null', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 2, tf: null }
        , doc3 = { a: 8, tf: 'world' }
        , doc4 = { a: 7, tf: null }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      assert.deepEqual(idx.getMatching('bloup'), []);
      assert.deepEqual(idx.getMatching('hello'), [doc1]);
      assert.deepEqual(idx.getMatching('world'), [doc3]);
      assert.deepEqual(idx.getMatching('yes'), []);
      assert.deepEqual(idx.getMatching(null), [doc2]);

      idx.insert(doc4);

      assert.deepEqual(idx.getMatching('bloup'), []);
      assert.deepEqual(idx.getMatching('hello'), [doc1]);
      assert.deepEqual(idx.getMatching('world'), [doc3]);
      assert.deepEqual(idx.getMatching('yes'), []);
      assert.deepEqual(idx.getMatching(null), [doc2, doc4]);
    });

    it('Can get all documents for a given key in a sparse index, but not unindexed docs (= field undefined)', function () {
      var idx = new Index({ fieldName: 'tf', sparse: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 2, nottf: 'bloup' }
        , doc3 = { a: 8, tf: 'world' }
        , doc4 = { a: 7, nottf: 'yes' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.insert(doc4);

      assert.deepEqual(idx.getMatching('bloup'), []);
      assert.deepEqual(idx.getMatching('hello'), [doc1]);
      assert.deepEqual(idx.getMatching('world'), [doc3]);
      assert.deepEqual(idx.getMatching('yes'), []);
      assert.deepEqual(idx.getMatching(undefined), []);
    });

    it('Can get all documents whose key is in an array of keys', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 2, tf: 'bloup' }
        , doc3 = { a: 8, tf: 'world' }
        , doc4 = { a: 7, tf: 'yes' }
        , doc5 = { a: 7, tf: 'yes' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.insert(doc4);
      idx.insert(doc5);

      assert.deepEqual(idx.getMatching([]), []);
      assert.deepEqual(idx.getMatching(['bloup']), [doc2]);
      assert.deepEqual(idx.getMatching(['bloup', 'yes']), [doc2, doc4, doc5]);
      assert.deepEqual(idx.getMatching(['hello', 'no']), [doc1]);
      assert.deepEqual(idx.getMatching(['nope', 'no']), []);
    });

    it('Can get all documents whose key is between certain bounds', function () {
      var idx = new Index({ fieldName: 'a' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 2, tf: 'bloup' }
        , doc3 = { a: 8, tf: 'world' }
        , doc4 = { a: 7, tf: 'yes' }
        , doc5 = { a: 10, tf: 'yes' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.insert(doc4);
      idx.insert(doc5);

      assert.deepEqual(idx.getBetweenBounds({ $lt: 10, $gte: 5 }), [ doc1, doc4, doc3 ]);
      assert.deepEqual(idx.getBetweenBounds({ $lte: 8 }), [ doc2, doc1, doc4, doc3 ]);
      assert.deepEqual(idx.getBetweenBounds({ $gt: 7 }), [ doc3, doc5 ]);
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
