# NeDB (Node embedded database)

<img src="http://i.imgur.com/GdeQBmc.png" style="width: 25%; height: 25%; float: left;">

**Embedded persistent database for Node.js, written in Javascript, with no dependency** (except npm
modules of course). You can **think of it as a SQLite for Node.js projects**, which
can be used with a simple `require` statement. The API is a subset of MongoDB's. You can use it as a persistent or an in-memory only datastore.

NeDB is not intended to be a replacement of large-scale databases such as MongoDB! Its goal is to provide you with a clean and easy way to query data and persist it to disk, for web applications that do not need lots of concurrent connections, for example a <a href="https://github.com/louischatriot/braindead-ci" target="_blank">continuous integration and deployment server</a> and desktop applications built with <a href="https://github.com/rogerwang/node-webkit" target="_blank">Node Webkit</a>.

I recently benchmarked NeDB against the popular client-side database <a href="http://www.taffydb.com/" target="_blank">TaffyDB</a> and <a href="https://github.com/louischatriot/taffydb-benchmark" target="_blank">NeDB is much, much faster</a>, so I will port it to browsers. Please comment on <a href="https://github.com/louischatriot/nedb/issues/23">this issue</a> if you have any ideas/requirements.

Check the <a href="https://github.com/louischatriot/nedb/wiki/Change-log" target="_blank">change log in the wiki</a> if you think nedb doesn't behaves as the documentation describes! Most of the issues I get are due to non-latest version NeDBs.


## Installation, tests
Module name on npm is `nedb`.
```javascript
npm install nedb --save   // Put latest version in your package.json

npm test   // You'll need the dev dependencies to test it
```

## API
It's a subset of MongoDB's API (the most used operations). The current API will not change, but I will add operations as they are needed. Summary of the API:  

* <a href="#creatingloading-a-database">Creating/loading a database</a>
* <a href="#inserting-documents">Inserting documents</a>
* <a href="#finding-documents">Finding documents</a>
* <a href="#updating-documents">Updating documents</a>
* <a href="#removing-documents">Removing documents</a>
* <a href="#indexing">Indexing</a>

### Creating/loading a database
You can use NeDB as an in-memory only datastore or as a persistent datastore. One datastore is the equivalent of a MongoDB collection. The constructor is used as follows `new Datastore(options)` where `options` is an object with the following fields:  

* `filename` (optional): path to the file where the data is persisted. If left blank, the datastore is automatically considered in-memory only.
* `inMemoryOnly` (optional, defaults to false): as the name implies.
* `autoload` (optional, defaults to false): if used, the database will
  automatically be loaded from the datafile upon creation (you don't
need to call `loadDatabase`). Any command
issued before load is finished is buffered and will be executed when
load is done.
* `nodeWebkitAppName` (optional): if you are using NeDB from whithin a Node Webkit app, specify its name (the same one you use in the `package.json`) in this field and the `filename` will be relative to the directory Node Webkit uses to store the rest of the application's data (local storage etc.). It works on Linux, OS X and Windows.

If you use a persistent datastore without the `autoload` option, you need to call `loadDatabase` manually.
This function fetches the data from datafile and prepares the database. **Don't forget it!** If you use a
persistent datastore, no command (insert, find, update, remove) will be executed before `loadDatabase`
is called, so make sure to call it yourself or use the `autoload`
option.

```javascript
// Type 1: In-memory only datastore (no need to load the database)
var Datastore = require('nedb')
  , db = new Datastore();


// Type 2: Persistent datastore with manual loading
var Datastore = require('nedb')
  , db = new Datastore({ filename: 'path/to/datafile' });
db.loadDatabase(function (err) {    // Callback is optional
  // Now commands will be executed
});


// Type 3: Persistent datastore with automatic loading
var Datastore = require('nedb')
  , db = new Datastore({ filename: 'path/to/datafile', autoload: true });
// You can issue commands right away


// Type 4: Persistent datastore for a Node Webkit app called 'nwtest'
// For example on Linux, the datafile will be ~/.config/nwtest/nedb-data/something.db
var Datastore = require('nedb')
  , db = new Datastore({ filename: 'something.db', nodeWebkitAppName: 'nwtest' });


// Of course you can create multiple datastores if you need several
// collections. In this case it's usually a good idea to use autoload for all collections.
db = {};
db.users = new Datastore('path/to/users.db');
db.robots = new Datastore('path/to/robots.db');

// You need to load each database (here we do it asynchronously)
db.users.loadDatabase();
db.robots.loadDatabase();
```

