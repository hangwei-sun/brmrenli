const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

async function pngToIco(inputPath, outputPath) {
  const sizes = [256, 128, 64, 48, 32, 16]
  const images = []

  for (const size of sizes) {
    const buf = await sharp(inputPath).resize(size, size).png().toBuffer()
    images.push({ size, buf })
  }

  const fd = fs.openSync(outputPath, 'w')

  // ICO header: reserved(2) + type=1(2) + count(2)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)  // reserved
  header.writeUInt16LE(1, 2)  // type: 1 = ICO
  header.writeUInt16LE(images.length, 4)  // count
  fs.writeSync(fd, header)

  const headerSize = 6 + 16 * images.length
  let offset = headerSize
  const imageDatas = []

  for (const { size, buf } of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)  // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)  // height
    entry.writeUInt8(0, 2)   // palette
    entry.writeUInt8(0, 3)   // reserved
    entry.writeUInt16LE(1, 4)   // planes
    entry.writeUInt16LE(32, 6)  // bpp
    entry.writeUInt32LE(buf.length, 8)  // image size
    entry.writeUInt32LE(offset, 12)    // offset
    fs.writeSync(fd, entry)
    imageDatas.push(buf)
    offset += buf.length
  }

  for (const buf of imageDatas) {
    fs.writeSync(fd, buf)
  }

  fs.closeSync(fd)
  console.log('ICO created:', outputPath, `(${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB)`)
}

// Copy PNG to assets first
const logoPath = path.resolve(__dirname, '..', 'logo.png')
const assetsDir = path.resolve(__dirname, '..', 'src', 'assets')
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })

fs.copyFileSync(logoPath, path.join(assetsDir, 'logo.png'))
console.log('logo.png copied to src/assets/')

const icoPath = path.join(assetsDir, 'icon.ico')
pngToIco(logoPath, icoPath)
