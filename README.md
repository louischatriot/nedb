<img src="http://i.imgur.com/9O1xHFb.png" style="width: 25%; height: 25%; float: left;">

## The Javascript Database

**Embedded persistent or in memory database for Node.js, nw.js, Electron and browsers, 100% Javascript, no binary dependency**. API is a subset of MongoDB's and it's <a href="#speed">plenty fast</a>.

**IMPORTANT NOTE**: Please don't submit issues for questions regarding your code. Only actual bugs or feature requests will be answered, all others will be closed without comment. Also, please follow the <a href="#bug-reporting-guidelines">bug reporting guidelines</a> and check the <a href="https://github.com/louischatriot/nedb/wiki/Change-log" target="_blank">change log</a> before submitting an already fixed bug :)

## Support NeDB development
No time to <a href="#help-out">help out</a>? You can support NeDB development by sending money or bitcoins!

Money: [![Donate to author](https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=louis%2echatriot%40gmail%2ecom&lc=US&currency_code=EUR&bn=PP%2dDonationsBF%3abtn_donate_LG%2egif%3aNonHostedGuest)

Bitcoin address: 1dDZLnWpBbodPiN8sizzYrgaz5iahFyb1


## Installation, tests
Module name on npm and bower is `nedb`.
```javascript
npm install nedb --save   // Put latest version in your package.json
npm test   // You'll need the dev dependencies to launch tests
bower install nedb   // For the browser versions, which will be in browser-version/out
```

## API
It's a subset of MongoDB's API (the most used operations).

* <a href="#creatingloading-a-database">Creating/loading a database</a>
* <a href="#persistence">Persistence</a>
* <a href="#inserting-documents">Inserting documents</a>
* <a href="#finding-documents">Finding documents</a>
  * <a href="#basic-querying">Basic Querying</a>
  * <a href="#operators-lt-lte-gt-gte-in-nin-ne-exists-regex">Operators ($lt, $lte, $gt, $gte, $in, $nin, $ne, $exists, $regex)</a>
  * <a href="#array-fields">Array fields</a>
  * <a href="#logical-operators-or-and-not-where">Logical operators $or, $and, $not, $where</a>
  * <a href="#sorting-and-paginating">Sorting and paginating</a>
  * <a href="#projections">Projections</a>
* <a href="#counting-documents">Counting documents</a>
* <a href="#updating-documents">Updating documents</a>
* <a href="#removing-documents">Removing documents</a>
* <a href="#indexing">Indexing</a>
* <a href="#browser-version">Browser version</a>

### Creating/loading a database
You can use NeDB as an in-memory only datastore or as a persistent datastore. One datastore is the equivalent of a MongoDB collection. The constructor is used as follows `new Datastore(options)` where `options` is an object with the following fields:

* `filename` (optional): path to the file where the data is persisted. If left blank, the datastore is automatically considered in-memory only. It cannot end with a `~` which is used in the temporary files NeDB uses to perform crash-safe writes
* `inMemoryOnly` (optional, defaults to false): as the name implies.
* `timestampData` (optional, defaults to false): timestamp the insertion and last update of all documents, with the fields `createdAt` and `updatedAt`. User-specified values override automatic generation, usually useful for testing.
* `autoload` (optional, defaults to false): if used, the database will
  automatically be loaded from the datafile upon creation (you don't
need to call `loadDatabase`). Any command
issued before load is finished is buffered and will be executed when
load is done.
* `onload` (optional): if you use autoloading, this is the handler called after the `loadDatabase`. It takes one `error` argument. If you use autoloading without specifying this handler, and an error happens during load, an error will be thrown.
* `afterSerialization` (optional): hook you can use to transform data after it was serialized and before it is written to disk. Can be used for example to encrypt data before writing database to disk. This function takes a string as parameter (one line of an NeDB data file) and outputs the transformed string, **which must absolutely not contain a `\n` character** (or data will be lost)
* `beforeDeserialization` (optional): reverse of `afterSerialization`. Make sure to include both and not just one or you risk data loss. For the same reason, make sure both functions are inverses of one another. Some failsafe mechanisms are in place to prevent data loss if you misuse the serialization hooks: NeDB checks that never one is declared without the other, and checks that they are reverse of one another by testing on random strings of various lengths. In addition, if too much data is detected as corrupt, NeDB will refuse to start as it could mean you're not using the deserialization hook corresponding to the serialization hook used before (see below)
* `corruptAlertThreshold` (optional): between 0 and 1, defaults to 10%. NeDB will refuse to start if more than this percentage of the datafile is corrupt. 0 means you don't tolerate any corruption, 1 means you don't care 
* `nodeWebkitAppName` (optional, **DEPRECATED**): if you are using NeDB from whithin a Node Webkit app, specify its name (the same one you use in the `package.json`) in this field and the `filename` will be relative to the directory Node Webkit uses to store the rest of the application's data (local storage etc.). It works on Linux, OS X and Windows. Now that you can use `require('nw.gui').App.dataPath` in Node Webkit to get the path to the data directory for your application, you should not use this option anymore and it will be removed.

If you use a persistent datastore without the `autoload` option, you need to call `loadDatabase` manually.
This function fetches the data from datafile and prepares the database. **Don't forget it!** If you use a
persistent datastore, no command (insert, find, update, remove) will be executed before `loadDatabase`
is called, so make sure to call it yourself or use the `autoload` option.

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
  , path = require('path')
  , db = new Datastore({ filename: path.join(require('nw.gui').App.dataPath, 'something.db') });


// Of course you can create multiple datastores if you need several
// collections. In this case it's usually a good idea to use autoload for all collections.
db = {};
db.users = new Datastore('path/to/users.db');
db.robots = new Datastore('path/to/robots.db');

// You need to load each database (here we do it asynchronously)
db.users.loadDatabase();
db.robots.loadDatabase();
```

### Persistence
Under the hood, NeDB's persistence uses an append-only format, meaning that all updates and deletes actually result in lines added at the end of the datafile, for performance reasons. The database is automatically compacted (i.e. put back in the one-line-per-document format) everytime your application restarts.

You can manually call the compaction function with `yourDatabase.persistence.compactDatafile` which takes no argument. It queues a compaction of the datafile in the executor, to be executed sequentially after all pending operations.

You can also set automatic compaction at regular intervals with `yourDatabase.persistence.setAutocompactionInterval(interval)`, `interval` in milliseconds (a minimum of 5s is enforced), and stop automatic compaction with `yourDatabase.persistence.stopAutocompaction()`.

Keep in mind that compaction takes a bit of time (not too much: 130ms for 50k records on a typical development machine) and no other operation can happen when it does, so most projects actually don't need to use it.

Durability works similarly to major databases: compaction forces the OS to physically flush data to disk, while appends to the data file do not (the OS is responsible for flushing the data). That guarantees that a server crash can never cause complete data loss, while preserving performance. The worst that can happen is a crash between two syncs, causing a loss of all data between the two syncs. Usually syncs are 30 seconds appart so that's at most 30 seconds of data. <a href="http://oldblog.antirez.com/post/redis-persistence-demystified.html" target="_blank">This post by Antirez on Redis persistence</a> explains this in more details, NeDB being very close to Redis AOF persistence with `appendfsync` option set to `no`.


### Inserting documents
The native types are `String`, `Number`, `Boolean`, `Date` and `null`. You can also use
arrays and subdocuments (objects). If a field is `undefined`, it will not be saved (this is different from 
MongoDB which transforms `undefined` in `null`, something I find counter-intuitive).

If the document does not contain an `_id` field, NeDB will automatically generated one for you (a 16-characters alphanumerical string). The `_id` of a document, once set, cannot be modified.

Field names cannot begin by '$' or contain a '.'.

```javascript
var doc = { hello: 'world'
               , n: 5
               , today: new Date()
               , nedbIsAwesome: true
               , notthere: null
               , notToBeSaved: undefined  // Will not be saved
               , fruits: [ 'apple', 'orange', 'pear' ]
               , infos: { name: 'nedb' }
               };

db.insert(doc, function (err, newDoc) {   // Callback is optional
  // newDoc is the newly inserted document, including its _id
  // newDoc has no key called notToBeSaved since its value was undefined
});
```

You can also bulk-insert an array of documents. This operation is atomic, meaning that if one insert fails due to a unique constraint being violated, all changes are rolled back.
```javascript
db.insert([{ a: 5 }, { a: 42 }], function (err, newDocs) {
  // Two documents were inserted in the database
  // newDocs is an array with these documents, augmented with their _id
});

// If there is a unique constraint on field 'a', this will fail
db.insert([{ a: 5 }, { a: 42 }, { a: 5 }], function (err) {
  // err is a 'uniqueViolated' error
  // The database was not modified
});
```

### Finding documents
Use `find` to look for multiple documents matching you query, or `findOne` to look for one specific document. You can select documents based on field equality or use comparison operators (`$lt`, `$lte`, `$gt`, `$gte`, `$in`, `$nin`, `$ne`). You can also use logical operators `$or`, `$and`, `$not` and `$where`. See below for the syntax.

You can use regular expressions in two ways: in basic querying in place of a string, or with the `$regex` operator.

You can sort and paginate results using the cursor API (see below).

You can use standard projections to restrict the fields to appear in the results (see below).

#### Basic querying
Basic querying means are looking for documents whose fields match the ones you specify. You can use regular expression to match strings.
You can use the dot notation to navigate inside nested documents, arrays, arrays of subdocuments and to match a specific element of an array.

```javascript
// Let's say our datastore contains the following collection
// { _id: 'id1', planet: 'Mars', system: 'solar', inhabited: false, satellites: ['Phobos', 'Deimos'] }
// { _id: 'id2', planet: 'Earth', system: 'solar', inhabited: true, humans: { genders: 2, eyes: true } }
// { _id: 'id3', planet: 'Jupiter', system: 'solar', inhabited: false }
// { _id: 'id4', planet: 'Omicron Persei 8', system: 'futurama', inhabited: true, humans: { genders: 7 } }
// { _id: 'id5', completeData: { planets: [ { name: 'Earth', number: 3 }, { name: 'Mars', number: 2 }, { name: 'Pluton', number: 9 } ] } }

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

// Use the dot-notation to navigate arrays of subdocuments
db.find({ "completeData.planets.name": "Mars" }, function (err, docs) {
  // docs contains document 5
});

db.find({ "completeData.planets.name": "Jupiter" }, function (err, docs) {
  // docs is empty
});

db.find({ "completeData.planets.0.name": "Earth" }, function (err, docs) {
  // docs contains document 5
  // If we had tested against "Mars" docs would be empty because we are matching against a specific array element
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
When a field in a document is an array, NeDB first tries to see if there is an array-specific comparison function (for now there is only `$size`) being used
and tries it first. If there isn't, the query is treated as a query on every element and there is a match if at least one element matches.

```javascript
// Using an array-specific comparison function
// Note: you can't use nested comparison functions, e.g. { $size: { $lt: 5 } } will throw an error
db.find({ satellites: { $size: 2 } }, function (err, docs) {
  // docs contains Mars
});

db.find({ satellites: { $size: 1 } }, function (err, docs) {
  // docs is empty
});

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

#### Logical operators $or, $and, $not, $where
You can combine queries using logical operators:  

* For `$or` and `$and`, the syntax is `{ $op: [query1, query2, ...] }`.
* For `$not`, the syntax is `{ $not: query }`
* For `$where`, the syntax is `{ $where: function () { /* object is "this", return a boolean */ } }`

```javascript
db.find({ $or: [{ planet: 'Earth' }, { planet: 'Mars' }] }, function (err, docs) {
  // docs contains Earth and Mars
});

db.find({ $not: { planet: 'Earth' } }, function (err, docs) {
  // docs contains Mars, Jupiter, Omicron Persei 8
});

db.find({ $where: function () { return Object.keys(this) > 6; } }, function (err, docs) {
  // docs with more than 6 properties
});

// You can mix normal queries, comparison queries and logical operators
db.find({ $or: [{ planet: 'Earth' }, { planet: 'Mars' }], inhabited: true }, function (err, docs) {
  // docs contains Earth
});

```

#### Sorting and paginating
If you don't specify a callback to `find`, `findOne` or `count`, a `Cursor` object is returned. You can modify the cursor with `sort`, `skip` and `limit` and then execute it with `exec(callback)`.

```javascript
// Let's say the database contains these 4 documents
// doc1 = { _id: 'id1', planet: 'Mars', system: 'solar', inhabited: false, satellites: ['Phobos', 'Deimos'] }
// doc2 = { _id: 'id2', planet: 'Earth', system: 'solar', inhabited: true, humans: { genders: 2, eyes: true } }
// doc3 = { _id: 'id3', planet: 'Jupiter', system: 'solar', inhabited: false }
// doc4 = { _id: 'id4', planet: 'Omicron Persei 8', system: 'futurama', inhabited: true, humans: { genders: 7 } }

// No query used means all results are returned (before the Cursor modifiers)
db.find({}).sort({ planet: 1 }).skip(1).limit(2).exec(function (err, docs) {
  // docs is [doc3, doc1]
});

// You can sort in reverse order like this
db.find({ system: 'solar' }).sort({ planet: -1 }).exec(function (err, docs) {
  // docs is [doc1, doc3, doc2]
});

// You can sort on one field, then another, and so on like this:
db.find({}).sort({ firstField: 1, secondField: -1 }) ...   // You understand how this works!
```

#### Projections
You can give `find` and `findOne` an optional second argument, `projections`. The syntax is the same as MongoDB: `{ a: 1, b: 1 }` to return only the `a` and `b` fields, `{ a: 0, b: 0 }` to omit these two fields. You cannot use both modes at the time, except for `_id` which is by default always returned and which you can choose to omit.

```javascript
// Same database as above

// Keeping only the given fields
db.find({ planet: 'Mars' }, { planet: 1, system: 1 }, function (err, docs) {
  // docs is [{ planet: 'Mars', system: 'solar', _id: 'id1' }]
});

// Keeping only the given fields but removing _id
db.find({ planet: 'Mars' }, { planet: 1, system: 1, _id: 0 }, function (err, docs) {
  // docs is [{ planet: 'Mars', system: 'solar' }]
});

// Omitting only the given fields and removing _id
db.find({ planet: 'Mars' }, { planet: 0, system: 0, _id: 0 }, function (err, docs) {
  // docs is [{ inhabited: false, satellites: ['Phobos', 'Deimos'] }]
});

// Failure: using both modes at the same time
db.find({ planet: 'Mars' }, { planet: 0, system: 1 }, function (err, docs) {
  // err is the error message, docs is undefined
});

// You can also use it in a Cursor way but this syntax is not compatible with MongoDB
// If upstream compatibility is important don't use this method
db.find({ planet: 'Mars' }).projection({ planet: 1, system: 1 }).exec(function (err, docs) {
  // docs is [{ planet: 'Mars', system: 'solar', _id: 'id1' }]
});
```



### Counting documents
You can use `count` to count documents. It has the same syntax as `find`. For example:

```javascript
// Count all planets in the solar system
db.count({ system: 'solar' }, function (err, count) {
  // count equals to 3
});

// Count all documents in the datastore
db.count({}, function (err, count) {
  // count equals to 4
});
```


### Updating documents
`db.update(query, update, options, callback)` will update all documents matching `query` according to the `update` rules:  
* `query` is the same kind of finding query you use with `find` and `findOne`
* `update` specifies how the documents should be modified. It is either a new document or a set of modifiers (you cannot use both together, it doesn't make sense!)
  * A new document will replace the matched docs
  * The modifiers create the fields they need to modify if they don't exist, and you can apply them to subdocs. Available field modifiers are `$set` to change a field's value, `$unset` to delete a field and `$inc` to increment a field's value. To work on arrays, you have `$push`, `$pop`, `$addToSet`, `$pull`, and the special `$each`. See examples below for the syntax.
* `options` is an object with two possible parameters
  * `multi` (defaults to `false`) which allows the modification of several documents if set to true
  * `upsert` (defaults to `false`) if you want to insert a new document corresponding to the `update` rules if your `query` doesn't match anything. If your `update` is a simple object with no modifiers, it is the inserted document. In the other case, the `query` is stripped from all operator recursively, and the `update` is applied to it.
* `callback` (optional) signature: `err`, `numReplaced`, `newDoc`
  * `numReplaced` is the number of documents replaced
  * `newDoc` is the created document if the upsert mode was chosen and a document was inserted

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

// Deleting a field
db.update({ planet: 'Mars' }, { $unset: { planet: true } }, {}, function () {
  // Now the document for Mars doesn't contain the planet field
  // You can unset nested fields with the dot notation of course
});

// Upserting a document
db.update({ planet: 'Pluton' }, { planet: 'Pluton', inhabited: false }, { upsert: true }, function (err, numReplaced, upsert) {
  // numReplaced = 1, upsert = { _id: 'id5', planet: 'Pluton', inhabited: false }
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

// $pull removes all values matching a value or even any NeDB query from the array
db.update({ _id: 'id6' }, { $pull: { fruits: 'apple' } }, {}, function () {
  // Now the fruits array is ['orange', 'pear']
});
db.update({ _id: 'id6' }, { $pull: { fruits: $in: ['apple', 'pear'] } }, {}, function () {
  // Now the fruits array is ['orange']
});



// $each can be used to $push or $addToSet multiple values at once
// This example works the same way with $addToSet
db.update({ _id: 'id6' }, { $push: { fruits: {$each: ['banana', 'orange'] } } }, {}, function () {
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
NeDB supports indexing. It gives a very nice speed boost and can be used to enforce a unique constraint on a field. You can index any field, including fields in nested documents using the dot notation. For now, indexes are only used to speed up basic queries and queries using `$in`, `$lt`, `$lte`, `$gt` and `$gte`. The indexed values cannot be of type array of object.

To create an index, use `datastore.ensureIndex(options, cb)`, where callback is optional and get passed an error if any (usually a unique constraint that was violated). `ensureIndex` can be called when you want, even after some data was inserted, though it's best to call it at application startup. The options are:  

* **fieldName** (required): name of the field to index. Use the dot notation to index a field in a nested document.
* **unique** (optional, defaults to `false`): enforce field uniqueness. Note that a unique index will raise an error if you try to index two documents for which the field is not defined.
* **sparse** (optional, defaults to `false`): don't index documents for which the field is not defined. Use this option along with "unique" if you want to accept multiple documents for which it is not defined.

Note: the `_id` is automatically indexed with a unique constraint, no need to call `ensureIndex` on it.

You can remove a previously created index with `datastore.removeIndex(fieldName, cb)`.

If your datastore is persistent, the indexes you created are persisted in the datafile, when you load the database a second time they are automatically created for you. No need to remove any `ensureIndex` though, if it is called on a database that already has the index, nothing happens.

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
  db.insert({ somefield: 'nedb' }, function (err) {
    // err is { errorType: 'uniqueViolated'
    //        , key: 'name'
    //        , message: 'Unique constraint violated for key name' }
  });
});

// Remove index on field somefield
db.removeIndex('somefield', function (err) {
});
```

**Note:** the `ensureIndex` function creates the index synchronously, so it's best to use it at application startup. It's quite fast so it doesn't increase startup time much (35 ms for a collection containing 10,000 documents).


## Browser version
The browser version and its minified counterpart are in the `browser-version/out` directory. You only need to require `nedb.js` or `nedb.min.js` in your HTML file and the global object `Nedb` can be used right away, with the same API as the server version:

```
<script src="nedb.min.js"></script>
<script>
  var db = new Nedb();   // Create an in-memory only datastore
  
  db.insert({ planet: 'Earth' }, function (err) {
   db.find({}, function (err, docs) {
     // docs contains the two planets Earth and Mars
   });
  });
</script>
```

If you specify a `filename`, the database will be persistent, and automatically select the best storage method available (IndexedDB, WebSQL or localStorage) depending on the browser. In most cases that means a lot of data can be stored, typically in hundreds of MB. **WARNING**: the storage system changed between v1.3 and v1.4 and is NOT back-compatible! Your application needs to resync client-side when you upgrade NeDB.

NeDB is compatible with all major browsers: Chrome, Safari, Firefox, IE9+. Tests are in the `browser-version/test` directory (files `index.html` and `testPersistence.html`).

If you fork and modify nedb, you can build the browser version from the sources, the build script is `browser-version/build.js`.


## Performance
### Speed
NeDB is not intended to be a replacement of large-scale databases such as MongoDB, and as such was not designed for speed. That said, it is still pretty fast on the expected datasets, especially if you use indexing. On a typical, not-so-fast dev machine, for a collection containing 10,000 documents, with indexing:  
* Insert: **10,680 ops/s**
* Find: **43,290 ops/s**
* Update: **8,000 ops/s**
* Remove: **11,750 ops/s**  

You can run these simple benchmarks by executing the scripts in the `benchmarks` folder. Run them with the `--help` flag to see how they work.

### Memory footprint
A copy of the whole database is kept in memory. This is not much on the
expected kind of datasets (20MB for 10,000 2KB documents).

## Use in other services
* <a href="https://github.com/louischatriot/connect-nedb-session"
  target="_blank">connect-nedb-session</a> is a session store for
Connect and Express, backed by nedb
* If you mostly use NeDB for logging purposes and don't want the memory footprint of your application to grow too large, you can use <a href="https://github.com/louischatriot/nedb-logger" target="_blank">NeDB Logger</a> to insert documents in a NeDB-readable database
* If you've outgrown NeDB, switching to MongoDB won't be too hard as it is the same API. Use <a href="https://github.com/louischatriot/nedb-to-mongodb" target="_blank">this utility</a> to transfer the data from a NeDB database to a MongoDB collection
* An ODM for NeDB: <a href="https://github.com/scottwrobinson/camo" target="_blank">Camo</a>


## Bug reporting guidelines
If you report a bug, thank you! That said for the process to be manageable please strictly adhere to the following guidelines. I'll not be able to handle bug reports that don't:
* Your bug report should be a self-containing gist complete with a package.json for any dependencies you need. I need to run through a simple `git clone gist; npm install; node bugreport.js`, nothing more.
* It should use assertions to showcase the expected vs actual behavior and be hysteresis-proof. It's quite simple in fact, see this example: https://gist.github.com/louischatriot/220cf6bd29c7de06a486
* Simplify as much as you can. Strip all your application-specific code. Most of the time you will see that there is no bug but an error in your code :)
* 50 lines max. If you need more, read the above point and rework your bug report. If you're **really** convinced you need more, please explain precisely in the issue.

### Bitcoins
You don't have time? You can support NeDB by sending bitcoins to this address: 1dDZLnWpBbodPiN8sizzYrgaz5iahFyb1


## License 

See [License](LICENSE)
