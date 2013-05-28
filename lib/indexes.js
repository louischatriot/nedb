var BinarySearchTree = require('binary-search-tree').BinarySearchTree;


/**
 * Create a new index
 * @param {String} options.fieldName On which field should the index apply
 * @param {Datastore} options.datastore Datastore on which the index is created
 * @param {Boolean} options.unique Optional, enforce a unique constraint (default: false)
 * @param {Boolean} options.sparse Optional, allow a sparse index (we can have documents for which fieldName is undefined) (default: false)
 */
function Index (options) {
  this.fieldName = options.fieldName;
  this.datastore = options.datastore;
  this.unique = options.unique || false;
  this.sparse = options.unique || false;

  if (this.sparse) { this.fieldUndefined = []; }   // Will store all elements for which the indexed field is not defined
}




// Interface
module.exports = Index;
