console.log('BEGINNING');

var N = 4000
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

// Manually updating the localStorage
function someLS (sn, N, callback) {
  var i = 0, beg = Date.now();
  for (i = 0; i < N; i += 1) {
    localStorage.setItem('loadTestLS', localStorage.getItem('loadTestLS') + sample);
  }
  console.log("localStorage, series " + sn + " " + (Date.now() - beg));
  return callback();
}


localStorage.setItem('loadTestLS', '');
async.waterfall([
  function (cb) { db.remove({}, { multi: true }, function (err) { return cb(err); }); }
//, async.apply(someInserts, "#1", N)   // N=5000, 141s
//, async.apply(someInserts, "#2", N)   // N=5000, 208s
//, async.apply(someInserts, "#3", N)   // N=5000, 281s
//, async.apply(someInserts, "#4", N)   // N=5000, 350s

, async.apply(someLS, "#1", N)   // N=4000, 2.5s
, async.apply(someLS, "#2", N)   // N=4000, 8.0s
, async.apply(someLS, "#3", N)   // N=4000, 26.5s
, async.apply(someLS, "#4", N)   // N=4000, 47.8s then crash (with N=5000 crash happens on second pass)
]);
