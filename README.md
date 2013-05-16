# NE DB (Node Embedded DataBase)

Embedded persistent database for Node.js, with no dependency (except npm modules of course). The API is the same as MongoDB.

**It's still experimental!** I'm still stabilizing the code. The API will not change though. Don't hesitate to file issues/PRs if you find bugs.

## Why?
I needed to store data from another project (<a href="https://github.com/louischatriot/braindead-ci" target="_blank">Braindead CI</a>). I needed the datastore to be standalone (i.e. no dependency except other Node modules) so that people can install the software using a simple `npm install`. I couldn't find one without bugs and a clean API so I made this one.

## Installation, tests
It will be published as an npm module once it is finished. To launch tests: `npm test`.

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

// You need to load each database
db.users.loadDatabase();
db.robots.loadDatabase();
```

### Inserting documents
The native types are String, Number, Boolean and Date. You can also use
arrays and subdocuments (objects). If you specify an `_id` field, it
will be used as the document's _id, otherwise a nedb will generate one.
Note the generated `_id` is a simple string, not an ObjectId.

```javascript
var document = { hello: 'world'
               , n: 5
               , today: new Date()
               , nedbIsAwesome: true
               , fruits: [ 'apple, 'orange', 'pear' ]
               , infos: { name: 'nedb' }
               };

db.insert(document, function (err, newDoc) {   // Callback is optional
  // newDoc is the newly inserted document, including its _id
});
```

### Finding documents
For now, you can only select documents based on field equality. You can
use `find` to look for multiple documents matching you query, of
`findOne` to look for one specific document.

```javascript
// Let's say our datastore contains the following collection
// { _id: 'id1', planet: 'Mars', system: 'solar', inhabited: false }
// { _id: 'id2', planet: 'Earth', system: 'solar', inhabited: true }
// { _id: 'id3', planet: 'Jupiter', system: 'solar', inhabited: false }
// { _id: 'id4', planet: 'Omicron Persia 8', system: 'futurama', inhabited: true }

// Finding all planets in the solar system
db.find({ system: 'solar' }, function (err, docs) {
  // docs is an array containing documents _id1, _id2, _id3
});

// Finding all inhabited planets in the solar system
db.find({ system: 'solar', inhabited: true }, function (err, docs) {
  // docs is an array containing document _id2 only
});
```


## Performance
### Speed
It is pretty fast on the kind of datasets it was designed for (10,000 documents or less). On my machine (3 years old, no SSD), with a collection with 10,000 documents:  
* An insert takes 0.1ms
* A read takes 5.7ms
* An update takes 62ms
* A deletion takes 61ms  

Read, update and deletion times are pretty much non impacted by the number of concerned documents. Inserts, updates and deletions are non-blocking. Read will be soon, too (but they are so fast it is not so important anyway).

You can run the simple benchmarks I use by executing the scripts in the `benchmarks` folder. They all take an optional parameter which is the size of the dataset to use (default is 10,000).

### Memory footprint
For now, a copy of the whole database is kept in memory. For the kind of datasets expected this should not be too much (max 20MB) but I am planning on stopping using that method to free RAM and make it completely asynchronous.



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
