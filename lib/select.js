const _ = require('lodash')

const {
    assign, indexOf, filter, get, keys
} = _

const {
    plural, singular
} = require('pluralize')

function process(object) {

    let {schema} = object
    object.select = {}

    let crawl = (branch, parentPath = []) => {
        for (let key in branch) {   // key is plural
            object.select[key] = async filters => 
                await select(object, schema, key, filters)
            let path = [...parentPath, key]
            object.pathTo[key] = path
            object.iterate[key] = async (callback, options) =>
                await iterate(object, path, callback, options)
            
            object.all[key] = async (options) => {
                if (object[key] && !options.reload)
                    return object[key]
                let items = []
                let singularKey = singular[key]
                await object.iterate[key](async args => {
                    let item = args[singularKey]
                    for (let stop of path.slice(0, -2)) {
                        let singularStop = singular(stop)
                        item[singularStop] = args[singularStop]
                    }
                    items.push(args[singularKey])
                }, options)
                return items
            }

            crawl(branch[key], path)
        }
    }

    crawl(schema)

}


async function iterate(object, path, callback, options, promises = [], args = {}) {
    options = assign({
        async: true
    }, options)

    let {fetch} = object
    let {async, reload} = options

    let root = !promises

    if (path.length == 1) {
        let promise = callback(args)
        if (async)
            promises.push(promise)
        else
            await promise
    } else {
        let key = path[0]
        let items = object[key]

        if (!items || reload) {
            items = await object.fetch[key]({args, options})
        }
        
        args[key] = items
        for (let item of items) {
            args[key] = item
            iterate(item, path.slice(1), callback, options, promises, args)
        }

        if (async && root) {
            await Promise.all(promises)
        }
    }
}

async function select(object, schema, key, filters) {
    let pluralKey = plural(key)
    let {fetch} = object

    let path = []
    let extendedItems = []

    let crawl = branch => {
        for (let branchKey of keys(branch)) {
            path.push(branchKey)
            if (branchKey == key) {
                return true
            } else {
                if (crawl(branch[branchKey]))
                    return true
                path.pop()
            }
        }
    }

    crawl(schema)

    let index = indexOf(path, key)

    let iterate = (items, parentItem) => {
        let thisFilter = filters[key + 'Filter']
        if (thisFilter) 
            items = filter(items, thisFilter)
        for (let item of items) {
            let extendedItem = {}
            extendedItem[key] = item
            extendedItem[plural(key)] = items
            let indent = '  '.repeat(index)
            let log = object.log[key]
            log = log ? (
                typeof log == 'function' ?
                    log(item) :
                    get(item, log)
            ) : stringify(item)
            console.log(`${indent}${key}: ${log}`)
            if (parentItem) assign(extendedItem, parentItem)
            extendedItems.push(extendedItem)
        }
    }

    if (filters[key]) {
        iterate([filters[key]])
    } else if (filters[pluralKey]) {
        iterate(filters[pluralKey])
    } else {
        if (index == 0)  {
            let items = await fetch[pluralKey](filters)
            iterate(items)
        } else {

            let parentKey = path[index - 1]

            let parentItems = await select(object, schema, parentKey, filters)

            for (let parentItem of parentItems) {

                let items

                if (fetch[pluralKey] && filters.reload) {
                    items = await fetch[pluralKey](assign({}, filters, parentItem))
                    parentItem[parentKey][pluralKey] = items
                } else 
                    items = parentItem[parentKey][pluralKey]
                
                iterate(items, parentItem)
            
            }
                

        }   
    }

    return extendedItems
}

module.exports = {process}