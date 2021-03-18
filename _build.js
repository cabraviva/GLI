const { compile } = require('nexe')

compile({
  input: './gli.js',
  build: true,
  patches: [
    async (compiler, next) => {
      // await compiler.setFileContentsAsync(
      //   'lib/new-native-module.js',
      //   'module.exports = 42'
      // )
      return next()
    }
  ]
}).then(() => {
  console.log('success')
})
