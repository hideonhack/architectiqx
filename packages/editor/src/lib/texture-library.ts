export interface TextureEntry {
  id: string
  name: string
  category: 'wood' | 'stone' | 'tile' | 'metal' | 'fabric' | 'concrete'
  url: string
  repeat: [number, number]
  roughness: number
  metalness: number
}

export const TEXTURE_CATEGORIES = ['wood', 'stone', 'tile', 'metal', 'concrete'] as const
export type TextureCategory = (typeof TEXTURE_CATEGORIES)[number]

export const TEXTURE_LIBRARY: TextureEntry[] = [
  // Wood
  {
    id: 'wood-oak',
    name: 'Oak',
    category: 'wood',
    url: '/textures/wood-oak.jpg',
    repeat: [2, 2],
    roughness: 0.7,
    metalness: 0,
  },
  {
    id: 'wood-walnut',
    name: 'Walnut',
    category: 'wood',
    url: '/textures/wood-walnut.jpg',
    repeat: [2, 2],
    roughness: 0.65,
    metalness: 0,
  },
  {
    id: 'wood-pine',
    name: 'Pine',
    category: 'wood',
    url: '/textures/wood-pine.jpg',
    repeat: [2, 2],
    roughness: 0.75,
    metalness: 0,
  },
  {
    id: 'wood-parquet',
    name: 'Parquet',
    category: 'wood',
    url: '/textures/wood-parquet.jpg',
    repeat: [4, 4],
    roughness: 0.6,
    metalness: 0,
  },
  // Stone
  {
    id: 'stone-marble-white',
    name: 'White Marble',
    category: 'stone',
    url: '/textures/stone-marble-white.jpg',
    repeat: [1, 1],
    roughness: 0.3,
    metalness: 0,
  },
  {
    id: 'stone-marble-black',
    name: 'Black Marble',
    category: 'stone',
    url: '/textures/stone-marble-black.jpg',
    repeat: [1, 1],
    roughness: 0.3,
    metalness: 0,
  },
  {
    id: 'stone-granite',
    name: 'Granite',
    category: 'stone',
    url: '/textures/stone-granite.jpg',
    repeat: [2, 2],
    roughness: 0.5,
    metalness: 0,
  },
  // Tile
  {
    id: 'tile-ceramic-white',
    name: 'White Ceramic',
    category: 'tile',
    url: '/textures/tile-ceramic-white.jpg',
    repeat: [4, 4],
    roughness: 0.4,
    metalness: 0,
  },
  {
    id: 'tile-subway',
    name: 'Subway Tile',
    category: 'tile',
    url: '/textures/tile-subway.jpg',
    repeat: [6, 4],
    roughness: 0.35,
    metalness: 0,
  },
  // Concrete
  {
    id: 'concrete-smooth',
    name: 'Smooth Concrete',
    category: 'concrete',
    url: '/textures/concrete-smooth.jpg',
    repeat: [2, 2],
    roughness: 0.8,
    metalness: 0,
  },
  // Metal
  {
    id: 'metal-brushed',
    name: 'Brushed Steel',
    category: 'metal',
    url: '/textures/metal-brushed.jpg',
    repeat: [2, 2],
    roughness: 0.4,
    metalness: 0.9,
  },
]

export function getTextureById(id: string): TextureEntry | undefined {
  return TEXTURE_LIBRARY.find((t) => t.id === id)
}

export function getTexturesByCategory(category: TextureCategory): TextureEntry[] {
  return TEXTURE_LIBRARY.filter((t) => t.category === category)
}
