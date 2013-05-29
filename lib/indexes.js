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
 */
function Index (options) {
  this.fieldName = options.fieldName;
  this.datastore = options.datastore;
  this.unique = options.unique || false;
  this.sparse = options.sparse || false;

  if (this.sparse) { this.nonindexedDocs = []; }

  this.tree = new BinarySearchTree({ unique: this.unique, compareKeys: model.compareThings, checkValueEquality: checkValueEquality });
}


/**
 * Insert a new document in the index
 * If an array is passed, we insert all its elements
 * O(log(n))
 */
Index.prototype.insert = function (doc) {
  var key, self = this;

  if (util.isArray(doc)) { doc.forEach(function (d) { self.insert(d); }); }

  key = model.getDotValue(doc, this.fieldName);

  // We don't index documents that don't contain the field if the index is sparse
  if (key === undefined && this.sparse) {
    this.nonindexedDocs.push(doc);
    return;
  }

  this.tree.insert(key, doc);
};


/**
 * Remove a document from the index
 * O(log(n))
 */
Index.prototype.remove = function (doc) {
  var key = model.getDotValue(doc, this.fieldName);

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
 * @param {Thing} value Value to match the key against
 * @return {Array od documents}
 */
Index.prototype.getMatching = function (value) {
  return this.tree.search(value);
};


// Interface
module.exports = Index;
