/**
 * Created by valev on 2016-03-23.
 */
var _ = require('lodash'),
    security = require('./security');

function createNonce() {
    return security.randomString(12);
}

function createExchangeCode() {
    return security.randomString(48);
}

function formAuthRequest(redirect, clientId, sub) {
    return Object.assign({
        response_type: 'id_token token',
        nonce: security.randomString(12),
        state: security.randomString(12)
    }, {clientId: clientId, redirect_uri: redirect, sub: sub});
}

function requestToURI(authEndpoint, req) {
    return encodeURI(authEndpoint + '?' +
        _.toPairs(req).map(e => e.join('=')).join('&'));

    //&client_id=s6BhdRkqt3
    //&redirect_uri=https%3A%2F%2Fclient.example.org%2Fcb
    //&scope=openid%20profile
    //&state=af0ifjsldkj
    //&nonce=n-0S6_WzA2Mj`
    //'subject=anonym&redirect=/
}



function getTokenSubject(token) {
    if (!token) { return false; }

    //parse token, get sub field
    return false;
}

function id_tokenValid(token) {
    if (!token) { return false; }

    //parse token, get exp time if still 10 sec to live return true
    return false;
}

function getSessionBySubject(sub) {
    var empty = { subject: ''};
    if (!sub) { return empty; }

    //parse token, get subject, fetch session from SessionCache by subject
    // return {subject, id_token, expires}
    return empty;
}

function getSessionByToken(token) {
    return getSessionBySubject(getTokenSubject(token));
}

function validateId_token(token, options) {
    return true;
}

module.exports = {
    createNonce: createNonce,
    getTokenSubject: getTokenSubject,
    id_tokenValid: id_tokenValid,
    getSessionBySubject: getSessionBySubject,
    getSessionByToken: getSessionByToken,
    formAuthRequest :  formAuthRequest,
    requestToURI: requestToURI,
    validateId_token: validateId_token
};