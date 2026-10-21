export type GameFormat = 'classic' | 'strategic' | 'blind'

export interface User {
  id: number
  username: string
  email: string
  avatar: string | null
  created_at: string
  rooms_count: number
  games_played: number
}

export interface PublicUser {
  id: number
  username: string
  avatar: string | null
}

export interface Question {
  id: number
  text: string
  answer: string
  points: number
  photo: string | null
  category: number | null
  order: number
}

export interface Category {
  id: number
  name: string
  order: number
  questions: Question[]
}

export interface RoomListItem {
  id: number
  title: string
  format: GameFormat
  timer_duration: number
  is_public: boolean
  description: string
  author: PublicUser
  likes_count: number
  created_at: string
  categories: string[]
  questions_count: number
  is_liked: boolean
}

export interface RoomDetail extends Omit<RoomListItem, 'categories'> {
  categories: Category[]
  questions: Question[]
}

export interface Team {
  id: number
  name: string
  color: string
  score: number
  /** Античит: команда дисквалифицирована, её баллы заморожены и она вне зачёта */
  disqualified?: boolean
  warnings?: number
  dq_reason?: string
}

/** Что зафиксировал браузер устройства команды */
export type ViolationKind = 'hidden' | 'blur' | 'fullscreen' | 'left' | 'lost'

export interface Violation {
  id: number
  team_id: number
  team: string
  kind: ViolationKind
  label: string
  /** Нарушение, за которое дисквалифицировали */
  fatal: boolean
  at: string
}

/** Сводка античита для ведущего */
export interface AnticheatStatus {
  anticheat: boolean
  warnings_allowed: number
  teams: (Team & { warnings: number; disqualified: boolean; dq_reason: string; offline: boolean })[]
  violations: Violation[]
}

/** solo — «Один»; offline/online — «Команда» на одном экране / со своих устройств */
export type GameMode = 'solo' | 'offline' | 'online'

export interface GameSession {
  id: number
  room: number
  host: number
  status: 'lobby' | 'active' | 'finished'
  mode: GameMode
  code: string | null
  anticheat: boolean
  /** Запуск с умной доски: состав и время заданы заранее */
  board: boolean
  /** Сколько команд ждём (0 — без ограничения) */
  expected_teams: number
  /** Игроков в команде (0 — не задано) */
  team_size: number
  /** Начать игру самим, как только соберутся все команды */
  autostart: boolean
  /** Время на вопрос; null — как в комнате */
  timer_duration: number | null
  created_at: string
  teams: Team[]
}

// ---------- Онлайн-режим: публичное состояние, которое видят команды ----------

export interface LiveCell {
  id: number
  points?: number
  n?: number
  used: boolean
  team?: number | null
  correct?: boolean
}

export interface LiveState {
  view?: 'lobby' | 'waiting' | 'question' | 'review' | 'grid' | 'tiles' | 'bonus' | 'results'
  category?: string
  number?: number
  total?: number
  question?: { id: number; text?: string; photo?: string | null; points?: number }
  /** Принимаются ли сейчас ответы */
  accepting?: boolean
  /** Отвечает только эта команда (стратегический/слепой) */
  answer_team?: number | null
  /** Правильный ответ — появляется, когда ведущий его показал */
  reveal?: string | null
  /** Итоги категории (классический) */
  items?: { id: number; text: string; answer: string; points: number; correct: number[] }[]
  columns?: { name: string; cells: LiveCell[] }[]
  tiles?: LiveCell[]
  available?: number[]
  active_team?: number | null
  bonus?: 'double' | 'skip' | 'steal' | null
}

export interface LivePayload {
  code: string
  mode: GameMode
  status: 'lobby' | 'active' | 'finished'
  room: { title: string; format: GameFormat }
  state: LiveState
  version: number
  timer: { left: number; running: boolean } | null
  server_time: string
  teams: Team[]
  me: Team | null
  my_answer: string | null
  /** Античит включён ведущим: устройство команды держит игру в полном экране */
  anticheat: boolean
  /** Сколько нарушений прощается до дисквалификации */
  warnings_allowed: number
  /** Сколько команд ждёт ведущий (0 — без ограничения) */
  expected_teams: number
  /** Игроков в команде (0 — не задано) */
  team_size: number
}

export interface LiveAnswer {
  question_id: number
  team_id: number
  text: string
  matches: boolean
  submitted_at: string
}

export interface PlatformStats {
  users: number
  rooms: number
  games: number
  rating: number
}
