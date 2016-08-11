'use strict';
function base64Encode(str, base) {
    return new Buffer(str).toString(base || 'base64');
}

function base64Decode(str, base) {
    return new Buffer(str, base || 'base64').toString();
}

function hmac(str, key) {
    return crypto.createHmac('sha256', key).update(str).digest('hex');
}

function hash(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

function hmacEncoded(str, key) {
    return base64Encode(hmac(str, key), 'hex');
}

function createCert(owner, key) { return hmac(owner, key); }

function verify(raw, secret, signature) {
    return signature === sign(raw, secret);
}

var crypto = require('crypto'),
    bcrypt = require('bcrypt-nodejs'),
    defaultCryptoConf = {
        bcyptSeed: 10,
        workFactor: 4096,
        keyLength: 32,
        randomSize: 128
    },

    randomBytes = function(length) {
        return crypto.randomBytes(length || defaultCryptoConf.randomSize);
    },

    randomString = function(length) {
        return randomBytes(length).toString('base64');
    },

    createSalt = function(bytes) {
        return randomString(bytes);
        //return new Buffer(crypto.randomBytes(16).toString('base64'), 'base64');
    },

//instance method for hashing a password
    hashPassword = function(salt, password, config) {
        var conf = config || defaultCryptoConf;
        return !salt ? password :
            crypto.pbkdf2Sync(password, salt, conf.workFactor, conf.keyLength).toString('base64');
    },

    createDigest = function(message, salt, alg) {
        var alg = alg || 'sha1',
            salt = salt || crypto.randomBytes(10).toString('base64');

        return crypto.createHmac(alg, salt).update(message).digest('hex');
    },

    hashPasswordBcryptAsync = function(user, password){
        return new Promise(function(resolve, reject) {
            bcrypt.genSalt(defaultCryptoConf.bcyptSeed, function(err, salt) {
                if(err) { reject(err); }
                user.salt = salt;
                bcrypt.hash(password, salt, function(err, hash) {
                    if(err) { reject(err); }
                    user.password = hash;
                    resolve(user);
                });
            });
        });
    },

    hashPasswordCryptoAsync = function(user, password){
        return new Promise(function(resolve, reject) {
            crypto.randomBytes(defaultCryptoConf.keyLength, function(err, salt){
                if(err) { reject(err); }
                user.salt = salt;
                crypto.pbkdf2(password, salt, defaultCryptoConf.workFactor,
                    defaultCryptoConf.randomSize, 'sha256', function(err, hash) {
                    if(err) { reject(err); }
                    user.password = hash;
                    resolve(user);
                });
            });
        });
    },

    hashPasswordBcrypt = function(user, seed) {
        return bcrypt.getSalt(seed || defaultCryptoConf.bcyptSeed, function(err, salt) {
            if(err) { return next(err); }
            user.salt = salt;
            bcrypt.hash(user.password, user.salt, null, function(err, hash) {
                if(err) { return next(err); }
                user.password = hash;
                next();
            });
        });
    },

    encodeToken = function(payload, secret) {
        var header = {typ: 'JWT', alg: 'HS256'},
            jwt = base64Encode(JSON.stringify(header))+ '.' + base64Encode(JSON.stringify(payload));
        return jwt + '.' + sign(jwt, secret);
    },

    decodeToken = function(token, secret) {
        var toks = token.split('.');

        if (toks.length !== 3) { throw new Error('Token format incorrect')}
        var header = JSON.parse(base64Decode(toks[0])),
            payload = JSON.parse(base64Decode(toks[1])),
            rawSignature = toks[0] + '.' + toks[1];
        if (!verify(rawSignature, secret, toks[2])) { throw new Error('Token verification failed')}

        return payload;
    },

    encryptAesSha256 = function(salt, textToEncrypt) {
        var cipher = crypto.createCipher('aes-256-cbc', salt);
        var crypted = cipher.update(textToEncrypt, 'utf8', 'hex');
        crypted += cipher.final('hex');
        return crypted;
    };


function encrypt(text, key, alg){
    var cipher = crypto.createCipher(alg || 'aes-256-ctr', key);
    var crypted = cipher.update(text || 'NA','utf8','hex');
    crypted += cipher.final('hex');
    return crypted;
}

function decrypt(text, key, alg){
    var decipher = crypto.createDecipher(alg || 'aes-256-ctr', key);
    var dec = decipher.update(text || 'NA','hex','utf8');
    dec += decipher.final('utf8');
    return dec;
}

//Auth
function authenticate(req, res, next) {
    passport.authenticate('local', function(err, user) {
        if(err) {return next(err);}
        if(!user) { res.send({success:false})}
        req.logIn(user, function(err) {
            if(err) {return next(err);}
            res.redirect('/');//.send({success:true, user: user});
        })
    })(req, res, next);
};

function requiresApiLogin(req, res, next) {
    //req.headers['x-access-token']
    //if (decoded.exp <= Date.now()) {
    //    res.end('Access token has expired', 400);
    //}
    if(!req.isAuthenticated()) {//TBD: authorized
        res.status(403);
        res.end();
    } else {
        next();
    }
};

function requiresRole(role) {
    return function(req, res, next) {
        if(!req.isAuthenticated() || req.user.roles.indexOf(role) === -1) {
            res.status(403);
            res.end();
        } else {
            next();
        }
    }
}

function encodeSecret(id, key, seed){
    return hmac(id + '.' + key, seed);
}

function validateSecret(secret, hash, seed){
    return hmac(secret, seed);
}

function encodeTokenizer(key, seed) {
    return hmac(key, seed);
}

function encodeId(id) {
    return hash(id);
}

module.exports = {
    hmac: hmac,
    hash: hash,
    hmacEncoded: hmacEncoded,
    createCert: createCert,
    randomBytes: randomBytes,
    randomString:randomString,
    base64Encode: base64Encode,
    base64Decode: base64Decode,
    createSalt: createSalt,
    hashPasswordStrong: hashPassword,
    createDigest: createDigest,
    hashPasswordBcrypt: hashPasswordBcrypt,
    encodeToken: encodeToken,
    decodeToken: decodeToken,
    encrypt: encrypt,
    decrypt: decrypt,
    authenticate: authenticate,
    requiresApiLogin: requiresApiLogin,
    requiresRole: requiresRole,
    hashPasswordBcryptAsync: hashPasswordBcryptAsync,
    hashPasswordCryptoAsync: hashPasswordCryptoAsync,
    encodeSecret: encodeSecret,
    encodeTokenizer: encodeTokenizer,
    encodeId: encodeId
};