import test from 'node:test'
import assert from 'node:assert/strict'
import { inflateSync } from 'node:zlib'
import { VISION_SENTINEL, VISION_TEST_PNG_BASE64 } from '../src/vision-fixture.js'

test('vision probe PNG is complete, decodable and non-trivial', () => {
  assert.equal(VISION_SENTINEL, 'VISION_427')
  const png = Buffer.from(VISION_TEST_PNG_BASE64, 'base64')
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])

  let offset = 8
  let width = 0
  let height = 0
  const idat = []
  let sawIend = false
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    const next = dataEnd + 4
    assert.ok(next <= png.length, `truncated ${type} chunk`)
    if (type === 'IHDR') {
      width = png.readUInt32BE(dataStart)
      height = png.readUInt32BE(dataStart + 4)
    }
    if (type === 'IDAT') idat.push(png.subarray(dataStart, dataEnd))
    if (type === 'IEND') { sawIend = true; offset = next; break }
    offset = next
  }

  assert.equal(sawIend, true)
  assert.equal(offset, png.length)
  assert.equal(width, 320)
  assert.equal(height, 96)
  assert.ok(idat.length > 0)
  const scanlines = inflateSync(Buffer.concat(idat))
  assert.equal(scanlines.length, height * (1 + width * 3))
})
