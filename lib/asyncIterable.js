const _ = require('lodash')

const {
    assign, filter, find, get, keys, isArray, isFunction, isUndefined, 
    indexOf, noop, omit, last, nth, pick, remove
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
            schema, pathTo: {}, subSchema: {}, parentKey: {}, modelSettings: {}, fetchings: []
        })

        let crawl = (branch, parentPath = []) => {
            for (let key in branch) {
                let subBranch = branch[key]
                if (key.charAt(0) == '_') {
                    continue
                }
                let path = [...parentPath, key]
                this.parentKey[key] = last(parentPath)
                this.pathTo[key] = path
                this.subSchema[key] = subBranch
                this.modelSettings[key] = subBranch._ || {}

                crawl(branch[key], path)
            }
        }
    
        crawl(schema)
    
    }
    
    async select(key, options) {
        let wugs = []

        await this.iterate(key, async (wug) => 
            wugs.push(wug), options
        )

        let { then } = options
        if ( then ) {
            if (!isArray(then)) then = [then]
            for ( let operation of then ) {
                for ( let key in operation ) {
                    let args = operation[key]
                    if (!isArray(args)) args = [args]
                    if (args) {
                        wugs = _[key](wugs, ... args)
                    }    
                }
            }
        }

        return wugs

    }

    schemaArg(functionName, key) {
        return this[[functionName, key].join('_')] || 
            this.subSchema[key]['_' + functionName]
    }

    async fetch(key, parents, options = {}) {
        let parentKey = this.parentKey[key]

        let parent = parentKey ? parents[singular(parentKey)] : this

        let wugs = get(parent, key)
        let { reload, reload_all, filters } = options
        let release = () => {}

        filters = filters || {}
        if (isUndefined(wugs) || reload_all || get(reload, key)) {

            let fetching = find(this.fetchings, { key, parent })
            if ( fetching ) {
                await fetching.promise
                return get(parent, key)
            } else {
                this.fetchings.push({
                    key, parent, 
                    promise: new Promise(resolve => release = resolve)
                })
    
                let filter = filters[key] || {}
    
                let fetchArgs = { ... parents, options }
    
                let subSchema = this.subSchema[key]
                if (!subSchema) {
                    wugs = undefined
                } else {
                    let { _nativeFilterKeys } = subSchema
    
    
                    if (_nativeFilterKeys) {
                        let nativeFilters = {}
                        if (isFunction(this['nativeFilters_' + key])) {
                            nativeFilters = this['nativeFilters_' + key](filter)
                        } else {
                            nativeFilters = pick(filter, _nativeFilterKeys)
                        }
                        // filters[key] = omit(filter, _nativeFilterKeys)
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
            }
            
        }

        if (isArray(wugs))
            if (!get(parent, '_enriched_' + key)) {
                for (let wug of wugs) {
                    for (let parentKey in parents) {
                        Object.defineProperty(wug, parentKey, { get: () => parents[parentKey] })
                    }
                    let enrichFunctionName = 'enrich_' + singular(key)
                    if (isFunction(this[enrichFunctionName])) {
                        await (this[enrichFunctionName](wug, parents))
                    }
                }
                parent['_enriched_' + key] = true

        }

        remove(this.fetchings, {
            key, parent
        })
        release(wugs)

        return wugs
    }

    async get(wug, path) {
        
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
            filters = options.filters = where || {}

        let promises = []

        let path = isArray(keyOrPath) ? 
            keyOrPath :
            this.pathTo[keyOrPath]
        
        let key = path[level - 1]
        let wugs = await this.fetch(key, parents, options)

        let modelSettings = this.modelSettings[key]

        let { freeze } = modelSettings

        if (!isArray(wugs)) {
            wugs = [wugs]
        }

        for (let wug of wugs) {
            let promise = (async () => {
                try {
                    let newParents = {... parents}
                    let singularKey = singular(key)
                    newParents[singularKey] = wug
                    let filter = filters[key]
                    if (filter) {
                        let match = await matchesFilter(wug, filter, this, newParents, key)
                        if (!match)
                            return Promise.resolve()
                    }
                    let setFunctionName = 'set_' + singularKey
                    if ( freeze && this[singularKey] != wug ) {
                        if ( isFunction(this[setFunctionName]) ) {
                            await this[setFunctionName](wug)
                        }    
                        this[singularKey] = wug
                    }
                    if (level < path.length) {
                        return this.iterate(path, callback, {...options, level: level + 1}, wug, newParents)
                    } else {
                        return callback(wug)
                    }        
                } catch(error) {
                    console.error(error)
                    if (throwOnError)
                        throw(error)
                }
            })()
            if (wait || freeze)
                await promise
            else
                promises.push(promise)    
        }
        return Promise.all(promises)
    }


}

module.exports = AsyncIterable