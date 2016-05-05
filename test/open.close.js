var should = require('chai').should()
  , assert = require('chai').assert
  , fs = require('fs')
  , path = require('path')
  , _ = require('underscore')
  , async = require('async')
  , model = require('../lib/model')
  , Datastore = require('../lib/datastore');

var closeDb = 'workspace/close.db';

describe('Database', function () {
  it('Can open and close cleanly', function(done) {
    var db = new Datastore({filename: closeDb, autoload: true}, function() { });
    db.filename.should.equal(closeDb);
    
    db.inMemoryOnly.should.equal(false);
    
    db.insert({ somedata: 'ok' }, function(err) { 
      assert.isNull(err);
      
      db.closeDatabase(function(err) {
        db.insert({ somedata: 'ok' }, function(err) {
          err.message.should.equal("Attempting operation on closed database.");
        });
        
        try {
          db.insert({ somedata: 'ok' });
        } catch (e) {
          e.message.should.equal("Attempting operation on closed database.");
        }  
        done();
      });      
    });
  });
  
  it('Can reopen a closed database', function(done) {
    var db = new Datastore({filename: closeDb, autoload: true}, function() { });
    db.find({}, function(err, docs) {
      assert.isNull(err, 'There were no errors');
      assert.isNotNull(docs, 'A result was returned');
      assert.isAbove(docs.length, 1, 'Some results exist');
      assert.isDefined(docs[0].somedata, 'somedata has been defined');
      docs[0].somedata.should.equal('ok');  
      done();
    });
  });
});