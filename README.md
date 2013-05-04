# NE DB (Node Embedded DataBase)

Embedded persistent database for Node.js, with no dependency (except npm modules of course). The API is the same as MongoDB.

**It's still experimental!** I'm still stabilizing the code. The API will not change though. Don't hesitate to file issues/PRs if you find bugs.

## Why?
I needed to store data from another project (<a href="https://github.com/louischatriot/braindead-ci" target="_blank">Braindead CI</a>). I needed the datastore to be standalone (i.e. no dependency except other Node modules) so that people can install the software using a simple `npm install`. I couldn't find one without bugs and a clean API so I made this one.

## Installation, tests
It will be published as an npm module once it is finished. To launch tests: `npm test`.

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

## API
It's a subset of MongoDB's API.


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
