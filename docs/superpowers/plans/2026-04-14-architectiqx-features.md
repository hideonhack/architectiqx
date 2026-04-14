# ArchitectIQX Feature Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 11 features to the ArchitectIQX 3D architectural editor: smart snapping, dimension input while drawing, Space key top-view toggle, top-view object indicators, bounding box resize for windows, better default materials & texture support, box select with Shift, L-staircase preset, stair supports, additional door types, and 3DS export.

**Architecture:** Each feature is self-contained and touches specific subsystems (editor tools, viewer renderers, core schemas). Features are grouped into independent tasks that can be parallelized. The codebase is a Turborepo monorepo with packages: `@pascal-app/core` (schemas, systems), `@pascal-app/viewer` (3D renderers), and `apps/editor` (UI, tools).

**Tech Stack:** React 19, Next.js 16, Three.js 0.183, React Three Fiber 9, Zustand, Zod, TypeScript 5.9, Turborepo, Bun

---

## Feature Overview

| # | Feature | Package(s) | Complexity |
|---|---------|------------|------------|
| 1 | Smart Object Snapping | editor | High |
| 2 | Dimension Input While Drawing | editor | Medium |
| 3 | Space Key Top View Toggle | editor | Low |
| 4 | Top View Object Indicators | editor, viewer | Medium |
| 5 | Window Bounding Box Resize | editor | Medium |
| 6 | Texture & Material System | core, viewer, editor | High |
| 7 | Box Select with Shift | editor | Low |
| 8 | L-Staircase Preset & Stair Supports | core, editor | Medium |
| 9 | Additional Door Types | core, viewer, editor | High |
| 10 | 3DS Export | viewer | Low |
| 11 | Default Materials for Objects | viewer | Medium |

---

### Task 1: Smart Object Snapping (Edge-to-Edge, Corner-to-Corner)

**Files:**
- Create: `packages/editor/src/lib/snap-engine.ts`
- Create: `packages/editor/src/components/editor/snap-guides.tsx`
- Modify: `packages/editor/src/components/tools/item/placement-strategies.ts`
- Modify: `packages/editor/src/components/tools/item/move-tool.tsx`
- Modify: `packages/editor/src/components/tools/wall/wall-drafting.ts`

**Context:** Currently grid snap exists (0.5m increments) and wall endpoint snap (0.35 radius). Missing: object-to-object edge/corner alignment with visual guide lines.

- [ ] **Step 1: Create snap engine module**

```typescript
// packages/editor/src/lib/snap-engine.ts
import type { Vector3Tuple } from 'three'

export interface SnapTarget {
  position: Vector3Tuple
  type: 'corner' | 'edge-center' | 'center'
  sourceNodeId: string
}

export interface SnapResult {
  snappedPosition: Vector3Tuple
  guides: SnapGuide[]
  snapped: boolean
}

export interface SnapGuide {
  from: Vector3Tuple
  to: Vector3Tuple
  axis: 'x' | 'z'
}

const SNAP_THRESHOLD = 0.15 // meters

export function collectSnapTargets(
  nodes: Map<string, { position: Vector3Tuple; width?: number; depth?: number }>,
  excludeId: string
): SnapTarget[] {
  const targets: SnapTarget[] = []

  for (const [id, node] of nodes) {
    if (id === excludeId) continue
    const [x, y, z] = node.position
    const hw = (node.width ?? 1) / 2
    const hd = (node.depth ?? 1) / 2

    // Center
    targets.push({ position: [x, y, z], type: 'center', sourceNodeId: id })

    // Corners (on XZ plane)
    targets.push({ position: [x - hw, y, z - hd], type: 'corner', sourceNodeId: id })
    targets.push({ position: [x + hw, y, z - hd], type: 'corner', sourceNodeId: id })
    targets.push({ position: [x - hw, y, z + hd], type: 'corner', sourceNodeId: id })
    targets.push({ position: [x + hw, y, z + hd], type: 'corner', sourceNodeId: id })

    // Edge centers
    targets.push({ position: [x, y, z - hd], type: 'edge-center', sourceNodeId: id })
    targets.push({ position: [x, y, z + hd], type: 'edge-center', sourceNodeId: id })
    targets.push({ position: [x - hw, y, z], type: 'edge-center', sourceNodeId: id })
    targets.push({ position: [x + hw, y, z], type: 'edge-center', sourceNodeId: id })
  }

  return targets
}

export function findSnap(
  position: Vector3Tuple,
  targets: SnapTarget[],
  threshold = SNAP_THRESHOLD
): SnapResult {
  let snapX: number | null = null
  let snapZ: number | null = null
  const guides: SnapGuide[] = []

  for (const target of targets) {
    const dx = Math.abs(position[0] - target.position[0])
    const dz = Math.abs(position[2] - target.position[2])

    if (dx < threshold && (snapX === null || dx < Math.abs(position[0] - snapX))) {
      snapX = target.position[0]
      guides.push({
        from: [target.position[0], 0, Math.min(position[2], target.position[2]) - 1],
        to: [target.position[0], 0, Math.max(position[2], target.position[2]) + 1],
        axis: 'x',
      })
    }

    if (dz < threshold && (snapZ === null || dz < Math.abs(position[2] - snapZ))) {
      snapZ = target.position[2]
      guides.push({
        from: [Math.min(position[0], target.position[0]) - 1, 0, target.position[2]],
        to: [Math.max(position[0], target.position[0]) + 1, 0, target.position[2]],
        axis: 'z',
      })
    }
  }

  const snappedPosition: Vector3Tuple = [
    snapX ?? position[0],
    position[1],
    snapZ ?? position[2],
  ]

  return { snappedPosition, guides, snapped: snapX !== null || snapZ !== null }
}
```

