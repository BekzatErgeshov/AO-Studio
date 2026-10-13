import { motion } from 'framer-motion'
import { Gamepad2, Home, LogIn, Moon, PlusCircle, Sun, User as UserIcon } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useUI } from '../store/ui'
import Avatar from './Avatar'
import FloatingEmojis from './FloatingEmojis'
import Logo from './Logo'

function ThemeToggle({ withLabel }: { withLabel?: boolean }) {
  const { theme, toggleTheme } = useUI()
  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted transition hover:bg-fg/5 hover:text-fg"
      aria-label="Сменить тему"
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      {withLabel && <span className="text-sm">{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>}
    </button>
  )
}

const navCls = ({ isActive }: { isActive: boolean }) =>
  `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${
    isActive ? 'bg-green/15 text-green' : 'text-muted hover:bg-fg/5 hover:text-fg'
  }`

export function scrollToAbout() {
  document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
}

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const openAuth = useUI((s) => s.openAuth)

  // «AO Studio» в меню → на главную и плавный скролл к описанию
  const onLogo = () => {
    if (location.pathname === '/') scrollToAbout()
    else {
      navigate('/')
      setTimeout(scrollToAbout, 450)
    }
  }

  const goCreate = () => (user ? navigate('/create') : openAuth('register', () => navigate('/create')))

  return (
    <div className="relative min-h-screen">
      <div className="bg-aurora" />
      <FloatingEmojis />

      {/* Sidebar — десктоп */}
      <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-64 flex-col rounded-none border-y-0 border-l-0 p-4 md:flex">
        <button onClick={onLogo} className="mb-8 flex items-center gap-3 rounded-xl p-2 text-left transition hover:bg-fg/5">
          <Logo />
          <div>
            <div className="text-lg font-extrabold leading-tight">AO Studio</div>
            <div className="text-xs text-muted">Акыл Ордо</div>
          </div>
        </button>

        <nav className="flex flex-col gap-1">
          <NavLink to="/" end className={navCls}>
            <Home size={20} /> Главная
          </NavLink>
          <NavLink to="/rooms" className={navCls}>
            <Gamepad2 size={20} /> AO Rooms
          </NavLink>
          <button onClick={goCreate} className={navCls({ isActive: location.pathname === '/create' })}>
            <PlusCircle size={20} /> Создать АО
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-1">
          <ThemeToggle withLabel />
          {user ? (
            <NavLink to="/profile" className={navCls}>
              <Avatar name={user.username} src={user.avatar} size={30} />
              <span className="truncate">{user.username}</span>
            </NavLink>
          ) : (
            <button onClick={() => openAuth('login')} className={navCls({ isActive: false })}>
              <LogIn size={20} /> Войти
            </button>
          )}
        </div>
      </aside>

      {/* Верхняя панель — мобильные */}
      <header className="glass sticky top-0 z-30 flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-2.5 md:hidden">
        <button onClick={onLogo} className="flex items-center gap-2">
          <Logo size={30} />
          <span className="font-extrabold">AO Studio</span>
        </button>
        <ThemeToggle />
      </header>

      <main className="relative z-10 pb-24 md:ml-64 md:pb-0">
        {/* Анимация входа при каждой смене страницы */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Bottom navigation — мобильные */}
      <nav className="glass fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around rounded-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden">
        {[
          { to: '/', icon: Home, label: 'Главная', end: true },
          { to: '/rooms', icon: Gamepad2, label: 'Rooms' },
        ].map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${isActive ? 'text-green' : 'text-muted'}`
            }
          >
            <Icon size={22} />
            {label}
          </NavLink>
        ))}
        <button
          onClick={goCreate}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${location.pathname === '/create' ? 'text-green' : 'text-muted'}`}
        >
          <PlusCircle size={22} />
          Создать
        </button>
        {user ? (
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? 'text-green' : 'text-muted'}`
            }
          >
            <Avatar name={user.username} src={user.avatar} size={22} />
            Профиль
          </NavLink>
        ) : (
          <button onClick={() => openAuth('login')} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted">
            <UserIcon size={22} />
            Войти
          </button>
        )}
      </nav>
    </div>
  )
}
