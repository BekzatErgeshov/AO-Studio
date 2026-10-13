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

export interface GameSession {
  id: number
  room: number
  host: number
  status: 'active' | 'finished'
  created_at: string
  teams: Team[]
}

export interface PlatformStats {
  users: number
  rooms: number
  games: number
  rating: number
}
