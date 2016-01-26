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

function convertDotToObj(originalObj){
  var keys = Object.keys(originalObj);
  var i = keys.length;
  var keyParts,keyPart, j, keyPartsLen, root;
  var result = {};
  while(i--){
    keyParts = keys[i].split('.');//dot notation shows deeper level for object, so we will traverse that
    keyPartsLen = keyParts.length;
    root = result;
    j = -1;
    while (++j < keyPartsLen){
      keyPart = keyParts[j];//get current part of
      if (j < (keyPartsLen - 1)){//we will go deeper
        root[keyPart] = root[keyPart] || {};//initialize if not already there
        root = root[keyPart];//move root deeper for reference
      }
    }//end of iteration of keyParts
    root[keyPart] = originalObj[keys[i]];//assign value
  }
  return result;
}

/**
 * Return only selected document properties.
 * Will also traverse through projection object with dot notation for embedded documents and arrays
 *
 * @param {Object} doc - The source doc from where data will be retrieved
 * @param {Object} projection - The projection doc based on which selection of properties will take place
 * @param {Object} query - The query that came with the operation, in case positional operator '$' was used in project
 */
function pick (doc,projection,query){
  var copy = {};//object that will be returned to caller;
  var projectKeys = Object.keys(projection);
  var i = projectKeys.length;
  var key, keyValue, docValue, tmpDoc, j;
  while (i--){//browse projection properties...
    key = projectKeys[i];//get hold of current projection key
    //first we need to see if this property exists in source doc. If not, no further processing is needed
    if (!doc[key]) continue;//move on to next property
    //property exists, we should check the property type
    keyValue = projection[key];
    docValue = doc[key];
    if (keyValue === 1 || keyValue === true){//direct inclusion of total source doc property
      copy[key] = docValue;
    }
    //we have deeper level
    else if (!!keyValue.$ && !Array.isArray(docValue)){//positional operator used on a non array element... skip
      continue;
    }
    else if (!!keyValue.$ && Array.isArray(docValue)){//apply positional operator in array
      copy[key] = [];//initialize doc array
      var arrayEl;
      for (var j = 0, jLen = docValue.length;j<jLen;j++){
        arrayEl = docValue[j];
        tmpDoc = {};
        for (var prop in doc){
          if (key !== prop) tmpDoc[prop] = doc[prop];
        }
        tmpDoc[key] = [arrayEl];//set current array element as array property
        if (model.match(tmpDoc,query)){
          copy[key].push(arrayEl);
          break;
        }
      }
    }
    else if (Array.isArray(docValue)){//we have array, apply projection on each element
      copy[key] = [];//initialize doc array
      j = docValue.length;
      while(j--){
        tmpDoc = pick(docValue[j], keyValue, query);
        if (Object.keys(tmpDoc).length > 0) copy[key].unshift(tmpDoc);//use unshift because we are reverse browsing
      }
    }
    else{//simple embedded document
      tmpDoc = pick(docValue,keyValue,query);
      if (Object.keys(tmpDoc).length > 0) copy[key] = tmpDoc;
    }
  }

  return copy;
}

/**
 * Return document properties except for the exluded ones.
 * Will also traverse through projection object with dot notation for embedded documents and arrays
 *
 * @param {Object} doc - The source doc from where data will be retrieved
 * @param {Object} projection - The projection doc based on which exclusion of properties will take place
 */
function omit (doc,projection){
  var copy = {};//object that will be returned to caller;
  var docKeys = Object.keys(doc);
  var i = docKeys.length;
  var key, projectValue,docValue, tmpDoc, j;
  while(i--){//browse doc properties
    key = docKeys[i];//get hold of current doc key
    //first we need to see if this property exists in projection. If not we should directly include it
    docValue = doc[key];//get hold of document value for current property key
    if (!projection.hasOwnProperty(key)){
      copy[key] = docValue;
      continue;//continue to next property
    }
    //it exists in projection, we should check
    projectValue = projection[key];
    if (!!projectValue && Array.isArray(docValue)){//we have document array, apply projection on each element
      copy[key] = [];//initialize copy array
      j = docValue.length;
      while (j--){
        tmpDoc = omit(docValue[j],projectValue);
        if (Object.keys(tmpDoc).length > 0) copy[key].unshift(tmpDoc);//use unshift because we are reverse browsing
      }
    }
    else if(!!projectValue){//simple embedded document
      tmpDoc = omit(docValue,projectValue);
      if (Object.keys(tmpDoc).length > 0) copy[key] = tmpDoc;
    }
  }

  return copy;
}

// Interface
module.exports.uid = uid;
module.exports.convertDotToObj = convertDotToObj;
module.exports.pick = pick;
module.exports.omit = omit;
