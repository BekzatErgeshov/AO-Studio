import { create } from 'zustand'
import { ACCESS_KEY, REFRESH_KEY, api } from '../lib/api'
import type { User } from '../lib/types'

interface AuthPayload {
  access: string
  refresh: string
  user: User
}

interface AuthState {
  user: User | null
  ready: boolean
  init: () => Promise<void>
  login: (login: string, password: string) => Promise<User>
  loginWithGoogle: (credential: string) => Promise<{ user: User; created: boolean }>
  register: (data: { username: string; email: string; password: string; password_confirm: string }) => Promise<User>
  logout: () => Promise<void>
  clear: () => void
  refreshMe: () => Promise<void>
  setUser: (u: User) => void
}

function save(p: AuthPayload) {
  localStorage.setItem(ACCESS_KEY, p.access)
  localStorage.setItem(REFRESH_KEY, p.refresh)
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  ready: false,

  async init() {
    if (!localStorage.getItem(ACCESS_KEY)) {
      set({ ready: true })
      return
    }
    try {
      const { data } = await api.get<User>('/auth/me/')
      set({ user: data })
    } catch {
      get().clear()
    } finally {
      set({ ready: true })
    }
  },

  async login(login, password) {
    const { data } = await api.post<AuthPayload>('/auth/login/', { login, password })
    save(data)
    set({ user: data.user })
    return data.user
  },

  async loginWithGoogle(credential) {
    const { data } = await api.post<AuthPayload & { created: boolean }>('/auth/google/', { credential })
    save(data)
    set({ user: data.user })
    return { user: data.user, created: data.created }
  },

  async register(payload) {
    const { data } = await api.post<AuthPayload>('/auth/register/', payload)
    save(data)
    set({ user: data.user })
    return data.user
  },

  async logout() {
    try {
      await api.post('/auth/logout/', { refresh: localStorage.getItem(REFRESH_KEY) })
    } catch {
      /* токен мог уже истечь — не важно */
    }
    get().clear()
  },

  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    set({ user: null })
  },

  async refreshMe() {
    const { data } = await api.get<User>('/auth/me/')
    set({ user: data })
  },

  setUser(u) {
    set({ user: u })
  },
}))
