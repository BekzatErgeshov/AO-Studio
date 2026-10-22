/**
 * Знак AO Studio — «түндүк»: купол юрты, решётка в круге.
 *
 * «Акыл Ордо» — дворец разума, поэтому знак взят из кыргызской архитектуры:
 * решётка держит круг, в центре красный узел — место, где сходится ответ.
 * Рисуется штрихами, поэтому одинаково читается и крупно, и в 20 px.
 */
export default function Logo({ size = 36 }: { size?: number }) {
  // В мелком размере тонкие штрихи сливаются — утолщаем их и убираем узел
  const small = size < 30
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="shrink-0"
      role="img"
      aria-label="AO Studio"
    >
      <circle cx="32" cy="32" r="25" fill="none" stroke="var(--primary)" strokeWidth={small ? 7 : 5} />
      <g stroke="var(--fg)" strokeWidth={small ? 6 : 4.5} strokeLinecap="square">
        <path d="M13 24 H51" />
        <path d="M13 40 H51" />
        <path d="M24 13 V51" />
        <path d="M40 13 V51" />
      </g>
      {!small && <rect x="27" y="27" width="10" height="10" fill="var(--accent)" />}
    </svg>
  )
}
