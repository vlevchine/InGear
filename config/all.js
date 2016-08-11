var _ = require('lodash');

var overall = _.extend({
        project: '5terre',
        channels: {
            auth_start: 'auth_start',
            app_start: 'app_start'
        },
        winston: {
            file: {
                level: 'info',
                filename: './logs/all-logs.log',
                handleExceptions: true,
                json: true,
                maxsize: 5242880, //5MB
                maxFiles: 5,
                colorize: false
            },
            console: {
                level: 'debug',
                handleExceptions: true,
                json: false,
                colorize: true
            }
        }
    }, require('./' +(process.env.NODE_ENV || 'development') ) || {});


module.exports = overall;