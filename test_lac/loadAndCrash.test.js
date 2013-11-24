var Nedb = require('../lib/datastore.js')
  , db = new Nedb({ filename: 'workspace/lac.db' })
  ;

db.loadDatabase();