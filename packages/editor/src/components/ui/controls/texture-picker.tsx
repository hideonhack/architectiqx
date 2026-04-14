'use client'

import { useState } from 'react'
import {
  TEXTURE_CATEGORIES,
  TEXTURE_LIBRARY,
  type TextureCategory,
  type TextureEntry,
} from '../../../lib/texture-library'

const CATEGORY_LABELS: Record<TextureCategory, string> = {
  wood: 'Wood',
  stone: 'Stone',
  tile: 'Tile',
  metal: 'Metal',
  concrete: 'Concrete',
}

type TexturePickerProps = {
  selectedTextureUrl?: string
  onSelect: (texture: TextureEntry) => void
  onRemove: () => void
}

export function TexturePicker({ selectedTextureUrl, onSelect, onRemove }: TexturePickerProps) {
  const [activeCategory, setActiveCategory] = useState<TextureCategory>('wood')

  const filteredTextures = TEXTURE_LIBRARY.filter((t) => t.category === activeCategory)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-gray-500 text-xs font-medium">Texture</span>
        {selectedTextureUrl && (
          <button
            className="text-red-400 text-xs hover:text-red-500"
            onClick={onRemove}
            type="button"
          >
            Remove
          </button>
        )}
      </div>

      <div className="flex gap-1">
        {TEXTURE_CATEGORIES.map((cat) => (
          <button
            className={`rounded px-2 py-1 text-xs transition-colors ${
              activeCategory === cat
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            key={cat}
            onClick={() => setActiveCategory(cat)}
            type="button"
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {filteredTextures.map((texture) => {
          const isSelected = selectedTextureUrl === texture.url
          return (
            <button
              className={`group relative h-12 w-full overflow-hidden rounded border-2 transition-all ${
                isSelected
                  ? 'border-cyan-500 ring-2 ring-cyan-500/30'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
              key={texture.id}
              onClick={() => onSelect(texture)}
              title={texture.name}
              type="button"
            >
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${texture.url})`,
                  backgroundColor: texture.category === 'wood' ? '#deb887'
                    : texture.category === 'stone' ? '#c0c0c0'
                    : texture.category === 'tile' ? '#d3d3d3'
                    : texture.category === 'metal' ? '#a0a0a0'
                    : '#808080',
                }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="text-white text-[10px]">{texture.name}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
