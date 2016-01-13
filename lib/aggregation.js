/**
 * Created by mitsos on 1/11/16.
 */

var model = require('./model')
  , async = require('async')
  , aggregationOperators = {}
  , accumulators = {}
  , Cursor = require('./cursor')
  , utils = require('./customUtils')
  ;

/**
 * Supported Aggregators for $group functionality
 */
accumulators.$sum = function (sumValue, previousValue, doc) {
  if (!previousValue) previousValue = 0;//initialize it if not initialized yet
  //check operator value
  if (typeof sumValue === 'string' && sumValue.charAt(0) === '$') {//expression
    var docProp = sumValue.substr(1);
    previousValue += doc[docProp];
  }
  else {//simple value
    previousValue += parseInt(sumValue);
  }
  return previousValue;
};

/**
 * Aggegation Operators that will be supported in aggregation pipeline
 */

aggregationOperators.$match = function (docs, matchObj, callback) {
  var newDataSet = [];
  for (var i = 0, docsLen = docs.length;i<docsLen;i++){
    if (model.match(docs[i],matchObj)) newDataSet.push(docs[i]);//add if meets query criteria
  }
  callback(null, newDataSet);//return the filtered set
};

aggregationOperators.$unwind = function (docs, unwindElement, callback) {
  if (unwindElement.charAt(0) === '$') unwindElement = unwindElement.substr(1);// remove first dollar character if there
  //browse results and unwind them
  var newDataSet = [];
  var doc, docUnwindEl, newUnwindDoc, refDoc;
  for (var i = 0, docLen = docs.length; i < docLen; i++) {
    doc = docs[i];
    docUnwindEl = doc[unwindElement];
    if (typeof doc[unwindElement] === 'undefined') {
      continue;//does not exist, continue
    }
    else if (Array.isArray(docUnwindEl)) {//manually unwind
      var unwindElemLen = docUnwindEl.length;
      if (unwindElemLen === 0) continue;//array element without any content, skip
      refDoc = {};//initialize starting point of reference doc to be used in unwinded elements
      for (var key in doc){
        if (key !== unwindElement) refDoc[key] = doc[key];//assign all except for element to unwind
      }
      for (var j = 0; j < unwindElemLen; j++) {//loop array field element from original doc
        newUnwindDoc = model.deepCopy(refDoc);//copy original doc
        newUnwindDoc[unwindElement] = docUnwindEl[j];//the current doc of the array element that's unwinded
        newDataSet.push(newUnwindDoc);
      }//end loop of doc field
    }
    else {//not an array element, error
      return callback(new Error('$unwind operator used on non-array field: ' + unwindElement));
    }
  }//end loop for docs, new Dataset created
  callback(null, newDataSet);
};

aggregationOperators.$sort = function (docs, sortObj, callback) {
  var tmpDb = {
    getCandidates: function () {
      return docs.slice(0);//return copy of docs
    }
  };
  var tmpCursor = new Cursor(tmpDb);//construct cursor to use already built in functionality for sorting in cursor prototype
  tmpCursor.sort(sortObj);//apply sort object
  tmpCursor._exec(callback);//call internal functionality of cursor to provide results
};

aggregationOperators.$skip = function (docs, skip, callback) {
  //if (skip > docs.length) {
  //  return callback(new Error('Skip option provided ' + skip + ' greater than actual length of provided dataset'));
  //}
  callback(null, docs.slice(skip));
};

aggregationOperators.$limit = function (docs, limit, callback) {
  return callback(null, docs.slice(0, limit));
};

aggregationOperators.$group = function (docs, groupObj, callback) {
  if (typeof groupObj._id === 'undefined') {
    return callback(new Error('Group Object in operator does not contain an _id field'));
  }
  //group object ok.. continue
  var newDataSet = [];
  var idElem = groupObj._id;
  var currentDoc, docId, j, accumulator, accumulatorOp, docToModify = null;
  for (var i = 0, docsLen = docs.length; i < docsLen; i++) {
    currentDoc = docs[i];
    docId = getDocGroupId(idElem, currentDoc);//get doc's _id expression
    //find existing or create new doc
    docToModify = null;//initialiaze selection of doc
    j = newDataSet.length;
    while (j--) {
      if (newDataSet[j]._id !== docId) continue;
      //doc found
      docToModify = newDataSet[j];
      break;///found no need to iterate
    }
    //check if docToModify was not found in order to create it
    if (!docToModify) {
      docToModify = {_id: docId};//add the group match _id
      newDataSet.push(docToModify);
    }
    //apply aggregators
    for (var property in groupObj) {
      if (property === '_id') continue;//skip these properties
      accumulator = groupObj[property];//get accumulator object
      accumulatorOp = Object.keys(accumulator)[0];
      if (!accumulators[accumulatorOp]) return callback(new Error('Unsupported accumulator ' + accumulatorOp + ' used in $group'));
      docToModify[property] = accumulators[accumulatorOp](accumulator[accumulatorOp], docToModify[property], currentDoc);
    }
    //appliance of operators finished
  }//end of iteration of result set
  callback(null, newDataSet);
};

