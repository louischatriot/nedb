console.log("Beginning tests");

var db = new Nedb({ filename: 'test' });

db.loadDatabase(function (err) {
  console.log("LOADING DONE " + err);
});
