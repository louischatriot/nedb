var Nedb = require('../lib/datastore.js')
  , db = new Nedb({ filename: 'workspace/rah.db' })
  ;

// Simulate a crash in 100ms
setTimeout(function() {
  process.send('crash');
  process.exit();
}, 100);
  
db.loadDatabase();