/**
 * Implements middleware for client side of OAuth flows (see readme.md)
 * This is the ONLY object exposed to outside - must run init to activate identityManager and
 */
var express = require('express'),
    request = require('request'),
    utils = require('../utils'),
    security = require('../security'),
    logger = require('../logger').getLogger(),
    authFlows = require('./authFlows'),
    stateManager = require('./stateManager'),
    cache = require('./localCache');

var secret = 'secret',
    config, connector,
    errorText = 'Internal application error running authentication. Please contact your system administrator.';

function init(conf, conn) {
    config = conf;
    connector = conn;
    cache.init(conf);
    var replyTo = conf.channels.app_start + '_' + config.clientId;
    //Ping AS, if AS running, it'll reply, if not - just wait for AS start up notification
    conn.subscribeTo(conf.channels.auth_start, function(err, dt) {
        register(dt);
    });
    conn.subscribeTo(replyTo, function(err, data) {
        if (!!data) {
            register(data);
        }
        conn.unsubscribeFrom(replyTo);
    });
    conn.sendOneWay(conf.channels.app_start, {replyTo: replyTo});
}

function register(data) {
    config.as = data;
    authFlows.init(config);
    var state = security.randomString(48);

    request.post({url: config.as.baseURL + config.endpoints.register, form: {state: state,
            client: config.clientId, pages: JSON.stringify(config.pages), title: config.title,
        services: JSON.stringify(config.useServices), baseURL: config.baseURL}},//
        function(error, response, body) {
            if (error) {//cache {sub:tokens}, broadcast {access_token,expires_in,expires_in_rt,rights:{webapi_id:rightsCode}
                logger.error("%s: Failed to connect to Authorization server", config.clientId);
            } else {
                var dt = JSON.parse(body),
                    salt = decodeURIComponent(dt.sid);
                if (security.hmac(state, salt) === dt.state) {
                    config.registeredClient = {
                        client_id: decodeURIComponent(dt.client_id),
                        client_secret: decodeURIComponent(dt.cs_hint),
                        //since Workbench is webapp which serves api, convert tid to tokenizer (for just webapp - convert to code)
                        tokenizer: security.hmac(decodeURIComponent(dt.tid), salt),
                        salt: salt,
                        credentials: function() { return this.client_id + ':' + this.client_secret; }
                    };
                    logger.info('%s registered with Authorization server', config.clientId);
                } else {
                    logger.error("Workbench: registration attempt failed");
                }
            }
    });
}

function logout(req, res, options) {
    var headers = utils.createAuthHeader(config.registeredClient.client_id, config.registeredClient.client_secret);

    logger.debug('%s: Logout - sending request for logout', config.clientId);
    request.post({url: config.as.baseURL + config.as.endpoints.clearSession, headers: headers, form: {
            grant_type: 'revoke', state: req.body.logout_state,
            client_id: config.registeredClient.client_id, subject: req.cookies.subject } },
        function(error, response, body) {
            var data = body ? JSON.parse(body) : '';

            if (error || !data || data.error) {
                logger.error('Auth error on logout: ', error);
                res.cookie('error', errorText);
                res.redirect(config.baseURL);
            } else {
                cache.deleteSession(security.base64Decode(req.cookies.subject))
                    .then(() => {
                        res.clearCookie('subject');
                        res.redirect(config.baseURL);
                    });
            }
        });
}

//This only relates to API
function onLogout(req, res) {
    var subject = security.base64Decode(req.body.subject);
    logger.debug('%s: User logged out', req.body.subject);
    //TBD: keep a set of logged users
    //now remove user from set, and res.clearCookie('subject')
}

function onError (req, res) {
    res.cookie('error', req.query.error);
    logger.error('Auth error: ', req.query.error);
    res.redirect(config.baseURL);
}

function runIGFlow(req, res, options, fnPageParams) {
    if(!req.cookies.igf) {//start IG flow
        return authFlows.startImplicitGrantFlow(req, res, options);
    } else {//IG flow is over
        authFlows.finishImplicitGrantFlow(req, res)
            .then( result => res.render(options.page,
                fnPageParams.call(null, result.error, Object.assign(result.session, options ))) );
    }
}

function runACGFlow(req, res, options, fnPageParams) {
    res.clearCookie('subject');
    if (!stateManager.inACGF(req, res)) {//start ACG flow
        authFlows.authCodeGrantFlowStart(req, res, options);
    } else {
        res.render(options.page, fnPageParams.call(null, req.cookies.error, { challenge:
            security.hmac(req.cookies.acgf, config.registeredClient.salt)}));
    }
}

module.exports = {
    init: init,
    authCodeGrantFlowExchange: authFlows.authCodeGrantFlowExchange,
    refreshFlow: authFlows.refreshFlow,
    sessionExists: cache.sessionExists,
    runIGFlow: runIGFlow,
    runACGFlow: runACGFlow,
    logout: logout,
    onLogout: onLogout,
    onError: onError
};
