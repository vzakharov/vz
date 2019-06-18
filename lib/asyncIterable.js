const _ = require('lodash')

const {
    assign,filter, get, keys, isArray, isFunction, isUndefined, 
    indexOf, noop, omit, last, nth
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
                    if ( key == '_fetch' ) {
                        branch[key] = async (args) => {
                            let path = [... parentPath]
                            let key = path.pop()
                            let string = `${key}`
                            if (path.length > 0) {
                                let parentKey = path.pop()
                                let singularParentKey = singular(parentKey)
                                string += ` for ${singularParentKey} ${args[singularParentKey][this.subSchema[parentKey]._descriptor]}`
                            }
                            console.log(`Fetching ${string}...`)
                            try {
                                let result = await subBranch(args)
                                console.log(`Fetched ${string}.`)
                                return result    
                            } catch(error) {
                                console.error(`Failed fetching ${string}!`)
                                throw(error)
                            }
                        }
                    }
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

    async schemaArg(functionName, Key) {
        return this[[functionName, key].join('_')] || 
            this.subSchema[key]['_' + functionName]
    }

    async fetch(key, parent, options = {}, parents) {
        let wugs = parent[key]
        if (!isUndefined(wugs) && !( reload === true || reload && reload[key] ))
            return wugs

        let { reload, filters, where, search } = options


        if (!filters)
            filters = where || {}

        let filter = filters[key]

        let fetchArgs = { ... parents, options }

        let { _nativeFilterKeys } = this.subSchema[key]


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

        let parentKey = parent ? nth(this.pathTo[key], -2) : undefined

        let fetchKey = key => this.schemaArg('fetch', key)

        if ( isFunction(fetchKey(key)) ) {
            wugs = await fetchKey(key)(fetchArgs)
        } else if (fetchKey == 'parent') {
            wugs = (
                await fetchKey(parentKey)(fetchArgs)
            )[key]
        } else {
            throw(`No fetching operation defined for ${key}`)
        }
        parent[key] = wugs
        return wugs
    }

    async iterate(keyOrPath, callback, options = {}, parents = {}) {
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
        let currentSchema = this.subSchema[key]
        let parentKey, parent 
        if (level > 1) {
            parentKey = singular(path[level - 2])
            parent = parents[parentKey]
        } else {
            parentKey = ''
            parent = this
        }
        let parentSchema = this.subSchema[plural(parentKey)] || {}
        let wugs = parent[key]

        let fetchFunction = key =>
            // currentSchema._fetch            
            this['fetch_' + key]

        if ( isUndefined(wugs) || reload ) { 
            // console.log(`Fetching ${currentKey} for ${parent[parentSchema._descriptor] || '-'}...`)
            // wugs = await this.fetch(currentKey, {... parentWugs, options})
            
            if (isFunction(fetchFunction(key))) {
                wugs = await fetchFunction(key)({... parents, options})
            } else if (isFunction(parentSchema._fetchChildren)) {
                wugs = (
                    await parentSchema._fetchChildren({... parents, options})
                )[key]
            } else {
                throw(`No fetching operation defined for ${key}`)
            }
            // console.log(`Fetched ${currentKey} for ${parent[parentSchema._descriptor] || '-'}...`)
            parent[key] = wugs
        }

        if (!isArray(wugs)) {
            wugs = [wugs]
        }

        for (let wug of wugs) {
            let promise = (async () => {
                try {
                    assign(wug, parents)
                    let newParentWugs = {... parents}
                    newParentWugs[singular(key)] = wug
                    let filter = filters[key]
                    if (filter) {
                        let match = await matchesFilter(wug, filter, this, newParentWugs, key)
                        if (!match)
                            return Promise.resolve()
                    }
                    if (level < path.length) {
                        return this.iterate(path, callback, {...options, level: level + 1}, newParentWugs)
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