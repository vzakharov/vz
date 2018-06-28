const json2csv = require('json2csv')
const csv2json = require('csvtojson')
const fs = require('fs')

const _ = require('lodash')
const {
    assign, find, map, pullAt, remove
} = _

const {
    deepFor, getDiff, sleep
} = require('./lib/basic')

const {
    handleFilesRecursively, renameRecursively
} = require('./lib/files')

const {
    arrayToHashes, iterate, loadHashes, loadHashesAsArray, readHash, getDeep, setDeep
} = require('./lib/hash')

const Select = require('./lib/select')

module.exports = {
    deepFor, getDiff, sleep,
    handleFilesRecursively, renameRecursively,
    arrayToHashes, iterate, loadHashes, loadHashesAsArray, readHash, getDeep, setDeep,
    Select
}