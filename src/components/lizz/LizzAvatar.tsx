interface LizzAvatarProps {
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'w-7 h-7 text-sm',
  md: 'w-9 h-9 text-base',
  lg: 'w-12 h-12 text-xl',
}

export default function LizzAvatar({ size = 'md' }: LizzAvatarProps) {
  return (
    <div
      className={`${sizeClasses[size]} flex-shrink-0 rounded-full bg-menzis-geel flex items-center justify-center font-bold text-menzis-inkt select-none`}
      aria-hidden="true"
    >
      L
    </div>
  )
}
