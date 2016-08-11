/**
 * Messages are converted to objects which should contain 'sender' field
 * duplex messages should be checked by nonce
 */

var _ = require('lodash'),
    uuid = require('node-uuid'),
    security = require('./security'),
    redisClient = require('./redisClient'),
    logger = require('./logger').getLogger(),
    D = require('./deferred'),
    MASTER_INIT = 'master_init';

//Channel class
function Channel(name, sender, duplex, cb) {
    this.name =  name;
    this.sender = sender;
    this.duplex = duplex;
    this.cb = cb;
}

Channel.prototype.resetCallback = function(cb) {
    this.cb = cb;
    return this;
};

Channel.wrapMessage = function(msg, sender) {
    var body = _.isString(msg) ? { message: msg } : msg;
    body.sender = sender || 'NA';
    return body;
};

Channel.prototype.wrapMessage = function(msg) {
    return Channel.wrapMessage(msg, this.sender);
};

Channel.prototype.destroy = function() {
    this.cb = null;
};
//This check is for duplex messages only!!!
Channel.prototype.payloadValid = function(payload) {
    return this.sender === payload.from && payload.duplex &&
        this._nonce === payload.nonce;
};

Channel.prototype.publish = function(conn, payload) {
    if (this.duplex) {
        this._nonce = uuid.v1();
        payload.nonce = this._nonce;
        payload.published = Date.now();
        payload.duplex = this.name + payload.published;
    }
    conn.publish(this.name, JSON.stringify(this.wrapMessage(payload)));

    return payload;
};

Channel.prototype.process = function(conn, payload) {
    if (!this.cb) { throw 'No callback defined for channel'; }
    var nonce = payload.nonce,
        self = this;
    if (this.duplex && !this.payloadValid(payload)) { throw 'Invalid payload'}

    Promise.resolve(this.cb(null, payload))
        .then(function(res) {
            self._nonce = null;
            //if callback returns value and there's nonce in a message = it's req/res, so send res back
            if (res && nonce) {
                conn.publish(payload.duplex, JSON.stringify(Object.assign(res, {
                    from: payload.sender, nonce: payload.nonce, duplex: payload.duplex, recipient: self.name})));
            }
        }).catch(function(err) {
        logger.error('Error processing request: ' + err)
    });
};

Channel.prototype.for = function(name) {
    return this.name === name;
};

///////////////////
function AppConnector(config, clientId) {
    this.reader = redisClient.createClient(config, 'Reader_'+clientId);
    this.writer = redisClient.createClient(config, 'Writer_'+clientId);
    this.clientId = clientId;
    this.channels = [];

    var self = this;
    this.reader.on("message", function (channelName, message) {
        var payload = JSON.parse(message),
            channel = self.findChannel(payload.recipient || channelName);
        if (payload.duplex) {//one-time topic name, don't use it anymore
            self.reader.unsubscribe(payload.duplex);
            clearTimeout(channel.timeout);
        }
        if (channel) {
            channel.process(self.writer, payload);
        }
    });
}

AppConnector.prototype.findChannel = function(name) {
    return this.channels.find(function(e) { return e.for(name ); });
};

AppConnector.prototype.getChannel = function(name, duplex) {
    var channel = this.findChannel(name) || new Channel(name, this.clientId, duplex);
    this.channels.push(channel);
    return channel;
};

AppConnector.prototype.close = function() {
    this.channels.forEach(function(e) { e.destroy(); });
    this.reader.unsubscribe();
    this.reader.quit();
    this.writer.quit();
    this.reader = null;
    this.writer = null;
};

//send and forget - no need for specific channel
AppConnector.prototype.sendOneWay = function(channelName, data) {
    return this.getChannel(channelName).publish(this.writer, data);
};

//subscription to one-way messages
AppConnector.prototype.subscribeTo = function(channel, cb) {
    if (!channel || !cb) { throw 'App connector subscription paramemeter missing.'; }
    this.getChannel(channel).resetCallback(cb);
    this.reader.subscribe(channel);
    return this;
};
AppConnector.prototype.unsubscribeFrom = function(channel) {
    if (!channel) { throw 'App connector subscription paramemeter missing.'; }
    this.reader.unsubscribe(channel);
    var ch = this.getChannel(channel);
    if (ch) {
        ch.destroy();
        _.remove(this.channels, ch);
    }
    return this;
};

//send / expect response
AppConnector.prototype.sendReply = function(channelName, data, cb, timeout) {
    if (!channelName || !cb) { throw 'App connector sender channel missing.'; }

    var self = this,
        replyTo = 'tmp_'+channelName,
        timeout = setTimeout(function() {
            cb(new Error('No response'));
        }, timeout || 2000);

    this.reader.subscribe(replyTo, dt => {
       self.reader.unsubscribe(replyTo);
        clearTimeout(timeout);
        cb(null, dt);
    });

    this.writer.publish(channelName, Object.assign(data, {replyTo: replyTo}) );
};

AppConnector.prototype.subscribeToMaster = function(cb) {
    this.subscribeTo(MASTER_INIT, cb)
};

AppConnector.prototype.sendToMaster = function(data) {
    this.sendOneWay(MASTER_INIT, data)
};

module.exports = AppConnector;




