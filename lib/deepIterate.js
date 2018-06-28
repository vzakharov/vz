const _ = require('lodash')

const {
    assign, indexOf, filter, get, keys
} = _

const pluralize = require('pluralize')

module.exports = class DeepIterate {

    constructor({schema, getAll, log}) {
        assign(this, {schema, getAll, log})

        let crawl = branch => {
            for (let key in branch) {
                this[pluralize(key)] = async (filters, callback) => this.for(key, filters, callback)
                crawl(branch[key])
            }
        }

        crawl(schema)
    }

    async for(key, filters, callback) {
        let pluralKey = pluralize(key)
        let {schema, getAll} = this

        let path = []

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

        let iterate = async (items, iteratees) => {
            let thisFilter = filters[key + 'Filter']
            if (thisFilter) 
                items = filter(items, thisFilter)
            for (let item of items) {
                let args = {}
                args[key] = item
                args[pluralize(key)] = items
                let indent = '  '.repeat(index)
                let log = this.log[key]
                log = log ? (
                    typeof log == 'function' ?
                        log(item) :
                        get(item, log)
                ) : stringify(item)
                console.log(`${indent}${key}: ${log}`)
                if (iteratees) assign(args, iteratees)
                await callback(args)
            }
        }

        if (filters[key]) {
            await iterate([filters[key]])
        } else if (filters[pluralKey]) {
            await iterate(filters[pluralKey])
        } else {
            if (index == 0)  {
                let items = await getAll[pluralKey](filters)
                await iterate(items)
            } else {

                let parentKey = path[index - 1]

                await this.for(parentKey, filters, async iteratees => {
    
                    let parent = iteratees[parentKey]
                    
                    let items = 
                        getAll[pluralKey] ?
                            await (getAll[pluralKey](assign({}, filters, iteratees))) :
                            parent[pluralKey]
        
                    await iterate(items)
        
                })    
    
            }   
        }
    }

}