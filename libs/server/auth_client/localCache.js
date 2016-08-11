/**
 * Created by valev on 2016-03-31.
 */
var redisClient = require("../redisClient"),
    logger = require('../logger').getLogger();

var client, SESSION_PRX;

function toSessionId(id, prefix){
    return (prefix || SESSION_PRX) + ':' + id.replace('@', ':');
}

function init(config) {
    client = redisClient.createClient(config.redis, 'LocalSessionCache:'+config.clientId);
    SESSION_PRX = config.clientId;
}

function saveSession(id, data, expiresIn) {
    var sessionId = toSessionId(id);
    return client.hmsetAsync(sessionId, data)
        .then(function (result) {
            if (!result) { throw 'Failed to write token into redis'; }
            return client.expireAsync(sessionId, expiresIn);
        })
        .then(function(reply) {
            if (!reply) { throw 'Failed to set token expiration in redis'; }
            return data;
        })
        .catch(err => {
            logger(error, 'Failed to write token into redis', err);
            throw 'Internal server error, please contact your system administrator.'
        });
}

function retrieveSession(id) {
    return client.hgetallAsync(toSessionId(id))
        .catch(function(err) {
            logger(error, 'Failed to retrieve token from redis', err);
            throw 'Internal server error, please contact your system administrator.'
        });
}

function sessionExists(id) {
    return client.existsAsync(toSessionId(id));
}

function deleteSession(id) {
    return client.hgetallAsync(toSessionId(id))
        .then(function(result) {
            if (!result) {
                throw "Session doesn't exists, it may have been expired or revoked";
            }
            return result;
        }, function(err) {
            logger(error, 'Failed to retrieve token from redis', err);
            throw 'Internal server error, please contact your system administrator.'
        });
}

module.exports = {
    init: init,
    saveSession: saveSession,
    retrieveSession: retrieveSession,
    sessionExists: sessionExists,
    deleteSession: deleteSession
}