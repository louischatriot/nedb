/**
 * Responsible for sequentially executing requests
 */

var async = require('async')
  , queue
  ;

executor = async.queue(function (task, cb) {
  var callback
    , lastArg = task.arguments[task.arguments.length - 1]
    ;

  // Always tell the queue task is complete. Execute callback if any was given.
  if (typeof lastArg === 'function') {
    callback = function () {
      lastArg(arguments);
      cb();
    };

    task.arguments[task.arguments.length - 1] = callback;
  } else {
    callback = function () {
      cb();
    };

    task.arguments.push(callback);
  }

  task.fn.apply(task.this, task.arguments);
}, 1);


function test1 (msg, cb) {
  var callback = cb || function () {};

  console.log("ooooo TEST1");

  setTimeout(function () {
    console.log("Hello " + msg);
    callback();
  }, 1500);
}


function test2 (msg, cb) {
  var callback = cb || function () {};

  console.log("ooooo TEST2");

  setTimeout(function () {
    console.log("Ola " + msg);
    callback();
  }, 500);
}

function bloup () { console.log("FINISHED"); }

executor.push({ this: null, fn: test1, arguments: [ 'world' ] });
executor.push({ this: null, fn: test2, arguments: [ 'world', bloup ] });


/*
 *
queue(worker, concurrency)

Creates a queue object with the specified concurrency. Tasks added to the queue will be processed in parallel (up to the concurrency limit). If all workers are in progress, the task is queued until one is available. Once a worker has completed a task, the task's callback is called.

Arguments

worker(task, callback) - An asynchronous function for processing a queued task, which must call its callback(err) argument when finished, with an optional error as an argument.
concurrency - An integer for determining how many worker functions should be run in parallel.
Queue objects

The queue object returned by this function has the following properties and methods:

length() - a function returning the number of items waiting to be processed.
concurrency - an integer for determining how many worker functions should be run in parallel. This property can be changed after a queue is created to alter the concurrency on-the-fly.
push(task, [callback]) - add a new task to the queue, the callback is called once the worker has finished processing the task. instead of a single task, an array of tasks can be submitted. the respective callback is used for every task in the list.
unshift(task, [callback]) - add a new task to the front of the queue.
saturated - a callback that is called when the queue length hits the concurrency and further tasks will be queued
empty - a callback that is called when the last item from the queue is given to a worker
drain - a callback that is called when the last item from the queue has returned from the worker
Example

// create a queue object with concurrency 2

var q = async.queue(function (task, callback) {
    console.log('hello ' + task.name);
    callback();
}, 2);


// assign a callback
q.drain = function() {
    console.log('all items have been processed');
}

// add some items to the queue

q.push({name: 'foo'}, function (err) {
    console.log('finished processing foo');
});
q.push({name: 'bar'}, function (err) {
    console.log('finished processing bar');
});

// add some items to the queue (batch-wise)

q.push([{name: 'baz'},{name: 'bay'},{name: 'bax'}], function (err) {
    console.log('finished processing bar');
});

// add some items to the front of the queue

q.unshift({name: 'bar'}, function (err) {
    console.log('finished processing bar');
});
 */



// Interface
module.exports = executor;
