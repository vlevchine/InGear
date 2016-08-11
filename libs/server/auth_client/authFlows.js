/**
 * Implements Auth2 flows: ACG, IG and refresh
 */
var _ = require('lodash'),
    request = require('request'),
    jwt = require('jsonwebtoken'),
    uuid = require('node-uuid'),
    utils = require('../utils'),
    security = require('../security'),
    logger = require('../logger').getLogger(),
    stateManager = require('./stateManager'),
    cache = require('./localCache');

var secret = 'secret', config,
    errorText = 'Internal application error running authentication. Please contact your system administrator.';

function init(conf) {
    config = conf;
}

function authCodeGrantFlowStart(req, res, options) {//options is expected {baseURL, subject}, e.g scope=user@comp
    var redirectURI = config.baseURL,// + config.endpoints.exchange, //subject = security.base64Encode(options.id),
        state = uuid.v4(),
        scope = Object.keys(config.useServices).join(' '),
        url = config.as.baseURL + config.as.endpoints.authorize + utils.toQueryString({ response_type: 'code',
                client_id: config.registeredClient.client_id, redirect_uri: redirectURI,
                scope: scope, state: state
            });

    stateManager.initACGF(req, res, state, {scope: scope, redirect_uri: redirectURI, page_uri: options.pageURI});
    logger.debug('%s: ACGF started, code request sent', config.clientId);

    res.redirect(url);
}

function authCodeGrantFlowExchange(req, res, next) {
    var query = req.query,
        state = req.cookies.acgf,
        flow = stateManager.get(state),
        headers = utils.createAuthHeader(config.registeredClient.client_id, config.registeredClient.client_secret);
    res.clearCookie('acgf');
    if (query.error || !flow || query.state !== security.hmac(state, config.registeredClient.salt)) {
        res.cookie('error', errorText);
    }
    logger.debug('%s: ACGF - sending request for token', config.clientId);
    request.post({url: config.as.baseURL + config.as.endpoints.token, headers: headers, form: {
            grant_type: 'authorization_code', code: query.code,
            client_id: config.registeredClient.client_id, redirect_uri: flow.redirect_uri} },
        function(error, response, body) {
            stateManager.clearACGF(res, state);
            var data = body ? JSON.parse(body) : '',
                url = config.baseURL + flow.page_uri;

            if (error || !data || data.error) {
                logger.error('Auth error on token request: ', error);
                res.cookie('error', errorText);
                res.redirect(url);
            } else {
                var decoded = jwt.decode(data.id_token);
                cache.saveSession(security.base64Decode(decoded.sub), Object.assign(decoded, {refresh_token: data.refresh_token}),
                    data.expires_in).then(() => {//age in ms
                    res.cookie('subject', decoded.sub, {httpOnly: true, maxAge : data.expires_in*1000});
                    logger.debug('%s: ACGF - code exchanged for token, redirecting to source url: %s', config.clientId, url);
                    res.redirect(url);
                }, err => {
                    res.cookie('error', errorText);
                    res.redirect(url);
                });
            }
        });
}

function startImplicitGrantFlow(req, res, options) {
    var state = uuid.v4(),
        payload = { response_type: 'token', client_id: config.registeredClient.client_id,
            redirect_uri: config.baseURL + options.pageURI,
            scope: req.cookies.subject, state: state
        },
        url = config.as.baseURL + config.as.endpoints.authorize + utils.toQueryString(payload);

    stateManager.initIGF(req, res, state, payload);
    logger.debug('%s: IGF started, sending request to Authorization server', config.clientId);
    res.redirect(url);
}

function finishImplicitGrantFlow(req, res) {
    var cached = stateManager.get(req.cookies.igf);
    stateManager.clearIGF(res, req.cookies.igf);

    return cache.retrieveSession(security.base64Decode(req.cookies.subject))
        .then(session => {
            logger.debug('%s: IGF finished - serving request from browser', config.clientId);
            return { session: Object.assign(session, {
                challenge: security.hmac(cached.state, config.registeredClient.salt)}) };
        })
        .catch(err => {return {error: errorText}; });

}

function refreshFlow(req, res) {
    var subject = security.base64Decode(req.cookies.subject);

    cache.retrieveSession(subject)
        .then(session => {
            if (!session) {
                logger.error('No session found for existing subject.', subject);
                throw errorText;
            }
            request.post({url: config.as.baseURL + config.as.endpoints.refreshToken, headers:
                    utils.createAuthHeader(config.registeredClient.client_id, config.registeredClient.client_secret),
                    form: {grant_type: 'refresh_token', refresh_token: session.refresh_token, scope: req.cookies.subject}},
                function(error, response, body) {
                    if (error) {
                        logger.error('Auth error on IGF request: ', error);
                        throw 'AS communication error';
                    } else {
                        res.json(body);
                    }
                });
        })
        .catch(err => res.status(500).json({error: 'Internal server error.'}));
}

module.exports = {
    init: init,
    startImplicitGrantFlow: startImplicitGrantFlow,
    finishImplicitGrantFlow: finishImplicitGrantFlow,
    authCodeGrantFlowStart: authCodeGrantFlowStart,
    authCodeGrantFlowExchange: authCodeGrantFlowExchange,
    refreshFlow: refreshFlow
};