aggregationOperators.$project = function (docs, projectObj, callback) {
  var newDataSet = [];
  var doc, j, projectKey, newDoc, projectValue, projectDoc;
  var projectKeys = Object.keys(projectObj);//get project object keys
  //check for exclusion of _id
  var excludeId = false;
  var idPos = projectKeys.indexOf('_id');
  if (idPos !== -1) {//id found in projection keys
    if (!projectObj._id) {
      excludeId = true;
      delete projectObj._id;//remove it from projection obj
      projectKeys.splice(idPos, 1);//remove it from keys array
    }
    //else {
    //  return callback(new Error('_id used in projection but without exclusion'));
    //}
  }
  for (var i = 0, docsLen = docs.length; i < docsLen; i++) {
    doc = docs[i];
    newDoc = {};//initialize new doc
    j = projectKeys.length;
    while (j--) {
      projectKey = projectKeys[j];//current projection key
      projectValue = projectObj[projectKey];
      //check type of project key
      projectDoc = {};
      projectDoc[projectKey] = projectValue;
      if (projectKey.indexOf('.') !== -1) {//dot notation key
        projectDoc = utils.convertDotToObj(projectDoc);//convert dot notation to normal obj
      }
      //project doc structured, apply it on doc
      aggregationProject(doc, projectDoc, newDoc);
    }
    if (!excludeId) newDoc._id = doc._id;
    //newDoc constructed
    newDataSet.push(newDoc);
  }
  callback(null, newDataSet);
};

/**
 * Run the Aggregation pipeline of operators upon the provided dataset
 * @param {Array} dataset The array of objects that will have the aggregation operations applied on
 * @param {Array} pipeline The array that will hold the aggregation operators that should be applied on the provided dataset
 * @param {Function} cb The callback function that will accept the result with signature (err,resultDocsArray)
 */
function exec(dataset, pipeline, cb) {
  async.reduce(pipeline, dataset, function (docs, operator, callback) {
    //check to find which operator to use
    var operation = Object.keys(operator)[0];//get the key of the operator in pipeline to determine operation
    if (!aggregationOperators[operation]) {
      return callback(new Error('Unknown aggregation operator ' + operation + ' used.'));
    }
    else {//operation exists, call it
      aggregationOperators[operation](docs, operator[operation], callback);
    }
  }, cb);
}

/**
 * Helper Functions
 */

/**
 * Applies the projection for aggregation on the provided doc
 * @param {Object} originalDoc The doc that the projection will be applied on
 * @param {Object} projectObj The projection object
 * @param {Object} newDoc The object on which the projected properties will be appended to
 */
function aggregationProject(originalDoc, projectObj, newDoc) {
  var projectKeys = Object.keys(projectObj);//get keys from projection doc
  var i = projectKeys.length;
  var key, keyValue, childDoc, tmpDoc, tmpChildArray, dotArray;
  while (i--) {
    key = projectKeys[i];//get current browsed projection key
    keyValue = projectObj[key];//get key value
    //check type of value to see what operation is needed
    if (keyValue === 1 || keyValue === true) {//inclusion of key...
      if (!!originalDoc && originalDoc.hasOwnProperty(key)) newDoc[key] = originalDoc[key];
    }
    else if (typeof keyValue === 'string') {//expression
      //for now expression will only support, including document fields as computed properties!!!!!!!
      if (keyValue.charAt(0) === '$') {//document field
        keyValue = keyValue.substr(1);
        dotArray = keyValue.split('.');
        keyValue = dotArray[0];
        childDoc = originalDoc;
        for (var k = 1, kLen = dotArray.length; k < kLen; k++) {
          if (!!childDoc && childDoc.hasOwnProperty(keyValue)) childDoc = childDoc[keyValue];
          else break;
          keyValue = dotArray[k];
        }
        //if k is not equal to kLen it means, that loop was interrupted due to not existing property.. so skip
        if (k === kLen && !!childDoc && childDoc.hasOwnProperty(keyValue)) newDoc[key] = childDoc[keyValue];
      }
    }
    else {//object .... call recursive
      childDoc = !!originalDoc && originalDoc.hasOwnProperty(key) ? originalDoc[key] : null;
      if (Array.isArray(childDoc)) {//array element in original doc, apply for every element
        tmpChildArray = [];
        for (var j = 0, childDocLen = childDoc.length; j < childDocLen; j++) {
          tmpDoc = {};
          aggregationProject(childDoc[j], keyValue, tmpDoc);
          if (Object.keys(tmpDoc).length > 0) tmpChildArray.push(tmpDoc);//nothing was assigned, remove unnecessary property
        }//end array element loop
        if (tmpChildArray.length > 0) newDoc[key] = tmpChildArray;
      }
      else {//simple object
        tmpDoc = {};//initialize child of new doc produced, hoping that will get a property
        aggregationProject(childDoc, keyValue, tmpDoc);
        if (Object.keys(tmpDoc).length > 0) newDoc[key] = tmpDoc;//nothing was assigned, remove unnecessary property
      }
    }
  }
}

/**
 * This function will accept the _id element of a $group match operator and a
 * doc and will return the computed value depending on _id content
 * @param {string} groupId the string that will set the field to return
 * @param {object} doc The object from which we want the id extracted
 * @returns {*} the id field from the doc
 */
function getDocGroupId(groupId, doc) {
  if (!groupId || (typeof groupId === 'string' && groupId.charAt(0) !== '$')) {//either null or not expression
    return groupId;
  }
  //expression
  groupId = groupId.substr(1);//remove first dollar character
  return doc[groupId] || null;
}


exports.exec = exec;