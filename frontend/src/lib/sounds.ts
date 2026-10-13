// Звуковые эффекты на Web Audio API — без внешних файлов

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.2) {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + start
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

export const sounds = {
  /** Правильный ответ — восходящий приятный тон */
  correct() {
    tone(523.25, 0, 0.18, 'sine', 0.25)
    tone(659.25, 0.1, 0.18, 'sine', 0.25)
    tone(783.99, 0.2, 0.35, 'sine', 0.25)
  },
  /** Неправильный ответ — низкий buzzer */
  wrong() {
    tone(140, 0, 0.45, 'sawtooth', 0.15)
    tone(110, 0.05, 0.45, 'square', 0.08)
  },
  /** Тиканье таймера (последние 10 секунд) */
  tick() {
    tone(1200, 0, 0.05, 'square', 0.05)
  },
  /** Конец таймера — сигнал тревоги */
  alarm() {
    for (let i = 0; i < 3; i++) {
      tone(880, i * 0.25, 0.18, 'square', 0.12)
      tone(660, i * 0.25 + 0.12, 0.12, 'square', 0.12)
    }
  },
  /** Победа — фанфары */
  fanfare() {
    const notes: [number, number, number][] = [
      [523.25, 0, 0.15], [523.25, 0.15, 0.15], [523.25, 0.3, 0.15],
      [659.25, 0.45, 0.4], [587.33, 0.85, 0.15], [659.25, 1.0, 0.15], [783.99, 1.15, 0.7],
    ]
    for (const [f, s, d] of notes) {
      tone(f, s, d, 'triangle', 0.22)
      tone(f / 2, s, d, 'sine', 0.1)
    }
  },
  /** Бонусное событие — волшебный перелив */
  bonus() {
    ;[784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.08, 0.3, 'sine', 0.15))
  },
  /** Переворот карточки */
  flip() {
    tone(400, 0, 0.08, 'triangle', 0.1)
    tone(600, 0.05, 0.08, 'triangle', 0.08)
  },
}
