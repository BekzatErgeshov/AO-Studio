import type { GameFormat } from '../lib/types'
import { FORMATS } from '../lib/utils'

// Оттенки зелёного для разных форматов — без синего/фиолетового
const styles: Record<GameFormat, string> = {
  classic: 'bg-primary/15 border-primary/40 text-primary-dark dark:text-primary-light',
  strategic: 'bg-primary-dark/25 border-primary-dark/50 text-primary-dark dark:text-primary-light',
  random: 'bg-lime-400/15 border-lime-500/40 text-lime-700 dark:text-lime-300',
}

export default function FormatBadge({ format, compact }: { format: GameFormat; compact?: boolean }) {
  const f = FORMATS[format]
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${styles[format]}`}>
      <span>{f.emoji}</span>
      {compact ? f.short : f.label}
    </span>
  )
}