- [ ] **Step 2: Create snap guide visualization component**

```tsx
// packages/editor/src/components/editor/snap-guides.tsx
import { Line } from '@react-three/drei'
import { useSnapGuides } from '../../store/use-snap-guides'

export function SnapGuides() {
  const guides = useSnapGuides((s) => s.guides)

  return (
    <group name="snap-guides">
      {guides.map((guide, i) => (
        <Line
          key={i}
          points={[guide.from, guide.to]}
          color="#22d3ee"
          lineWidth={1}
          dashed
          dashSize={0.1}
          gapSize={0.05}
        />
      ))}
    </group>
  )
}
```

- [ ] **Step 3: Create snap guides store**

```typescript
// packages/editor/src/store/use-snap-guides.ts
import { create } from 'zustand'
import type { SnapGuide } from '../lib/snap-engine'

interface SnapGuidesState {
  guides: SnapGuide[]
  setGuides: (guides: SnapGuide[]) => void
  clearGuides: () => void
}

export const useSnapGuides = create<SnapGuidesState>((set) => ({
  guides: [],
  setGuides: (guides) => set({ guides }),
  clearGuides: () => set({ guides: [] }),
}))
```

- [ ] **Step 4: Integrate snap engine into placement strategies**

In `packages/editor/src/components/tools/item/placement-strategies.ts`, modify the floor placement to use snap engine. After grid snapping, run `findSnap()` against collected targets. Update the position if snapped. Set snap guides in store.

- [ ] **Step 5: Integrate snap guides component into editor scene**

Add `<SnapGuides />` to the editor's 3D scene root (same level as the grid component).

- [ ] **Step 6: Integrate into wall tool for endpoint snapping**

In `packages/editor/src/components/tools/wall/wall-drafting.ts`, extend `snapWallDraftPoint()` to also check nearby wall corners and midpoints, not just endpoints within 0.35 radius.

- [ ] **Step 7: Commit**

```bash
git add packages/editor/src/lib/snap-engine.ts packages/editor/src/components/editor/snap-guides.tsx packages/editor/src/store/use-snap-guides.ts
git add packages/editor/src/components/tools/item/placement-strategies.ts packages/editor/src/components/tools/wall/wall-drafting.ts
git commit -m "feat: add smart object snapping with visual guide lines"
```

---

### Task 2: Dimension Input While Drawing Walls

**Files:**
- Create: `packages/editor/src/components/ui/dimension-input-overlay.tsx`
- Modify: `packages/editor/src/components/tools/wall/wall-tool.tsx`

**Context:** Wall tool shows measurement labels but users can't type exact dimensions. After placing the first point, pressing Tab or typing a number should open an input overlay for exact wall length.

- [ ] **Step 1: Create dimension input overlay component**

```tsx
// packages/editor/src/components/ui/dimension-input-overlay.tsx
import { useEffect, useRef, useState } from 'react'

interface DimensionInputOverlayProps {
  currentLength: number
  onSubmit: (length: number) => void
  onCancel: () => void
  visible: boolean
}

export function DimensionInputOverlay({ currentLength, onSubmit, onCancel, visible }: DimensionInputOverlayProps) {
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
```

- [ ] **Step 2: Integrate into wall tool**

In `packages/editor/src/components/tools/wall/wall-tool.tsx`:

1. Add state: `const [showDimensionInput, setShowDimensionInput] = useState(false)`
2. Add state: `const [currentWallLength, setCurrentWallLength] = useState(0)`
3. When `buildingState === 1` (first point placed), listen for Tab key to open overlay
4. Calculate current wall length from start to cursor: `Math.sqrt((end.x - start.x)**2 + (end.z - start.z)**2)`
5. On dimension submit: calculate the end point at exact length along the current direction vector, then call `createWallOnCurrentLevel()`
6. Render `<DimensionInputOverlay>` as an Html overlay

- [ ] **Step 3: Also support typing numbers directly**

When `buildingState === 1` and a digit key is pressed, auto-open the dimension input with that digit pre-filled. This allows quick workflow: click first point → type "3.5" → Enter.

- [ ] **Step 4: Commit**

```bash
git add packages/editor/src/components/ui/dimension-input-overlay.tsx packages/editor/src/components/tools/wall/wall-tool.tsx
git commit -m "feat: add dimension input while drawing walls (Tab or type number)"
```

---

### Task 3: Space Key Top View Toggle

**Files:**
- Modify: `packages/editor/src/components/editor/custom-camera-controls.tsx`

**Context:** Space currently enables pan mode (left click = screen pan). User wants Space to toggle top view instead. Pan can remain on middle mouse button which already works.

- [ ] **Step 1: Modify Space key handler**

In `packages/editor/src/components/editor/custom-camera-controls.tsx`, replace the Space keydown/keyup handlers:

```typescript
// Replace lines 148-165 approximately
// OLD: Space enables SCREEN_PAN
// NEW: Space toggles top view

case 'Space': {
  e.preventDefault()
  // Toggle top view (same logic as handleTopView)
  const controls = controlsRef.current
  if (!controls) return
  const currentPolar = controls.polarAngle
  if (currentPolar < 0.1) {
    // Already in top view, return to 45°
    controls.rotatePolarTo(Math.PI / 4, true)
  } else {
    // Go to top view
    controls.rotatePolarTo(0, true)
  }
  // Also switch to orthographic when going top, perspective when leaving
  const isGoingTop = currentPolar >= 0.1
  if (isGoingTop) {
    setViewerState({ cameraMode: 'orthographic' })
  } else {
    setViewerState({ cameraMode: 'perspective' })
  }
  break
}
```

