import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { api } from '../lib/api'
import type { RoomDetail, Team } from '../lib/types'

interface GameState {
  sessionId: number | null
  room: RoomDetail | null
  teams: Team[]
  finished: boolean
  start: (sessionId: number, room: RoomDetail, teams: Team[]) => void
  addScore: (teamId: number, delta: number) => void
  finish: () => Promise<void>
  reset: () => void
}

// Состояние игры хранится в sessionStorage — переживает обновление страницы во время игры
export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      room: null,
      teams: [],
      finished: false,

      start(sessionId, room, teams) {
        set({ sessionId, room, teams, finished: false })
      },

      addScore(teamId, delta) {
        if (!delta) return
        set({ teams: get().teams.map((t) => (t.id === teamId ? { ...t, score: t.score + delta } : t)) })
        const id = get().sessionId
        if (id) api.patch(`/game/${id}/score/`, { team_id: teamId, delta }).catch(() => {})
      },

      async finish() {
        const id = get().sessionId
        set({ finished: true })
        if (id) await api.patch(`/game/${id}/finish/`).catch(() => {})
      },

      reset() {
        set({ sessionId: null, room: null, teams: [], finished: false })
      },
    }),
    { name: 'ao_game', storage: createJSONStorage(() => sessionStorage) },
  ),
)
