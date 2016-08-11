'use strict';
var winston = require('winston');
//TBD: setting handleExceptions=true causes memory leak
function getTransports(opts) {
    var options = opts || {},
        fileOptions = options.file,
        consoleOptions = options.console || {},
        transports = [new winston.transports.Console({
            level: consoleOptions.level || 'debug',
            handleExceptions: typeof consoleOptions.handleExceptions !== 'undefined' ? consoleOptions.handleExceptions : false, //true,
            json: typeof consoleOptions.json !== 'undefined' ? consoleOptions.json : false,
            colorize: typeof consoleOptions.colorize !== 'undefined' ? consoleOptions.colorize : false,
            timestamp: function() {return new Date().toLocaleString(); },
            formatter: function(options) { // Return string will be passed to logger.
                return options.timestamp() +' - ['+ options.level.toUpperCase() +'] - '+ (undefined !== options.message ? options.message : '') +
                    (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
            },
            prettyPrint: true
        })];

    if (fileOptions) {
        transports.push(new winston.transports.File({
            level: fileOptions.level || 'warning',
            filename: fileOptions.filename || 'log.log',
            handleExceptions: typeof fileOptions.handleExceptions !== 'undefined' ? fileOptions.handleExceptions : true,
            json: typeof fileOptions.json !== 'undefined' ? fileOptions.json : true,
            maxsize: fileOptions.maxsize || 5242880, //5MB
            maxFiles: fileOptions.maxFiles || 5,
            colorize: typeof fileOptions.colorize !== 'undefined' ? fileOptions.colorize : false,
            eol: 'rn',
            timestamp: true
        }));
    }
    return transports;
}

function getLogger(options) {
    return new winston.Logger({
        transports: getTransports(options),
        exitOnError: false
    })
}

module.exports = {
    default: winston,
    getLogger: getLogger,
    stream: {
        write: function(message){
            getLogger({level: 'info', filename: 'logs/all-logs.log'}).info(message);
        }
    }
};