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
