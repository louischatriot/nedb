/**
 * Load and modify part of fs to ensure writeFile will crash after writing 5000 bytes
 */
var fs = require('fs');

function rethrow() {
  // Only enable in debug mode. A backtrace uses ~1000 bytes of heap space and
  // is fairly slow to generate.
  if (DEBUG) {
    var backtrace = new Error();
    return function(err) {
      if (err) {
        backtrace.stack = err.name + ': ' + err.message +
                          backtrace.stack.substr(backtrace.name.length);
        throw backtrace;
      }
    };
  }

  return function(err) {
    if (err) {
      throw err;  // Forgot a callback but don't know where? Use NODE_DEBUG=fs
    }
  };
}

function maybeCallback(cb) {
  return typeof cb === 'function' ? cb : rethrow();
}

function isFd(path) {
  return (path >>> 0) === path;
}

function assertEncoding(encoding) {
  if (encoding && !Buffer.isEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

var onePassDone = false;
function writeAll(fd, isUserFd, buffer, offset, length, position, callback_) {
  var callback = maybeCallback(arguments[arguments.length - 1]);

  if (onePassDone) { process.exit(1); }   // Crash on purpose before rewrite done
  var l = Math.min(5000, length);   // Force write by chunks of 5000 bytes to ensure data will be incomplete on crash

  // write(fd, buffer, offset, length, position, callback)
  fs.write(fd, buffer, offset, l, position, function(writeErr, written) {
    if (writeErr) {
      if (isUserFd) {
        if (callback) callback(writeErr);
      } else {
        fs.close(fd, function() {
          if (callback) callback(writeErr);
        });
      }
    } else {
      onePassDone = true;
      if (written === length) {
        if (isUserFd) {
          if (callback) callback(null);
        } else {
          fs.close(fd, callback);
        }
      } else {
        offset += written;
        length -= written;
        if (position !== null) {
          position += written;
        }
        writeAll(fd, isUserFd, buffer, offset, length, position, callback);
      }
    }
  });
}

fs.writeFile = function(path, data, options, callback_) {
  var callback = maybeCallback(arguments[arguments.length - 1]);

  if (!options || typeof options === 'function') {
    options = { encoding: 'utf8', mode: 438, flag: 'w' }; // Mode 438 == 0o666 (compatibility with older Node releases)
  } else if (typeof options === 'string') {
    options = { encoding: options, mode: 438, flag: 'w' }; // Mode 438 == 0o666 (compatibility with older Node releases)
  } else if (typeof options !== 'object') {
    throwOptionsError(options);
  }

  assertEncoding(options.encoding);

  var flag = options.flag || 'w';

  if (isFd(path)) {
    writeFd(path, true);
    return;
  }

  fs.open(path, flag, options.mode, function(openErr, fd) {
    if (openErr) {
      if (callback) callback(openErr);
    } else {
      writeFd(fd, false);
    }
  });

  function writeFd(fd, isUserFd) {
    var buffer = (data instanceof Buffer) ? data : new Buffer('' + data,
        options.encoding || 'utf8');
    var position = /a/.test(flag) ? null : 0;

    writeAll(fd, isUserFd, buffer, 0, buffer.length, position, callback);
  }
};




// End of fs modification
var Nedb = require('../lib/datastore.js')
  , db = new Nedb({ filename: 'workspace/lac.db' })
  ;

db.loadDatabase();
