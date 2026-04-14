import { type MaterialProperties, type MaterialSchema, resolveMaterial } from '@pascal-app/core'
import * as THREE from 'three'

const sideMap: Record<MaterialProperties['side'], THREE.Side> = {
  front: THREE.FrontSide,
  back: THREE.BackSide,
  double: THREE.DoubleSide,
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>()

function getCacheKey(props: MaterialProperties): string {
  return `${props.color}-${props.roughness}-${props.metalness}-${props.opacity}-${props.transparent}-${props.side}`
}

export function createMaterial(material?: MaterialSchema): THREE.MeshStandardMaterial {
  const props = resolveMaterial(material)
  const cacheKey = getCacheKey(props)

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
  properties: { color: '#f5f5f0', roughness: 0.85, metalness: 0 },
})

// Doors: warm wood tone
export const DEFAULT_DOOR_MATERIAL = createMaterial({
  properties: { color: '#8B6914', roughness: 0.65, metalness: 0 },
})

// Window frames: light metallic gray
export const DEFAULT_WINDOW_FRAME_MATERIAL = createMaterial({
  properties: { color: '#e8e8e8', roughness: 0.3, metalness: 0.6 },
})

// Window glass: subtle blue tint, very transparent
export const DEFAULT_WINDOW_GLASS_MATERIAL = createMaterial({
  properties: { color: '#b8d4e8', roughness: 0.05, metalness: 0.1, opacity: 0.25, transparent: true },
})

// Keep legacy alias for existing imports
export const DEFAULT_WINDOW_MATERIAL = DEFAULT_WINDOW_GLASS_MATERIAL

// Slabs/floors: warm concrete tone
export const DEFAULT_SLAB_MATERIAL = createMaterial({
  properties: { color: '#d4cfc4', roughness: 0.75, metalness: 0 },
})

// Stairs: warm stone/concrete
export const DEFAULT_STAIR_MATERIAL = createMaterial({
  properties: { color: '#c8bfb0', roughness: 0.7, metalness: 0 },
})

// Ceilings: pure white, very matte
export const DEFAULT_CEILING_MATERIAL = createMaterial({
  properties: { color: '#fafafa', roughness: 0.95, metalness: 0 },
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
