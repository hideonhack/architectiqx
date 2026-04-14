import { useEffect, useRef, useState } from 'react'

interface DimensionInputOverlayProps {
  currentLength: number
  onSubmit: (length: number) => void
  onCancel: () => void
  visible: boolean
}

export function DimensionInputOverlay({
  currentLength,
  onSubmit,
  onCancel,
  visible,
}: DimensionInputOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (visible) {
      setValue(currentLength.toFixed(2))
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [visible, currentLength])

  if (!visible) return null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const num = Number.parseFloat(value)
      if (!Number.isNaN(num) && num > 0) {
        onSubmit(num)
      }
    } else if (e.key === 'Escape') {
      onCancel()
    }
    e.stopPropagation()
  }

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 shadow-xl flex items-center gap-3">
      <label className="text-zinc-400 text-sm whitespace-nowrap">Wall Length:</label>
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        min="0.1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-24 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-sm text-right focus:outline-none focus:border-cyan-500"
      />
      <span className="text-zinc-400 text-sm">m</span>
      <span className="text-zinc-600 text-xs">Enter to confirm, Esc to cancel</span>
    </div>
  )
}
