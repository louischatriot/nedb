var BinarySearchTree = require('binary-search-tree').BinarySearchTree
  , model = require('./model')
  , _ = require('underscore')
  , util = require('util')
  ;

/**
 * We can't use the one in model here since it doesn't work for arrays
 */
function checkValueEquality (a, b) {
  return a === b;
  return model.compareThings(a, b) === 0;
}


/**
 * Create a new index
 * @param {String} options.fieldName On which field should the index apply (can use dot notation to index on sub fields)
 * @param {Datastore} options.datastore Datastore on which the index is created
 * @param {Boolean} options.unique Optional, enforce a unique constraint (default: false)
 * @param {Boolean} options.sparse Optional, allow a sparse index (we can have documents for which fieldName is undefined) (default: false)
 *                                 TODO: for now the sparse option doesn't work fully
 *                                       don't use it. I will implement it in the future
 *                                       in the meantime you can use non-unique, non-sparse indexes
 *                                       for approx. the same behaviour
 */
function Index (options) {
  this.fieldName = options.fieldName;
  this.datastore = options.datastore;
  this.unique = options.unique || false;
  this.sparse = options.sparse || false;

  this.treeOptions = { unique: this.unique, compareKeys: model.compareThings, checkValueEquality: checkValueEquality };

  this.reset();   // No data in the beginning
}


/**
 * Reset an index
 * @param {Document or Array of documents} newData Optional, data to initialize the index with
 */
Index.prototype.reset = function (newData) {
  this.tree = new BinarySearchTree(this.treeOptions);
  if (this.sparse) { this.nonindexedDocs = []; }

  if (newData) { this.insert(newData); }
};


/**
 * Insert a new document in the index
 * If an array is passed, we insert all its elements
 * O(log(n))
 */
Index.prototype.insert = function (doc) {
  var key, self = this;

  if (util.isArray(doc)) { this.insertMultipleDocs(doc); return; }

  key = model.getDotValue(doc, this.fieldName);

  // We don't index documents that don't contain the field if the index is sparse
  if (key === undefined && this.sparse) {
    this.nonindexedDocs.push(doc);
    return;
  }

  this.tree.insert(key, doc);
};


/**
 * When inserting an array of documents, we need to rollback all insertions
 * if an error is thrown
 */
Index.prototype.insertMultipleDocs = function (docs) {
  var i, error, failingI;

  for (i = 0; i < docs.length; i += 1) {
    try {
      this.insert(docs[i]);
    } catch (e) {
      error = e;
      failingI = i;
      break;
    }
  }

  if (error) {
    for (i = 0; i < failingI; i += 1) {
      this.remove(docs[i]);
    }

    throw error;
  }
};


/**
 * Remove a document from the index
 * If an array is passed, we remove all its elements
 * O(log(n))
 */
Index.prototype.remove = function (doc) {
  var key, self = this

  if (util.isArray(doc)) { doc.forEach(function (d) { self.remove(d); }); return; }

  key = model.getDotValue(doc, this.fieldName);

  if (key === undefined && this.sparse) {
    this.nonindexedDocs = _.without(this.nonindexedDocs, doc);
    return;
  }

  this.tree.delete(key, doc);
};


/**
 * Update a document in the index
 * O(log(n))
 */
Index.prototype.update = function (oldDoc, newDoc) {
  this.remove(oldDoc);
  this.insert(newDoc);
};


/**
 * Get all documents in index that match the query on fieldName
 * For now only works with field equality (i.e. can't use the index for $lt query for example)
 * And doesn't return non indexed docs
 * @param {Thing} value Value to match the key against
 * @return {Array od documents}
 */
Index.prototype.getMatching = function (value) {
  return this.tree.search(value);
};


// Interface
module.exports = Index;
