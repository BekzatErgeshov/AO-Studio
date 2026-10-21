import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Ban, Check, Crown, Loader2, LockKeyhole, LogOut, Send, ShieldCheck, Trophy, Wifi, WifiOff, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import CircularTimer from '../../components/game/CircularTimer'
import Logo from '../../components/Logo'
import { useAnticheat } from '../../hooks/useAnticheat'
import { getTeamToken, teamTokenKey, useLiveState, useServerTimer } from '../../hooks/useLive'
import { api, errorMessage } from '../../lib/api'
import { sounds } from '../../lib/sounds'
import type { LiveCell, LivePayload, Team } from '../../lib/types'

function TeamChip({ team, big }: { team: Team; big?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${big ? 'text-lg' : ''}`}>
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: team.color, boxShadow: `0 0 8px ${team.color}` }} />
      <span className="truncate">{team.name}</span>
    </span>
  )
}

function Standings({ teams, meId }: { teams: Team[]; meId?: number }) {
  // Дисквалифицированные — вне зачёта, в конце списка и без номера места
  const ranked = [...teams].sort(
    (a, b) => Number(!!a.disqualified) - Number(!!b.disqualified) || b.score - a.score,
  )
  return (
    <div className="space-y-1.5">
      {ranked.map((t, i) => (
        <motion.div
          layout
          key={t.id}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
            t.disqualified
              ? 'border-red-400/30 bg-red-400/5 opacity-60'
              : t.id === meId
                ? 'border-green bg-green/10'
                : 'border-line bg-fg/[0.03]'
          }`}
        >
          <span className="w-5 text-center text-sm font-bold text-muted">
            {t.disqualified ? <Ban size={14} className="mx-auto text-red-400" /> : i + 1}
          </span>
          <span className="min-w-0 flex-1">
            <TeamChip team={t} />
            {t.disqualified && <span className="ml-1.5 text-xs font-semibold text-red-400">вне зачёта</span>}
          </span>
          <span className={`text-lg font-extrabold tabular-nums ${t.disqualified ? 'text-muted line-through' : ''}`}>{t.score}</span>
        </motion.div>
      ))}
    </div>
  )
}

/** Заглушка до входа в защищённый режим: без полного экрана вопрос не показываем */
function ArmGate({ warnings, allowed, onArm }: { warnings: number; allowed: number; onArm: () => void }) {
  const returning = warnings > 0
  return (
    <div className="glass rounded-3xl p-6 text-center">
      <LockKeyhole className="mx-auto text-green" size={44} />
      <h1 className="mt-3 text-2xl font-extrabold">{returning ? 'Вернитесь в игру' : 'Защищённый режим'}</h1>
      <p className="mt-2 text-muted">
        Игра идёт в полноэкранном режиме. Пока вы не вернётесь, вопрос и поле ответа скрыты.
      </p>
      <ul className="mt-5 space-y-2 text-left text-sm text-muted">
        <li className="flex gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-400" />
          Нельзя сворачивать игру, открывать другие вкладки и приложения.
        </li>
        <li className="flex gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-400" />
          {allowed > 0
            ? `Первый уход с экрана — предупреждение, следующий — дисквалификация.`
            : 'Любой уход с экрана — дисквалификация.'}
        </li>
        <li className="flex gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-400" />
          Ведущий видит каждое нарушение.
        </li>
      </ul>
      {returning && (
        <div className="mt-5 rounded-2xl border border-yellow-400/40 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-400">
          У вас {warnings} из {allowed + 1} нарушений. Ещё одно — и команда вне зачёта.
        </div>
      )}
      <button onClick={onArm} className="btn btn-primary mt-6 w-full py-3.5 text-base">
        <ShieldCheck size={20} /> {returning ? 'Вернуться в игру' : 'Войти в игру'}
      </button>
    </div>
  )
}

