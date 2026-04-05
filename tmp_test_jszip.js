const JSZip = require('jszip')
const fs = require('fs')
const zip = new JSZip()
zip.file('hello.txt', 'Hello World\n')
zip
  .generateAsync({ type: 'nodebuffer' })
  .then(function (content) {
    fs.writeFileSync('./test.zip', content)
    console.log('Success')
  })
  .catch((err) => {
    console.error(err)
  })
