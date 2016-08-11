/**
 * Created by valev on 2016-05-05.
 */
var inProcess = new Map();

function get(id) {
    return inProcess.get(id);
}

function set(id, value) {
    return inProcess.set(id, value);
}

function clear(id) {
    return inProcess.delete(id);
}

function initACGF(req, res, state, value) {
    if (req.cookies.igf) { res.clearCookie('igf'); }
    set(state, value);
    res.cookie('acgf', state);
}

function getACGFState(req) {
    return get(req.cookies.acgf);
}

function clearACGF(res, state) {
    clear(state);
    res.clearCookie('acgf');
}

function inACGF(req, res) {
    var state = get(req.cookies.acgf);
    if (!!req.cookies.acgf && !state) { res.clearCookie('acgf'); }
    return !!state;
}

function initIGF(req, res, state, value) {
    if (req.cookies.agf) { res.clearCookie('acgf'); }
    set(state, value);
    res.cookie('igf', state);
}

function getIGFState(req) {
    return get(req.cookies.igf);
}

function clearIGF(res, state) {
    clear(state);
    res.clearCookie('igf');
}

module.exports = {
    get: get,
    set: set,
    clear: clear,
    initACGF: initACGF,
    getACGFState: getACGFState,
    clearACGF: clearACGF,
    inACGF: inACGF,
    initIGF: initIGF,
    getIGFState: getIGFState,
    clearIGF: clearIGF
};