- [ ] **Step 2: Remove Space from keyup handler**

Remove the Space keyup handler that was reverting pan mode, since Space is now a toggle (not hold).

- [ ] **Step 3: Commit**

```bash
git add packages/editor/src/components/editor/custom-camera-controls.tsx
git commit -m "feat: Space key toggles top view with orthographic/perspective switch"
```

---

### Task 4: Top View Object Indicator Lines

**Files:**
- Create: `packages/editor/src/components/editor/topview-indicators.tsx`
- Modify: `packages/editor/src/components/editor/editor-scene.tsx` (or equivalent scene root)

**Context:** In top view, some objects (furniture, appliances) are hard to identify. Add subtle indicator lines/markers next to objects so users can see what's there.

- [ ] **Step 1: Create top-view indicators component**

```tsx
// packages/editor/src/components/editor/topview-indicators.tsx
import { Line, Html } from '@react-three/drei'
import { useViewer } from '@pascal-app/viewer'
import { useScene } from '@pascal-app/core'

export function TopViewIndicators() {
  const cameraMode = useViewer((s) => s.cameraMode)
  const polarAngle = useViewer((s) => s.polarAngle)
  const nodes = useScene((s) => s.nodes)

  // Only show in top/plan view (near-zero polar angle)
  const isTopView = cameraMode === 'orthographic' && polarAngle < 0.2

  if (!isTopView) return null

  const items = Array.from(nodes.values()).filter(
    (n) => n.type === 'item' && n.visible !== false
  )

  return (
    <group name="topview-indicators">
      {items.map((item) => {
        const [x, y, z] = item.position
        const label = item.name || item.type
        return (
          <group key={item.id} position={[x, y + 0.01, z]}>
            {/* Cross marker */}
            <Line
              points={[[- 0.15, 0, 0], [0.15, 0, 0]]}
              color="#6366f1"
              lineWidth={1.5}
            />
            <Line
              points={[[0, 0, -0.15], [0, 0, 0.15]]}
              color="#6366f1"
              lineWidth={1.5}
            />
            {/* Label */}
            <Html
              position={[0.25, 0, 0]}
              style={{
                fontSize: '10px',
                color: '#a5b4fc',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {label}
            </Html>
          </group>
        )
      })}
    </group>
  )
}
```

- [ ] **Step 2: Track polar angle in viewer store**

In `packages/viewer/src/store/use-viewer.ts`, add `polarAngle: number` state and `setPolarAngle` setter. Update it from camera controls on each frame or camera change event.

- [ ] **Step 3: Add to editor scene**

Import and render `<TopViewIndicators />` in the editor's 3D scene root component.

- [ ] **Step 4: Commit**

```bash
git add packages/editor/src/components/editor/topview-indicators.tsx
git add packages/viewer/src/store/use-viewer.ts
git commit -m "feat: add object indicator markers in top view"
```

---

### Task 5: Window Bounding Box Resize Handles

**Files:**
- Create: `packages/editor/src/components/editor/resize-handles.tsx`
- Modify: `packages/editor/src/components/tools/window/move-window-tool.tsx`
- Modify: `packages/core/src/systems/window/window-system.tsx`

**Context:** Currently windows can only be resized via property panel sliders. User wants visual corner/edge handles on the wall plane that can be dragged to resize.

- [ ] **Step 1: Create resize handles component**

