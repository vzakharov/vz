const {
    deepFor, transposeNestedHash
} = require('./basic')

const {
    handleFilesRecursively
} = require('./files')

const _ = require('lodash')
const {
    assign, map
} = _

const readYaml = require('read-yaml')

function arrayToHashes(array, keys) {
    let hashes = {}
    keys.forEach(key => hashes[key] = {})
    array.forEach(item => keys.forEach(key => hashes[key][item.key] = item[key]))
    return hashes
}

function loadHashesAsArray(path, {pathKeyMask, format}) {

    let object = readHashes(path, {
            pathKeyMask, format
        })

    object = transposeNestedHash(object)

    let data = map(object, (value, key) => assign({key}, value))

    return data
}

function readHashes(path, {pathKeyMask, format} = {}) {
    let out = {}
    let mask = format == 'yaml' ? /\.ya?ml$/ : new RegExp(`.${format}$`)

    handleFilesRecursively(path, (path, {filename}) => {
        let key = pathKeyMask ?
            path.match(pathKeyMask)[0] :
            filename
        if (!out[key]) out[key] = {}
        assign(out[key], readHash(path))
    }, {mask})

    return out
}

function readHash(path, format) {
    console.log(`Reading ${path}...`)
    try {
        if (format == 'yaml') {
            return readYaml.sync(path)
        } else {
            return require(path)
        }
    } catch (error) {
        console.log(`Caught an error while loading:`)
        console.log(error)
        if (format == 'yaml') {
            console.log(`Trying with less trict options...`)
            return readYaml.sync(path, {json: true})    
        } else {
            throw(error)
        }
    } finally {
        console.log('\tDone.')
    }
}

function getDeep(object, path, defaultValue) {

    if (typeof path == 'string') path = path.split('.')
    let lastPoint = path.pop()

    for (let point of path) {
        if (!object[point]) {
            object[point] = {}
        }
        object = object[point]
    }

    if (!object[lastPoint]) object[lastPoint] = defaultValue

    return object[lastPoint]

}

async function iterate(object, depth, asyncCallback, args = []) {

    if (depth > 0) {
        for (let key in object) {
            console.log(`Level ${depth}: ${key}`)
            args.push(key)
            await iterate(object[key], depth - 1, asyncCallback, args)
            args.pop()
        }
    } else {
        await asyncCallback(object, ... args)
    }

}

function setDeep(object, path, value) {
    
    let lastPoint = path.pop()
    let branch = getDeep(object, path, {})
    branch[lastPoint] = value

}

module.exports = {
    arrayToHashes, iterate, readHashes, loadHashesAsArray, readHash, getDeep, setDeep
}
