const _ = require('lodash')
const {
    pullAt
} = _

const Diff = require('diff')

function getDiff(oldString, newString) {
    let array = Diff.diffWords(oldString, newString)
    for (let i = 4; i < array.length; i++) {

        let whitespace = j => {
            let match = array[j].value.match(/^\s+$/)
            if (match) return match[0]
        }

        let ws = whitespace(i - 2)
        if (
            array[i - 4].removed &&
            array[i - 3].added &&
            ws &&
            array[i - 1].removed
        ) {
            array[i - 4].value += ws + array[i - 1].value
            array[i - 3].value += ws
            if (array[i].added) {
                array[i - 3].value += array[i].value
            }
            pullAt(array, i - 2, i - 1, array[i].added && i)
            i--
        }
    }

    for (let piece of array) {
        piece.changed = piece.added || piece.removed
    }

    if (!array[0].changed) {
        array[0].value = array[0].value.trimLeft()
    }

    let string = map(
        array, item => {
            let {added, removed, value} = item
            if (added) {
                value = value.replace(/(?<=.)/g, "\u0332")
            }
            if (removed) {
                value = value.replace(/(?=.)/g, "\u0336")
            }
            return value
        }
    ).join('')

    return {array, string}
}

function deepFor(object, predicate, options = {pathDelimiter: '/'}, nestedKeys = []) {
    for (let key in object) {
        nestedKeys.push(key)
        let value = object[key]
        if (typeof value == 'object') {
            deepFor(value, predicate, options, nestedKeys)
        } else {
            let keyPath = nestedKeys.join(options.pathDelimiter)
            predicate(value, nestedKeys.slice(), keyPath)
        }
        nestedKeys.pop()
    }
}

function transposeNestedHash(object, {joiner} = {joiner: '/'}) {

    let out = {}

    deepFor(object, (value, nestedKeys) => {
        let keyToTranspose = nestedKeys.shift()
        let key = nestedKeys.join(joiner)
        let item = out[key] || (out[key] = {})
        item[keyToTranspose] = value
    })

    return out

}

async function sleep(milliseconds) {
    await new Promise(resolve => {
        setTimeout(resolve, milliseconds)
    })
}   


module.exports = {
    deepFor, getDiff, transposeNestedHash, sleep
}