/** Экран дисквалифицированной команды */
function DqScreen({ reason, teams, meId }: { reason: string; teams: Team[]; meId: number }) {
  return (
    <div className="glass rounded-3xl border-red-400/40 p-6 text-center">
      <Ban className="mx-auto text-red-400" size={48} />
      <h1 className="mt-3 text-2xl font-extrabold text-red-400">Команда дисквалифицирована</h1>
      <p className="mt-2 text-muted">{reason || 'Вы покинули экран игры.'}</p>
      <p className="mt-3 text-sm text-muted">
        Ответы больше не принимаются, баллы заморожены. Если это ошибка — подойдите к ведущему: он может вернуть
        команду в игру.
      </p>
      <div className="mt-6 text-left">
        <Standings teams={teams} meId={meId} />
      </div>
    </div>
  )
}

/** Поле ответа команды. После отправки ответ изменить нельзя — поле блокируется. */
function AnswerBox({ code, questionId, current }: { code: string; questionId: number; current: string | null }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(current)

  // Новый вопрос — чистое поле
  useEffect(() => {
    setText('')
    setSent(current)
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId])

  useEffect(() => setSent((s) => s ?? current), [current])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() || sent) return
    setSending(true)
    setError('')
    try {
      const { data } = await api.post<{ text: string }>(
        `/live/${code}/answer/`,
        { question_id: questionId, text: text.trim() },
        { headers: { 'X-Team-Token': getTeamToken(code) ?? '' } },
      )
      setSent(data.text)
      sounds.flip()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="mt-5 rounded-2xl border border-green/40 bg-green/10 p-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-green">
          <Check size={16} /> Ответ отправлен
        </div>
        <div className="mt-1 text-lg font-bold">{sent}</div>
        <div className="mt-1.5 text-xs text-muted">Изменить его уже нельзя — ждём остальных.</div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-5">
      <div className="flex gap-2">
        <input
          className="input py-3.5 text-lg"
          placeholder="Ваш ответ"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" disabled={sending || !text.trim()} className="btn btn-primary px-5">
          {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>
      <div className="mt-2 text-xs text-muted">Ответ отправляется один раз — проверьте перед отправкой.</div>
      {error && <div className="mt-2 text-sm text-red-400">{error}</div>}
    </form>
  )
}

