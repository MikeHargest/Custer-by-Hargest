const { Jimp } = require('jimp');
const pngToIco = require('png-to-ico').default;
const fs = require('fs');

async function run() {
  const image = await Jimp.read('E:/PROGRAMS/for project manager/logo_2.png');
  const size = Math.max(image.bitmap.width, image.bitmap.height);
  const newImage = new Jimp({ width: size, height: size, color: 0x00000000 });
  const x = Math.floor((size - image.bitmap.width) / 2);
  const y = Math.floor((size - image.bitmap.height) / 2);
  newImage.composite(image, x, y);
  const buf = await newImage.getBuffer('image/png');
  const icoBuf = await pngToIco(buf);
  fs.writeFileSync('e:/PROGRAMS/Antigravity/Cluster/build/icon.ico', icoBuf);
  fs.writeFileSync('e:/PROGRAMS/Antigravity/Cluster/resources/icon.ico', icoBuf);
  console.log('Made square and generated ICO successfully.');
}
run().catch(console.error);
