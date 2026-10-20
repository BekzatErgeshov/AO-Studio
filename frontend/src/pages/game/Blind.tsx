import { AnimatePresence, motion } from 'framer-motion'
import { Check, Crown, Eye, SkipForward, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useNavigate } from 'react-router-dom'
import CircularTimer from '../../components/game/CircularTimer'
import GameShell from '../../components/game/GameShell'
import Scoreboard from '../../components/game/Scoreboard'
import { useCountdown, useHotkeys, usePersistentState } from '../../hooks/useGameHooks'
import { useLiveAnswers, usePublishState } from '../../hooks/useLive'
import { sounds } from '../../lib/sounds'
import type { LiveState } from '../../lib/types'
import { shuffle } from '../../lib/utils'
import { useGame } from '../../store/game'

type Bonus = 'double' | 'skip' | 'steal'

const BONUSES: Record<Bonus, { emoji: string; title: string; text: string }> = {
  double: { emoji: '🌟', title: 'Двойные баллы!', text: 'За правильный ответ — x2 балла' },
  skip: { emoji: '⏭️', title: 'Пропуск хода!', text: 'Команда пропускает ход, карточка остаётся закрытой' },
  steal: { emoji: '🎯', title: 'Кража вопроса!', text: 'После ответа команда выбирает ещё раз' },
}

interface Outcome {
  teamId: number
  correct: boolean
}

function rollBonus(): Bonus | null {
  if (Math.random() >= 0.2) return null
  const all: Bonus[] = ['double', 'skip', 'steal']
  return all[Math.floor(Math.random() * all.length)]
}

