const axios = require('axios')
const repo = process.argv[2]
const id = process.argv[3]
const path = require('path')
const fs = require('fs')
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

function runScript (gliconf, script) {
  if (doLog) console.log(`----- Executing ${script} -----`)
  const scripts = gliconf.scripts
  const commands = scripts[script].commands

  commands.forEach(command => {
    const cmdType = command[0]
    if (cmdType === 'move') {
      console.log('Move Command')
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

  // Update version
  // Debugging (Disbaled):
  // fs.writeFileSync(path.join(dir, '.latest'), tag)

  // Run scripts:
  if (needToInstall) runScript(gliconf, 'install')
  if (!needToInstall) runScript(gliconf, 'run')
}

;(async () => {
  const ghResponse = (await axios.get(`https://api.github.com/repos/${repo}/releases/latest`)).data
  const tag = ghResponse.tag_name
  const assets = ghResponse.assets
  const asset = (assets.filter(__asset => __asset.name === 'main.glif'))[0]
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
