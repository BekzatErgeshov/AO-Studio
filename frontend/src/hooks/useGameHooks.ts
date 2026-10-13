import { useCallback, useEffect, useRef, useState } from 'react'
import { sounds } from '../lib/sounds'

/** Обратный отсчёт со звуками: тиканье в последние 10с и сигнал в конце */
export function useCountdown(duration: number, running: boolean, resetKey: unknown) {
  const [left, setLeft] = useState(duration)
  const leftRef = useRef(duration)

  useEffect(() => {
    leftRef.current = duration
    setLeft(duration)
  }, [duration, resetKey])

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      if (leftRef.current <= 0) return
      leftRef.current -= 1
      setLeft(leftRef.current)
      if (leftRef.current === 0) sounds.alarm()
      else if (leftRef.current <= 10) sounds.tick()
    }, 1000)
    return () => clearInterval(t)
  }, [running, resetKey])

  const reset = useCallback(() => {
    leftRef.current = duration
    setLeft(duration)
  }, [duration])

  return { left, reset }
}

/** Горячие клавиши ведущего: Space / Enter / Escape / F. Не срабатывают в полях ввода. */
export function useHotkeys(map: Partial<Record<'space' | 'enter' | 'escape' | 'f' | 'p', () => void>>) {
  const ref = useRef(map)
  ref.current = map
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key === ' ' ? 'space' : e.key.toLowerCase()
      // Русская раскладка: «а» на месте F, «з» на месте P
      const normalized = key === 'а' ? 'f' : key === 'з' ? 'p' : key
      const fn = ref.current[normalized as keyof typeof map]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** useState, который переживает перезагрузку страницы (sessionStorage) */
export function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const storageKey = `ao_progress_${key}`
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) return JSON.parse(raw) as T
    } catch {
      /* ignore */
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      /* ignore */
    }
  }, [storageKey, value])
  return [value, setValue] as const
}
