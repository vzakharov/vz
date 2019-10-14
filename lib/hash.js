const {
    deepFor, transposeNestedHash
} = require('./basic')

const {
    plural, singular
} = require('pluralize')

const {
    handleFilesRecursively
} = require('./files')

const _ = require('lodash')
const {
    assign, get, isArray, isBoolean, isFunction, isNull, isNumber, isString, isUndefined, 
    map, toString
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

async function matchesFilter(object, filter, caller, parents, parentKey) {
    if (!filter)
        return true
    if (isArray(object) && !filter.length) {
        let items = object
        // Todo: add wrappers like sum, max, count, etc.
        for (let item of items) {
            if (!(await matchesFilter(item, filter, caller, parents, parentKey)))
                return false
            continue
        }
    } else {
        for (let key in filter) {
            let item = get(object, key)
            if ( isUndefined(item) ) { //&& isFunction(caller.fetch)) {
                item = await caller.fetch(key, parents)
                if (isUndefined(item)) {
                    // Todo: Fix 👇, should look up if it is a native filter
                    continue
                }
            }
            let criterion = filter[key]
            let { not, gt, lt } = criterion || {}
            if (
                isString(criterion) || 
                isNumber(criterion) || 
                isBoolean(criterion) ||
                isNull(criterion) || 
                !isUndefined(not) ||
                gt || lt
            ) { //Todo: turn the latter into something prettier
                let negative = false
                if (isNull(criterion)) {
                    if (!item)
                        continue
                } else {
                    if (!isUndefined(not)) {
                        criterion = not
                        negative = true
                    }
                    if (lt || gt) {
                        criterion = lt || gt
                    }
                    if (isUndefined(item) || isNull(item)) {
                        if (negative) {
                            if (isNull(criterion))
                                return false
                            else
                                continue
                        }
                    } else {
                        // let string = toString(item)
                        let check = value => 
                            isString(value) ?
                                !!value.match(criterion) :
                                lt ? 
                                    value < criterion :
                                    gt ?
                                        value > criterion :
                                        value == criterion
                        if (check(item) != negative)
                            continue
                    }
                }
            } else if (isArray(criterion)) {
                let items = criterion
                if (items.includes(item))
                    continue
            } else {
                let subFilter = criterion
                let match = await matchesFilter(item, subFilter, caller, parents, key)
                if (match)
                    continue
            }
            return false
        }
    }
    return true

} 

function renameKeys(object, change) {
    for (let before in change) {
        let after = change[before]
        object[after] = object[before]
        delete object[before]
    }
}

function setDeep(object, path, value) {
    
    let lastPoint = path.pop()
    let branch = getDeep(object, path, {})
    branch[lastPoint] = value

}

module.exports = {
    arrayToHashes, iterate, readHashes, loadHashesAsArray, readHash, getDeep, matchesFilter, renameKeys, setDeep
}
