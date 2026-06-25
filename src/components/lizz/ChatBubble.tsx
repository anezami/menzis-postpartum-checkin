import type { ReactNode } from 'react'
import LizzAvatar from './LizzAvatar'

interface ChatBubbleProps {
  from: 'lizz' | 'user'
  children: ReactNode
  rtl?: boolean
}

export default function ChatBubble({ from, children, rtl = false }: ChatBubbleProps) {
  if (from === 'lizz') {
    return (
      <div className={`flex items-start gap-3 ${rtl ? 'flex-row-reverse' : ''}`}>
        <LizzAvatar />
        <div className="max-w-[82%] bg-menzis-zacht rounded-2xl rounded-ss-none px-4 py-3 text-menzis-inkt text-base leading-relaxed shadow-sm">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${rtl ? 'justify-start' : 'justify-end'}`}>
      <div className="max-w-[82%] bg-menzis-inkt text-menzis-wit rounded-2xl rounded-se-none px-4 py-3 text-base leading-relaxed shadow-sm">
        {children}
      </div>
    </div>
  )
}
