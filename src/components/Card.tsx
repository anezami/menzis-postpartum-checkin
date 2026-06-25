import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-3xl shadow-md p-6 ${className}`}>
      {children}
    </div>
  )
}
