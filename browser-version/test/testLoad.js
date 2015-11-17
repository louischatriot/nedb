console.log('BEGINNING');

var N = 50000
  , db = new Nedb({ filename: 'loadTest', autoload: true })
  , t, i
  , sample = JSON.stringify({ data: Math.random(), _id: Math.random() });
  ;

// Some inserts in sequence, using the default storage mechanism (IndexedDB in my case)
function someInserts (sn, N, callback) {
  var i = 0, beg = Date.now();
  async.whilst( function () { return i < N; }
              , function (_cb) {
                  db.insert({ data: Math.random() }, function (err) { i += 1; return _cb(err); });
                }
              , function (err) {
                  console.log("Inserts, series " + sn + " " + (Date.now() - beg));
                  return callback(err);
                });
}

// Manually updating the localStorage on the same variable
function someLS (sn, N, callback) {
  var i = 0, beg = Date.now();
  for (i = 0; i < N; i += 1) {
    localStorage.setItem('loadTestLS', getItem('loadTestLS') + sample);
  }
  console.log("localStorage, series " + sn + " " + (Date.now() - beg));
  return callback();
}

// Manually updating the localStorage on different variables
function someLSDiff (sn, N, callback) {
  var i = 0, beg = Date.now();
  for (i = 0; i < N; i += 1) {
    localStorage.setItem('loadTestLS-' + i, sample);
  }
  console.log("localStorage, series " + sn + " " + (Date.now() - beg));
  return callback();
}

// Manually updating the localforage default on the same variable (IndexedDB on my machine)
function someLF (sn, N, callback) {
  var i = 0, beg = Date.now();
  async.whilst( function () { return i < N; }
              , function (_cb) {
                  localforage.getItem('loadTestLF', function (err, value) {
                    if (err) { return _cb(err); }
                    localforage.setItem('loadTestLF', value + sample, function (err) { i += 1; return _cb(err); });
                  });
                }
              , function (err) {
                  console.log("localForage/IDB, series " + sn + " " + (Date.now() - beg));
                  return callback(err);
                });
}

// Manually updating the localforage default on the different variables (IndexedDB on my machine)
function someLFDiff (sn, N, callback) {
  var i = 0, beg = Date.now();
  async.whilst( function () { return i < N; }
              , function (_cb) {
                  localforage.setItem('loadTestLF-' + i, sample, function (err) { i += 1; return _cb(err); });
                }
              , function (err) {
                  console.log("localForage/IDB, series " + sn + " " + (Date.now() - beg));
                  return callback(err);
                });
}



localStorage.setItem('loadTestLS', '');
async.waterfall([
  function (cb) { db.remove({}, { multi: true }, function (err) { return cb(err); }); }

// Slow and gets slower with database size
//, async.apply(someInserts, "#1", N)   // N=5000, 141s
//, async.apply(someInserts, "#2", N)   // N=5000, 208s
//, async.apply(someInserts, "#3", N)   // N=5000, 281s
//, async.apply(someInserts, "#4", N)   // N=5000, 350s

// Slow and gets slower really fast with database size, then outright crashes
//, async.apply(someLS, "#1", N)   // N=4000, 2.5s
//, async.apply(someLS, "#2", N)   // N=4000, 8.0s
//, async.apply(someLS, "#3", N)   // N=4000, 26.5s
//, async.apply(someLS, "#4", N)   // N=4000, 47.8s then crash, can't get string (with N=5000 crash happens on second pass)

// Much faster and more consistent
//, async.apply(someLSDiff, "#1", N)   // N=50000, 0.7s
//, async.apply(someLSDiff, "#2", N)   // N=50000, 0.5s
//, async.apply(someLSDiff, "#3", N)   // N=50000, 0.5s
//, async.apply(someLSDiff, "#4", N)   // N=50000, 0.5s

// Slow and gets slower with database size
//, function (cb) { localforage.setItem('loadTestLF', '', function (err) { return cb(err) }) }
//, async.apply(someLF, "#1", N)   // N=5000, 69s
//, async.apply(someLF, "#2", N)   // N=5000, 108s
//, async.apply(someLF, "#3", N)   // N=5000, 137s
//, async.apply(someLF, "#4", N)   // N=5000, 169s

// Quite fast and speed doesn't change with database size (tested with N=10000 and N=50000, still no slow-down)
//, async.apply(someLFDiff, "#1", N)   // N=5000, 18s
//, async.apply(someLFDiff, "#2", N)   // N=5000, 18s
//, async.apply(someLFDiff, "#3", N)   // N=5000, 18s
//, async.apply(someLFDiff, "#4", N)   // N=5000, 18s
]);




