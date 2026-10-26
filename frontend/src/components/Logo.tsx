import { useId } from 'react'

/**
 * Знак AO Studio.
 *
 * «O» — это тюндюк, навершие юрты: то же, что в центре кыргызского флага. Для «Акыл Ордо»
 * он читается буквально — ордо значит ставка, дворец, а тюндюк и есть её макушка.
 * Ножки «A» заканчиваются завитками кочкор мүйүз («бараньи рога») — самого частого мотива
 * кыргызского орнамента.
 */
export default function Logo({ size = 36 }: { size?: number }) {
  // Свой id на каждый знак: с общим браузер берёт первый в документе, а он может оказаться
  // в скрытом блоке (мобильная шапка) — тогда градиент не рисуется и плашка выходит прозрачной
  const gradId = `ao-logo-${useId().replace(/:/g, '')}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className="shrink-0 drop-shadow-[0_4px_20px_rgba(16,185,129,0.4)]"
      role="img"
      aria-label="AO Studio"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--green-light)" />
          <stop offset="1" stopColor="var(--green-dark)" />
        </linearGradient>
      </defs>

      <rect width="48" height="48" rx="13" fill={`url(#${gradId})`} />

      {/* Рамка-кайма: тонкий внутренний кант, как по краю ширдака */}
      <rect x="3" y="3" width="42" height="42" rx="10.5" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="1" />

      <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
        {/* A: ножки сбегают в завитки бараньих рогов */}
        <g strokeWidth="2.9">
          <path d="M13.2 13.6 L6.6 31.6 C6 33.5 7.6 34.8 9.2 33.8" />
          <path d="M13.2 13.6 L19.8 31.6 C20.4 33.5 18.8 34.8 17.2 33.8" />
          <path d="M9.2 27.4 L17.2 27.4" />
        </g>

        {/* O — тюндюк: обод и три перекладины, что сходятся решёткой, как жерди на макушке юрты */}
        <circle cx="34.2" cy="24" r="7.9" strokeWidth="2.7" />
        <g strokeWidth="1.9">
          <path d="M26.3 24 Q34.2 19.6 42.1 24" />
          <path d="M26.3 24 Q34.2 19.6 42.1 24" transform="rotate(120 34.2 24)" />
          <path d="M26.3 24 Q34.2 19.6 42.1 24" transform="rotate(240 34.2 24)" />
        </g>
      </g>
    </svg>
  )
}
