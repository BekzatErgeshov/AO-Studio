import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, ChevronRight, Eye } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import CircularTimer from '../../components/game/CircularTimer'
import GameShell from '../../components/game/GameShell'
import Scoreboard from '../../components/game/Scoreboard'
import { useCountdown, useHotkeys, usePersistentState } from '../../hooks/useGameHooks'
import { sounds } from '../../lib/sounds'
import { useGame } from '../../store/game'

type Phase = 'question' | 'review'

export default function Classic() {
  const { room, teams, addScore, finish, sessionId } = useGame()
  const navigate = useNavigate()

  const cats = (room?.categories ?? []).filter((c) => c.questions.length)
  const [catIdx, setCatIdx] = usePersistentState(`classic_${sessionId}_cat`, 0)
  const [qIdx, setQIdx] = usePersistentState(`classic_${sessionId}_q`, 0)
  const [phase, setPhase] = usePersistentState<Phase>(`classic_${sessionId}_phase`, 'question')
  // Отметки правильных ответов: questionId → [teamId]
  const [marks, setMarks] = usePersistentState<Record<number, number[]>>(`classic_${sessionId}_marks`, {})
  const [running, setRunning] = useState(true)

  const cat = cats[catIdx]
  const q = cat?.questions[qIdx]
  const duration = room?.timer_duration ?? 60
  const { left, reset } = useCountdown(duration, running && phase === 'question', `${catIdx}-${qIdx}-${phase}`)

  useEffect(() => {
    setRunning(true)
  }, [catIdx, qIdx, phase])

  const isLastQ = cat && qIdx >= cat.questions.length - 1
  const isLastCat = catIdx >= cats.length - 1

  const end = async () => {
    await finish()
    navigate('/game/results')
  }

  const next = () => {
    if (phase === 'question') {
      if (isLastQ) setPhase('review')
      else setQIdx(qIdx + 1)
    } else if (isLastCat) {
      void end()
    } else {
      setCatIdx(catIdx + 1)
      setQIdx(0)
      setPhase('question')
    }
  }

  const toggleMark = (questionId: number, points: number, teamId: number) => {
    const cur = marks[questionId] ?? []
    const on = cur.includes(teamId)
    setMarks({ ...marks, [questionId]: on ? cur.filter((t) => t !== teamId) : [...cur, teamId] })
    addScore(teamId, on ? -points : points)
    if (on) sounds.wrong()
    else sounds.correct()
  }

  useHotkeys({ space: next, p: () => setRunning((r) => !r) })

  if (!room || room.format !== 'classic') return <Navigate to="/rooms" replace />
  if (!cat) return <Navigate to="/game/results" replace />

  return (
    <GameShell onFinish={end} hotkeys={[{ key: 'Space', label: 'далее' }, { key: 'P', label: 'пауза' }]}>
      <div className="grid flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_340px]">
        {/* Левая часть — вопрос / разбор */}
        <section className="flex min-h-[60vh] flex-col">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {cats.map((c, i) => (
              <span
                key={c.id}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  i === catIdx ? 'bg-green text-white' : i < catIdx ? 'bg-green/15 text-green' : 'bg-fg/5 text-muted'
                }`}
              >
                {c.name}
              </span>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {phase === 'question' && q ? (
              <motion.div
                key={`q-${q.id}`}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.35 }}
                className="glass flex flex-1 flex-col rounded-3xl p-6 sm:p-10"
              >
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-widest text-green">📂 {cat.name}</div>
                    <div className="mt-1 text-muted">
                      Вопрос {qIdx + 1} из {cat.questions.length} · <b className="text-fg">{q.points}</b> балл.
                    </div>
                  </div>
                  <CircularTimer
                    left={left}
                    total={duration}
                    size={110}
                    running={running}
                    onToggle={() => setRunning((r) => !r)}
                    onReset={() => {
                      reset()
                      setRunning(true)
                    }}
                  />
                </div>

                <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                  {q.photo && <img src={q.photo} alt="" className="max-h-[40vh] max-w-full rounded-2xl border border-line object-contain" />}
                  <p className="max-w-4xl whitespace-pre-line text-2xl font-bold leading-snug sm:text-4xl">{q.text}</p>
                </div>

                <div className="host-only mt-8 flex justify-end">
                  <button onClick={next} className="btn btn-primary px-6 py-3">
                    {isLastQ ? (
                      <>
                        <Eye size={18} /> К правильным ответам
                      </>
                    ) : (
                      <>
                        Следующий вопрос <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`r-${cat.id}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                className="glass flex flex-1 flex-col rounded-3xl p-5 sm:p-8"
              >
                <h2 className="text-2xl font-extrabold sm:text-3xl">✅ Правильные ответы</h2>
                <p className="mt-1 text-muted">
                  Категория «{cat.name}». <span className="host-only">Отметьте команды, ответившие верно.</span>
                </p>

                <div className="scrollbar-thin mt-6 flex-1 space-y-3 overflow-y-auto">
                  {cat.questions.map((cq, i) => (
                    <motion.div
                      key={cq.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="rounded-2xl border border-line bg-fg/[0.03] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green/15 text-xs font-bold text-green">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-muted">{cq.text}</p>
                          <p className="mt-1 text-lg font-bold text-green">→ {cq.answer}</p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-fg/5 px-2 py-1 text-xs font-bold">{cq.points} б.</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 pl-10">
                        {teams.map((t) => {
                          const on = (marks[cq.id] ?? []).includes(t.id)
                          return (
                            <motion.button
                              key={t.id}
                              whileTap={{ scale: 0.92 }}
                              onClick={() => toggleMark(cq.id, cq.points, t.id)}
                              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                                on ? 'text-white' : 'border-line text-muted hover:text-fg'
                              }`}
                              style={on ? { background: t.color, borderColor: t.color } : undefined}
                            >
                              {on ? <Check size={14} strokeWidth={3} /> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />}
                              {t.name}
                            </motion.button>
                          )
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="host-only mt-6 flex justify-end">
                  <button onClick={next} className="btn btn-primary px-6 py-3">
                    {isLastCat ? '🏆 Завершить игру' : (
                      <>
                        Следующая категория <ChevronRight size={18} />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Правая часть — табло */}
        <aside className="glass h-fit rounded-3xl p-4 lg:sticky lg:top-4">
          <h3 className="mb-3 px-1 text-sm font-semibold uppercase tracking-widest text-muted">🏆 Табло</h3>
          <Scoreboard teams={teams} onAdjust={addScore} />
        </aside>
      </div>
    </GameShell>
  )
}
