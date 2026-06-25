import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: Variant
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-menzis-geel text-menzis-inkt hover:brightness-105 active:brightness-95',
  secondary:
    'bg-menzis-inkt text-menzis-wit hover:opacity-90 active:opacity-80',
  ghost:
    'bg-transparent text-menzis-inkt border-2 border-menzis-inkt hover:bg-menzis-zacht active:bg-menzis-zacht',
}

export default function PrimaryButton({
  children,
  variant = 'primary',
  fullWidth = true,
  className = '',
  ...props
}: PrimaryButtonProps) {
  const base =
    'min-h-[52px] px-6 py-3 rounded-2xl font-semibold text-base transition-all ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-menzis-geel ' +
    'disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <button
      className={`${base} ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
