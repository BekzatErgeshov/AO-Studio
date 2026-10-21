import type { GameFormat } from './types'

export const FORMATS: Record<GameFormat, { label: string; emoji: string; short: string; description: string }> = {
  classic: {
    label: 'Классический',
    emoji: '📘',
    short: 'Классич.',
    description:
      'Вопросы разложены по категориям, каждый стоит 1 балл. Играют по категориям: открывают вопросы нужной темы.',
  },
  random: {
    label: 'Рандом',
    emoji: '🎲',
    short: 'Рандом',
    description:
      'Без категорий: вопросы идут вперемешку, каждый стоит 1 балл. Карточки открываются вслепую.',
  },
  strategic: {
    label: 'Стратегический',
    emoji: '🎯',
    short: 'Стратег.',
    description:
      'Категории и цена вопроса от 1 до 5 баллов — как в «Своей игре». Команды по очереди выбирают клетку.',
  },
}

// Палитра цветов команд (яркие, различимые на тёмном фоне)
export const TEAM_COLORS = [
  '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#F97316',
  '#84CC16', '#14B8A6', '#EAB308', '#F43F5E', '#A3E635',
  '#FB7185', '#FBBF24', '#22C55E', '#E879F9', '#FDBA74',
]

export function randomTeamColor(used: string[]): string {
  const free = TEAM_COLORS.filter((c) => !used.includes(c))
  const pool = free.length ? free : TEAM_COLORS
  return pool[Math.floor(Math.random() * pool.length)]
}

export function initials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * Следующая команда ходит в случайном порядке (стратегический формат и рандом).
 * Две команды подряд один и тот же ход не получают, если команд больше одной.
 */
export function nextRandomTeam(count: number, current: number): number {
  if (count <= 1) return 0
  let next = current
  while (next === current) next = Math.floor(Math.random() * count)
  return next
}
