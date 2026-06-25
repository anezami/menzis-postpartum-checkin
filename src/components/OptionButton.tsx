interface OptionButtonProps {
  label: string
  value: number
  selected: boolean
  onChange: (value: number) => void
  name: string
}

export default function OptionButton({
  label,
  value,
  selected,
  onChange,
  name,
}: OptionButtonProps) {
  return (
    <label
      className={[
        'flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all min-h-[56px]',
        'focus-within:ring-2 focus-within:ring-menzis-geel focus-within:ring-offset-1',
        selected
          ? 'border-menzis-geel bg-menzis-zacht'
          : 'border-gray-200 bg-white hover:border-menzis-geel hover:bg-menzis-zacht/50',
      ].join(' ')}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {/* Custom radio indicator */}
      <span
        className={[
          'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
          selected ? 'border-menzis-geel bg-menzis-geel' : 'border-gray-300 bg-white',
        ].join(' ')}
        aria-hidden="true"
      >
        {selected && <span className="w-2 h-2 rounded-full bg-menzis-inkt" />}
      </span>
      <span className="text-base text-menzis-inkt leading-snug">{label}</span>
    </label>
  )
}
