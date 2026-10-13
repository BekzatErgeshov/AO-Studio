import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useUI } from '../store/ui'

// Минимальные типы Google Identity Services
interface GoogleId {
  initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let scriptPromise: Promise<void> | null = null
let clientIdPromise: Promise<string | null> | null = null

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('Не удалось загрузить Google'))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

/** Client ID берётся с бэкенда (GOOGLE_CLIENT_ID в backend/.env) */
export function getGoogleClientId(): Promise<string | null> {
  clientIdPromise ??= api
    .get<{ google_client_id: string | null }>('/auth/config/')
    .then(({ data }) => data.google_client_id)
    .catch(() => {
      clientIdPromise = null
      return null
    })
  return clientIdPromise
}

interface Props {
  mode: 'login' | 'register'
  onCredential: (credential: string) => void
}

/** Официальная кнопка «Войти через Google». Ничего не рисует, если Google не настроен. */
export default function GoogleButton({ mode, onCredential }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const theme = useUI((s) => s.theme)
  const [clientId, setClientId] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const cb = useRef(onCredential)
  cb.current = onCredential

  useEffect(() => {
    void getGoogleClientId().then(setClientId)
  }, [])

  useEffect(() => {
    if (!clientId || !ref.current) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => cb.current(r.credential),
        })
        ref.current.innerHTML = ''
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text: mode === 'register' ? 'signup_with' : 'signin_with',
          locale: 'ru',
          width: Math.min(ref.current.offsetWidth || 320, 400),
        })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [clientId, mode, theme])

  if (!clientId) return null

  return (
    <div>
      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-line" /> или <div className="h-px flex-1 bg-line" />
      </div>
      {failed ? (
        <p className="text-center text-xs text-muted">Не удалось загрузить вход через Google. Проверьте интернет.</p>
      ) : (
        <div ref={ref} className="flex min-h-[44px] w-full justify-center" />
      )}
    </div>
  )
}
