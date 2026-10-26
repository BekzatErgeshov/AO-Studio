import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { describe, expect, it } from 'vitest'
import { codeFromQr } from './QrScanner'

/** Поля вокруг кода: без них разбор не цепляется за углы */
const QUIET = 4
/** Пикселей на модуль — крупнее берём, чтобы разбор шёл как с настоящего снимка */
const SCALE = 6

/**
 * Рисуем QR в такой же массив RGBA, какой приходит из `canvas.getImageData`.
 * Так тест проходит весь путь разбора, кроме самой камеры.
 */
async function renderQr(text: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const size = qr.modules.size
  const side = (size + QUIET * 2) * SCALE
  const data = new Uint8ClampedArray(side * side * 4).fill(255)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!qr.modules.get(x, y)) continue
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const px = (x + QUIET) * SCALE + dx
          const py = (y + QUIET) * SCALE + dy
          const i = (py * side + px) * 4
          data[i] = data[i + 1] = data[i + 2] = 0
        }
      }
    }
  }
  return { data, side }
}

describe('codeFromQr', () => {
  it('достаёт код из ссылки, которую показывает доска', () => {
    expect(codeFromQr('https://ao-studio.vercel.app/join/ABC123')).toBe('ABC123')
    expect(codeFromQr('http://localhost:8000/join/QUP7ZY')).toBe('QUP7ZY')
  })

  it('принимает код в нижнем регистре и с пробелами по краям', () => {
    expect(codeFromQr('  https://site/join/abc123  ')).toBe('ABC123')
  })

  it('принимает голый код без ссылки', () => {
    expect(codeFromQr('ABC123')).toBe('ABC123')
    expect(codeFromQr('abc123')).toBe('ABC123')
  })

  it('не принимает чужой QR', () => {
    expect(codeFromQr('https://example.com')).toBeNull()
    expect(codeFromQr('')).toBeNull()
    expect(codeFromQr('ABC12')).toBeNull()
    expect(codeFromQr('ABC1234')).toBeNull()
    expect(codeFromQr('https://site/rooms/ABC123')).toBeNull()
  })
})

describe('разбор снимка QR', () => {
  it('читает код с картинки, нарисованной так же, как её рисует доска', async () => {
    const url = 'https://ao-studio.vercel.app/join/QUP7ZY'
    const { data, side } = await renderQr(url)

    const result = jsQR(data, side, side)

    expect(result?.data).toBe(url)
    expect(codeFromQr(result!.data)).toBe('QUP7ZY')
  })
})
