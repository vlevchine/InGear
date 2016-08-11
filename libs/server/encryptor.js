/**
 * Created by valev on 2016-04-14.
 */
/*
 Copyright 2014 Levi Gross. All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */

var crypto = require('crypto'),
    utils = require('./utils'),
    ALGORITHM = 'AES-256-CTR', // CBC because CTR isn't possible with the current version of the Node.JS crypto library
    HMAC_ALGORITHM = 'SHA256';
KEY = crypto.randomBytes(32); // This key should be stored in an environment variable
HMAC_KEY = crypto.randomBytes(32); // This key should be stored in an environment variable

function encrypt(text, key, alg) {
    var iv = crypto.randomBytes(16),
        cipher = crypto.createCipher(alg || ALGORITHM, key, iv);
        encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    var hmac = crypto.createHmac(HMAC_ALGORITHM, HMAC_KEY);
    hmac.update(encrypted);
    hmac.update(iv.toString('hex')); // ensure that both the IV and the cipher-text is protected by the HMAC

    // The IV isn't a secret so it can be stored along side everything else
    return encrypted + "$" + iv.toString('hex') + "$" + hmac.digest('hex');
}

function decrypt(encrypted, key, alg) {
    var cipher_blob = encrypted.split("$");
    var ct = cipher_blob[0];
    var iv = new Buffer(cipher_blob[1], 'hex');
    var hmac = cipher_blob[2];
    var decryptor;

    var chmac = crypto.createHmac(HMAC_ALGORITHM, HMAC_KEY);
    chmac.update(ct);
    chmac.update(iv.toString('hex'));

    if (!constant_time_compare(chmac.digest('hex'), hmac)) {
        console.log("Encrypted Blob has been tampered with...");
        return null;
    }
    var decipher = crypto.createDecipher(alg || ALGORITHM, key, iv),
        decrypted = decipher.update(ct, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;

}
//var encrypt = function (plain_text, key) {
//
//    var IV = new Buffer(crypto.randomBytes(16)); // ensure that the IV (initialization vector) is random
//    var cipher_text, hmac, encryptor;
//
//    encryptor = crypto.createCipheriv(ALGORITHM, key || KEY, IV);
//    encryptor.setEncoding('hex');
//    encryptor.write(plain_text);
//    encryptor.end();
//
//    cipher_text = encryptor.read();
//
//    hmac = crypto.createHmac(HMAC_ALGORITHM, HMAC_KEY);
//    hmac.update(cipher_text);
//    hmac.update(IV.toString('hex')); // ensure that both the IV and the cipher-text is protected by the HMAC
//
//    // The IV isn't a secret so it can be stored along side everything else
//    return cipher_text + "$" + IV.toString('hex') + "$" + hmac.digest('hex');
//
//};
//
//var decrypt = function (cipher_text, key) {
//    var cipher_blob = cipher_text.split("$");
//    var ct = cipher_blob[0];
//    var IV = new Buffer(cipher_blob[1], 'hex');
//    var hmac = cipher_blob[2];
//    var decryptor;
//
//    chmac = crypto.createHmac(HMAC_ALGORITHM, HMAC_KEY);
//    chmac.update(ct);
//    chmac.update(IV.toString('hex'));
//
//    if (!constant_time_compare(chmac.digest('hex'), hmac)) {
//        console.log("Encrypted Blob has been tampered with...");
//        return null;
//    }
//
//    decryptor = crypto.createDecipheriv(ALGORITHM, key || KEY, IV);
//    decryptor.update(ct, 'hex', 'utf-8');
//    return decryptor.final('utf-8');
//
//};

var constant_time_compare = function (val1, val2) {
    var sentinel;

    if (val1.length !== val2.length) {
        return false;
    }


    for (var i = 0; i <= (val1.length - 1); i++) {
        sentinel |= val1.charCodeAt(i) ^ val2.charCodeAt(i);
    }

    return sentinel === 0
};

function getSeed() {
    return crypto.randomBytes(32);
}

function seed2Text(seed) {
    return utils.ua2text(seed);
}


function text2Seed(txt) {
    return utils.text2ua(txt);
}


module.exports = {
    encrypt: encrypt,
    decrypt: decrypt,
    getSeed: getSeed,
    seed2Text: seed2Text,
    text2Seed: text2Seed
}