var should = require('chai').should()
  , assert = require('chai').assert
  , customUtils = require('../lib/customUtils')
  , fs = require('fs')
  ;


describe('customUtils', function () {

  describe('ensureFileDoesntExist', function () {
  
    it('Doesnt do anything if file already doesnt exist', function (done) {
      customUtils.ensureFileDoesntExist('workspace/nonexisting', function (err) {
        assert.isNull(err);
        fs.existsSync('workspace/nonexisting').should.equal(false);
        done();
      });
    });

    it('Deletes file if it exists', function (done) {
      fs.writeFileSync('workspace/existing', 'hello world', 'utf8');
      fs.existsSync('workspace/existing').should.equal(true);
    
      customUtils.ensureFileDoesntExist('workspace/existing', function (err) {
        assert.isNull(err);
        fs.existsSync('workspace/existing').should.equal(false);
        done();
      });
    });
    
  });



});
