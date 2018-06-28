const fs = require('fs')

function handleFilesRecursively(path, handler, {mask} = {}) {
    for (let filename of fs.readdirSync(path)) {
        let fullPath = `${path}/${filename}`
        let stats = fs.statSync(fullPath)

        if (stats.isDirectory(fullPath)) {
            console.log(`Directory: ${fullPath}`)
            handleFilesRecursively(fullPath, handler, {mask})
        } else {
            let match = fullPath.match(/([^/\\]+)\.([^.]*)$/)
            if (!match) {
                continue
            }
            let [, filename, extension] = match
            if (mask) {
                if (!fullPath.match(mask)) {                        
                    console.log(`Skipping ${fullPath} (mask not matched).`)
                    continue
                }
            }
            console.log(`Handling ${fullPath}...`)
            handler(fullPath, {filename, extension})
        }
    }
}

function renameRecursively(path, mask, renameTo) {
    handleFilesRecursively(path, (path) => {
        if (path.match(mask)) {
            let newPath = path.replace(mask, renameTo)
            fs.renameSync(path, newPath)
            console.log(`Renamed ${path} to ${newPath}`)
        }
    }, {mask})
}

module.exports = {
    handleFilesRecursively, renameRecursively
}