```tsx
// packages/editor/src/components/editor/resize-handles.tsx
import { useRef, useState } from 'react'
import { Sphere } from '@react-three/drei'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import type { WindowNode } from '@pascal-app/core'

interface ResizeHandlesProps {
  node: WindowNode
  onResize: (width: number, height: number) => void
}

type HandlePosition = 'tl' | 'tr' | 'bl' | 'br' | 'ml' | 'mr' | 'mt' | 'mb'

const HANDLE_SIZE = 0.04
const HANDLE_COLOR = '#22d3ee'
const HANDLE_HOVER_COLOR = '#06b6d4'

export function ResizeHandles({ node, onResize }: ResizeHandlesProps) {
  const [activeHandle, setActiveHandle] = useState<HandlePosition | null>(null)
  const startRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)

  const hw = node.width / 2
  const hh = node.height / 2

  const handles: { pos: HandlePosition; x: number; y: number }[] = [
    { pos: 'tl', x: -hw, y: hh },
    { pos: 'tr', x: hw, y: hh },
    { pos: 'bl', x: -hw, y: -hh },
    { pos: 'br', x: hw, y: -hh },
    { pos: 'ml', x: -hw, y: 0 },
    { pos: 'mr', x: hw, y: 0 },
    { pos: 'mt', x: 0, y: hh },
    { pos: 'mb', x: 0, y: -hh },
  ]

  const handlePointerDown = (handle: HandlePosition, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setActiveHandle(handle)
    startRef.current = { x: e.point.x, y: e.point.y, width: node.width, height: node.height }
    ;(e.target as HTMLElement).setPointerCapture?.(e.nativeEvent.pointerId)
  }

  const handlePointerMove = (handle: HandlePosition, e: ThreeEvent<PointerEvent>) => {
    if (activeHandle !== handle || !startRef.current) return
    e.stopPropagation()

    const dx = e.point.x - startRef.current.x
    const dy = e.point.y - startRef.current.y

    let newWidth = startRef.current.width
    let newHeight = startRef.current.height

    if (handle.includes('l')) newWidth = Math.max(0.3, startRef.current.width - dx * 2)
    if (handle.includes('r')) newWidth = Math.max(0.3, startRef.current.width + dx * 2)
    if (handle.includes('t')) newHeight = Math.max(0.3, startRef.current.height + dy * 2)
    if (handle.includes('b')) newHeight = Math.max(0.3, startRef.current.height - dy * 2)

    onResize(newWidth, newHeight)
  }

  const handlePointerUp = () => {
    setActiveHandle(null)
    startRef.current = null
  }

  return (
    <group name="resize-handles">
      {handles.map(({ pos, x, y }) => (
        <Sphere
          key={pos}
          args={[HANDLE_SIZE, 8, 8]}
          position={[x, y, 0.04]}
          onPointerDown={(e) => handlePointerDown(pos, e)}
          onPointerMove={(e) => handlePointerMove(pos, e)}
          onPointerUp={handlePointerUp}
        >
          <meshBasicMaterial color={activeHandle === pos ? HANDLE_HOVER_COLOR : HANDLE_COLOR} />
        </Sphere>
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Integrate resize handles into window selection**

When a window is selected, render `<ResizeHandles>` positioned at the window's wall-local coordinates. The `onResize` callback calls `updateNode(windowId, { width, height })` and marks the window + parent wall as dirty.

- [ ] **Step 3: Commit**

```bash
git add packages/editor/src/components/editor/resize-handles.tsx
git commit -m "feat: add bounding box resize handles for windows"
```

---

### Task 6: Texture & Material System

**Files:**
- Modify: `packages/core/src/schema/material.ts` (texture schema already exists, verify)
- Create: `packages/viewer/src/lib/texture-loader.ts`
- Modify: `packages/viewer/src/lib/materials.ts`
- Create: `packages/editor/src/components/ui/controls/texture-picker.tsx`
- Modify: `packages/editor/src/components/ui/controls/material-picker.tsx`
- Create: `packages/editor/src/lib/texture-library.ts`

**Context:** MaterialSchema has texture field (url, repeat, scale) but it's not implemented. No texture loading, no texture UI, presets are flat colors only.

- [ ] **Step 1: Create texture library with built-in textures**

```typescript
// packages/editor/src/lib/texture-library.ts
export interface TextureEntry {
  id: string
  name: string
  category: 'wood' | 'stone' | 'tile' | 'metal' | 'fabric' | 'concrete'
  url: string // relative to CDN
  repeat: [number, number]
  roughness: number
  metalness: number
}

export const TEXTURE_LIBRARY: TextureEntry[] = [
  // Wood
  { id: 'wood-oak', name: 'Oak', category: 'wood', url: '/textures/wood-oak.jpg', repeat: [2, 2], roughness: 0.7, metalness: 0 },
  { id: 'wood-walnut', name: 'Walnut', category: 'wood', url: '/textures/wood-walnut.jpg', repeat: [2, 2], roughness: 0.65, metalness: 0 },
  { id: 'wood-pine', name: 'Pine', category: 'wood', url: '/textures/wood-pine.jpg', repeat: [2, 2], roughness: 0.75, metalness: 0 },
  { id: 'wood-parquet', name: 'Parquet', category: 'wood', url: '/textures/wood-parquet.jpg', repeat: [4, 4], roughness: 0.6, metalness: 0 },

  // Stone
  { id: 'stone-marble-white', name: 'White Marble', category: 'stone', url: '/textures/stone-marble-white.jpg', repeat: [1, 1], roughness: 0.3, metalness: 0 },
  { id: 'stone-marble-black', name: 'Black Marble', category: 'stone', url: '/textures/stone-marble-black.jpg', repeat: [1, 1], roughness: 0.3, metalness: 0 },
  { id: 'stone-granite', name: 'Granite', category: 'stone', url: '/textures/stone-granite.jpg', repeat: [2, 2], roughness: 0.5, metalness: 0 },

  // Tile
  { id: 'tile-ceramic-white', name: 'White Ceramic', category: 'tile', url: '/textures/tile-ceramic-white.jpg', repeat: [4, 4], roughness: 0.4, metalness: 0 },
  { id: 'tile-subway', name: 'Subway Tile', category: 'tile', url: '/textures/tile-subway.jpg', repeat: [6, 4], roughness: 0.35, metalness: 0 },
  { id: 'tile-herringbone', name: 'Herringbone', category: 'tile', url: '/textures/tile-herringbone.jpg', repeat: [3, 3], roughness: 0.4, metalness: 0 },

  // Concrete
  { id: 'concrete-smooth', name: 'Smooth Concrete', category: 'concrete', url: '/textures/concrete-smooth.jpg', repeat: [2, 2], roughness: 0.8, metalness: 0 },
  { id: 'concrete-rough', name: 'Rough Concrete', category: 'concrete', url: '/textures/concrete-rough.jpg', repeat: [2, 2], roughness: 0.9, metalness: 0 },

  // Metal
  { id: 'metal-brushed', name: 'Brushed Steel', category: 'metal', url: '/textures/metal-brushed.jpg', repeat: [2, 2], roughness: 0.4, metalness: 0.9 },
  { id: 'metal-copper', name: 'Copper', category: 'metal', url: '/textures/metal-copper.jpg', repeat: [2, 2], roughness: 0.35, metalness: 0.85 },

  // Fabric
  { id: 'fabric-linen', name: 'Linen', category: 'fabric', url: '/textures/fabric-linen.jpg', repeat: [4, 4], roughness: 0.9, metalness: 0 },
]
```

- [ ] **Step 2: Create texture loader with caching**

```typescript
// packages/viewer/src/lib/texture-loader.ts
import { TextureLoader, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

const textureCache = new Map<string, Texture>()
const loader = new TextureLoader()

export function loadTexture(url: string, repeat: [number, number] = [1, 1]): Texture | null {
  const cacheKey = `${url}-${repeat[0]}-${repeat[1]}`

  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!
  }

  const texture = loader.load(url)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.colorSpace = SRGBColorSpace

  textureCache.set(cacheKey, texture)
  return texture
}

