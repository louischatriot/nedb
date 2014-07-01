//beforeCompactDatafile callback test
var should = require('chai').should()
  , assert = require('chai').assert
  , testDb = 'workspace/test.db'
  , fs = require('fs')
  , path = require('path')
  , _ = require('underscore')
  , async = require('async')
  , model = require('../lib/model')
  , Datastore = require('../lib/datastore')
  , Persistence = require('../lib/persistence')


describe('beforeCompactDatafile', function () {
  d = new Datastore({ filename: testDb, beforeCompactDatafile: function(persistence){
    console.log("beforeCompactDatafile handler called");
    return true;
  }});

  it('Callback is registered', function () {
    assert.isNotNull(d.beforeCompactDatafile);
    d.beforeCompactDatafile.call(this).should.equal(true);
  });


  it('Call Auto Compact Directly',function(){
    var result = d.persistence.compactDatafile();
    assert.isNotNull(result);
  });

  it('Test Auto Compact abort',function(){
    d.persistence.stopAutocompaction();

    d.beforeCompactDatafile = function(persistence){
      return false;
    };

    var result = d.persistence.compactDatafile();
    assert.equal(result,false,result);
  });

  it('Test no beforeCompactDatafile handler',function(){
    d.beforeCompactDatafile = null;
    var result = d.persistence.compactDatafile();
    assert.equal(result,true);
  });

  it('Test Auto Compact interval',function(){
    //set auto compact interval to 1s
    //TODO implement proper test
    d.persistence.setAutocompactionInterval(1000);

    var doc = { hello: 'world'
                   , n: 5
                   , today: new Date()
                   , nedbIsAwesome: true
                   , notthere: null
                   , notToBeSaved: undefined  // Will not be saved
                   , fruits: [ 'apple', 'orange', 'pear' ]
                   , infos: { name: 'nedb' }
                   };

    d.insert(doc, function (err, doc) {
        //console.log("Inserted document",doc);
    });
  });  
});
