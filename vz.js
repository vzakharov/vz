const json2csv = require('json2csv')
const csv2json = require('csvtojson')
const fs = require('fs')

const _ = require('lodash')
const {
    assign, find, map, pullAt, remove
} = _

const {
    deepFor, getDiff, sleep, lastDefined
} = require('./lib/basic')

const {
    handleFilesRecursively, renameRecursively
} = require('./lib/files')

const {
    arrayToHashes, iterate, loadHashes, loadHashesAsArray, matchesFilter, readHash, getDeep, renameKeys, setDeep
} = require('./lib/hash')

const Select = require('./lib/select')

const AsyncIterable = require('./lib/asyncIterable')

const setGetters = (object, getters) => {
    for (let key in getters) {
        Object.defineProperty(object, key, {get: () => getters[key]})
    }
}

module.exports = {
    deepFor, getDiff, sleep, matchesFilter, lastDefined,
    handleFilesRecursively, renameKeys, renameRecursively,
    arrayToHashes, iterate, loadHashes, loadHashesAsArray, readHash, getDeep, setDeep, 
    Select, AsyncIterable, setGetters
}