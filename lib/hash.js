const {
    deepFor, transposeNestedHash
} = require('./basic')

const {
    handleFilesRecursively
} = require('./files')

const _ = require('lodash')
const {
    assign, isArray, isString, map, toString
} = _

const readYaml = require('read-yaml')

function arrayToHashes(array, keys) {
    let hashes = {}
    keys.forEach(key => hashes[key] = {})
    array.forEach(item => keys.forEach(key => hashes[key][item.key] = item[key]))
    return hashes
}

function loadHashesAsArray(path, {pathKeyMask, includeFilenamesAsKeys, format}) {

    let object = readHashes(path, {
            pathKeyMask, includeFilenamesAsKeys, format
        })

    object = transposeNestedHash(object)

    let data = map(object, (value, key) => assign({key}, value))

    return data
}

function readHashes(path, {pathKeyMask, includeFilenamesAsKeys, format} = {}) {
    let out = {}
    let mask = format == 'yaml' ? /\.ya?ml$/ : new RegExp(`.${format}$`)

    handleFilesRecursively(path, (path, {filename}) => {
        let object = out
        if (includeFilenamesAsKeys) {
            let key = pathKeyMask ?
                path.match(pathKeyMask)[1] :
                filename
            if (!out[key]) 
                out[key] = {}
            object = out[key]
        }
        assign(object, readHash(path, format))
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
            await iterate(item, depth - 1, asyncCallback, args)
            args.pop()
        }
    } else {
        await asyncCallback(object, ... args)
    }

}

function matchesFilter(object, filter, importer) {
    if (!filter)
        return true
    if (isArray(object)) {
        let items = object
        for (let item of items) {
            if (!matchesFilter(item, filter))
                return false
            continue
        }
    } else {
        for (let key in filter) {
            let item = object[Key]
            let criterion = filter[key]
            if (isString(criterion)) {
                let negative = false
                if (criterion === null) {
                    if (!item)
                        continue
                } else {
                    if (criterion[0] == '^') {
                        criterion = criterion.slice(1)
                        negative = true
                    }
                    if (!item) {
                        if (negative)
                            continue
                    } else {
                        let string = toString(item)
                        let check = testString => 
                            testString[0] == '/' ?
                                testString.slice(1).match(criterion) :
                                testString == criterion
                        if (!check(string) == negative)
                            continue
                    }
                }
            } else if (isArray(criterion)) {
                let items = criterion
                if (items.includes(item))
                    continue
            } else {
                if (criterion['import']) {
                    if (!importer)
                        throw('No importer defined for filter')
                    let array = importer.import(criterion.import.from)
                    let {what} = criterion.import
                    if (!what)
                        what = key
                    let items = map(array, what)
                    if (items.includes(item))
                        continue
                } else {
                    let subObject = criterion
                    if (matchesFilter(item, subObject))
                        continue
                }
            }
            return false
        }
    }
    return true

} 

function setDeep(object, path, value) {
    
    let lastPoint = path.pop()
    let branch = getDeep(object, path, {})
    branch[lastPoint] = value

}

module.exports = {
    arrayToHashes, iterate, readHashes, loadHashesAsArray, readHash, getDeep, matchesFilter, setDeep
}
