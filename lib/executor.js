/**
 * Responsible for sequentially executing actions on the database
 */

var async = require('async')
  ;

function Executor () {
  this.queue = async.queue(function (task, cb) {
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
}


/**
 * @param {Object} options
 *                 options.this - Object to use as this
 *                 options.fn - Function to execute
 *                 options.arguments - Array of arguments
 */
Executor.prototype.push = function () {
  this.queue.push.apply(this, arguments);
};



// Interface
module.exports = Executor;
