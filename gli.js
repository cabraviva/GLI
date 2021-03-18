const axios = require('axios')
const repo = process.argv[2]
const id = process.argv[3]
const __ghf = process.argv[5]
const path = require('path')
const request = require('request')
const fs = require('fs')
const { exec } = require('child_process')

async function download (url, dest) {
  /* Create an empty file where we can save data */
  const file = fs.createWriteStream(dest)

  /* Using Promises so that we can use the ASYNC AWAIT syntax */
  await new Promise((resolve, reject) => {
    request({
      /* Here you should specify the exact link to the file you are trying to download */
      uri: url,
      gzip: true
    }).pipe(file)
      .on('finish', async () => {
        resolve()
      }).on('error', (error) => {
        reject(error)
      })
  }).catch((error) => {
    throw error
  })
}
const fse = require('fs-extra')
const _os = require('os')
const dlFile = require('./dlfile.js')
const AdmZip = require('adm-zip')
const doLog = (process.argv[4] || '--no-logging') === '--logging'
let isWin = false
if (process.platform.toLowerCase().includes('win32')) isWin = true

if (doLog && isWin) console.log('Detected Windows!')

function getAppData () {
  if (!isWin) return _os.userInfo().homedir
  return path.join(_os.userInfo().homedir, path.join('AppData', 'Roaming'))
}

const dir = path.join(getAppData(), id)

if (!fs.existsSync(dir)) fs.mkdirSync(dir)

if (doLog) console.log(`Fetching repo ${repo}`)
if (doLog) console.log(`Program Directory: ${dir}`)

async function runScript (gliconf, script) {
  const $package = path.join(dir, '__package')
  const $program = dir

  function parseFilePath ($s) { return $s.replace(/%package/g, $package).replace(/%program/g, $program) }

  if (doLog) console.log(`----- Executing ${script} -----`)
  const scripts = gliconf.scripts
  const commands = scripts[script].commands

  commands.forEach(async command => {
    const cmdType = command[0]
    if (cmdType === 'move') {
      if (doLog) console.log(`Moving ${parseFilePath(command[1].src)} as ${command[1].as} to ${parseFilePath(command[1].to)}`)
      if (command[1].as === 'folder') {
        // Folder
        fse.copySync(parseFilePath(command[1].src), parseFilePath(command[1].to), { overwrite: true })
      } else {
        // File
        fs.copyFileSync(parseFilePath(command[1].src), parseFilePath(command[1].to))
      }
    } else if (cmdType === 'makesure') {
      const file = command[1].file
      const isIn = parseFilePath(command[1].is_in)

      if (doLog) console.log(`Fetching: ${file} (${isIn})`)

      if (!fs.existsSync(isIn)) { await download(file, isIn) }
    } else if (cmdType === 'unzip') {
      const _src = parseFilePath(command[1].src)
      const _into = parseFilePath(command[1].into)

      if (!fs.existsSync(_into)) {
        if (doLog) console.log(`Extracting: ${_src} to ${_into}`)

        const zip = new AdmZip(_src)
        zip.extractAllTo(_into, true)
      }
    } else if (cmdType === 'execute') {
      await runScript(gliconf, command[1])
    } else if (cmdType === 'run') {
      exec(parseFilePath(command[1]), (error, stdout, stderr) => {
        if (error) {
          if (doLog) console.error(`exec error: ${error}`)
          return
        }
        console.log(`${stdout}`)
        console.error(`${stderr}`)
      })
    } else {
      if (doLog) console.log(`Invaild or unknown command: ${cmdType}`)
    }
  })
}

function _afterFetchFiles (asset, tag, needToInstall) {
  // Extract
  if (needToInstall) {
    if (doLog) console.log('Unzipping files')

    const zip = new AdmZip(path.join(dir, 'glif.zip'))

    zip.extractAllTo(path.join(dir, '__package'), /* overwrite */true)
    if (doLog) console.log('Unzipped all')
  }

  // Read .gliconf
  const gliconf = JSON.parse(fs.readFileSync(path.join(dir, '__package', '.gliconf')).toString('utf-8'))

  // Update Version:
  fs.writeFileSync(path.join(dir, '.latest'), tag)

  // Run scripts:
  if (needToInstall) runScript(gliconf, 'install')
  if (!needToInstall) runScript(gliconf, 'run')
}

;(async () => {
  const ghResponse = (await axios.get(`https://api.github.com/repos/${repo}/releases/latest`)).data
  const tag = ghResponse.tag_name
  const assets = ghResponse.assets
  const asset = (assets.filter(__asset => __asset.name === (__ghf || 'main') + '.glif'))[0]
  let current = null

  try {
    current = fs.readFileSync(path.join(dir, '.latest')).toString('utf-8')
  } catch { current = null }

  if (doLog) console.log(`Current: ${current === null ? 'Not Installed' : current}`)
  if (doLog) console.log(`Latest: ${tag}`)

  const needToInstall = !(current === tag)

  if (!needToInstall) {
    if (doLog) console.log('Already fetched files')
    _afterFetchFiles(asset, tag, needToInstall)
  } else {
    if (doLog) console.log('Fetching files')
    dlFile(asset.browser_download_url, path.join(dir, 'glif.zip'), () => {
      if (doLog) console.log('Fetched files')
      _afterFetchFiles(asset, tag, needToInstall)
    }, (msg) => {
      if (doLog) console.log(msg)
    })
  }
})()