export default function Blind() {
  const { room, teams, addScore, finish, sessionId } = useGame()
  const navigate = useNavigate()

  const questions = room?.questions ?? []
  // Порядок карточек перемешивается один раз за игру
  const [order] = usePersistentState<number[]>(`blind_${sessionId}_order`, () => shuffle(questions.map((q) => q.id)))
  const [results, setResults] = usePersistentState<Record<number, Outcome>>(`blind_${sessionId}_results`, {})
  const [activeIdx, setActiveIdx] = usePersistentState(`blind_${sessionId}_active`, 0)
  const [openId, setOpenId] = useState<number | null>(null)
  const [bonus, setBonus] = useState<Bonus | null>(null)
  const [stage, setStage] = useState<'bonus' | 'question' | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [running, setRunning] = useState(false)

  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])
  const current = openId != null ? byId.get(openId) : undefined
  const active = teams[activeIdx % Math.max(1, teams.length)]
  const duration = room?.timer_duration ?? 60
  const { left, reset } = useCountdown(duration, running && stage === 'question' && !showAnswer, openId)
  const cardNumber = openId != null ? order.indexOf(openId) + 1 : 0

  const end = async () => {
    await finish()
    navigate('/game/results')
  }

  const nextTeam = () => setActiveIdx((activeIdx + 1) % teams.length)

  const revealQuestion = () => {
    setStage('question')
    setFlipped(false)
    setTimeout(() => {
      sounds.flip()
      setFlipped(true)
      setRunning(true)
    }, 350)
  }

  const pick = (id: number) => {
    if (results[id] || openId != null) return
    sounds.flip()
    setOpenId(id)
    setShowAnswer(false)
    setRunning(false)
    const b = rollBonus()
    setBonus(b)
    if (b) {
      setStage('bonus')
      setTimeout(() => sounds.bonus(), 150)
    } else revealQuestion()
  }

  // После показа бонуса — продолжаем
  useEffect(() => {
    if (stage !== 'bonus' || !bonus) return
    const t = setTimeout(() => {
      if (bonus === 'skip') {
        setOpenId(null)
        setStage(null)
        setBonus(null)
        nextTeam()
      } else revealQuestion()
    }, 2600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, bonus])

  const judge = (correct: boolean) => {
    if (stage !== 'question' || !current || !active) return
    const pts = bonus === 'double' ? 2 : 1
    if (correct) {
      addScore(active.id, pts)
      sounds.correct()
    } else sounds.wrong()
    const next = { ...results, [current.id]: { teamId: active.id, correct } }
    setResults(next)
    if (bonus !== 'steal') nextTeam()
    setOpenId(null)
    setStage(null)
    setBonus(null)
    setFlipped(false)
    if (Object.keys(next).length >= order.length) setTimeout(() => void end(), 1200)
  }

  useHotkeys({
    enter: () => judge(true),
    escape: () => judge(false),
    space: () => stage === 'question' && setShowAnswer((s) => !s),
    p: () => setRunning((r) => !r),
  })

  // ---------- Онлайн: что видят команды, их ответы и выбор карточки ----------
  const liveState: LiveState =
    stage === 'bonus' && bonus
      ? { view: 'bonus', bonus, active_team: active?.id ?? null }
      : stage === 'question' && current
        ? {
            view: 'question',
            question: { id: current.id, text: current.text, photo: current.photo, points: bonus === 'double' ? 2 : 1 },
            accepting: true,
            answer_team: active?.id ?? null,
            reveal: showAnswer ? current.answer : null,
            bonus,
          }
        : {
            view: 'tiles',
            active_team: active?.id ?? null,
            available: order.filter((id) => !results[id]),
            tiles: order.map((id, i) => ({
              id,
              n: i + 1,
              used: !!results[id],
              team: results[id]?.teamId ?? null,
              correct: results[id]?.correct,
            })),
          }
  usePublishState(liveState, stage === 'question' ? { left, running: running && !showAnswer } : null)
  const { answers, pick: teamPick, online } = useLiveAnswers(current ? [current.id] : [])
  const activeAnswer = current && active ? answers[current.id]?.[active.id] : undefined

  // Команда выбрала карточку со своего устройства — открываем её
  const lastPick = useRef<string | null>(null)
  useEffect(() => {
    if (!teamPick || openId != null || !active || teamPick.at === lastPick.current) return
    lastPick.current = teamPick.at
    if (teamPick.team_id === active.id && !results[teamPick.question_id]) pick(teamPick.question_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamPick])

  if (!room || room.format !== 'blind') return <Navigate to="/rooms" replace />

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
                Выбирает: <span style={{ color: active.color }}>{active.name}</span>
                <button onClick={nextTeam} className="host-only ml-2 rounded-lg p-1.5 text-muted hover:bg-fg/10 hover:text-fg" title="Передать ход">
                  <SkipForward size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {order.map((id, i) => {
              const res = results[id]
              const team = res && teams.find((t) => t.id === res.teamId)
              return (
                <motion.button
                  key={id}
                  initial={{ opacity: 0, rotateY: 90 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={res ? {} : { y: -4, scale: 1.04 }}
                  whileTap={res ? {} : { scale: 0.95 }}
                  onClick={() => pick(id)}
                  disabled={!!res}
                  className={`relative flex aspect-square items-center justify-center rounded-2xl border text-3xl font-extrabold sm:text-4xl ${
                    res
                      ? 'cursor-default border-line bg-fg/5 text-fg/20'
                      : 'border-green/40 bg-gradient-to-br from-green/25 to-green-dark/30 text-fg shadow-[0_6px_24px_rgba(16,185,129,0.15)] hover:border-green'
                  }`}
                >
                  {i + 1}
                  {!res && <span className="absolute right-2 top-1.5 text-sm opacity-60">?</span>}
                  {res && team && (
                    <span className="absolute bottom-1.5 right-2 flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: team.color }} />
                      {res.correct ? <Check size={14} className="text-green" /> : <X size={14} className="text-red-400" />}
                    </span>
                  )}
                </motion.button>
              )
            })}
          </div>
          <div className="mt-4 text-center text-sm text-muted">
            Открыто {Object.keys(results).length} из {order.length} · правильно = +1 балл
          </div>
        </section>

        <aside className="glass h-fit rounded-3xl p-4 xl:sticky xl:top-4">
          <h3 className="mb-3 px-1 text-sm font-semibold uppercase tracking-widest text-muted">🏆 Табло</h3>
          <Scoreboard teams={teams} activeId={active?.id} onAdjust={addScore} />
        </aside>
      </div>

      {createPortal(
        <AnimatePresence>
          {openId != null && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

              {/* Бонусное событие */}
              <AnimatePresence>
                {stage === 'bonus' && bonus && (
                  <motion.div
                    key="bonus"
                    className="relative z-10 text-center"
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 2, opacity: 0 }}
                    transition={{ type: 'spring', damping: 10, stiffness: 160 }}
                  >
                    {Array.from({ length: 12 }).map((_, i) => (
                      <motion.span
                        key={i}
                        className="absolute left-1/2 top-1/2 text-3xl"
                        initial={{ x: 0, y: 0, opacity: 1 }}
                        animate={{
                          x: Math.cos((i / 12) * Math.PI * 2) * 260,
                          y: Math.sin((i / 12) * Math.PI * 2) * 260,
                          opacity: 0,
                        }}
                        transition={{ duration: 1.4, ease: 'easeOut' }}
                      >
                        ✨
                      </motion.span>
                    ))}
                    <motion.div
                      animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.8, repeat: 2 }}
                      className="text-[110px] leading-none drop-shadow-[0_0_40px_rgba(16,185,129,0.8)]"
                    >
                      {BONUSES[bonus].emoji}
                    </motion.div>
                    <div className="text-gradient mt-4 text-5xl font-extrabold sm:text-6xl">{BONUSES[bonus].title}</div>
                    <div className="mt-3 text-xl text-white/80">{BONUSES[bonus].text}</div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Переворачивающаяся карточка */}
              {stage === 'question' && current && (
                <motion.div
                  key="card"
                  className="flip-scene relative z-10 w-full max-w-4xl"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 20 }}
                >
                  <motion.div
                    className="flip-card relative min-h-[60vh]"
                    animate={{ rotateY: flipped ? 180 : 0 }}
                    transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                  >
                    {/* Рубашка */}
                    <div className="flip-face absolute inset-0 flex items-center justify-center rounded-3xl border-2 border-green bg-gradient-to-br from-green to-green-dark text-[140px] font-extrabold text-white shadow-[0_0_60px_rgba(16,185,129,0.5)]">
                      {cardNumber}
                    </div>
                    {/* Лицо */}
                    <div className="flip-face glass-strong absolute inset-0 flex flex-col gap-5 overflow-y-auto rounded-3xl p-6 sm:p-8 [transform:rotateY(180deg)]">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold uppercase tracking-widest text-green">Карточка №{cardNumber}</div>
                          {active && (
                            <div className="mt-2 flex items-center gap-2 text-muted">
                              <Crown size={16} className="text-yellow-400" fill="currentColor" /> Отвечает:{' '}
                              <b style={{ color: active.color }}>{active.name}</b>
                            </div>
                          )}
                          {bonus && (
                            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green/15 px-3 py-1 text-sm font-semibold text-green">
                              {BONUSES[bonus].emoji} {BONUSES[bonus].title}
                            </div>
                          )}
                        </div>
                        <CircularTimer left={left} total={duration} size={100} running={running} onToggle={() => setRunning((r) => !r)} onReset={reset} />
                      </div>

                      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
                        {current.photo && <img src={current.photo} alt="" className="max-h-[32vh] max-w-full rounded-2xl border border-line object-contain" />}
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

                      {online && active && (
                        <div className="host-only rounded-2xl border border-line bg-fg/[0.03] p-3">
                          <div className="text-xs uppercase tracking-widest text-muted">Ответ команды «{active.name}»</div>
                          {activeAnswer ? (
                            <div className="mt-1 flex items-center gap-2 text-lg font-bold">
                              {activeAnswer.text}
                              {activeAnswer.matches && (
                                <span className="rounded-md bg-green/15 px-2 py-0.5 text-xs font-semibold text-green">совпадает</span>
                              )}
                            </div>
                          ) : (
                            <div className="mt-1 text-muted">Ждём ответ…</div>
                          )}
                        </div>
                      )}

                      <div className="host-only grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
                        <button onClick={() => setShowAnswer((s) => !s)} className="btn btn-ghost">
                          <Eye size={18} /> {showAnswer ? 'Скрыть' : 'Ответ'}
                        </button>
                        <button onClick={() => judge(true)} className="btn btn-primary py-3.5 text-base">
                          ✅ Правильно {bonus === 'double' ? '(+2)' : '(+1)'}
                        </button>
                        <button onClick={() => judge(false)} className="btn btn-danger py-3.5 text-base">
                          ❌ Неправильно
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </GameShell>
  )
}
