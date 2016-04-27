var should = require('chai').should()
  , fs = require('fs')
  , path = require('path')
  , _ = require('underscore')
  , async = require('async')
  , model = require('../lib/model')
  , Datastore = require('../lib/datastore');

describe('Database', function () {
  it('Can open and close cleanly', function() {
    var closeDb = 'workspace/close.db';
    var db = new Datastore({filename: closeDb, autoload: true}, function() {});
    db.filename.should.equal(closeDb);
    
    db.inMemoryOnly.should.equal(false);
    
    db.insert({ somedata: 'ok' }, function(err) { 
      assert.isNull(err);
    });
    
    db.closeDatabase();
    
    db.insert({ somedata: 'ok' }, function(err) {
      err.message.should.equal("Attempting operation on closed database.")
    });
    
    try {
      db.insert({ somedata: 'ok' });
    } catch (e) {
      
    }    
  });
});