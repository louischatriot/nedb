
  var crypto = require("crypto");

  exports.encrypt = function(input, cypher, password) {
    var cipher, data, encrypted, iv, key, m;
    m = crypto.createHash("md5");
    m.update(password);
    key = m.digest("hex");
    m = crypto.createHash("md5");
    m.update(password + key);
    iv = m.digest("hex");
    data = new Buffer(input, "utf8").toString("binary");
    cipher = crypto.createCipheriv(cypher, key, iv.slice(0, 16));
    encrypted = cipher.update(data, "binary") + cipher.final("binary");
    return new Buffer(encrypted, "binary").toString("base64");
  };

  exports.decrypt = function(input, cypher, password) {
    var decipher, decrypted, edata, iv, key, m, plaintext;
    edata = new Buffer(input, "base64").toString("binary");
    m = crypto.createHash("md5");
    m.update(password);
    key = m.digest("hex");
    m = crypto.createHash("md5");
    m.update(password + key);
    iv = m.digest("hex");
    decipher = crypto.createDecipheriv(cypher, key, iv.slice(0, 16));
    decrypted = decipher.update(edata, "binary");
    plaintext = new Buffer(decrypted, "binary").toString("utf8");
    return plaintext;
  };


