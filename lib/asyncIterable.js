const _ = require('lodash')

const {
    assign, indexOf, filter, get, keys, isArray, noop
} = _

const {
    plural, singular
} = require('pluralize')

const {
    matchesFilter
} = require('./hash')

class AsyncIterable {

    constructor(schema) {

        assign(this, {
            schema, pathTo: {}
        })

        let crawl = (branch, parentPath = []) => {
            for (let key in branch) {   // key is plural
                let path = [...parentPath, key]
                this.pathTo[key] = path
    
                crawl(branch[key], path)
            }
        }
    
        crawl(schema)
    
    }
    
    async all(key, options) {
        let wugs = []

        await this.iterate(key, async (wug) => wugs.push(wug), options)

        return wugs

    }

    async iterate(keyOrPath, callback, options = {}, promises = [], parentWugs = {}) {
        let {wait, reload, filters, level, throwOnError} = {
            level: 1, 
            throwOnError: true,
            wait: false,
            ...options
        }
    
        let path = isArray(keyOrPath) ? 
            keyOrPath :
            this.pathTo[keyOrPath]

        let currentKey = path[level - 1]
        let parent = level > 1 ?
            parentWugs[singular(path[level - 2])] :
            this
        let wugs = parent[currentKey]

        if (!wugs || reload) { 
            console.log(`Fetching ${currentKey}`)
            wugs = await this.fetch(currentKey, {... parentWugs, options})
            parent[currentKey] = wugs
        }

        if (!isArray(wugs)) {
            wugs = [wugs]
        }

        for (let wug of wugs) {
            let promise = (async () => {
                try {
                    assign(wug, parentWugs)
                    let newParentWugs = {... parentWugs}
                    newParentWugs[singular(currentKey)] = wug
                    let filter = filters[currentKey]
                    if (filter) {
                        let match = await matchesFilter(wug, filter, this, newParentWugs)
                        if (!match)
                            return
                    }
                    if (level < path.length) {
                        await this.iterate(path, callback, {...options, level: level + 1}, promises, newParentWugs)
                    } else {
                        await callback(wug)
                    }        
                } catch(error) {
                    console.error(error)
                    if (throwOnError)
                        throw(error)
                }
            })()
            if (wait)
                await promise
            else
                promises.push(promise)    
        }
        // Todo: combine wait & level
        if (!wait && level == 1) {
            let numPromises = 0
            while (promises.length > numPromises) {
                numPromises = promises.length
                await Promise.all(promises)
                noop()
            }
            noop()
        }
    }


}

module.exports = AsyncIterable