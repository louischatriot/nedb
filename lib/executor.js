/**
 * Responsible for sequentially executing actions on the database
 * async.queue is actually slowing down the code (10% hit on inserts, 3% on updates/removes)
 * That's not critical for the intended uses but I may reimplement this in the future
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
      lastArg.apply(null, arguments);
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



// Interface
module.exports = executor;
