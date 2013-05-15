/**
 * Handle models (i.e. docs)
 * Serialization/deserialization
 * Copying
 */

var dateToJSON = function () { return { $$date: this.getTime() }; }
  , originalDateToJSON = Date.prototype.toJSON
  , util = require('util')
  , _ = require('underscore')
  , modifierFunctions = {}
  ;


/**
 * Check a key, throw an error if the key is non valid
 * @param {String} k key
 * @param {Model} v value, needed to treat the Date edge case
 * Non-treatable edge case here: if part of the object if of the form { $$date: number }
 * Its serialized-then-deserialized version it will transformed into a Date object
 * But you really need to want it to trigger such behaviour, even when warned not to use '$' at the beginning of the field names...
 */
function checkKey (k, v) {
  if (k[0] === '$' && !(k === '$$date' && typeof v === 'number')) {
    throw 'Field names cannot begin with the $ character';
  }

  if (k.indexOf('.') !== -1) {
    throw 'Field names cannot contain a .';
  }
}


/**
 * Check a DB object and throw an error if it's not valid
 * Works by applying the above checkKey function to all fields recursively
 */
function checkObject (obj) {
  if (util.isArray(obj)) {
    obj.forEach(function (o) {
      checkObject(o);
    });
  }

  if (typeof obj === 'object') {
    Object.keys(obj).forEach(function (k) {
      checkKey(k, obj[k]);
      checkObject(obj[k]);
    });
  }
}


/**
 * Serialize an object to be persisted to a one-line string
 * Accepted primitive types: Number, String, Boolean, Date, null
 * Accepted secondary types: Objects, Arrays
 */
function serialize (obj) {
  var res;

  // Keep track of the fact that this is a Date object
  Date.prototype.toJSON = dateToJSON;

  res = JSON.stringify(obj, function (k, v) {
    checkKey(k, v);

    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) { return v; }
    //if (v && v.constructor && v.constructor.name === 'Date') { console.log("==============="); return { $$date: v.toString() }; }

    return v;
  });

  // Return Date to its original state
  Date.prototype.toJSON = originalDateToJSON;

  return res;
}


/**
 * From a one-line representation of an object generate by the serialize function
 * Return the object itself
 */
function deserialize (rawData) {
  return JSON.parse(rawData, function (k, v) {
    if (k === '$$date') { return new Date(v); }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) { return v; }
    if (v && v.$$date) { return v.$$date; }

    return v;
  });
}


/**
 * Deep copy a DB object
 */
function deepCopy (obj) {
  var res;

  if ( typeof obj === 'boolean' ||
       typeof obj === 'number' ||
       typeof obj === 'string' ||
       obj === null ||
       (obj && obj.constructor && obj.constructor.name === 'Date') ) {
    return obj;
  }

  if (obj instanceof Array) {
    res = [];
    obj.forEach(function (o) { res.push(o); });
    return res;
  }

  if (typeof obj === 'object') {
    res = {};
    Object.keys(obj).forEach(function (k) {
      res[k] = deepCopy(obj[k]);
    });
    return res;
  }

  return undefined;   // For now everything else is undefined. We should probably throw an error instead
}


/**
 * Set field to value in a model
 * Create it if it doesn't exist
 * @param {Object} obj The model to set a field for
 * @param {Object} mod mod is of the form { k: v }. k is the field, v its value
 *                     k can contain dots, in that case that means we will set a subfield
 */
modifierFunctions.$set = function (obj, mod) {
  var field, value;


};

modifierFunctions.$inc = function () {};


/**
 * Modify a DB object according to an update query
 * For now the updateQuery only replaces the object
 */
function modify (obj, updateQuery) {
  var keys = Object.keys(updateQuery)
    , firstChars = _.map(keys, function (item) { return item[0]; })
    , dollarFirstChars = _.filter(firstChars, function (c) { return c === '$'; })
    , newDoc, modifiers
    ;

  if (keys.indexOf('_id') !== -1) { throw "You cannot change a document's _id"; }

  if (dollarFirstChars.length !== 0 && dollarFirstChars.length !== firstChars.length) {
    throw "You cannot mix modifiers and normal fields";
  }

  if (dollarFirstChars.length === 0) {
    // Simply replace the object with the update query contents
    newDoc = deepCopy(updateQuery);
    newDoc._id = obj._id;
  } else {
    // Apply modifiers
    modifiers = _.uniq(keys);
    modifiers.forEach(function (m) {
      var keys;

      if (!modifierFunctions[m]) { throw "Unknown modifier " + m; }

      try {
        keys = Object.keys(updateQuery[m]);
      } catch (e) {
        throw "Modifier " + m + "'s argument must be an object";
      }

      keys.forEach(function (k) {
        modifierFunctions[m](obj, k, updateQuery[m][k]);
      });
    });
  }

  // Check result is valid and return it
  checkObject(newDoc);
  return newDoc;
};


// Interface
module.exports.serialize = serialize;
module.exports.deserialize = deserialize;
module.exports.deepCopy = deepCopy;
module.exports.checkObject = checkObject;
module.exports.modify = modify;
