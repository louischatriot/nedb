var BinarySearchTree = require('binary-search-tree').BinarySearchTree
  , model = require('./model')
  , _ = require('underscore')
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
 */
Index.prototype.insert = function (doc) {
  var key = model.getDotValue(doc, this.fieldName);

  // We don't index documents that don't contain the field if the index is sparse
  if (key === undefined && this.sparse) {
    this.nonindexedDocs.push(doc);
    return;
  }

  this.tree.insert(key, doc);
};


/**
 * Remove a document from the index
 */
Index.prototype.remove = function (doc) {
  var key = model.getDotValue(doc, this.fieldName);

  if (key === undefined && this.sparse) {
    this.nonindexedDocs = _.without(this.nonindexedDocs, doc);
    return;
  }

  this.tree.delete(key, doc);
};



// Interface
module.exports = Index;
