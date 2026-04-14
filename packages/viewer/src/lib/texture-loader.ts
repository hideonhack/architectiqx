import { TextureLoader, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

const textureCache = new Map<string, Texture>()
let loader: TextureLoader | null = null

function getLoader(): TextureLoader {
  if (!loader) loader = new TextureLoader()
  return loader
}

export function loadTexture(url: string, repeat: [number, number] = [1, 1]): Texture | null {
  const cacheKey = `${url}-${repeat[0]}-${repeat[1]}`
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!
  }

  const texture = getLoader().load(url)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.colorSpace = SRGBColorSpace

  textureCache.set(cacheKey, texture)
  return texture
}

export function disposeTexture(url: string): void {
  for (const [key, texture] of textureCache) {
    if (key.startsWith(url)) {
      texture.dispose()
      textureCache.delete(key)
    }
  }
}

export function clearTextureCache(): void {
  for (const texture of textureCache.values()) {
    texture.dispose()
  }
  textureCache.clear()
}
