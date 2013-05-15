/**
 * Handle models (i.e. docs)
 * Serialization/deserialization
 * Copying
 */

var dateToJSON = function () { return { $$date: this.getTime() }; }
  , originalDateToJSON = Date.prototype.toJSON


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
    throw 'Keys cannot begin with the $ character';
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
      checkKey(k, obj[k]);
      res[k] = deepCopy(obj[k]);
    });
    return res;
  }

  return undefined;   // For now everything else is undefined. We should probably throw an error instead
}


/**
 * Modify a DB object according to an update query
 * For now the updateQuery only replaces the object
 */
function modify (obj, updateQuery) {
  updateQuery = deepCopy(updateQuery);
  updateQuery._id = obj._id;
  return updateQuery;
};


// Interface
module.exports.serialize = serialize;
module.exports.deserialize = deserialize;
module.exports.deepCopy = deepCopy;
module.exports.modify = modify;
