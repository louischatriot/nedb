var crypto = require('crypto')
  , model = require('./model')
  ;

/**
 * Return a random alphanumerical string of length len
 * There is a very small probability (less than 1/1,000,000) for the length to be less than len
 * (il the base64 conversion yields too many pluses and slashes) but
 * that's not an issue here
 * The probability of a collision is extremely small (need 3*10^12 documents to have one chance in a million of a collision)
 * See http://en.wikipedia.org/wiki/Birthday_problem
 */
function uid (len) {
  return crypto.randomBytes(Math.ceil(Math.max(8, len * 2)))
    .toString('base64')
    .replace(/[+\/]/g, '')
    .slice(0, len);
}

/**
 * This function will accept an object whose properties can be set a dot notated fields. It will transform it into
 * an normally structured object, replacing these dot notation with their relevant paths and values and return
 * the result
 * @param {Object} originalObj This will be the source Object with dot notation object keys
 */
function convertDotToObj (originalObj) {
  var keys = Object.keys(originalObj)
    , result = {}
    ;
  var keyParts, keyPart, j, keyPartsLen, root, i, keysLen;
  for (i = 0, keysLen = keys.length; i < keysLen; i++) {
    keyParts = keys[i].split('.');   // Dot notation shows deeper level for object, so we will traverse that
    root = result;
    for (j = 0, keyPartsLen = keyParts.length; j < keyPartsLen; j++) {
      keyPart = keyParts[j];   // Get current part of
      if (j < (keyPartsLen - 1)) {   // We will go deeper
        root[keyPart] = root[keyPart] || {};   // Initialize if not already there
        root = root[keyPart];   // Move root deeper for reference
      }
    }   // End of iteration of keyParts
    root[keyPart] = originalObj[keys[i]];   // Assign value
  }
  return result;
}

/**
 * Return only selected document properties.
 * Will also traverse through projection object with dot notation for embedded documents and arrays
 * Note That the projection document **SHOULD not be in dot notated form**... It should be passed from **ConvertDotToObj**
 * first to be constructed as a document with not dot notated properties
 *
 * @param {Object} doc - The source doc from where data will be retrieved
 * @param {Object} projection - The projection doc based on which selection of properties will take place
 * @param {Object} [query] - The query that came with the operation, in case positional operator '$' was used in project
 */
function pick (doc, projection, query) {
  var copy = {}   // Object that will be returned to caller;
    , projectKeys = Object.keys(projection)
    ;
  var key, keyValue, docValue, tmpDoc, i, keysLen, j, docLen;
  for (i = 0, keysLen = projectKeys.length; i < keysLen; i++) {   // Browse projection properties...
    key = projectKeys[i];   // Get hold of current projection key
    // First we need to see if this property exists in source doc. If not, no further processing is needed
    if (typeof doc[key] === 'undefined') {
      continue;   // Move on to next property
    }
    // Property exists, we should check the property type
    keyValue = projection[key];
    docValue = doc[key];
    if (keyValue === 1 || keyValue === true) {   // Direct inclusion of total source doc property
      copy[key] = docValue;
    }
    // We have deeper level
    else if (!!keyValue.$ && !Array.isArray(docValue)) {   // Positional operator used on a non array element... skip
      continue;
    }
    else if (!!keyValue.$ && Array.isArray(docValue)) {   // Apply positional operator in array
      copy[key] = [];   // Initialize doc array
      var arrayEl;
      for (var j = 0, jLen = docValue.length; j < jLen; j++) {
        arrayEl = docValue[j];
        tmpDoc = {};
        for (var prop in doc) {
          if (key !== prop) {
            tmpDoc[prop] = doc[prop];
          }
        }
        tmpDoc[key] = [arrayEl];   // Set current array element as array property
        if (model.match(tmpDoc,query)) {
          copy[key].push(arrayEl);
          break;
        }
      }
    }
    else if (Array.isArray(docValue)) {   // We have array, apply projection on each element
      copy[key] = [];  // Initialize doc array
      for (j = 0, docLen = docValue.length; j < docLen; j++) {
        tmpDoc = pick(docValue[j], keyValue, query);
        if (Object.keys(tmpDoc).length > 0) {
          copy[key].push(tmpDoc);
        }
      }
    }
    else {   // Simple embedded document
      tmpDoc = pick(docValue, keyValue, query);
      if (Object.keys(tmpDoc).length > 0) {
        copy[key] = tmpDoc;
      }
    }
  }

  return copy;
}

/**
 * Return document properties except for the excluded ones.
 * Will also traverse through projection object with dot notation for embedded documents and arrays
 *
 * @param {Object} doc - The source doc from where data will be retrieved
 * @param {Object} projection - The projection doc based on which exclusion of properties will take place
 */
function omit (doc, projection) {
  var copy = {}   // Object that will be returned to caller;
    , docKeys = Object.keys(doc)
    ;
  var key, projectValue, docValue, tmpDoc, j, i, keysLen, docLen;
  for (i = 0, keysLen = docKeys.length; i < keysLen; i++) {   // Browse doc properties
    key = docKeys[i];   // Get hold of current doc key
    // First we need to see if this property exists in projection. If not we should directly include it
    docValue = doc[key];   // Get hold of document value for current property key
    if (!projection.hasOwnProperty(key)) {
      copy[key] = docValue;
      continue;   // Continue to next property
    }
    // It exists in projection, we should check
    projectValue = projection[key];
    if (!!projectValue && Array.isArray(docValue)) {   // We have document array, apply projection on each element
      copy[key] = [];   // Initialize copy array
      for (j = 0, docLen = docValue.length; j < docLen; j++) {
        tmpDoc = omit(docValue[j], projectValue);
        if (Object.keys(tmpDoc).length > 0) {
          copy[key].push(tmpDoc);
        }
      }
    }
    else if (!!projectValue) {   // Simple embedded document
      tmpDoc = omit(docValue, projectValue);
      if (Object.keys(tmpDoc).length > 0) {
        copy[key] = tmpDoc;
      }
    }
  }

  return copy;
}

/**
 * This function will accept a string path (dot notation form) and return this path from the source doc, or undefined
 * if it does not exist
 *
 * @param {Object} doc The source document from which the path is extracted
 * @param {String} path The dot notated field path
 */
function getFieldPath (doc, path) {
  var pathParts = path.split('.')   // Separate the dotted parts of path to find the level of doc to get
    , current = doc   // Set starting point
    , pathPart;

  for (var i = 0, partsLen = pathParts.length; i < partsLen; i++) {
    pathPart = pathParts[i];
    current = current[pathPart];
    if (typeof current === 'undefined') {   // Path does not exist in doc... exit with undefined
      return undefined;
    }
  }//   End of parts loop
  return current;
}

// Interface
module.exports.uid = uid;
module.exports.convertDotToObj = convertDotToObj;
module.exports.pick = pick;
module.exports.omit = omit;
module.exports.getFieldPath = getFieldPath;