export function disposeTexture(url: string) {
  for (const [key, texture] of textureCache) {
    if (key.startsWith(url)) {
      texture.dispose()
      textureCache.delete(key)
    }
  }
}
```

- [ ] **Step 3: Modify createMaterial to support textures**

In `packages/viewer/src/lib/materials.ts`, extend `createMaterial()`:

```typescript
// Add to createMaterial function:
import { loadTexture } from './texture-loader'

// Inside createMaterial, after creating MeshStandardMaterial:
if (material.texture?.url) {
  const texture = loadTexture(
    material.texture.url,
    material.texture.repeat ?? [1, 1]
  )
  if (texture) {
    mat.map = texture
    if (material.texture.scale) {
      texture.repeat.multiplyScalar(material.texture.scale)
    }
    mat.needsUpdate = true
  }
}

// Update getCacheKey to include texture:
function getCacheKey(material: MaterialSchema): string {
  const props = material.properties ?? {}
  const tex = material.texture
  return `${props.color}-${props.roughness}-${props.metalness}-${props.opacity}-${props.transparent}-${props.side}-${tex?.url ?? 'none'}-${tex?.repeat?.join(',') ?? ''}-${tex?.scale ?? ''}`
}
```

- [ ] **Step 4: Create texture picker UI**

```tsx
// packages/editor/src/components/ui/controls/texture-picker.tsx
import { useState } from 'react'
import { TEXTURE_LIBRARY, type TextureEntry } from '../../../lib/texture-library'

interface TexturePickerProps {
  value: { url?: string; repeat?: [number, number]; scale?: number } | undefined
  onChange: (texture: { url: string; repeat: [number, number]; scale: number } | undefined) => void
}