### Inserting documents
The native types are `String`, `Number`, `Boolean`, `Date` and `null`. You can also use
arrays and subdocuments (objects). If a field is `undefined`, it will not be saved (this is different from 
MongoDB which transforms `undefined` in `null`, something I find counter-intuitive).  

An `_id` field will be automatically generated by NeDB. It's a 16-characters alphanumerical string that cannot be modified once it has been generated. Unlike with MongoDB, you cannot specify it (that shouldn't be a problem anyway).

Field names cannot begin by '$' or contain a '.'.

```javascript
var document = { hello: 'world'
               , n: 5
               , today: new Date()
               , nedbIsAwesome: true
               , notthere: null
               , notToBeSaved: undefined  // Will not be saved
               , fruits: [ 'apple', 'orange', 'pear' ]
               , infos: { name: 'nedb' }
               };

db.insert(document, function (err, newDoc) {   // Callback is optional
  // newDoc is the newly inserted document, including its _id
  // newDoc has no key called notToBeSaved since its value was undefined
});
```

### Finding documents
Use `find` to look for multiple documents matching you query, or `findOne` to look for one specific document. You can select documents based on field equality or use comparison operators (`$lt`, `$lte`, `$gt`, `$gte`, `$in`, `$nin`, `$ne`). You can also use logical operators `$or`, `$and` and `$not`. See below for the syntax.

You can use regular expressions in two ways: in basic querying in place of a string, or with the `$regex` operator.

#### Basic querying
Basic querying means are looking for documents whose fields match the ones you specify. You can use regular expression to match strings.

```javascript
// Let's say our datastore contains the following collection
// { _id: 'id1', planet: 'Mars', system: 'solar', inhabited: false, satellites: ['Phobos', 'Deimos'] }
// { _id: 'id2', planet: 'Earth', system: 'solar', inhabited: true, humans: { genders: 2, eyes: true } }
// { _id: 'id3', planet: 'Jupiter', system: 'solar', inhabited: false }
// { _id: 'id4', planet: 'Omicron Persei 8', system: 'futurama', inhabited: true, humans: { genders: 7 } }

// Finding all planets in the solar system
db.find({ system: 'solar' }, function (err, docs) {
  // docs is an array containing documents Mars, Earth, Jupiter
  // If no document is found, docs is equal to []
});

// Finding all planets whose name contain the substring 'ar' using a regular expression
db.find({ planet: /ar/ }, function (err, docs) {
  // docs contains Mars and Earth
});

// Finding all inhabited planets in the solar system
db.find({ system: 'solar', inhabited: true }, function (err, docs) {
  // docs is an array containing document Earth only
});

// Use the dot-notation to match fields in subdocuments
db.find({ "humans.genders": 2 }, function (err, docs) {
  // docs contains Earth
});

// You can also deep-compare objects. Don't confuse this with dot-notation!
db.find({ humans: { genders: 2 } }, function (err, docs) {
  // docs is empty, because { genders: 2 } is not equal to { genders: 2, eyes: true }
});

// Find all documents in the collection
db.find({}, function (err, docs) {
});

// The same rules apply when you want to only find one document
db.findOne({ _id: 'id1' }, function (err, doc) {
  // doc is the document Mars
  // If no document is found, doc is null
});
```

#### Operators ($lt, $lte, $gt, $gte, $in, $nin, $ne, $exists, $regex)
The syntax is `{ field: { $op: value } }` where `$op` is any comparison operator:  

* `$lt`, `$lte`: less than, less than or equal
* `$gt`, `$gte`: greater than, greater than or equal
* `$in`: member of. `value` must be an array of values
* `$ne`, `$nin`: not equal, not a member of
* `$exists`: checks whether the document posses the property `field`. `value` should be true or false
* `$regex`: checks whether a string is matched by the regular expression. Contrary to MongoDB, the use of `$options` with `$regex` is not supported, because it doesn't give you more power than regex flags. Basic queries are more readable so only use the `$regex` operator when you need to use another operator with it (see example below)

