import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Loader2, Plus, Rocket, Search, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import type { GameSession, RoomDetail, RoomListItem } from '../lib/types'
import { plural, randomTeamColor, uid } from '../lib/utils'
import { useGame } from '../store/game'
import { useUI } from '../store/ui'
import FormatBadge from './FormatBadge'
import Modal from './Modal'

interface TeamDraft {
  key: string
  name: string
  color: string
}

function newTeam(existing: TeamDraft[]): TeamDraft {
  return { key: uid(), name: '', color: randomTeamColor(existing.map((t) => t.color)) }
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export default function StartGameModal() {
  const { startModal, startRoom, closeStart } = useUI()
  const startGame = useGame((s) => s.start)
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2>(1)
  const [room, setRoom] = useState<RoomListItem | null>(null)
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [rooms, setRooms] = useState<RoomListItem[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [teams, setTeams] = useState<TeamDraft[]>([])
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)

  // Сброс при открытии
  useEffect(() => {
    if (!startModal) return
    const t1 = newTeam([])
    setTeams([t1, newTeam([t1])])
    setError('')
    setSearch('')
    if (startRoom) {
      setRoom(startRoom)
      setStep(2)
    } else {
      setRoom(null)
      setStep(1)
    }
  }, [startModal, startRoom])

  useEffect(() => {
    if (!startModal || step !== 1) return
    let cancelled = false
    setLoadingRooms(true)
    api
      .get<RoomListItem[]>('/rooms/', { params: { show: 'available', search: q || undefined } })
      .then(({ data }) => !cancelled && setRooms(data))
      .catch(() => !cancelled && setRooms([]))
      .finally(() => !cancelled && setLoadingRooms(false))
    return () => {
      cancelled = true
    }
  }, [startModal, step, q])

  const updateTeam = (key: string, name: string) => setTeams((ts) => ts.map((t) => (t.key === key ? { ...t, name } : t)))

  const begin = async () => {
    if (!room) return
    const named = teams.map((t, i) => ({ ...t, name: t.name.trim() || `Команда ${i + 1}` }))
    setStarting(true)
    setError('')
    try {
      const [{ data: detail }, { data: session }] = await Promise.all([
        api.get<RoomDetail>(`/rooms/${room.id}/`),
        api.post<GameSession>('/game/start/', {
          room_id: room.id,
          teams: named.map((t) => ({ name: t.name, color: t.color })),
        }),
      ])
      startGame(session.id, detail, session.teams)
      // Чистим прогресс предыдущей игры
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith('ao_progress'))
        .forEach((k) => sessionStorage.removeItem(k))
      closeStart()
      navigate(`/game/${detail.format}`)
    } catch (err) {
      setError(errorMessage(err, 'Не удалось начать игру.'))
    } finally {
      setStarting(false)
    }
  }

  return (
    <Modal
      open={startModal}
      onClose={closeStart}
      size="lg"
      title={
        <div className="flex items-center gap-3">
          {step === 2 && !startRoom && (
            <button onClick={() => setStep(1)} className="rounded-full p-1.5 text-muted hover:bg-fg/10 hover:text-fg" aria-label="Назад">
              <ArrowLeft size={18} />
            </button>
          )}
          <span>{step === 1 ? '▶️ Выберите AO комнату' : '👥 Настройка команд'}</span>
        </div>
      }
    >
      <div className="mb-5 flex gap-2">
        {[1, 2].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? 'bg-green' : 'bg-line'}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div key="s1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="relative mb-4">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className="input pl-10"
                placeholder="Поиск комнаты по названию…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="scrollbar-thin -mx-1 max-h-[50vh] space-y-2 overflow-y-auto px-1">
              {loadingRooms && !rooms.length ? (
                <div className="flex justify-center py-10 text-muted">
                  <Loader2 className="animate-spin" />
                </div>
              ) : rooms.length === 0 ? (
                <div className="py-10 text-center text-muted">Комнаты не найдены</div>
              ) : (
                rooms.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setRoom(r)
                      setStep(2)
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-fg/[0.02] p-4 text-left transition hover:border-green/60 hover:bg-green/5"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{r.title}</div>
                      <div className="mt-1 text-xs text-muted">
                        @{r.author.username} · {r.questions_count} {plural(r.questions_count, 'вопрос', 'вопроса', 'вопросов')}
                      </div>
                    </div>
                    <FormatBadge format={r.format} compact />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            {room && (
              <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-green/30 bg-green/10 p-4">
                <div className="min-w-0">
                  <div className="text-xs text-muted">Комната</div>
                  <div className="truncate font-bold">{room.title}</div>
                </div>
                <FormatBadge format={room.format} compact />
              </div>
            )}

            <div className="mb-3 flex items-center gap-2 text-sm text-muted">
              <Users size={16} /> {teams.length} {plural(teams.length, 'команда', 'команды', 'команд')}
            </div>

            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {teams.map((t, i) => (
                  <motion.div
                    key={t.key}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2"
                  >
                    <button
                      type="button"
                      title="Сменить цвет"
                      onClick={() =>
                        setTeams((ts) => ts.map((x) => (x.key === t.key ? { ...x, color: randomTeamColor(ts.map((y) => y.color)) } : x)))
                      }
                      className="h-10 w-10 shrink-0 rounded-xl ring-2 ring-white/20 transition hover:scale-105"
                      style={{ background: t.color }}
                    />
                    <input
                      className="input"
                      placeholder={`Команда ${i + 1}`}
                      value={t.name}
                      maxLength={100}
                      onChange={(e) => updateTeam(t.key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          setTeams((ts) => [...ts, newTeam(ts)])
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={teams.length <= 1}
                      onClick={() => setTeams((ts) => ts.filter((x) => x.key !== t.key))}
                      className="rounded-xl p-2.5 text-muted transition hover:bg-red-400/10 hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent"
                      aria-label="Удалить команду"
                    >
                      <Trash2 size={18} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <button onClick={() => setTeams((ts) => [...ts, newTeam(ts)])} className="btn btn-ghost mt-3 w-full border-dashed">
              <Plus size={18} /> Добавить команду
            </button>

            {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-400">{error}</div>}

            <button onClick={begin} disabled={starting || !teams.length} className="btn btn-primary mt-5 w-full py-3.5 text-base">
              {starting ? <Loader2 size={20} className="animate-spin" /> : <Rocket size={20} />} Начать игру
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  )
}