function Board({ cells, columns, code, data }: { cells?: LiveCell[]; columns?: { name: string; cells: LiveCell[] }[]; code: string; data: LivePayload }) {
  const myTurn = data.me && data.state.active_team === data.me.id
  const [picked, setPicked] = useState<number | null>(null)
  const [error, setError] = useState('')

  const pick = async (id: number) => {
    if (!myTurn) return
    setPicked(id)
    setError('')
    try {
      await api.post(`/live/${code}/pick/`, { question_id: id }, { headers: { 'X-Team-Token': getTeamToken(code) ?? '' } })
    } catch (err) {
      setPicked(null)
      setError(errorMessage(err))
    }
  }

  const cell = (c: LiveCell, label: string | number) => {
    const team = c.team ? data.teams.find((t) => t.id === c.team) : null
    const can = myTurn && !c.used
    return (
      <button
        key={c.id}
        disabled={!can}
        onClick={() => pick(c.id)}
        className={`relative flex aspect-[4/3] items-center justify-center rounded-xl border text-xl font-extrabold transition ${
          c.used
            ? 'border-line bg-fg/5 text-fg/20'
            : picked === c.id
              ? 'border-green bg-green text-white'
              : can
                ? 'border-green/60 bg-green/15 text-green active:scale-95'
                : 'border-line bg-fg/[0.04] text-fg/70'
        }`}
      >
        {label}
        {c.used && team && (
          <span className="absolute bottom-1 right-1.5 flex items-center gap-0.5">
            <span className="h-2 w-2 rounded-full" style={{ background: team.color }} />
            {c.correct ? <Check size={11} className="text-green" /> : <X size={11} className="text-red-400" />}
          </span>
        )}
      </button>
    )
  }

  return (
    <div>
      <div className={`mb-4 rounded-2xl border p-3 text-center font-bold ${myTurn ? 'border-green bg-green/15 text-green' : 'border-line'}`}>
        {myTurn ? (
          <motion.span animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="inline-block">
            👑 Ваш ход! Выберите {columns ? 'вопрос' : 'карточку'}
          </motion.span>
        ) : (
          <span className="text-muted">
            Выбирает:{' '}
            {(() => {
              const t = data.teams.find((x) => x.id === data.state.active_team)
              return t ? <TeamChip team={t} /> : '…'
            })()}
          </span>
        )}
      </div>
      {error && <div className="mb-3 text-center text-sm text-red-400">{error}</div>}
      {columns ? (
        <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
          <div className="grid min-w-max gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(76px, 1fr))` }}>
            {columns.map((col) => (
              <div key={col.name} className="flex flex-col gap-2">
                <div className="flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-br from-green to-green-dark p-1.5 text-center text-xs font-bold uppercase text-white">
                  {col.name}
                </div>
                {col.cells.map((c) => cell(c, c.points ?? ''))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">{(cells ?? []).map((c) => cell(c, c.n ?? ''))}</div>
      )}
    </div>
  )
}

export default function Play() {
  const { code = '' } = useParams()
  const upper = code.toUpperCase()
  const navigate = useNavigate()
  const { data, error, fetchedAt } = useLiveState(upper)
  const timer = useServerTimer(data?.timer, fetchedAt)
  const lastQuestion = useRef<number | null>(null)
  const confettiDone = useRef(false)

  const state = data?.state ?? {}
  const finished = data?.status === 'finished' || state.view === 'results'

  // Античит: игра держится в полном экране, уход с экрана = нарушение (см. useAnticheat)
  const ac = useAnticheat({
    code: upper,
    enabled: !!data?.anticheat,
    active: data?.status === 'active' && !finished,
    server: data?.me ? { warnings: data.me.warnings ?? 0, disqualified: !!data.me.disqualified, dq_reason: data.me.dq_reason ?? '' } : null,
  })

  // Игра закончилась — отпускаем телефон
  useEffect(() => {
    if (finished && document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }, [finished])

  // Звук на новый вопрос, конфетти в конце
  useEffect(() => {
    const qid = state.view === 'question' ? state.question?.id ?? null : null
    if (qid && qid !== lastQuestion.current) sounds.flip()
    lastQuestion.current = qid
  }, [state.view, state.question?.id])

  useEffect(() => {
    if (finished && !confettiDone.current) {
      confettiDone.current = true
      sounds.fanfare()
      confetti({ particleCount: 140, spread: 90, origin: { y: 0.4 }, colors: ['#10B981', '#34D399', '#FBBF24', '#ffffff'] })
    }
  }, [finished])

  if (!getTeamToken(upper)) return <Navigate to={`/join/${upper}`} replace />

  if (error === 'not_found') {
    return (
      <Centered>
        <div className="text-5xl">🔍</div>
        <h1 className="mt-3 text-xl font-bold">Игра не найдена</h1>
        <p className="mt-1 text-muted">Проверьте код у ведущего</p>
        <Link to="/join" className="btn btn-primary mt-6">Ввести другой код</Link>
      </Centered>
    )
  }

  if (!data) {
    return (
      <Centered>
        <Loader2 className="animate-spin text-green" size={32} />
        <p className="mt-3 text-muted">Подключаемся к игре…</p>
      </Centered>
    )
  }

  // Ведущий убрал команду (или токен от другой игры)
  if (!data.me) {
    localStorage.removeItem(teamTokenKey(upper))
    return (
      <Centered>
        <div className="text-5xl">🚪</div>
        <h1 className="mt-3 text-xl font-bold">Вы не в этой игре</h1>
        <p className="mt-1 text-muted">Возможно, ведущий убрал команду из списка.</p>
        {data.status === 'lobby' && (
          <button onClick={() => navigate(`/join/${upper}`)} className="btn btn-primary mt-6">Присоединиться снова</button>
        )}
      </Centered>
    )
  }

  const me = data.me
  const myTeam = data.teams.find((t) => t.id === me.id) ?? me
  const place = [...data.teams].sort((a, b) => b.score - a.score).findIndex((t) => t.id === me.id) + 1
  const q = state.question
  const answeringTeam = state.answer_team ? data.teams.find((t) => t.id === state.answer_team) : null
  const canAnswer = state.view === 'question' && state.accepting && q && (!state.answer_team || state.answer_team === me.id)

  return (
    <div className="relative min-h-screen pb-10">
      <div className="bg-aurora" />

      {/* Шапка: игра и моя команда */}
      <header className="glass sticky top-0 z-20 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-2.5">
        <Logo size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-muted">{data.room.title}</div>
          <TeamChip team={myTeam} />
        </div>
        <div className="text-right">
          <div className="text-xl font-extrabold leading-none tabular-nums">{myTeam.score}</div>
          <div className="text-[10px] text-muted">{place} место</div>
        </div>
        <span title={error ? 'Нет связи' : 'Онлайн'} className={error ? 'text-red-400' : 'text-green'}>
          {error ? <WifiOff size={16} /> : <Wifi size={16} />}
        </span>
        {data.anticheat && !finished && (
          <span
            title={
              ac.disqualified
                ? 'Команда дисквалифицирована'
                : ac.warnings > 0
                  ? `Нарушений: ${ac.warnings} из ${(data.warnings_allowed ?? 1) + 1}`
                  : 'Защищённый режим включён'
            }
            className={ac.disqualified ? 'text-red-400' : ac.warnings > 0 ? 'text-yellow-400' : 'text-green'}
          >
            {ac.disqualified ? <Ban size={16} /> : ac.warnings > 0 ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
          </span>
        )}
      </header>

      <main className="relative z-10 mx-auto max-w-2xl px-4 pt-5">
        {/* Предупреждение после первого ухода с экрана */}
        <AnimatePresence>
          {ac.lastWarning && !ac.disqualified && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 flex items-start gap-3 rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-4"
            >
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-yellow-400" />
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-bold text-yellow-400">Предупреждение {ac.warnings} из {(data.warnings_allowed ?? 1) + 1}</div>
                <div className="mt-0.5 text-muted">{ac.lastWarning}. Ещё одно нарушение — дисквалификация.</div>
              </div>
              <button onClick={ac.dismiss} className="shrink-0 rounded-lg p-1 text-muted hover:text-fg" aria-label="Скрыть">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!finished && ac.disqualified ? (
          <DqScreen reason={ac.dqReason} teams={data.teams} meId={me.id} />
        ) : !finished && ac.needsArm ? (
          <ArmGate warnings={ac.warnings} allowed={data.warnings_allowed ?? 1} onArm={ac.arm} />
        ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${finished ? 'results' : state.view}-${q?.id ?? ''}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {finished ? (
              <div className="glass rounded-3xl p-6 text-center">
                <Trophy className="mx-auto text-yellow-400" size={44} />
                <h1 className="mt-3 text-2xl font-extrabold">Игра окончена!</h1>
                <p className="mt-1 text-muted">
                  Ваша команда — <b className="text-fg">{place} место</b> с {myTeam.score} баллами
                </p>
                <div className="mt-6 text-left">
                  <Standings teams={data.teams} meId={me.id} />
                </div>
                <Link
                  to="/"
                  onClick={() => localStorage.removeItem(teamTokenKey(upper))}
                  className="btn btn-ghost mt-6"
                >
                  <LogOut size={16} /> На главную
                </Link>
              </div>
            ) : data.status === 'lobby' || state.view === 'lobby' ? (
              <div className="glass rounded-3xl p-6 text-center">
                <div className="text-5xl">✅</div>
                <h1 className="mt-3 text-2xl font-extrabold">Вы в игре!</h1>
                <p className="mt-1 text-muted">Ждём, когда ведущий начнёт. Не закрывайте эту страницу.</p>
                {data.anticheat && (
                  <div className="mt-4 rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-4 text-left text-sm">
                    <div className="flex items-center gap-2 font-bold text-yellow-400">
                      <ShieldCheck size={16} /> Игра идёт в защищённом режиме
                    </div>
                    <p className="mt-1.5 text-muted">
                      После старта игра развернётся на весь экран. Нельзя сворачивать её, переключаться на другие
                      вкладки и приложения: первый раз — предупреждение, второй — дисквалификация. Отключите
                      уведомления и не принимайте звонки на этом устройстве.
                    </p>
                  </div>
                )}
                <div className="mt-6 text-left">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Команды ({data.teams.length})</div>
                  <div className="flex flex-wrap gap-2">
                    {data.teams.map((t) => (
                      <span key={t.id} className={`rounded-full border px-3 py-1.5 text-sm ${t.id === me.id ? 'border-green bg-green/10' : 'border-line'}`}>
                        <TeamChip team={t} />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : state.view === 'question' && q ? (
              <div className="glass rounded-3xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {state.category && <div className="text-xs font-semibold uppercase tracking-widest text-green">📂 {state.category}</div>}
                    <div className="mt-1 text-sm text-muted">
                      {state.number && state.total ? `Вопрос ${state.number} из ${state.total} · ` : ''}
                      {q.points ? <b className="text-fg">{q.points} балл.</b> : null}
                    </div>
                  </div>
                  {timer && (
                    <CircularTimer
                      left={timer.left}
                      exact={timer.exact}
                      // Полный круг — время на вопрос, заданное ведущим
                      total={state.duration ?? Math.max(timer.left, 1)}
                      size={76}
                      showControls={false}
                      running={data.timer?.running}
                    />
                  )}
                </div>

                {q.photo && <img src={q.photo} alt="" className="mt-4 max-h-[35vh] w-full rounded-2xl border border-line object-contain" />}
                <p className="mt-4 whitespace-pre-line text-xl font-bold leading-snug sm:text-2xl">{q.text}</p>

                {state.reveal ? (
                  <div className="mt-5 rounded-2xl border border-green/40 bg-green/10 p-4 text-center">
                    <div className="text-xs uppercase tracking-widest text-muted">Правильный ответ</div>
                    <div className="mt-1 text-xl font-extrabold text-green">{state.reveal}</div>
                    {data.my_answer && <div className="mt-2 text-sm text-muted">Ваш ответ: {data.my_answer}</div>}
                  </div>
                ) : canAnswer ? (
                  <AnswerBox code={upper} questionId={q.id} current={data.my_answer} />
                ) : answeringTeam && answeringTeam.id !== me.id ? (
                  <div className="mt-5 rounded-2xl border border-line p-4 text-center text-muted">
                    Отвечает команда <TeamChip team={answeringTeam} />
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-line p-4 text-center text-muted">
                    {data.my_answer ? `Ваш ответ принят: «${data.my_answer}». Ждём ведущего…` : 'Приём ответов закрыт'}
                  </div>
                )}
              </div>
            ) : state.view === 'review' && state.items ? (
              <div className="glass rounded-3xl p-5">
                <h2 className="text-xl font-extrabold">✅ Правильные ответы</h2>
                {state.category && <p className="text-sm text-muted">Категория «{state.category}»</p>}
                <div className="mt-4 space-y-2.5">
                  {state.items.map((it, i) => {
                    const ok = it.correct.includes(me.id)
                    return (
                      <div key={it.id} className="rounded-2xl border border-line bg-fg/[0.03] p-3.5">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 text-xs font-bold text-muted">{i + 1}.</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-muted">{it.text}</p>
                            <p className="font-bold text-green">→ {it.answer}</p>
                          </div>
                          <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${ok ? 'bg-green text-white' : 'bg-fg/5 text-muted'}`}>
                            {ok ? `+${it.points}` : '—'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : state.view === 'grid' ? (
              <Board columns={state.columns} code={upper} data={data} />
            ) : state.view === 'tiles' ? (
              <Board cells={state.tiles} code={upper} data={data} />
            ) : (
              <Centered inline>
                <Loader2 className="animate-spin text-green" size={28} />
                <p className="mt-3 text-muted">Ведущий готовит следующий вопрос…</p>
              </Centered>
            )}
          </motion.div>
        </AnimatePresence>
        )}

        {!finished && data.status !== 'lobby' && !ac.disqualified && (
          <section className="mt-6">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted">
              <Crown size={14} /> Табло
            </div>
            <Standings teams={data.teams} meId={me.id} />
          </section>
        )}
      </main>
    </div>
  )
}

function Centered({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <div className={`relative flex flex-col items-center justify-center px-4 text-center ${inline ? 'py-16' : 'min-h-screen'}`}>
      {!inline && <div className="bg-aurora" />}
      <div className="relative z-10 flex flex-col items-center">{children}</div>
    </div>
  )
}