```javascript
// $lt, $lte, $gt and $gte work on numbers and strings
db.find({ "humans.genders": { $gt: 5 } }, function (err, docs) {
  // docs contains Omicron Persei 8, whose humans have more than 5 genders (7).
});

// When used with strings, lexicographical order is used
db.find({ planet: { $gt: 'Mercury' }}, function (err, docs) {
  // docs contains Omicron Persei 8
})

// Using $in. $nin is used in the same way
db.find({ planet: { $in: ['Earth', 'Jupiter'] }}, function (err, docs) {
  // docs contains Earth and Jupiter
});

// Using $exists
db.find({ satellites: { $exists: true } }, function (err, docs) {
  // docs contains only Mars
});

// Using $regex with another operator
db.find({ planet: { $regex: /ar/, $nin: ['Jupiter', 'Earth'] } }, function (err, docs) {
  // docs only contains Mars because Earth was excluded from the match by $nin
});
```

#### Array fields
When a field in a document is an array, NeDB tries the query on every element and there is a match if at least one element matches.

```javascript
// If a document's field is an array, matching it means matching any element of the array
db.find({ satellites: 'Phobos' }, function (err, docs) {
  // docs contains Mars. Result would have been the same if query had been { satellites: 'Deimos' }
});

// This also works for queries that use comparison operators
db.find({ satellites: { $lt: 'Amos' } }, function (err, docs) {
  // docs is empty since Phobos and Deimos are after Amos in lexicographical order
});

// This also works with the $in and $nin operator
db.find({ satellites: { $in: ['Moon', 'Deimos'] } }, function (err, docs) {
  // docs contains Mars (the Earth document is not complete!)
});
```

#### Logical operators $or, $and, $not
You can combine queries using logical operators:  

* For `$or` and `$and`, the syntax is `{ $op: [query1, query2, ...] }`.
* For `$not`, the syntax is `{ $not: query }`

```javascript
db.find({ $or: [{ planet: 'Earth' }, { planet: 'Mars' }] }, function (err, docs) {
  // docs contains Earth and Mars
});

db.find({ $not: { planet: 'Earth' } }, function (err, docs) {
  // docs contains Mars, Jupiter, Omicron Persei 8
});

// You can mix normal queries, comparison queries and logical operators
db.find({ $or: [{ planet: 'Earth' }, { planet: 'Mars' }], inhabited: true }, function (err, docs) {
  // docs contains Earth
});

```

