import { AnimatePresence, motion } from 'framer-motion'
import { Check, Crown, Eye, SkipForward, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import CircularTimer from '../../components/game/CircularTimer'
import GameShell from '../../components/game/GameShell'
import Scoreboard from '../../components/game/Scoreboard'
import Modal from '../../components/Modal'
import { useCountdown, useHotkeys, usePersistentState } from '../../hooks/useGameHooks'
import { sounds } from '../../lib/sounds'
import type { Question } from '../../lib/types'
import { useGame } from '../../store/game'

interface Outcome {
  teamId: number
  correct: boolean
}

export default function Strategic() {
  const { room, teams, addScore, finish, sessionId } = useGame()
  const navigate = useNavigate()

  // Колонки — категории, вопросы в колонке по возрастанию стоимости
  const columns = useMemo(
    () =>
      (room?.categories ?? [])
        .filter((c) => c.questions.length)
        .map((c) => ({ ...c, questions: [...c.questions].sort((a, b) => a.points - b.points || a.order - b.order) })),
    [room],
  )
  const rows = Math.max(0, ...columns.map((c) => c.questions.length))
  const total = columns.reduce((n, c) => n + c.questions.length, 0)

  const [results, setResults] = usePersistentState<Record<number, Outcome>>(`strategic_${sessionId}_results`, {})
  const [activeIdx, setActiveIdx] = usePersistentState(`strategic_${sessionId}_active`, 0)
  const [openId, setOpenId] = usePersistentState<number | null>(`strategic_${sessionId}_open`, null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [running, setRunning] = useState(true)

  const active = teams[activeIdx % Math.max(1, teams.length)]
  const current: (Question & { catName: string }) | null = useMemo(() => {
    for (const c of columns) {
      const q = c.questions.find((x) => x.id === openId)
      if (q) return { ...q, catName: c.name }
    }
    return null
  }, [columns, openId])

  const duration = room?.timer_duration ?? 60
  const { left, reset } = useCountdown(duration, running && !!current && !showAnswer, openId)

  useEffect(() => {
    setShowAnswer(false)
    setRunning(true)
  }, [openId])

  const end = async () => {
    await finish()
    navigate('/game/results')
  }

  const open = (q: Question) => {
    if (results[q.id] || current) return
    sounds.flip()
    setOpenId(q.id)
  }

  const judge = (correct: boolean) => {
    if (!current || !active) return
    if (correct) {
      addScore(active.id, current.points)
      sounds.correct()
    } else sounds.wrong()
    const next = { ...results, [current.id]: { teamId: active.id, correct } }
    setResults(next)
    setOpenId(null)
    setActiveIdx((activeIdx + 1) % teams.length)
    if (Object.keys(next).length >= total) setTimeout(() => void end(), 1200)
  }

  useHotkeys({
    enter: () => judge(true),
    escape: () => judge(false),
    space: () => current && setShowAnswer((s) => !s),
    p: () => setRunning((r) => !r),
  })

  if (!room || room.format !== 'strategic') return <Navigate to="/rooms" replace />

  return (
    <GameShell
      onFinish={end}
      hotkeys={[
        { key: 'Enter', label: 'верно' },
        { key: 'Esc', label: 'неверно' },
        { key: 'Space', label: 'ответ' },
      ]}
    >
      <div className="grid flex-1 gap-4 p-4 sm:p-6 xl:grid-cols-[1fr_320px]">
        <section className="flex flex-col">
          {/* Чей ход */}
          <AnimatePresence mode="wait">
            {active && (
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mb-4 flex items-center justify-center gap-3 rounded-2xl border p-3 text-lg font-bold"
                style={{ borderColor: active.color, background: `${active.color}1f` }}
              >
                <Crown className="text-yellow-400" fill="currentColor" size={22} />
                Ход команды: <span style={{ color: active.color }}>{active.name}</span>
                <button
                  onClick={() => setActiveIdx((activeIdx + 1) % teams.length)}
                  className="host-only ml-2 rounded-lg p-1.5 text-muted hover:bg-fg/10 hover:text-fg"
                  title="Передать ход следующей команде"
                >
                  <SkipForward size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Сетка категорий × стоимость */}
          <div className="scrollbar-thin -mx-1 flex-1 overflow-x-auto px-1 pb-2">
            <div className="grid min-w-max gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(130px, 1fr))` }}>
              {columns.map((c) => (
                <div
                  key={c.id}
                  className="flex min-h-[64px] items-center justify-center rounded-2xl bg-gradient-to-br from-green to-green-dark p-3 text-center text-sm font-extrabold uppercase tracking-wide text-white shadow-lg sm:text-base"
                >
                  {c.name}
                </div>
              ))}
              {Array.from({ length: rows }).map((_, r) =>
                columns.map((c) => {
                  const q = c.questions[r]
                  if (!q) return <div key={`${c.id}-${r}`} />
                  const res = results[q.id]
                  const team = res && teams.find((t) => t.id === res.teamId)
                  return (
                    <motion.button
                      key={q.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: r * 0.05 }}
                      whileHover={res ? {} : { scale: 1.05 }}
                      whileTap={res ? {} : { scale: 0.95 }}
                      onClick={() => open(q)}
                      disabled={!!res}
                      className={`relative flex aspect-[16/10] items-center justify-center rounded-2xl border text-3xl font-extrabold transition-colors sm:text-4xl ${
                        res ? 'cursor-default border-line bg-fg/5 text-fg/20' : 'glass text-green hover:border-green hover:shadow-[0_0_24px_rgba(16,185,129,0.3)]'
                      }`}
                    >
                      {q.points}
                      {res && team && (
                        <span className="absolute bottom-1.5 right-2 flex items-center gap-1 text-[10px] font-semibold">
                          <span className="h-2 w-2 rounded-full" style={{ background: team.color }} />
                          {res.correct ? <Check size={12} className="text-green" /> : <X size={12} className="text-red-400" />}
                        </span>
                      )}
                    </motion.button>
                  )
                }),
              )}
            </div>
          </div>
          <div className="mt-2 text-center text-sm text-muted">
            Сыграно {Object.keys(results).length} из {total}
          </div>
        </section>

        <aside className="glass h-fit rounded-3xl p-4 xl:sticky xl:top-4">
          <h3 className="mb-3 px-1 text-sm font-semibold uppercase tracking-widest text-muted">🏆 Табло</h3>
          <Scoreboard teams={teams} activeId={active?.id} onAdjust={addScore} />
        </aside>
      </div>

      {/* Модалка вопроса */}
      <Modal open={!!current} onClose={() => setOpenId(null)} closeOnEsc={false} size="xl" hideClose>
        {current && (
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold uppercase tracking-widest text-green">📂 {current.catName}</div>
                <div className="mt-1 text-4xl font-extrabold text-gradient">{current.points} балл.</div>
                {active && (
                  <div className="mt-2 flex items-center gap-2 text-muted">
                    <Crown size={16} className="text-yellow-400" fill="currentColor" /> Отвечает:{' '}
                    <b style={{ color: active.color }}>{active.name}</b>
                  </div>
                )}
              </div>
              <CircularTimer left={left} total={duration} size={110} running={running} onToggle={() => setRunning((r) => !r)} onReset={reset} />
            </div>

            <div className="flex flex-col items-center gap-5 py-4 text-center">
              {current.photo && <img src={current.photo} alt="" className="max-h-[38vh] max-w-full rounded-2xl border border-line object-contain" />}
              <p className="whitespace-pre-line text-2xl font-bold leading-snug sm:text-3xl">{current.text}</p>
            </div>

            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-green/40 bg-green/10 p-4 text-center"
                >
                  <div className="text-xs uppercase tracking-widest text-muted">Правильный ответ</div>
                  <div className="mt-1 text-2xl font-extrabold text-green">{current.answer}</div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="host-only grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
              <button onClick={() => setShowAnswer((s) => !s)} className="btn btn-ghost">
                <Eye size={18} /> {showAnswer ? 'Скрыть' : 'Ответ'}
              </button>
              <button onClick={() => judge(true)} className="btn btn-primary py-3.5 text-base">
                ✅ Правильно <kbd className="border-white/30 bg-white/10 text-white">Enter</kbd>
              </button>
              <button onClick={() => judge(false)} className="btn btn-danger py-3.5 text-base">
                ❌ Неправильно <kbd>Esc</kbd>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </GameShell>
  )
}
