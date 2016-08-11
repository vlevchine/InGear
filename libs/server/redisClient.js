/* Returns an open, configured connection to our Redis database. */
'use strict';

var redis = require('redis'),
    bluebird = require('bluebird'),
    logger = require('./logger').getLogger();

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

function createClient(redisConfig, name) {
    if (!redisConfig) {
        throw 'Redis config missing.'
    }
    var client = redis.createClient(redisConfig.port, redisConfig.host, redisConfig.options);

    client.on("error", function (err) {
        logger.info("Error " + err);
    });
    client.on('connect', function () {
        logger.info("%s: successfully connected to redis server", name || 'Redis');
    });

    // monkeypatch to make lpush accept an array

    var origLpush = client.lpush.bind(client);

    client.lpush = function(key, args, callback) {

        if (Array.isArray(args) && args.length > 0 && typeof callback === 'function') {
            args.unshift(key);
            this.send_command('lpush', args, function(err, result) {
                callback(err, result);
            });
        } else {
            origLpush.apply(client, arguments);
        }
    };

    return client;
}

function redisCache(redisConfig, name) {
    if (!redisConfig) {
        throw 'Redis config missing.'
    }
    this.client = redis.createClient(redisConfig.port, redisConfig.host, redisConfig.options);

    this.client.on("error", function (err) {
        logger.info("Error " + err);
    });
    this.client.on('connect', function () {
        logger.info("%s: successfully connected to redis server", name || 'Redis');
    });
    this.failed = 'failed';
}

redisCache.prototype.getObjectById = function(id) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.client.hgetall(id, function(err, result) {
            if (err) {
                logger.error("Redis error requesting hash by id: %s", id);
                reject('server_error');
            } else {
                    resolve(result);
            }
        });
    });
};

redisCache.prototype.setObjectById = function(id, obj, expiresIn) {
    if (!id || !obj) { return Promise.reject('invalid_request'); }
    var self = this;
    return new Promise(function(resolve, reject) {
        self.client.hmset(id, obj, function(err, result) {
            if (err || !result) {
                logger.error("Redis error saving hash by id: %s", id);
                reject('server_error');
            } else {
                if (expiresIn) {
                    self.client.expire(id, expiresIn, function(er, res) {
                        if (er || !res) {
                            logger.error("Redis error setting expiration on hash by id: %s", id);
                            reject('server_error');
                        } else { resolve(obj); }
                    })
                } else {
                    resolve(obj);
                }
            }
        });
    });
};

redisCache.prototype.updateObjectById = function(id, obj) {
    if (!id || !obj) { return Promise.reject('invalid_request'); }
    var self = this;
    return new Promise(function(resolve, reject) {
        self.hexists(id, function(err, result) {
            if (err) {
                logger.error("Redis error checking existance of hash by id: %s", id);
                reject('server_error');
            } else if (!result) {
                reject('Object does not exist');
            } else {
                self.client.hmset(id, obj, function(err, result) {
                    if (err || !result) {
                        logger.error("Redis error updating hash by id: %s", id);
                        reject('server_error');
                    } else {
                        resolve(obj);
                    }
                });
            }
        })
    });
};

redisCache.prototype.getStringById = function(id) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.client.get(id, function(err, result) {
            if (err) {
                logger.error("Redis error requesting string by id: %s", id);
                reject('server_error');
            } else {
                resolve(result);
            }
        });
    });
};

redisCache.prototype.setStringById = function(id, value, expiresIn) {
    function onResult(resolve, reject) {
        return function (err, result) {
            if (err || !result) {
                logger.error("Redis error requesting string by id: %s", id);
                reject('server_error');
            } else {
                return resolve(value);
            }
        };
    }
    var self = this;
    return new Promise(function(resolve, reject) {
        if (!expiresIn) {
            self.client.set(id, value, onResult(resolve, reject));
        } else {
            self.client.set(id, value, 'EX', expiresIn, onResult(resolve, reject));
        }
    });
};

redisCache.prototype.deleteById = function(id) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.client.expire(id, 0, function(err, result) {
            if (err) {
                logger.error("Redis error expiring value by id: %s", id);
                reject('server_error');
            } else {
                return resolve(!!result ? value : self.failed);
            }
        });
    });
};

redisCache.prototype.addToSet = function(id, value, expiresIn) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.client.sadd(id, value, function(err, result) {
            if (err) {
                logger.error("Redis error adding value to set: %s", id);
                reject('server_error');
            } else {
                if (expiresIn) {
                    self.client.expire(id, expiresIn, function(er, res) {
                        if (er || !res) {
                            logger.error("Redis error setting expiration on hash by id: %s", id);
                            reject('server_error');
                        } else { resolve(value); }
                    })
                } else {
                    resolve(value);
                }
            }
        });
    });
};

redisCache.prototype.getSetMembers = function(id) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.client.smembers(id, function(err, result) {
            if (err) {
                logger.error("Redis error adding value to set: %s", id);
                reject('server_error');
            } else {
                resolve(result);
            }
        });
    });
};

redisCache.prototype.deleteFromSet = function(id, value) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.client.srem(id, value, function(err, result) {
            if (err) {
                logger.error("Redis error adding value to set: %s", id);
                reject('server_error');
            } else {
                resolve(result);
            }
        });
    });
};

redisCache.prototype.isMemberOfSet = function(id, value) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.client.sismember(id, value, function(err, result) {
            if (err) {
                logger.error("Redis error checking value in set: %s", id);
                reject('server_error');
            } else {
                return resolve(!!result);
            }
        });
    });
};

redisCache.prototype.removeFromSet = function(id, value) {
    var self = this;
    return new Promise(function(resolve, reject) {
        this.client.srem(id, value, function(err, result) {
            if (err) {
                logger.error("Redis error removing value from set: %s", id);
                reject('server_error');
            } else {
                return resolve(!!result ? result : self.failed);
            }
        });
    });
};

redisCache.prototype.getTTL = function(id) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.client.ttl(id, function(err, result) {
            if (err) {
                logger.error("Redis error checking ttl value: %s", id);
                reject('server_error');
            } else {
                return resolve(!!result && result > 0 ? result : 0);
            }
        });
    });
}

redisCache.prototype.expire = function(id, expireIn) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.client.expire(id, expireIn, function(err, result) {
            if (err) {
                logger.error("Redis error deleting item: %s", id);
                reject('server_error');
            } else {
                return resolve(result);
            }
        });
    });
}

module.exports = {
    createClient: createClient,
    redisCache: redisCache
};


