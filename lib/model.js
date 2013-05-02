/**
 * Handle models (i.e. docs)
 * Serialization/deserialization
 * Copying
 */

var dateToJSON = function () { return { $$date: this.getTime() }; }
  , originalDateToJSON = Date.prototype.toJSON

/**
 * Serialize an object to be persisted to a one-line string
 * Accepted primitive types: Number, String, Boolean, Date, null
 * Accepted secondary types: Objects, Arrays
 * TODO: throw an error if variable name begins with '$'
 */
function serialize (obj) {
  var res;

  // Keep track of the fact this is a Date object
  Date.prototype.toJSON = dateToJSON;

  res = JSON.stringify(obj, function (k, v) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) { return v; }
    if (v && v.constructor && v.constructor.name === 'Date') { return { $$date: v.toString() }; }

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



// Interface
module.exports.serialize = serialize;
module.exports.deserialize = deserialize;
