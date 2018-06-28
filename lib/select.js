const _ = require('lodash')

const {
    assign, indexOf, filter, get, keys
} = _

const pluralize = require('pluralize')

module.exports = class DeepIterate {

    constructor({schema, get, log}) {
        assign(this, {schema, get, log})

        let crawl = branch => {
            for (let key in branch) {
                this[pluralize(key)] = async (filters) => this.fetch(key, filters)
                crawl(branch[key])
            }
        }

        crawl(schema)
    }

    async fetch(key, filters) {
        let pluralKey = pluralize(key)
        let {schema, get} = this

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
                extendedItem[pluralize(key)] = items
                let indent = '  '.repeat(index)
                let log = this.log[key]
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
                let items = await get[pluralKey](filters)
                iterate(items)
            } else {

                let parentKey = path[index - 1]

                let parentItems = await this.fetch(parentKey, filters)

                for (let parentItem of parentItems) {

                    let items = get[pluralKey] ?
                        await (get[pluralKey](assign({}, filters, parentItem))) :
                        parentItem[parentKey][pluralKey]
                    
                    iterate(items, parentItem)
                
                }
                    
    
            }   
        }

        return extendedItems
    }

}