import { motion } from 'framer-motion'
import { FolderOpen, Heart, HelpCircle, Lock, Play, Globe } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { api } from '../lib/api'
import type { RoomListItem } from '../lib/types'
import { useAuth } from '../store/auth'
import { useUI } from '../store/ui'
import Avatar from './Avatar'
import FormatBadge from './FormatBadge'

interface Props {
  room: RoomListItem
  onClick?: () => void
  onPlay?: () => void
  onLikeChange?: (room: RoomListItem) => void
  showPrivacy?: boolean
  showAuthor?: boolean
  index?: number
}

export default function RoomCard({ room, onClick, onPlay, onLikeChange, showPrivacy, showAuthor = true, index = 0 }: Props) {
  const user = useAuth((s) => s.user)
  const openAuth = useUI((s) => s.openAuth)
  const [liked, setLiked] = useState(room.is_liked)
  const [likes, setLikes] = useState(room.likes_count)
  const [pop, setPop] = useState(false)

  const toggleLike = async (e: MouseEvent) => {
    e.stopPropagation()
    if (!user) return openAuth('login')
    // Оптимистичное обновление
    setLiked(!liked)
    setLikes((n) => n + (liked ? -1 : 1))
    if (!liked) {
      setPop(true)
      setTimeout(() => setPop(false), 400)
    }
    try {
      const { data } = await api.post<{ is_liked: boolean; likes_count: number }>(`/rooms/${room.id}/like/`)
      setLiked(data.is_liked)
      setLikes(data.likes_count)
      onLikeChange?.({ ...room, is_liked: data.is_liked, likes_count: data.likes_count })
    } catch {
      setLiked(liked)
      setLikes(room.likes_count)
    }
  }

  const cats = room.format === 'random' ? [] : room.categories

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className={`glass group flex flex-col rounded-2xl transition-colors hover:border-green/50 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-lg font-bold leading-snug">{room.title}</h3>
          {showPrivacy && (
            <span className="shrink-0 text-muted" title={room.is_public ? 'Публичная' : 'Приватная'}>
              {room.is_public ? <Globe size={16} /> : <Lock size={16} />}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <FormatBadge format={room.format} />
          {room.format !== 'random' && (
            <span className="inline-flex items-center gap-1">
              <FolderOpen size={14} /> {cats.length} кат.
            </span>
          )}
        </div>

        {cats.length > 0 && (
          <p className="line-clamp-1 text-sm text-muted">
            <span className="text-fg/70">Категории:</span> {cats.join(', ')}
          </p>
        )}

        <p className="inline-flex items-center gap-1.5 text-sm text-muted">
          <HelpCircle size={15} /> Вопросов: <span className="font-semibold text-fg">{room.questions_count}</span>
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
        {showAuthor ? (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={room.author.username} src={room.author.avatar} size={28} />
            <span className="truncate text-sm text-muted">@{room.author.username}</span>
          </div>
        ) : (
          <span />
        )}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={toggleLike}
            className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition hover:bg-fg/5 ${liked ? 'text-rose-500' : 'text-muted'}`}
            aria-label={liked ? 'Убрать лайк' : 'Поставить лайк'}
          >
            <motion.span animate={pop ? { scale: [1, 1.5, 1] } : {}} transition={{ duration: 0.35 }} className="flex">
              <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
            </motion.span>
            {likes > 0 && <span>{likes}</span>}
          </button>
          {onPlay && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPlay()
              }}
              className="btn btn-primary px-3 py-1.5 text-sm"
            >
              <Play size={14} fill="currentColor" /> Играть
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