### Updating documents
`db.update(query, update, options, callback)` will update all documents matching `query` according to the `update` rules:  
* `query` is the same kind of finding query you use with `find` and `findOne`
* `update` specifies how the documents should be modified. It is either a new document or a set of modifiers (you cannot use both together, it doesn't make sense!)
  * A new document will replace the matched docs
  * The modifiers create the fields they need to modify if they don't exist, and you can apply them to subdocs. Available field modifiers are `$set` to change a field's value and `$inc` to increment a field's value. To work on arrays, you have `$push`, `$pop`, `$addToSet`, and the special `$each`. See examples below for the syntax.
* `options` is an object with two possible parameters
  * `multi` (defaults to `false`) which allows the modification of several documents if set to true
  * `upsert` (defaults to `false`) if you want to insert a new document corresponding to the `update` rules if your `query` doesn't match anything
* `callback` (optional) signature: err, numReplaced, upsert
  * `numReplaced` is the number of documents replaced
  * `upsert` is set to true if the upsert mode was chosen and a document was inserted

**Note**: you can't change a document's _id.

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
  db.update({ planet: 'Mars' }, { $set: { data: { satellites: 3 } } }, {}, function () {
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

// If we insert a new document { _id: 'id6', fruits: ['apple', 'orange', 'pear'] } in the collection,
// let's see how we can modify the array field atomically

// $push inserts new elements at the end of the array
db.update({ _id: 'id6' }, { $push: { fruits: 'banana' } }, {}, function () {
  // Now the fruits array is ['apple', 'orange', 'pear', 'banana']
});

// $pop removes an element from the end (if used with 1) or the front (if used with -1) of the array
db.update({ _id: 'id6' }, { $pop: { fruits: 1 } }, {}, function () {
  // Now the fruits array is ['apple', 'orange']
  // With { $pop: { fruits: -1 } }, it would have been ['orange', 'pear']
});

// $addToSet adds an element to an array only if it isn't already in it
// Equality is deep-checked (i.e. $addToSet will not insert an object in an array already containing the same object)
// Note that it doesn't check whether the array contained duplicates before or not
db.update({ _id: 'id6' }, { $addToSet: { fruits: 'apple' } }, {}, function () {
  // The fruits array didn't change
  // If we had used a fruit not in the array, e.g. 'banana', it would have been added to the array
});

// $each can be used to $push or $addToSet multiple values at once
// This example works the same way with $addToSet
db.update({ _id: 'id6' }, { $push: { fruits: ['banana', 'orange'] } }, {}, function () {
  // Now the fruits array is ['apple', 'orange', 'pear', 'banana', 'orange']
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

### Indexing
NeDB supports indexing. It gives a very nice speed boost and can be used to enforce a unique constraint on a field. You can index any field, including fields in nested documents using the dot notation. For now, indexes are only used to speed up basic queries and queries using `$in`, `$lt`, `$lte`, `$gt` and `$gte`.

To create an index, use `datastore.ensureIndex(options, cb)`, where callback is optional and get passed an error if any (usually a unique constraint that was violated). `ensureIndex` can be called when you want, even after some data was inserted, though it's best to call it at application startup. The options are:  

* **fieldName** (required): name of the field to index. Use the dot notation to index a field in a nested document.
* **unique** (optional, defaults to `false`): enforce field uniqueness. Note that a unique index will raise an error if you try to index two documents for which the field is not defined.
* **sparse** (optional, defaults to `false`): don't index documents for which the field is not defined. Use this option along with "unique" if you want to accept multiple documents for which it is not defined.

Note: the `_id` is automatically indexed with a unique constraint, no need to call `ensureIndex` on it.


```javascript
db.ensureIndex({ fieldName: 'somefield' }, function (err) {
  // If there was an error, err is not null
});

// Using a unique constraint with the index
db.ensureIndex({ fieldName: 'somefield', unique: true }, function (err) {
});

// Using a sparse unique index
db.ensureIndex({ fieldName: 'somefield', unique: true, sparse: true }, function (err) {
});


// Format of the error message when the unique constraint is not met
db.insert({ somefield: 'nedb' }, function (err) {
  // err is null
  db.insert({ somefiled: 'nedb' }, function (err) {
    // err is { errorType: 'uniqueViolated'
    //        , key: 'name'
    //        , message: 'Unique constraint violated for key name' }
  });
});
```

**Note:** the `ensureIndex` function creates the index synchronously, so it's best to use it at application startup. It's quite fast so it doesn't increase startup time much (35 ms for a collection containing 10,000 documents).



## Performance
### Speed
NeDB is not intended to be a replacement of large-scale databases such as MongoDB, and as such was not designed for speed. That said, it is still pretty fast on the expected datasets, especially if you use indexing. On my machine (3 years old, no SSD), with a collection containing 10,000 documents, with indexing:  
* Insert: **5,950 ops/s**
* Find: **25,440 ops/s**
* Update: **4,490 ops/s**
* Remove: **6,620 ops/s**  

You can run the simple benchmarks I use by executing the scripts in the `benchmarks` folder. Run them with the `--help` flag to see how they work.

### Memory footprint
A copy of the whole database is kept in memory. This is not much on the
expected kind of datasets (20MB for 10,000 2KB documents). If requested, I'll introduce an
option to not use this cache to decrease memory footprint (at the cost
of a lower speed).


## Use in other services
* <a href="https://github.com/louischatriot/connect-nedb-session"
  target="_blank">connect-nedb-session</a> is a session store for
Connect and Express, backed by nedb
* If you've outgrown NeDB, switching to MongoDB won't be too hard as it is the same API. Use <a href="https://github.com/louischatriot/nedb-to-mongodb" target="_blank">this utility</a> to transfer the data from a NeDB database to a MongoDB collection


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
