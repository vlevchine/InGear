'use strict';

var _ = require('lodash'),
    jsonwebtoken = require('jsonwebtoken'),
    utils = require('./utils'),
    errors = require('./errors'),
    logger = require('./logger').getLogger(),
    client = require('./redisClient'),
    config = require('../config/config');

var TOKEN_EXPIRATION = utils.toMinutes(config.sessionValid),
    TOKEN_KEEP_ALIVE = 4 * TOKEN_EXPIRATION,
    TOKEN_KEEP_ALIVE_SEC = TOKEN_KEEP_ALIVE * 60;

//Folloowing are service methods, not middleware
//Find the authorization headers from the headers in the request
module.exports.fetchTokenFromHeaders = function (headers) {
    if (headers && headers.authorization) {
        var authorization = headers.authorization;
        var part = authorization.split(' ');
        return part.length === 2 ? part[1]: null;
    } else { return null; }
};

// Expires the token, so the user can no longer gain access to the system, without logging in again or requesting new token
module.exports.expire = function (headers) {
    var token = exports.fetchToken(headers);
    logger.debug("Expiring token: %s", token);
    if (!!token) {
        client.expire(token, 0);
    }
    return !!token;
};

// Creates a new token for the user that has been logged in
module.exports.createSession = function (data, keepIdToken) {
    if (_.isEmpty(data)) {
        return cb(new errors.GeneralError(400, 'Insufficient data.'));
    }
    var access_token = jsonwebtoken.sign({ _id: data._id }, config.sessionSecret, { expiresInMinutes: TOKEN_EXPIRATION }),
        decoded = jsonwebtoken.decode(access_token);
    data.token_exp = decoded.exp;
    data.token_iat = decoded.iat;
    if (!keepIdToken) {//this will be used for key/value consistency check upon retrieval
        data.id_token = jsonwebtoken.sign(data, config.sessionSecret);
    }

    return client.setAsync(access_token, JSON.stringify(data))
        .then(function (result) {
                if (!result) { throw new errors.GeneralError(500, 'Failed to write token into redis');}
                return client.expireAsync(access_token, TOKEN_KEEP_ALIVE_SEC);
            })
        .then(function(reply) {
                if (!reply) { throw new errors.GeneralError('Failed to set token expiration in redis')}
                return {id_token: data.id_token, access_token: access_token};
            })
        .catch(function(err) {
            if (err.name === "GeneralError") { throw err; }
            throw new errors.GeneralError(500, err);
        });
};

//Fetch the token from redis for the given key
module.exports.retrieve = function (access_token, done) {
    if (!access_token) {
        return done(new errors.GeneralError(400, "token_invalid"), { message: "No token provided as input" });
    }
    client.getAsync(access_token)
        .then(function(result) {
            if (!result) {
                return done(newerrors.GeneralError(400, "token_invalid"), {
                    message: "Token doesn't exists, it may have been expired or revoked"
                });
            } else {
                var data = JSON.parse(result);
                if (jsonwebtoken.decode(access_token)._id === data._id) {//check if key/value consistent
                    return done(null, data);
                } else {
                    return done(new errors.GeneralError(400, "token_doesnt_exist"), {
                        message: "Token doesn't exists, login into the system so it can generate new token."
                    });
                }
            }
        })
        .catch(function(err) {
            return done(err, { message: err });
        });
};


//Follwong are middleware methods
//Verifies that the token supplied in the request is valid, by checking the redis store to see if it's stored there.
module.exports.verify = function (req, res, next) {
    var token = exports.fetchToken(req.headers);
    jsonwebtoken.verify(token, config.sessionSecret, function (err, decode) {
        if (err) {
            req.user = undefined;
            return next(new errors.UnauthorizedAccessError("invalid_token"));
        }
        exports.retrieve(token, function (err, data) {
            req.user = undefined;
            if (err) {
                return next(new errors.UnauthorizedAccessError("invalid_token", data));
            }
            if (data.token_exp > (new Date().valueOf() / 1000)) {
                return next(new errors.UnauthorizedAccessError("expired_token", data));
            }

            req.user = data;
            next();
        });
    });
};

module.exports.renew = function (req, res, next) {
    var access_token = exports.fetchToken(req.headers),
        id_token = req.headers ? req.headers['x-requested-with'] : '';
    if (!id_token) { utils.sendJSON(res, 400, {message: 'Bad request: id_token missing when requesting to renew token'}); }

    exports.retrieve(access_token, function (err, data) {
        if (err) {
            req.user = undefined;
            utils.sendJSON(res, 404, {
                message: 'No data found for provided token, login into the system so it can generate new token.'});
        } else {//clean retrieved data and create a new session
            delete data.token_exp;
            delete data.token_iat;
            client.del(access_token);
            exports.createSession(data, true)
            .then(function(dt) {
                utils.sendJSON(res, 200, dt.access_token);
            }, function(err) {
                utils.sendJSON(res, 404, {
                    message: "Access and ID tokens don't match, login into the system so it can generate new token." });
            });
        }
    });
};

// Middleware for getting the token into the user
module.exports.authorize = function (accessLevel) {
    var func = function (req, res, next) {
        var token = exports.fetchToken(req.headers);
        exports.retrieve(token, function (err, data) {
            req.user = undefined;
            var current = new Date().valueOf() / 1000,
                sufficient = true;//!accessLevel || (data.claims & accessLevel === accessLevel);
            if (err) {
                utils.sendJSON(res, 401, data);
            } else if (data.token_exp < current) {
                utils.sendJSON(res, 412, {message: "Request unauthorized (access token expired)"});
            }  else if (!sufficient) {
                utils.sendJSON(res, 403, {message: "Request unauthorized (insufficient claims)"});
            } else {
                req.user = _.merge(req.user || {}, data);
                next();
            }
        });
    };
    func.unless = require("express-unless");
    return func;
};