export function TexturePicker({ value, onChange }: TexturePickerProps) {
  const [category, setCategory] = useState<string>('wood')
  const categories = [...new Set(TEXTURE_LIBRARY.map((t) => t.category))]
  const filtered = TEXTURE_LIBRARY.filter((t) => t.category === category)

  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-2 py-0.5 rounded text-xs capitalize ${
              category === cat ? 'bg-cyan-600 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {filtered.map((tex) => (
          <button
            key={tex.id}
            onClick={() => onChange({ url: tex.url, repeat: tex.repeat, scale: 1 })}
            className={`aspect-square rounded border-2 overflow-hidden ${
              value?.url === tex.url ? 'border-cyan-500' : 'border-zinc-700'
            }`}
            title={tex.name}
          >
            <img src={tex.url} alt={tex.name} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {value?.url && (
        <button
          onClick={() => onChange(undefined)}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Remove texture
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Integrate texture picker into material picker**

In `packages/editor/src/components/ui/controls/material-picker.tsx`, add a "Texture" section below the preset buttons that renders `<TexturePicker>`. When a texture is selected, update the node's `material.texture` field.

- [ ] **Step 6: Add placeholder texture images**

Create `apps/editor/public/textures/` directory and add procedurally generated or CC0 texture images for each entry in the library. These can be simple 256x256 tileable patterns initially.

- [ ] **Step 7: Commit**

```bash
git add packages/viewer/src/lib/texture-loader.ts packages/editor/src/lib/texture-library.ts
git add packages/editor/src/components/ui/controls/texture-picker.tsx
git add packages/viewer/src/lib/materials.ts packages/editor/src/components/ui/controls/material-picker.tsx
git add apps/editor/public/textures/
git commit -m "feat: implement texture system with library, loader, and picker UI"
```

---

### Task 7: Box Select with Shift Key

**Files:**
- Modify: `packages/editor/src/components/tools/select/select-tool.tsx` (or equivalent selection tool)

**Context:** User wants box select to activate when holding Shift while in select (V) mode, rather than being a separate mode.

- [ ] **Step 1: Find and modify box select trigger**

Locate the box/marquee select implementation. Modify it so that:
- When select tool (V) is active and Shift is held, left-click-drag starts a box selection rectangle
- Without Shift, normal click-to-select behavior
- Shift+click on individual items adds to selection (multi-select)

- [ ] **Step 2: Update visual feedback**

Show a semi-transparent selection rectangle overlay when Shift+dragging. Use CSS or an SVG overlay with dashed border.

- [ ] **Step 3: Commit**

```bash
git add packages/editor/src/components/tools/select/
git commit -m "feat: box select activates with Shift+drag in select mode"
```

---

### Task 8: L-Staircase Preset & Stair Supports

**Files:**
- Modify: `packages/editor/src/components/tools/stair/stair-defaults.ts`
- Modify: `packages/editor/src/components/tools/stair/stair-tool.tsx`
- Modify: `packages/editor/src/components/ui/panels/stair-panel.tsx`
- Create: `packages/viewer/src/components/renderers/stair/stair-support-renderer.tsx`
- Modify: `packages/core/src/schema/nodes/stair.ts`

**Context:** L-stairs are technically possible (straight + segment with `attachmentSide: 'left'|'right'`) but there's no easy preset. User also wants stair supports (stringers/wall-mounted carriers).

- [ ] **Step 1: Add L-stair and U-stair presets to defaults**

```typescript
// packages/editor/src/components/tools/stair/stair-defaults.ts
// Add new preset configurations:

export const STAIR_PRESETS = {
  straight: {
    stairType: 'straight',
    children: [{ segmentType: 'stair', width: 1.0, length: 3.0, height: 2.5, stepCount: 10, attachmentSide: 'front' }],
  },
  lShape: {
    stairType: 'straight',
    children: [
      { segmentType: 'stair', width: 1.0, length: 2.0, height: 1.25, stepCount: 5, attachmentSide: 'front' },
      { segmentType: 'landing', width: 1.0, length: 1.0, height: 0, attachmentSide: 'front' },
      { segmentType: 'stair', width: 1.0, length: 2.0, height: 1.25, stepCount: 5, attachmentSide: 'left' },
    ],
  },
  uShape: {
    stairType: 'straight',
    children: [
      { segmentType: 'stair', width: 1.0, length: 2.0, height: 1.25, stepCount: 5, attachmentSide: 'front' },
      { segmentType: 'landing', width: 2.0, length: 1.0, height: 0, attachmentSide: 'front' },
      { segmentType: 'stair', width: 1.0, length: 2.0, height: 1.25, stepCount: 5, attachmentSide: 'left' },
    ],
  },
  curved: { /* existing */ },
  spiral: { /* existing */ },
} as const
```

- [ ] **Step 2: Update stair panel to show presets as visual options**

In `packages/editor/src/components/ui/panels/stair-panel.tsx`, replace the simple type toggle with a preset selector that shows: Straight, L-Shape, U-Shape, Curved, Spiral.

When switching presets, recreate child segments accordingly.

- [ ] **Step 3: Add support type to stair schema**

```typescript
// packages/core/src/schema/nodes/stair.ts
// Add support configuration:
export const StairSupportType = z.enum(['none', 'filled', 'stringer', 'wall-mounted'])

// Add to StairNode:
supportType: StairSupportType.default('none'),
supportThickness: z.number().default(0.05), // stringer thickness
```

- [ ] **Step 4: Create stair support renderer**

```tsx
// packages/viewer/src/components/renderers/stair/stair-support-renderer.tsx
// Renders structural supports under stairs based on supportType:
// - 'filled': solid mass under stairs (existing fillToFloor behavior, always enabled)
// - 'stringer': two diagonal beams along sides
// - 'wall-mounted': single beam on wall side with bracket geometry
```

- [ ] **Step 5: Add support controls to stair panel UI**

Add a "Support" section to stair panel with SegmentedControl for support type and thickness slider.

- [ ] **Step 6: Commit**

```bash
git add packages/editor/src/components/tools/stair/stair-defaults.ts
git add packages/editor/src/components/ui/panels/stair-panel.tsx
git add packages/core/src/schema/nodes/stair.ts
git add packages/viewer/src/components/renderers/stair/stair-support-renderer.tsx
git commit -m "feat: add L/U staircase presets and structural support types"
```

---

### Task 9: Additional Door Types (Sliding, Double, Folding)

**Files:**
- Modify: `packages/core/src/schema/nodes/door.ts`
- Modify: `packages/core/src/systems/door/door-system.tsx`
- Modify: `packages/editor/src/components/ui/panels/door-panel.tsx`

**Context:** Current door is single-leaf swing only. Add sliding, double-leaf, and folding door types.

- [ ] **Step 1: Extend door schema with door style**

```typescript
// packages/core/src/schema/nodes/door.ts
// Add door style enum:
export const DoorStyle = z.enum(['single', 'double', 'sliding', 'pocket', 'bifold', 'barn'])

// Add to DoorNode:
doorStyle: DoorStyle.default('single'),
// For double doors:
leafRatio: z.number().min(0.3).max(0.7).default(0.5), // ratio of left leaf to total width
// For sliding doors:
slideDirection: z.enum(['left', 'right']).default('left'),
// For bifold:
foldPanels: z.number().min(2).max(6).default(4),
```

- [ ] **Step 2: Update door geometry system**

In `packages/core/src/systems/door/door-system.tsx`, extend `updateDoorMesh`:

```typescript
// Add geometry generation per style:

// 'double': Two leaves with separate hinges, gap in middle
// - Left leaf: width * leafRatio, hinges on left
// - Right leaf: width * (1 - leafRatio), hinges on right

// 'sliding': Single leaf on a track rail
// - Rail geometry at top (thin box across full width)
// - Leaf offset to one side based on slideDirection
// - No hinges, no swing arc

// 'pocket': Like sliding but leaf disappears into wall
// - Same as sliding but cutout extends into wall

// 'barn': Sliding with visible top rail and rollers
// - Exposed rail with roller hardware
// - Leaf hangs from rail

// 'bifold': Multiple panels that fold accordion-style
// - N panels of equal width (width / foldPanels)
// - Alternating hinge positions
// - Each panel slightly angled when partially open
```

- [ ] **Step 3: Update door panel UI**

In `packages/editor/src/components/ui/panels/door-panel.tsx`:

```tsx
// Add door style selector at top of panel:
<PanelSection title="Style">
  <SegmentedControl
    options={[
      { value: 'single', label: 'Single' },
      { value: 'double', label: 'Double' },
      { value: 'sliding', label: 'Sliding' },
      { value: 'barn', label: 'Barn' },
      { value: 'bifold', label: 'Bifold' },
      { value: 'pocket', label: 'Pocket' },
    ]}
    value={node.doorStyle}
    onChange={(v) => handleUpdate({ doorStyle: v })}
  />
</PanelSection>

// Conditionally show style-specific controls:
// - double: leaf ratio slider
// - sliding/barn: slide direction toggle
// - bifold: panel count slider
// - Hide swing/hinge controls for non-swing types
```

- [ ] **Step 4: Update wall CSG cutout for different door types**

Sliding and pocket doors need different wall cutouts than swing doors. Pocket doors need an extended cutout into the wall for the leaf to slide into.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/schema/nodes/door.ts
git add packages/core/src/systems/door/door-system.tsx
git add packages/editor/src/components/ui/panels/door-panel.tsx
git commit -m "feat: add sliding, double, barn, bifold, and pocket door types"
```

---

### Task 10: 3DS Export

**Files:**
- Create: `packages/viewer/src/lib/three-ds-exporter.ts`
- Modify: `packages/viewer/src/systems/export/export-system.tsx`
- Modify: `packages/editor/src/components/ui/sidebar/panels/settings-panel/index.tsx`

**Context:** OBJ, GLB, STL exports exist. Add 3DS (3D Studio) format export.

- [ ] **Step 1: Create 3DS exporter**

Three.js doesn't have a built-in 3DS exporter. Create a minimal one that converts the scene to binary 3DS format:

```typescript
// packages/viewer/src/lib/three-ds-exporter.ts
import { type Scene, type Mesh, type BufferGeometry, type Material } from 'three'

// 3DS chunk IDs
const CHUNK_MAIN = 0x4d4d
const CHUNK_VERSION = 0x0002
const CHUNK_EDITOR = 0x3d3d
const CHUNK_OBJECT = 0x4000
const CHUNK_TRIMESH = 0x4100
const CHUNK_VERTICES = 0x4110
const CHUNK_FACES = 0x4120

export class ThreeDSExporter {
  parse(scene: Scene): ArrayBuffer {
    const meshes: { name: string; geometry: BufferGeometry }[] = []

    scene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh
        if (mesh.geometry) {
          meshes.push({
            name: mesh.name || `object_${meshes.length}`,
            geometry: mesh.geometry,
          })
        }
      }
    })

    return this.build3DS(meshes)
  }

  private build3DS(meshes: { name: string; geometry: BufferGeometry }[]): ArrayBuffer {
    // Build binary 3DS file structure
    // Main chunk > Editor chunk > Object chunks > Trimesh > Vertices + Faces
    const objectChunks = meshes.map((m) => this.buildObjectChunk(m.name, m.geometry))
    const editorChunk = this.buildChunk(CHUNK_EDITOR, this.concat(objectChunks))
    const versionChunk = this.buildChunk(CHUNK_VERSION, new Uint8Array([3, 0, 0, 0]))
    const mainChunk = this.buildChunk(CHUNK_MAIN, this.concat([versionChunk, editorChunk]))
    return mainChunk.buffer
  }

  private buildObjectChunk(name: string, geometry: BufferGeometry): Uint8Array {
    const nameBytes = new TextEncoder().encode(name.substring(0, 10) + '\0')
    const vertexChunk = this.buildVertexChunk(geometry)
    const faceChunk = this.buildFaceChunk(geometry)
    const trimeshChunk = this.buildChunk(CHUNK_TRIMESH, this.concat([vertexChunk, faceChunk]))
    return this.buildChunk(CHUNK_OBJECT, this.concat([nameBytes, trimeshChunk]))
  }

  private buildVertexChunk(geometry: BufferGeometry): Uint8Array {
    const positions = geometry.getAttribute('position')
    const count = positions.count
    const data = new ArrayBuffer(2 + count * 12)
    const view = new DataView(data)
    view.setUint16(0, count, true)
    for (let i = 0; i < count; i++) {
      view.setFloat32(2 + i * 12, positions.getX(i), true)
      view.setFloat32(2 + i * 12 + 4, positions.getY(i), true)
      view.setFloat32(2 + i * 12 + 8, positions.getZ(i), true)
    }
    return this.buildChunk(CHUNK_VERTICES, new Uint8Array(data))
  }

  private buildFaceChunk(geometry: BufferGeometry): Uint8Array {
    const index = geometry.getIndex()
    const faceCount = index ? index.count / 3 : geometry.getAttribute('position').count / 3
    const data = new ArrayBuffer(2 + faceCount * 8)
    const view = new DataView(data)
    view.setUint16(0, faceCount, true)
    for (let i = 0; i < faceCount; i++) {
      const a = index ? index.getX(i * 3) : i * 3
      const b = index ? index.getX(i * 3 + 1) : i * 3 + 1
      const c = index ? index.getX(i * 3 + 2) : i * 3 + 2
      view.setUint16(2 + i * 8, a, true)
      view.setUint16(2 + i * 8 + 2, b, true)
      view.setUint16(2 + i * 8 + 4, c, true)
      view.setUint16(2 + i * 8 + 6, 0, true) // flags
    }
    return this.buildChunk(CHUNK_FACES, new Uint8Array(data))
  }

  private buildChunk(id: number, data: Uint8Array): Uint8Array {
    const totalSize = 6 + data.length
    const chunk = new Uint8Array(totalSize)
    const view = new DataView(chunk.buffer)
    view.setUint16(0, id, true)
    view.setUint32(2, totalSize, true)
    chunk.set(data, 6)
    return chunk
  }

  private concat(arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((sum, a) => sum + a.length, 0)
    const result = new Uint8Array(total)
    let offset = 0
    for (const arr of arrays) {
      result.set(arr, offset)
      offset += arr.length
    }
    return result
  }
}
```

- [ ] **Step 2: Add 3DS to export system**

In `packages/viewer/src/systems/export/export-system.tsx`, add `'3ds'` format case:

```typescript
case '3ds': {
  const { ThreeDSExporter } = await import('../../lib/three-ds-exporter')
  const exporter = new ThreeDSExporter()
  const result = exporter.parse(clonedScene)
  downloadBlob(new Blob([result]), `scene-${timestamp}.3ds`)
  break
}
```

- [ ] **Step 3: Add 3DS button to settings panel**

```tsx
// In settings-panel/index.tsx, add after OBJ button:
<Button onClick={() => exportScene?.('3ds')} variant="outline">
  <Download className="size-4" />
  Export 3DS
</Button>
```

- [ ] **Step 4: Commit**

```bash
git add packages/viewer/src/lib/three-ds-exporter.ts
git add packages/viewer/src/systems/export/export-system.tsx
git add packages/editor/src/components/ui/sidebar/panels/settings-panel/index.tsx
git commit -m "feat: add 3DS format export"
```

---

### Task 11: Default Materials for Objects

**Files:**
- Modify: `packages/viewer/src/lib/materials.ts`
- Modify: Various renderer files for doors, windows, stairs, walls, slabs

**Context:** All objects use flat colors. Doors should look like wood, windows like glass with frames, stairs like concrete or wood, etc.

- [ ] **Step 1: Update default material constants**

```typescript
// packages/viewer/src/lib/materials.ts
// Replace flat color defaults with richer PBR properties:

export const DEFAULT_WALL_MATERIAL = createMaterial({
  properties: { color: '#f5f5f0', roughness: 0.85, metalness: 0 },
})

export const DEFAULT_DOOR_MATERIAL = createMaterial({
  preset: 'wood',
  properties: { color: '#8B6914', roughness: 0.65, metalness: 0 },
})

export const DEFAULT_WINDOW_FRAME_MATERIAL = createMaterial({
  properties: { color: '#e8e8e8', roughness: 0.3, metalness: 0.6 },
})

export const DEFAULT_WINDOW_GLASS_MATERIAL = createMaterial({
  properties: { color: '#b8d4e8', roughness: 0.05, metalness: 0.1, opacity: 0.25, transparent: true },
})

export const DEFAULT_SLAB_MATERIAL = createMaterial({
  properties: { color: '#d4cfc4', roughness: 0.75, metalness: 0 },
})

export const DEFAULT_STAIR_MATERIAL = createMaterial({
  properties: { color: '#c8bfb0', roughness: 0.7, metalness: 0 },
})

export const DEFAULT_CEILING_MATERIAL = createMaterial({
  properties: { color: '#fafafa', roughness: 0.95, metalness: 0 },
})

export const DEFAULT_ROOF_WALL_MATERIAL = createMaterial({
  properties: { color: '#e8e0d0', roughness: 0.85, metalness: 0 },
})

export const DEFAULT_ROOF_SHINGLE_MATERIAL = createMaterial({
  properties: { color: '#6b5c4c', roughness: 0.9, metalness: 0 },
})
```

- [ ] **Step 2: Apply separate materials to door frame vs leaf**

In `packages/core/src/systems/door/door-system.tsx`, use `DEFAULT_DOOR_MATERIAL` for the leaf and a lighter frame material for the frame. Glass segments should use `DEFAULT_WINDOW_GLASS_MATERIAL`.

- [ ] **Step 3: Apply separate materials to window frame vs glass**

In `packages/core/src/systems/window/window-system.tsx`, use `DEFAULT_WINDOW_FRAME_MATERIAL` for frame members and `DEFAULT_WINDOW_GLASS_MATERIAL` for glass panes.

- [ ] **Step 4: Apply better roof materials**

In `packages/viewer/src/components/renderers/roof/roof-materials.ts`, update the 4-material array to use richer defaults: warm off-white for walls, darker brown/gray for shingles.

- [ ] **Step 5: Commit**

```bash
git add packages/viewer/src/lib/materials.ts
git add packages/core/src/systems/door/door-system.tsx
git add packages/core/src/systems/window/window-system.tsx
git add packages/viewer/src/components/renderers/roof/roof-materials.ts
git commit -m "feat: update default materials with realistic PBR properties"
```

---

## Execution Order (Recommended)

Independent tasks that can be parallelized:

**Batch 1 (No dependencies):**
- Task 3: Space Key Top View (low complexity)
- Task 7: Box Select with Shift (low complexity)
- Task 10: 3DS Export (low complexity)
- Task 11: Default Materials (medium, no schema changes)

**Batch 2 (Medium complexity):**
- Task 1: Smart Snapping
- Task 2: Dimension Input
- Task 4: Top View Indicators
- Task 8: L-Staircase Presets

**Batch 3 (High complexity, depends on Batch 1):**
- Task 5: Window Resize Handles
- Task 6: Texture System (depends on Task 11)
- Task 9: Door Types
