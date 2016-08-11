"use strict";

//if error is string
var GeneralError = function(message, code, error, desc) {
        this.error = error;
        this.name = "GeneralError";
        this.code = code;
        this.desc = desc;
        this.message = message || this.error.message;
        this.isError = true;
    },
    BadRequestError = function BadRequestError(message, error, desc) {
        GeneralError.call(this, message, 400, error, desc);
        this.name = "BadRequestError";
        this.status = 400;
    },
    NotFoundError = function NotFoundError(message, error, desc) {
        GeneralError.call(this, message, 404, error, desc);
        this.name = "NotFoundError";
        this.status = 404;
    },
    InternalError = function InternalError(message, error, desc) {
        GeneralError.call(this, message, 500, error, desc);
        this.name = "InternalError";
        this.status = 500;
    },
    UnauthorizedAccessError = function( message, error, desc) {
        GeneralError.call(this, message, 401, error, desc);
        this.name = "UnauthorizedAccessError";
        this.status = 401;
    };

GeneralError.prototype.isInternalError = function() {
    return Number.isInteger(this.status) && this.status >= 500;
}

NotFoundError.prototype = Object.create(GeneralError.prototype);
NotFoundError.prototype.constructor = NotFoundError;

UnauthorizedAccessError.prototype = Object.create(GeneralError.prototype);
UnauthorizedAccessError.prototype.constructor = UnauthorizedAccessError;

InternalError.prototype = Object.create(GeneralError.prototype);
InternalError.prototype.constructor = InternalError;

BadRequestError.prototype = Object.create(GeneralError.prototype);
BadRequestError.prototype.constructor = BadRequestError;

module.exports = {
    NotFoundError: NotFoundError,
    UnauthorizedAccessError: UnauthorizedAccessError,
    GeneralError: GeneralError,
    InternalError: InternalError,
    BadRequestError: BadRequestError
};