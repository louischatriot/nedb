# NeDB (Node embedded database)

<img src="http://i.imgur.com/GdeQBmc.png" style="width: 25%; height: 25%; float: left;">

**Embedded persistent database for Node.js, with no dependency** (except npm
modules of course). You can **think of it as a SQLite for Node.js projects**, which
can be used in your projects with a simple `require` statement. The API is a subset of MongoDB's.


## Installation, tests
Module name on npm is `nedb`.
```javascript
npm install nedb --save   // Put latest version in your package.json

make test   // You'll need the dev dependencies to test it
```

## API
It's a subset of MongoDB's API (the most used operations). The current API will not change, but I will add operations as they are needed.

### Creating/loading a database
```javascript
var Datastore = require('nedb')
  , db = new Datastore('path/to/datafile');
  
db.loadDatabase(function (err) {    // Callback is optional
  // err is the error, if any
});

// Of course you can create multiple datastores if you need several
// collections. For example:
db = {};
db.users = new Datastore('path/to/users.db');
db.robots = new Datastore('path/to/robots.db');

// You need to load each database (here we do it asynchronously)
db.users.loadDatabase();
db.robots.loadDatabase();
```

### Inserting documents
The native types are String, Number, Boolean and Date. You can also use
arrays and subdocuments (objects). If you specify an `_id` field, it
will be used as the document's _id, otherwise nedb will generate one.
Note that the generated `_id` is a simple string, not an ObjectId. Field names cannot begin by '$' or contain a '.'.

```javascript
var document = { hello: 'world'
               , n: 5
               , today: new Date()
               , nedbIsAwesome: true
               , fruits: [ 'apple', 'orange', 'pear' ]
               , infos: { name: 'nedb' }
               };

db.insert(document, function (err, newDoc) {   // Callback is optional
  // newDoc is the newly inserted document, including its _id
});
```

### Finding documents
You can use `find` to look for multiple documents matching you query, or `findOne` to look for one specific document. For now, you can only select documents based on field equality, but I'm planning to add Mongo's <a href="http://docs.mongodb.org/manual/reference/operator/query-comparison/" target="_blank">$in, $lt, $gt, $lte and $gte comparison operators</a>.

```javascript
// Let's say our datastore contains the following collection
// { _id: 'id1', planet: 'Mars', system: 'solar', inhabited: false }
// { _id: 'id2', planet: 'Earth', system: 'solar', inhabited: true }
// { _id: 'id3', planet: 'Jupiter', system: 'solar', inhabited: false }
// { _id: 'id4', planet: 'Omicron Persia 8', system: 'futurama', inhabited: true }

// Finding all planets in the solar system
db.find({ system: 'solar' }, function (err, docs) {
  // docs is an array containing documents _id1, _id2, _id3
  // If no document is found, docs is equal to []
});

// Finding all inhabited planets in the solar system
db.find({ system: 'solar', inhabited: true }, function (err, docs) {
  // docs is an array containing document _id2 only
});

db.find({}, function (err, docs) {
  // docs contains all documents in the collection  
});

db.findOne({ _id: 'id1' }, function (err, doc) {
  // doc is the document _id1
  // If no document is found, doc is null
});
```

