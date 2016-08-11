/**
 * Created by valev on 2016-02-11.
 */
"use strict";

var logger = require('./logger').getLogger({console: {}}),
    mongoose = require('mongoose'),
    _ = require('lodash');

var manager = {
    namedConnections: {},
    //adds default connection, if it doesn't exist yet
    init: function(connString, options, seedFn) {
        if (mongoose.connection.name) { return mongoose.connection; }

        mongoose.connect(connString, options, seedFn);
        onConnectionCreate(mongoose.connection, connString);

        return mongoose.connection;
    },
    //adds named connection, if it doesn't exist yet
    addConnection: function(connString, options, name) {
        if (!name) { return this.init(connString, options); }
        if (!!this.namedConnections[name]) { return this.namedConnections[name]; }

        var conn = mongoose.createConnection(connString, options);
        this.namedConnections[name] = conn;
        onConnectionCreate(conn, connString);

        return conn;
    },
    shutdown: function(msg) {
        _.forIn(this.namedConnections, function(value, key) {
            gracefulShutdown(value, msg);
        });
        gracefulShutdown(mongoose.connection, msg, function () {
                process.exit(0);
            });
    }
}

function onConnectionCreate(conn, connString) {// CONNECTION EVENTS
    conn.on('connected', function (err, d) {
        logger.info('Mongoose connected to ' + connString);
    });

    conn.on('error',function (err) {
        logger.error('\x1b[31m', 'Could not connect to MongoDB: ' + connString);
        logger.info(err);
    });

    conn.on('disconnected', function () {
        logger.debug('Mongoose disconnected: ' + connString);
    });
}

// CAPTURE APP TERMINATION / RESTART EVENTS
// To be called when process is restarted or terminated
function gracefulShutdown(conn, msg, callback) {
    conn.close(function () {
        logger.debug('Mongoose disconnected through ' + msg);
        if (callback) { callback(); }
    });
}
process.on('SIGINT', function() {// app termination
    manager.shutdown('app termination');
});
process.on('SIGTERM', function() {// Heroku app termination
    manager.shutdown('Heroku app shutdown');
});

module.exports = manager;


