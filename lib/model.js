/**
 * Handle models (i.e. docs)
 * Serialization/deserialization
 * Copying
 */

function serialize (obj) {
  return JSON.stringify(obj);
}

function deserialize (rawData) {
  return JSON.parse(rawData);
}


// Interface
module.exports.serialize = serialize;
module.exports.deserialize = deserialize;

