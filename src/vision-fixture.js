import { deflateSync } from 'node:zlib'

export const VISION_SENTINEL = 'VISION_427'

const WIDTH = 320
const HEIGHT = 96
const SCALE = 5
const GLYPHS = {
  V: ['10001','10001','10001','10001','01010','01010','00100'],
  I: ['11111','00100','00100','00100','00100','00100','11111'],
  S: ['01111','10000','10000','01110','00001','00001','11110'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
  N: ['10001','11001','11001','10101','10011','10011','10001'],
  _: ['00000','00000','00000','00000','00000','00000','11111'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, crc])
}

function buildPixels() {
  const stride = 1 + WIDTH * 3
  const raw = Buffer.alloc(stride * HEIGHT, 0xff)
  for (let y = 0; y < HEIGHT; y++) raw[y * stride] = 0

  const chars = [...VISION_SENTINEL]
  const glyphWidth = 5 * SCALE
  const spacing = SCALE
  const totalWidth = chars.length * glyphWidth + (chars.length - 1) * spacing
  const totalHeight = 7 * SCALE
  const x0 = Math.floor((WIDTH - totalWidth) / 2)
  const y0 = Math.floor((HEIGHT - totalHeight) / 2)

  chars.forEach((char, charIndex) => {
    const glyph = GLYPHS[char]
    if (!glyph) throw new Error(`missing vision fixture glyph: ${char}`)
    glyph.forEach((row, gy) => {
      ;[...row].forEach((pixel, gx) => {
        if (pixel !== '1') return
        for (let dy = 0; dy < SCALE; dy++) {
          for (let dx = 0; dx < SCALE; dx++) {
            const x = x0 + charIndex * (glyphWidth + spacing) + gx * SCALE + dx
            const y = y0 + gy * SCALE + dy
            const at = y * stride + 1 + x * 3
            raw[at] = 0
            raw[at + 1] = 0
            raw[at + 2] = 0
          }
        }
      })
    })
  })
  return raw
}

function buildPng() {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(WIDTH, 0)
  ihdr.writeUInt32BE(HEIGHT, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(buildPixels(), { level: 9 })),
    chunk('IEND'),
  ])
}

export const VISION_TEST_PNG_BYTES = buildPng()
export const VISION_TEST_PNG_BASE64 = VISION_TEST_PNG_BYTES.toString('base64')