### Updating documents
`db.update(query, update, options, callback)` will update all documents matching `query` according to the `update` rules:  
* `query` is the same kind of finding query you use with `find` and `findOne`
* `update` specifies how the documents should be modified. It is either a new document or a set of modifiers (you cannot use both together, it doesn't make sense!)
  * A new document will replace the matched docs
  * The available modifiers are `$set` to change a field's value and `$inc` to increment a field's value. The modifiers create the fields they need to modify if they don't exist, and you can apply them to subdocs. See examples below for the syntax
* `options` is an object with two possible parameters
  * `multi` (defaults to `false`) which allows the modification of several documents if set to true
  * `upsert` (defaults to `false`) if you want to insert a new document corresponding to the `update` rules if your `query` doesn't match anything
* `callback` (optional) signature: err, numReplaced, upsert
  * `numReplaced` is the number of documents replaced
  * `upsert` is set to true if the upsert mode was chosen and a document was inserted

```javascript
// Let's use the same example collection as in the "finding document" part
// { _id: 'id1', planet: 'Mars', system: 'solar', inhabited: false }
// { _id: 'id2', planet: 'Earth', system: 'solar', inhabited: true }
// { _id: 'id3', planet: 'Jupiter', system: 'solar', inhabited: false }
// { _id: 'id4', planet: 'Omicron Persia 8', system: 'futurama', inhabited: true }

// Replace a document by another
db.update({ planet: 'Jupiter' }, { planet: 'Pluton'}, {}, function (err, numReplaced) {
  // numReplaced = 1
  // The doc #3 has been replaced by { _id: 'id3', planet: 'Pluton' }
  // Note that the _id is kept unchanged, and the document has been replaced
  // (the 'system' and inhabited fields are not here anymore)
});

// Set an existing field's value
db.update({ system: 'solar' }, { $set: { system: 'solar system' } }, { multi: true }, function (err, numReplaced) {
  // numReplaced = 3
  // Field 'system' on Mars, Earth, Jupiter now has value 'solar system'
});

// Setting the value of a non-existing field in a subdocument by using the dot-notation
db.update({ planet: 'Mars' }, { $set: { "data.satellites": 2, "data.red": true } }, {}, function () {
  // Mars document now is { _id: 'id1', system: 'solar', inhabited: false
  //                      , data: { satellites: 2, red: true }
  //                      }
  // Not that to set fields in subdocuments, you HAVE to use dot-notation
  // Using object-notation will just replace the top-level field
  db.update({ planet: 'Mars' }, { $set: { date: { satellites: 3 } } }, {}, function () {
    // Mars document now is { _id: 'id1', system: 'solar', inhabited: false
    //                      , data: { satellites: 3 }
    //                      }
    // You lost the "data.red" field which is probably not the intended behavior
  });
});

// Upserting a document
db.update({ planet: 'Pluton' }, { planet: 'Pluton', inhabited: false }, { upsert: true }, function (err, numReplaced, upsert) {
  // numReplaced = 1, upsert = true
  // A new document { _id: 'id5', planet: 'Pluton', inhabited: false } has been added to the collection
});

// If you upsert with a modifier, the upserted doc is the query modified by the modifier
// This is simpler than it sounds :)
db.update({ planet: 'Pluton' }, { $inc: { distance: 38 } }, { upsert: true }, function () {
  // A new document { _id: 'id5', planet: 'Pluton', distance: 38 } has been added to the collection  
});
```

### Removing documents
`db.remove(query, options, callback)` will remove all documents matching `query` according to `options`  
* `query` is the same as the ones used for finding and updating
* `options` only one option for now: `multi` which allows the removal of multiple documents if set to true. Default is false
* `callback` is optional, signature: err, numRemoved

```javascript
// Let's use the same example collection as in the "finding document" part
// { _id: 'id1', planet: 'Mars', system: 'solar', inhabited: false }
// { _id: 'id2', planet: 'Earth', system: 'solar', inhabited: true }
// { _id: 'id3', planet: 'Jupiter', system: 'solar', inhabited: false }
// { _id: 'id4', planet: 'Omicron Persia 8', system: 'futurama', inhabited: true }

// Remove one document from the collection
// options set to {} since the default for multi is false
db.remove({ _id: 'id2' }, {}, function (err, numRemoved) {
  // numRemoved = 1
});

// Remove multiple documents
db.remove({ system: 'solar' }, { multi: true }, function (err, numRemoved) {
  // numRemoved = 3
  // All planets from the solar system were removed
});
```


## Performance
### Speed
**NeDB is not intended to be a replacement of large-scale databases such as MongoDB!** Its goal is to provide you with a clean and easy way to query data and persist it to disk, for applications that do not need lots of concurrent connections, for example a <a href="https://github.com/louischatriot/braindead-ci" target="_blank">continuous integration and deployment server</a>.

As such, it was not designed for speed. That said, it is still pretty fast on the expected datasets (10,000
documents max). On my machine (3 years old, no SSD), with a collection
containing 10,000 documents:  
* An insert takes 0.1ms
* A read takes 5.7ms
* An update takes 58ms
* A deletion takes 57ms  

You can run the simple benchmarks I use by executing the scripts in the `benchmarks` folder. They all take an optional parameter which is the size of the dataset to use (default is 10,000). Most of the time spent during update and remove operations is IO, and I will work on optimizing this in the future.

### Memory footprint
A copy of the whole database is kept in memory. This is not much on the
expected kind of datasets (20MB for 10,000 2KB documents). If requested, I'll introduce an
option to not use this cache to decrease memory footprint (at the cost
of a lower speed).


## Use in other services
* <a href="https://github.com/louischatriot/connect-nedb-session"
  target="_blank">connect-nedb-session</a> is a session store for
Connect and Express, backed by nedb
* I'm planning on making an export tool to get all your data in an nedb
  database in a Mongo database


## License 

(The MIT License)

Copyright (c) 2013 Louis Chatriot &lt;louis.chatriot@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
