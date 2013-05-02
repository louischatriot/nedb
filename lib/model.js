/**
 * Handle models (i.e. docs)
 * Serialization/deserialization
 * Copying
 */

var dateToJSON = function () { return { $$date: this.toString() }; }
  , originalDateToJSON = Date.prototype.toJSON


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

