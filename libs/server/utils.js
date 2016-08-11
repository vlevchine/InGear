/**
 * Created by Vlad on 2015-03-21.
 */
'use strict';

var _ = require('lodash'),
    security = require('./security');

function getErrorMessage(err) {
    if (err.errors) {
        for (var errName in err.errors) {
            if (err.errors[errName].message) return err.errors[errName].
                message;
        }
    } else {
        return 'Unknown server error';
    }
}

function sendJSON(res, code, data) {
    res.set('Content-Type', 'application/json');
    res.status(code)
        .send(data);
}

function reply(res, err, data, options) {
    if (err) {
		res.status(options.status || 400).send({ message: getErrorMessage(err) });
    } else if (!data) {
        sendJSON(res, options.noDataMsg || 'no data found', options.status || 404);
    }
    res.status(options.status || 200).send(data);
}

function getURL(req, original) {
    return req.protocol + '://' + req.get('host');// + req.originalUrl;
}

function base64Encode(str) {
    return new Buffer(str).toString('base64');
}

function base64Decode(str) {
    return new Buffer(str, 'base64').toString('ascii');
}

function randomString(length) {
    "use strict";
    var ln = length || 12,
        chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
        result = '';
    for (var i = 0; i < ln; i++) {
        var rnum = Math.floor(Math.random() * chars.length);
        result += chars.substring(rnum, rnum+1)
    }

    return result;
}

function toQueryString(obj, separator) {
    return (separator || '?') +
        _.toPairs(obj)
            .filter(p => !!p[1])
            .map(p => p[0] + '=' + encodeURIComponent(p[1]) )
            .join('&')
}

function text2ua(s) {
    var ua = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) {
        ua[i] = s.charCodeAt(i);
    }
    return ua;
}

function ua2text(ua) {
    var s = '';
    for (var i = 0; i < ua.length; i++) {
        s += String.fromCharCode(ua[i]);
    }
    return s;
}

function getCredentialsFromHeaders(headers) {
    var tokens = headers.authorization ? headers.authorization.split(' ') : [],
        cTokens = tokens.length === 2 && tokens[0] === 'Basic' ?
            tokens[1].split(':') : '';
    return cTokens.length === 2 ? {id: cTokens[0], secret: cTokens[1]} : {};
}

function createAuthHeader(id, secret) {
    return {Authorization: 'Basic ' + id + ':' + secret};
}

module.exports = {
 //   asPromise: asPromise,
    getURL: getURL,
    getCredentialsFromHeaders: getCredentialsFromHeaders,
    createAuthHeader: createAuthHeader,
    sendJSON: sendJSON,
    reply: reply,
    randomString: randomString,
    toQueryString: toQueryString,
    text2ua:text2ua,
    ua2text:ua2text
};