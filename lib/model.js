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
  , matcherFunctions = {}
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

    if (typeof v === undefined) { return null; }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) { return v; }

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


// ==============================================================
// Updating documents
// ==============================================================

/**
 * Set field to value in a model
 * Create it if it doesn't exist
 * @param {Object} obj The model to set a field for
 * @param {String} field Can contain dots, in that case that means we will set a subfield recursively
 * @param {Model} value
 */
modifierFunctions.$set = function (obj, field, value) {
  var fieldParts = typeof field === 'string' ? field.split('.') : field;

  if (fieldParts.length === 1) {
    obj[fieldParts[0]] = value;
  } else {
    obj[fieldParts[0]] = obj[fieldParts[0]] || {};
    modifierFunctions.$set(obj[fieldParts[0]], fieldParts.slice(1), value);
  }
};


/**
 * Increase (or decrease) a 'number' field
 * Create and initialize it if needed
 * @param {Object} obj The model to set a field for
 * @param {String} field Can contain dots, in that case that means we will set a subfield recursively
 * @param {Model} value
 */
modifierFunctions.$inc = function (obj, field, value) {
  var fieldParts = typeof field === 'string' ? field.split('.') : field;

  if (typeof value !== 'number') { throw value + " must be a number"; }

  if (fieldParts.length === 1) {
    if (typeof obj[fieldParts[0]] !== 'number') {
      if (!_.has(obj, fieldParts[0])) {
        obj[fieldParts[0]] = value;
      } else {
        throw "Don't use the $inc modifier on non-number fields";
      }
    } else {
      obj[fieldParts[0]] += value;
    }
  } else {
    obj[fieldParts[0]] = obj[fieldParts[0]] || {};
    modifierFunctions.$inc(obj[fieldParts[0]], fieldParts.slice(1), value);
  }
};


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

  if (keys.indexOf('_id') !== -1 && updateQuery._id !== obj._id) { throw "You cannot change a document's _id"; }

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
    newDoc = deepCopy(obj);
    modifiers.forEach(function (m) {
      var keys;

      if (!modifierFunctions[m]) { throw "Unknown modifier " + m; }

      try {
        keys = Object.keys(updateQuery[m]);
      } catch (e) {
        throw "Modifier " + m + "'s argument must be an object";
      }

      keys.forEach(function (k) {
        modifierFunctions[m](newDoc, k, updateQuery[m][k]);
      });
    });
  }

  // Check result is valid and return it
  checkObject(newDoc);
  return newDoc;
};


// ==============================================================
// Finding documents
// ==============================================================

/**
 * Check whether things are equal
 * Returns true if they are, false otherwise
 */
function areThingsEqual (a, b) {
  var aKeys , bKeys , i;

  // Strings, booleans, numbers, null
  if (a === null || typeof a === 'string' || typeof a === 'boolean' || typeof a === 'number' ||
      b === null || typeof b === 'string' || typeof b === 'boolean' || typeof b === 'number') { return a === b; }

  // Dates
  if (util.isDate(a) || util.isDate(b)) { return util.isDate(a) && util.isDate(b) && a.getTime() === b.getTime(); }

  // Arrays (no match since arrays are used as a $in)
  // undefined (no match since they mean field doesn't exist and can't be serialized)
  if (util.isArray(a) || util.isArray(b) || a === undefined || b === undefined) { return false; }

  // a and b should be objects
  try {
    aKeys = Object.keys(a);
    bKeys = Object.keys(b);
  } catch (e) {
    return false;
  }

  // Objects
  if (aKeys.length !== bKeys.length) { return false; }
  for (i = 0; i < aKeys.length; i += 1) {
    if (bKeys.indexOf(aKeys[i]) === -1) { return false; }
    if (!areThingsEqual(a[aKeys[i]], b[aKeys[i]])) { return false; }
  }
  return true;
}


/**
 * Get a value from object with dot notation
 * @param {Object} obj
 * @param {String} field
 */
function getDotValue (obj, field) {
  var fieldParts = typeof field === 'string' ? field.split('.') : field;

  if (!obj) { return undefined; }   // field cannot be empty so that means we should return undefined so that nothing can match

  if (fieldParts.length === 1) {
    return obj[fieldParts[0]];
  } else {
    return matcherFunctions.$eq(obj[fieldParts[0]], fieldParts.slice(1));
  }
}


/**
 * Test for field equality
 * @param {Object} obj The model to check
 * @param {String} field Can contain dots, in that case that means we will set a subfield recursively
 * @param {Model} value
 */
matcherFunctions.$eq = function (obj, field, value) {
  var fieldParts = typeof field === 'string' ? field.split('.') : field;

  if (!obj) { return false; }   // field cannot be empty here so that means there is no match

  if (fieldParts.length === 1) {
    return areThingsEqual(obj[fieldParts[0]], value);
  } else {
    return matcherFunctions.$eq(obj[fieldParts[0]], fieldParts.slice(1), value);
  }
};



/**
 * Tell if a given document matches a query
 */
function match (obj, query) {
  var match = true
    , i, k;

  Object.keys(query).forEach(function (k) {
    if (!matcherFunctions.$eq(obj, k, query[k])) { match = false; }
  });

  return match;
};


// Interface
module.exports.serialize = serialize;
module.exports.deserialize = deserialize;
module.exports.deepCopy = deepCopy;
module.exports.checkObject = checkObject;
module.exports.modify = modify;
module.exports.match = match;
module.exports.areThingsEqual = areThingsEqual;
