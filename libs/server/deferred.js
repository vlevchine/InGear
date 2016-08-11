function Deferred(time) {
    var self = this,
        promise = new Promise(function(resolve, reject) {
            self._resolver = resolve;
            self._rejector = reject;
        });

    Object.defineProperty(this, 'promise', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: promise
    });

    if (!!time) {
        setTimeout(function() {
            self.reject('Timeout');
        }, time);
    }

    //if (typeof callback === 'function')
    //    callback.call(this, this._resolver, this._rejector);
}

Deferred.prototype.resolve = function(resolution) {
    this._resolver.call(null, resolution);
    return this;
};
Deferred.prototype.reject = function(rejection) {
    this._rejector.call(null, rejection);
    return this;
};

Deferred.defer = function(time) {
    return new Deferred(time);
};

module.exports = Deferred;
