var Nedb = require('../lib/datastore.js')
  , db = new Nedb({ filename: 'workspace/lac.db' })
  ;

// Simulate a crash in 100ms
setTimeout(function() {
  process.send('crash');
  process.exit();
}, 1870);
  
db.loadDatabase();