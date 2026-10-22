import { motion } from 'framer-motion'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Logo from '../../components/Logo'
import { getTeamToken, teamTokenKey } from '../../hooks/useLive'
import { api, errorMessage } from '../../lib/api'
import type { LivePayload } from '../../lib/types'
import { plural } from '../../lib/utils'

/** Вход команды в онлайн-игру: код комнаты + название команды. Аккаунт не нужен. */
export default function Join() {
  const params = useParams()
  const navigate = useNavigate()
  const [code, setCode] = useState((params.code ?? '').toUpperCase())
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [game, setGame] = useState<LivePayload | null>(null)
  const room = game?.room ?? null

  const validCode = /^[A-Z0-9]{6}$/.test(code)

  // Уже в этой игре с этого устройства — сразу на игровой экран
  useEffect(() => {
    if (validCode && getTeamToken(code)) navigate(`/play/${code}`, { replace: true })
  }, [code, validCode, navigate])

  // Подсказываем, к какой игре подключаемся и какой состав ждёт ведущий
  useEffect(() => {
    setGame(null)
    if (!validCode) return
    api
      .get<LivePayload>(`/live/${code}/`)
      .then(({ data }) => setGame(data))
      .catch(() => setGame(null))
  }, [code, validCode])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validCode) return setError('Код — 6 символов, его показывает ведущий')
    if (name.trim().length < 2) return setError('Введите название команды')
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post<LivePayload & { token: string }>(`/live/${code}/join/`, { name: name.trim() })
      localStorage.setItem(teamTokenKey(code), data.token)
      navigate(`/play/${code}`, { replace: true })
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      setError(status === 404 ? 'Игра с таким кодом не найдена' : errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="bg-aurora" />
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass relative z-10 w-full max-w-sm rounded-3xl p-6 sm:p-8"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={52} />
          <h1 className="mt-4 text-2xl font-extrabold">Войти в игру</h1>
          <p className="mt-1 text-sm text-muted">Код показывает ведущий на экране</p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Код комнаты</span>
          <input
            className="input text-center font-mono text-3xl font-extrabold uppercase tracking-[0.3em]"
            value={code}
            maxLength={6}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABC123"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            autoFocus={!params.code}
          />
        </label>
        {room && (
          <div className="mt-2 text-center text-sm text-green">🎯 {room.title}</div>
        )}
        {game && (game.expected_teams > 0 || game.team_size > 0) && (
          <div className="mt-1 text-center text-xs text-muted">
            {game.expected_teams > 0 && `Команд: ${game.teams.length} из ${game.expected_teams}`}
            {game.expected_teams > 0 && game.team_size > 0 && ' · '}
            {game.team_size > 0 && `по ${game.team_size} ${plural(game.team_size, 'игроку', 'игрока', 'игроков')}`}
          </div>
        )}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Название команды или ваше имя</span>
          <input
            className="input text-lg"
            value={name}
            maxLength={40}
            placeholder="Например: Ала-Тоо"
            onChange={(e) => setName(e.target.value)}
            autoFocus={!!params.code}
          />
        </label>
        <p className="mt-1.5 text-xs text-muted">
          Одна команда играет с одного устройства — подключается кто-то один за всю команду.
        </p>

        {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-400">{error}</div>}

        <button type="submit" disabled={loading} className="btn btn-primary mt-6 w-full py-3.5 text-base">
          {loading ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />} Присоединиться
        </button>
      </motion.form>
    </div>
  )
}
