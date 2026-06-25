interface TypingIndicatorProps {
  label: string
}

export default function TypingIndicator({ label }: TypingIndicatorProps) {
  return (
    <div
      className="bg-menzis-zacht rounded-2xl rounded-ss-none px-4 py-3 shadow-sm flex items-center gap-1.5"
      aria-live="polite"
      aria-label={label}
    >
      <span className="w-2 h-2 rounded-full bg-menzis-inkt/40 animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 rounded-full bg-menzis-inkt/40 animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 rounded-full bg-menzis-inkt/40 animate-bounce [animation-delay:300ms]" />
    </div>
  )
}
