import { useMemo, type CSSProperties } from 'react'

const EMOJIS = [
  '👀', '🎓', '🌱', '🐾', '🧩', '♟️', '🎯', '🎨', '🎬', '⌛', '💡', '🛠️',
  '🔬', '🔭', '📚', '🔍', '💭', '🏆', '🌐', '🎵', '⚖️', '📊', '📐', '💰',
]

// Генератор псевдослучайных чисел от зерна; зерно случайное — раскладка новая при каждой загрузке
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

interface Item {
  emoji: string
  left: number
  top: number
  size: number
  opacity: number
  blur: number
  duration: number
  delay: number
  drift: number
  rotate: number
  z: number
}

/**
 * Плавающие эмодзи на фоне с эффектом глубины:
 * дальние — маленькие, тусклые и размытые; средние — чёткие; ближние — крупные и слегка размытые.
 */
export default function FloatingEmojis() {
  const { items, dots } = useMemo(() => {
    const r = rng(Math.floor(Math.random() * 2147483646) + 1)
    const items: Item[] = EMOJIS.flatMap((emoji, i) =>
      // Каждый эмодзи дважды — на разной «глубине»
      [0, 1].map((k) => {
        const layer = (i + k) % 3 // 0 — далеко, 1 — середина, 2 — близко
        const d = layer === 0 ? 0.1 + r() * 0.25 : layer === 1 ? 0.4 + r() * 0.25 : 0.75 + r() * 0.25
        // Чёткие и крупные эмодзи не ставим в центр — там заголовок и кнопки
        let left = r() * 100
        let top = r() * 100
        for (let t = 0; layer > 0 && t < 20 && left > 22 && left < 78 && top > 18 && top < 82; t++) {
          left = r() * 100
          top = r() * 100
        }
        return {
          emoji,
          left,
          top,
          size: 22 + d * d * 150,
          opacity: layer === 0 ? 0.17 + r() * 0.12 : layer === 1 ? 0.42 + r() * 0.18 : 0.27 + r() * 0.14,
          blur: layer === 0 ? 2.5 + r() * 2 : layer === 1 ? 0 : 3 + r() * 4,
          duration: 14 + (1 - d) * 16 + r() * 8,
          delay: -r() * 30,
          drift: 20 + d * 50,
          rotate: (r() - 0.5) * 30,
          z: Math.round(d * 10),
        }
      }),
    )
    const dots = Array.from({ length: 28 }, () => ({
      left: r() * 100,
      top: r() * 100,
      size: 3 + r() * 7,
      opacity: 0.19 + r() * 0.38,
      blur: r() * 2,
      duration: 10 + r() * 14,
      delay: -r() * 20,
      drift: 10 + r() * 25,
    }))
    return { items, dots }
  }, [])

  return (
    <div className="floating-emojis pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {dots.map((d, i) => (
        <span
          key={`d${i}`}
          className="float-item absolute rounded-full bg-green"
          style={
            {
              left: `${d.left}%`,
              top: `${d.top}%`,
              width: d.size,
              height: d.size,
              opacity: d.opacity,
              filter: `blur(${d.blur}px)`,
              animationDuration: `${d.duration}s`,
              animationDelay: `${d.delay}s`,
              '--drift': `${d.drift}px`,
              '--rot': '0deg',
            } as CSSProperties
          }
        />
      ))}
      {items.map((it, i) => (
        <span
          key={i}
          className="float-item absolute select-none leading-none"
          style={
            {
              left: `${it.left}%`,
              top: `${it.top}%`,
              fontSize: it.size,
              opacity: it.opacity,
              // Подкраска зависит от темы: на тёмном фоне эмодзи гасим слабее, на белом — притемняем
              filter: `blur(${it.blur}px) var(--emoji-tone)`,
              zIndex: it.z,
              animationDuration: `${it.duration}s`,
              animationDelay: `${it.delay}s`,
              '--drift': `${it.drift}px`,
              '--rot': `${it.rotate}deg`,
            } as CSSProperties
          }
        >
          {it.emoji}
        </span>
      ))}
    </div>
  )
}
