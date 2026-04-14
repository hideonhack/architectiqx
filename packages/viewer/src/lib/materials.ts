import { type MaterialProperties, type MaterialSchema, resolveMaterial } from '@pascal-app/core'
import * as THREE from 'three'
import { loadTexture } from './texture-loader'

const sideMap: Record<MaterialProperties['side'], THREE.Side> = {
  front: THREE.FrontSide,
  back: THREE.BackSide,
  double: THREE.DoubleSide,
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>()

function getCacheKey(props: MaterialProperties, textureUrl?: string, textureRepeat?: [number, number]): string {
  const base = `${props.color}-${props.roughness}-${props.metalness}-${props.opacity}-${props.transparent}-${props.side}`
  if (textureUrl) {
    const r = textureRepeat || [1, 1]
    return `${base}-tex:${textureUrl}-${r[0]}-${r[1]}`
  }
  return base
}

export function createMaterial(material?: MaterialSchema): THREE.MeshStandardMaterial {
  const props = resolveMaterial(material)
  const textureUrl = material?.texture?.url
  const textureRepeat = material?.texture?.repeat as [number, number] | undefined
  const textureScale = material?.texture?.scale
  const cacheKey = getCacheKey(props, textureUrl, textureRepeat)

  if (materialCache.has(cacheKey)) {
    return materialCache.get(cacheKey)!
  }

  const threeMaterial = new THREE.MeshStandardMaterial({
    color: props.color,
    roughness: props.roughness,
    metalness: props.metalness,
    opacity: props.opacity,
    transparent: props.transparent,
    side: sideMap[props.side],
  })

  if (textureUrl) {
    const repeat: [number, number] = textureRepeat || [1, 1]
    const scaledRepeat: [number, number] = textureScale
      ? [repeat[0] * textureScale, repeat[1] * textureScale]
      : repeat
    const texture = loadTexture(textureUrl, scaledRepeat)
    if (texture) {
      threeMaterial.map = texture
      threeMaterial.needsUpdate = true
    }
  }

  materialCache.set(cacheKey, threeMaterial)
  return threeMaterial
}

export function createDefaultMaterial(
  color = '#ffffff',
  roughness = 0.9,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    side: THREE.FrontSide,
  })
}

// Walls: warm off-white, matte plaster feel
export const DEFAULT_WALL_MATERIAL = createMaterial({
  properties: { color: '#f5f5f0', roughness: 0.85, metalness: 0, opacity: 1, transparent: false, side: 'front' as const },
})

// Doors: warm wood tone
export const DEFAULT_DOOR_MATERIAL = createMaterial({
  properties: { color: '#8B6914', roughness: 0.65, metalness: 0, opacity: 1, transparent: false, side: 'front' as const },
})

// Window frames: light metallic gray
export const DEFAULT_WINDOW_FRAME_MATERIAL = createMaterial({
  properties: { color: '#e8e8e8', roughness: 0.3, metalness: 0.6, opacity: 1, transparent: false, side: 'front' as const },
})

// Window glass: subtle blue tint, very transparent
export const DEFAULT_WINDOW_GLASS_MATERIAL = createMaterial({
  properties: { color: '#b8d4e8', roughness: 0.05, metalness: 0.1, opacity: 0.25, transparent: true, side: 'double' as const },
})

// Keep legacy alias for existing imports
export const DEFAULT_WINDOW_MATERIAL = DEFAULT_WINDOW_GLASS_MATERIAL

// Slabs/floors: warm concrete tone
export const DEFAULT_SLAB_MATERIAL = createMaterial({
  properties: { color: '#d4cfc4', roughness: 0.75, metalness: 0, opacity: 1, transparent: false, side: 'front' as const },
})

// Stairs: warm stone/concrete
export const DEFAULT_STAIR_MATERIAL = createMaterial({
  properties: { color: '#c8bfb0', roughness: 0.7, metalness: 0, opacity: 1, transparent: false, side: 'front' as const },
})

// Ceilings: pure white, very matte
export const DEFAULT_CEILING_MATERIAL = createMaterial({
  properties: { color: '#fafafa', roughness: 0.95, metalness: 0, opacity: 1, transparent: false, side: 'front' as const },
})

// Roof: neutral gray
export const DEFAULT_ROOF_MATERIAL = createDefaultMaterial('#808080', 0.85)

export function disposeMaterial(material: THREE.Material): void {
  material.dispose()
}

export function clearMaterialCache(): void {
  for (const material of materialCache.values()) {
    material.dispose()
  }
  materialCache.clear()
}
