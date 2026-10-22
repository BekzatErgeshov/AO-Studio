import { initials } from '../lib/utils'

interface Props {
  name: string
  src?: string | null
  size?: number
  className?: string
}

/** Аватар: фото или зелёный кружок с инициалами */
export default function Avatar({ name, src, size = 36, className = '' }: Props) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover ring-2 ring-primary/40 ${className}`}
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-light to-primary-dark font-bold text-white ring-2 ring-primary/30 ${className}`}
    >
      {initials(name)}
    </div>
  )
}
