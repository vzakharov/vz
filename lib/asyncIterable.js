const _ = require('lodash')

const {
    assign,filter, get, keys, isArray, isFunction, isUndefined, 
    indexOf, noop, omit, last, nth, pick
} = _

const {
    plural, singular
} = require('pluralize')

const {
    matchesFilter
} = require('./hash')

class AsyncIterable {

    constructor(schema) {

        schema = schema(this)
        assign(this, {
            schema, pathTo: {}, subSchema: {}
        })

        let crawl = (branch, parentPath = []) => {
            for (let key in branch) {
                let subBranch = branch[key]
                if (key.charAt(0) == '_') {
                    // if ( key == '_fetch' ) {
                    //     branch[key] = async (args) => {
                    //         let path = [... parentPath]
                    //         let key = path.pop()
                    //         let string = `${key}`
                    //         if (path.length > 0) {
                    //             let parentKey = path.pop()
                    //             let singularParentKey = singular(parentKey)
                    //             string += ` for ${singularParentKey} ${args[singularParentKey][this.subSchema[parentKey]._descriptor]}`
                    //         }
                    //         console.log(`Fetching ${string}...`)
                    //         try {
                    //             let result = await subBranch(args)
                    //             console.log(`Fetched ${string}.`)
                    //             return result    
                    //         } catch(error) {
                    //             console.error(`Failed fetching ${string}!`)
                    //             throw(error)
                    //         }
                    //     }
                    // }
                    continue
                }
                let path = [...parentPath, key]
                this.pathTo[key] = path
                this.subSchema[key] = subBranch

                crawl(branch[key], path)
            }
        }
    
        crawl(schema)
    
    }
    
    async all(key, options) {
        let wugs = []

        await this.iterate(key, async (wug) => 
            wugs.push(wug), options
        )

        return wugs

    }

    schemaArg(functionName, key) {
        return this[[functionName, key].join('_')] || 
            this.subSchema[key]['_' + functionName]
    }

    async fetch(key, parent, options = {}, parents) {
        if (!parent) parent = this

        let wugs = get(parent, key)
        let { reload, reload_all, filters, where, search } = options
        if (isUndefined(wugs) || reload_all || get(reload, key)) {

            if (!filters)
                filters = where || {}

            let filter = filters[key]

            let fetchArgs = { ... parents, options }

            let subSchema = this.subSchema[key]
            let { _nativeFilterKeys } = subSchema


            if (_nativeFilterKeys) {
                let nativeFilters = {}
                if (isFunction(_nativeFilterKeys)) {
                    nativeFilters = _nativeFilterKeys(filter)
                    _nativeFilterKeys = keys(nativeFilters)
                } else {
                    nativeFilters = pick(filter, _nativeFilterKeys)
                }
                filters[key] = omit(filter, _nativeFilterKeys)
                assign(fetchArgs, { nativeFilters })
            }


            let fetchFunctionName = key => 'fetch_' + key
            if ( isFunction(this[fetchFunctionName(key)]) ) {
                wugs = await this[fetchFunctionName(key)](fetchArgs)
                parent[key] = wugs
            } else if (subSchema._fetch == 'parent') {
                let parentKey = nth(this.pathTo[key], -2)
                await this[fetchFunctionName(parentKey)](fetchArgs)
                wugs = parent[key]
            } else {
                throw(`No fetching operation defined for ${key}`)
            }
        }

        if (!get(parent, '_enriched_' + key)) {
            for (let wug of isArray(wugs) ? wugs : [wugs]) {
                for (let parentKey in parents) {
                    Object.defineProperty(wug, parentKey, { get: () => parents[parentKey] })
                }
                let enrichFunctionName = 'enrich_' + singular(key)
                if (isFunction(this[enrichFunctionName])) {
                    this[enrichFunctionName](wug, parents)
                }
            }
            parent['_enriched_' + key] = true
        }

        return wugs
    }

    async iterate(keyOrPath, callback, options = {}, parent, parents = {}) {
        let {wait, reload, filters, where, level, throwOnError} = {
            level: 1, 
            throwOnError: true,
            wait: false,
            ...options
        }


        // Todo: make default
        if (!filters)
            filters = where || {}
    
        let promises = []

        let path = isArray(keyOrPath) ? 
            keyOrPath :
            this.pathTo[keyOrPath]
        
        let key = path[level - 1]
        let wugs = await this.fetch(key, parent, options, parents)

        if (!isArray(wugs)) {
            wugs = [wugs]
        }

        for (let wug of wugs) {
            let promise = (async () => {
                try {
                    assign(wug, parents)
                    let newParents = {... parents}
                    newParents[singular(key)] = wug
                    let filter = filters[key]
                    if (filter) {
                        let match = await matchesFilter(wug, filter, this, newParents, key)
                        if (!match)
                            return Promise.resolve()
                    }
                    if (level < path.length) {
                        return this.iterate(path, callback, {...options, level: level + 1}, wug, newParents)
                    } else {
                        // Todo: fix 👇
                        // if (wait == 'first')
                        //     delete options.wait
                        return callback(wug)
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
        return Promise.all(promises)
    }


}

module.exports = AsyncIterable