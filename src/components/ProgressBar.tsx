interface ProgressBarProps {
  current: number
  total: number
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = Math.round((current / total) * 100)

  return (
    <div>
      <div className="flex justify-between text-sm text-menzis-inkt mb-2 font-medium">
        <span>Vraag {current} van {total}</span>
        <span>{pct}%</span>
      </div>
      <div
        className="w-full bg-white rounded-full h-3 overflow-hidden shadow-inner"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Vraag ${current} van ${total}`}
      >
        <div
          className="bg-menzis-geel h-3 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
