// Capture F5 to reload the base page testPersistence.html not this one
$(document).on('keydown', function (e) {
  if (e.keyCode === 116) {
    e.preventDefault();
    window.location = 'testPersistence.html';
  }
});


console.log("Checking tests results");
console.log("Please note these tests work on Chrome latest, might not work on other browsers due to discrepancies in how local storage works for the file:// protocol");

function testsFailed () {
  document.getElementById("results").innerHTML = "TESTS FAILED";
}

var filename = 'test';

var db = new Nedb({ filename: filename, autoload: true });
db.find({}, function (err, docs) {
  if (docs.length !== 1) {
    console.log(docs);
    console.log("Unexpected length of document database");
    return testsFailed();
  }

  if (Object.keys(docs[0]).length !== 2) {
    console.log("Unexpected length insert document in database");
    return testsFailed();
  }

  if (docs[0].hello !== 'world') {
    console.log("Unexpected document");
    return testsFailed();
  }

  document.getElementById("results").innerHTML = "BROWSER PERSISTENCE TEST PASSED";
});

