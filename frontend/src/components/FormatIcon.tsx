import type { IconProps } from '../lib/icons'
import type { GameFormat } from '../lib/types'
import { FORMATS } from '../lib/utils'

/** Значок формата игры: книга — классический, кубик — рандом, сетка клеток — стратегический. */
export default function FormatIcon({ format, ...props }: { format: GameFormat } & IconProps) {
  const Icon = FORMATS[format].icon
  return <Icon {...props} />
}
