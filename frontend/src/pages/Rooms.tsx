import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RoomCard from '../components/RoomCard'
import { api } from '../lib/api'
import type { GameFormat, RoomListItem } from '../lib/types'
import { FORMATS } from '../lib/utils'
import { useAuth } from '../store/auth'
import { useUI } from '../store/ui'

type Show = 'all' | 'mine' | 'liked'
type QCount = '' | '5-10' | '10-20' | '20+'

function ChipGroup<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {options.map((o) => (
          <button key={o.value} onClick={() => onChange(o.value)} className={`chip ${value === o.value ? 'active' : ''}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Rooms() {
  const user = useAuth((s) => s.user)
  const { openAuth, openStart } = useUI()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [fmt, setFmt] = useState<'' | GameFormat>('')
  const [qcount, setQcount] = useState<QCount>('')
  const [cats, setCats] = useState<string[]>([])
  const [show, setShow] = useState<Show>('all')
  const [allCats, setAllCats] = useState<string[]>([])
  const [rooms, setRooms] = useState<RoomListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    api.get<string[]>('/rooms/categories-list/').then(({ data }) => setAllCats(data)).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get<RoomListItem[]>('/rooms/', {
        params: {
          search: debounced || undefined,
          fmt: fmt || undefined,
          qcount: qcount || undefined,
          categories: cats.length ? cats.join(',') : undefined,
          show,
        },
      })
      .then(({ data }) => !cancelled && setRooms(data))
      .catch(() => !cancelled && setRooms([]))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [debounced, fmt, qcount, cats, show, user])

  const changeShow = (v: Show) => {
    if (v !== 'all' && !user) return openAuth('login', () => setShow(v))
    setShow(v)
  }

  const play = (room: RoomListItem) => (user ? openStart(room) : openAuth('register', () => openStart(room)))

  const activeFilters = (fmt ? 1 : 0) + (qcount ? 1 : 0) + cats.length
  const reset = () => {
    setFmt('')
    setQcount('')
    setCats([])
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">🎮 AO Rooms</h1>
          <p className="mt-1 text-muted">Готовые игры от сообщества — выбирайте и играйте</p>
        </div>
      </div>

      <div className="glass mb-8 space-y-4 rounded-2xl p-4 sm:p-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-10" placeholder="Поиск по названию комнаты…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg" aria-label="Очистить">
                <X size={16} />
              </button>
            )}
          </div>
          <button onClick={() => setFiltersOpen((o) => !o)} className={`btn btn-ghost relative px-3.5 md:hidden ${filtersOpen ? 'border-green text-green' : ''}`} aria-label="Фильтры">
            <SlidersHorizontal size={18} />
            {activeFilters > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-green text-[10px] font-bold text-white">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        <ChipGroup<Show>
          label="Показать"
          value={show}
          onChange={changeShow}
          options={[
            { value: 'all', label: 'Все комнаты' },
            { value: 'mine', label: 'Мои комнаты' },
            { value: 'liked', label: '❤️ Понравившиеся' },
          ]}
        />

        <div className={`${filtersOpen ? 'block' : 'hidden'} space-y-4 md:block`}>
          <ChipGroup<'' | GameFormat>
            label="Формат"
            value={fmt}
            onChange={setFmt}
            options={[
              { value: '', label: 'Все' },
              ...(Object.keys(FORMATS) as GameFormat[]).map((f) => ({ value: f, label: `${FORMATS[f].emoji} ${FORMATS[f].label}` })),
            ]}
          />
          <ChipGroup<QCount>
            label="Вопросов"
            value={qcount}
            onChange={setQcount}
            options={[
              { value: '', label: 'Все' },
              { value: '5-10', label: '5–10' },
              { value: '10-20', label: '10–20' },
              { value: '20+', label: '20+' },
            ]}
          />
          {allCats.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <span className="w-28 shrink-0 pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Категории</span>
              <div className="flex flex-wrap gap-2">
                {allCats.map((c) => {
                  const on = cats.includes(c)
                  return (
                    <button key={c} onClick={() => setCats((cs) => (on ? cs.filter((x) => x !== c) : [...cs, c]))} className={`chip ${on ? 'active' : ''}`}>
                      #{c}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {activeFilters > 0 && (
            <button onClick={reset} className="text-sm text-green hover:underline">
              Сбросить фильтры ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {loading && !rooms.length ? (
        <div className="flex justify-center py-24 text-muted">
          <Loader2 size={32} className="animate-spin" />
        </div>
      ) : rooms.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-3xl py-20 text-center">
          <div className="text-5xl">🔍</div>
          <h3 className="mt-4 text-xl font-bold">Ничего не найдено</h3>
          <p className="mt-1 text-muted">
            {show === 'liked' ? 'Вы ещё не лайкнули ни одной комнаты' : 'Попробуйте изменить запрос или фильтры'}
          </p>
          <button onClick={() => (user ? navigate('/create') : openAuth('register', () => navigate('/create')))} className="btn btn-primary mt-6">
            🎯 Создать свою АО
          </button>
        </motion.div>
      ) : (
        <motion.div layout className={`grid gap-5 sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''} transition-opacity`}>
          <AnimatePresence mode="popLayout">
            {rooms.map((r, i) => (
              <RoomCard
                key={r.id}
                room={r}
                index={i}
                showPrivacy={show === 'mine'}
                onPlay={() => play(r)}
                onClick={user && r.author.id === user.id ? () => navigate(`/rooms/${r.id}/edit`) : undefined}
                onLikeChange={(nr) => show === 'liked' && !nr.is_liked && setRooms((rs) => rs.filter((x) => x.id !== nr.id))}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
