import { type AnyNodeId, sceneRegistry, useScene, type WindowNode } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { Sphere } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'

const HANDLE_RADIUS = 0.04
const HANDLE_COLOR = '#22d3ee'
const MIN_SIZE = 0.3

// Z offset to push handles slightly in front of the window frame
const HANDLE_Z_OFFSET = 0.05

type HandleId = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br'

type HandleDef = {
  id: HandleId
  /** Position relative to window center (x, y) */
  getOffset: (w: number, h: number) => [number, number]
  /** Which axes this handle resizes */
  resizesWidth: boolean
  resizesHeight: boolean
  /** Sign for width delta: -1 = left edge, +1 = right edge */
  widthSign: number
  /** Sign for height delta: -1 = bottom edge, +1 = top edge */
  heightSign: number
}

const HANDLES: HandleDef[] = [
  // Corners
  { id: 'tl', getOffset: (w, h) => [-w / 2, h / 2], resizesWidth: true, resizesHeight: true, widthSign: -1, heightSign: 1 },
  { id: 'tr', getOffset: (w, h) => [w / 2, h / 2], resizesWidth: true, resizesHeight: true, widthSign: 1, heightSign: 1 },
  { id: 'bl', getOffset: (w, h) => [-w / 2, -h / 2], resizesWidth: true, resizesHeight: true, widthSign: -1, heightSign: -1 },
  { id: 'br', getOffset: (w, h) => [w / 2, -h / 2], resizesWidth: true, resizesHeight: true, widthSign: 1, heightSign: -1 },
  // Edge midpoints
  { id: 'tc', getOffset: (_, h) => [0, h / 2], resizesWidth: false, resizesHeight: true, widthSign: 0, heightSign: 1 },
  { id: 'bc', getOffset: (_, h) => [0, -h / 2], resizesWidth: false, resizesHeight: true, widthSign: 0, heightSign: -1 },
  { id: 'ml', getOffset: (w) => [-w / 2, 0], resizesWidth: true, resizesHeight: false, widthSign: -1, heightSign: 0 },
  { id: 'mr', getOffset: (w) => [w / 2, 0], resizesWidth: true, resizesHeight: false, widthSign: 1, heightSign: 0 },
]

const handleMaterial = new THREE.MeshBasicMaterial({ color: HANDLE_COLOR, depthTest: false })

function ResizeHandle({
  handle,
  windowNode,
}: {
  handle: HandleDef
  windowNode: WindowNode
}) {
  const dragRef = useRef<{
    startPointerWorld: THREE.Vector3
    startWidth: number
    startHeight: number
    /** Inverse of the window's world matrix — projects world coords into local space */
    inverseWorldMatrix: THREE.Matrix4
  } | null>(null)

  const { gl } = useThree()

  const [ox, oy] = handle.getOffset(windowNode.width, windowNode.height)

  const onPointerDown = useCallback(
    (e: any) => {
      e.stopPropagation()
      ;(e.target as HTMLElement)?.setPointerCapture?.(e.pointerId)

      // Get the window's Three.js object for world transform
      const windowObj = sceneRegistry.nodes.get(windowNode.id)
      if (!windowObj) return

      const inverseWorldMatrix = new THREE.Matrix4().copy(windowObj.matrixWorld).invert()

      dragRef.current = {
        startPointerWorld: e.point.clone(),
        startWidth: windowNode.width,
        startHeight: windowNode.height,
        inverseWorldMatrix,
      }

      // Disable orbit controls during drag
      gl.domElement.style.cursor = 'nwse-resize'
    },
    [windowNode.id, windowNode.width, windowNode.height, gl],
  )

  const onPointerMove = useCallback(
    (e: any) => {
      if (!dragRef.current) return
      e.stopPropagation()

      const { startPointerWorld, startWidth, startHeight, inverseWorldMatrix } = dragRef.current

      // Project both start and current pointer positions into window-local space
      const startLocal = startPointerWorld.clone().applyMatrix4(inverseWorldMatrix)
      const currentLocal = (e.point as THREE.Vector3).clone().applyMatrix4(inverseWorldMatrix)

      const deltaLocal = new THREE.Vector3().subVectors(currentLocal, startLocal)

      let newWidth = startWidth
      let newHeight = startHeight

      if (handle.resizesWidth) {
        // Symmetric resize: delta on one edge doubles the change
        const widthDelta = deltaLocal.x * handle.widthSign * 2
        newWidth = Math.max(MIN_SIZE, startWidth + widthDelta)
      }

      if (handle.resizesHeight) {
        const heightDelta = deltaLocal.y * handle.heightSign * 2
        newHeight = Math.max(MIN_SIZE, startHeight + heightDelta)
      }

      const { updateNode, markDirty } = useScene.getState()
      updateNode(windowNode.id as AnyNodeId, { width: newWidth, height: newHeight })
      markDirty(windowNode.id as AnyNodeId)

      // Also dirty the parent wall so its CSG cutout updates
      if (windowNode.parentId) {
        markDirty(windowNode.parentId as AnyNodeId)
      }
    },
    [windowNode.id, windowNode.parentId, handle],
  )

  const onPointerUp = useCallback(
    (e: any) => {
      if (!dragRef.current) return
      e.stopPropagation()
      ;(e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId)
      dragRef.current = null
      gl.domElement.style.cursor = ''
    },
    [gl],
  )

  return (
    <Sphere
      args={[HANDLE_RADIUS, 16, 16]}
      material={handleMaterial}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      position={[ox, oy, HANDLE_Z_OFFSET]}
      renderOrder={999}
    />
  )
}

const ResizeHandlesInner = ({ windowNode }: { windowNode: WindowNode }) => {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame(() => {
    const windowObj = sceneRegistry.nodes.get(windowNode.id)
    if (!windowObj || !groupRef.current) return

    groupRef.current.matrix.copy(windowObj.matrixWorld)
    groupRef.current.matrixWorld.copy(windowObj.matrixWorld)
  })

  return (
    <group ref={groupRef} matrixAutoUpdate={false}>
      {HANDLES.map((handle) => (
        <ResizeHandle handle={handle} key={handle.id} windowNode={windowNode} />
      ))}
    </group>
  )
}

export const ResizeHandles = () => {
  const selectedIds = useViewer((s) => s.selection.selectedIds)
  const nodes = useScene((s) => s.nodes)

  const windowNode = useMemo(() => {
    if (selectedIds.length !== 1) return null
    const node = nodes[selectedIds[0] as AnyNodeId]
    if (!node || node.type !== 'window') return null
    return node as WindowNode
  }, [selectedIds, nodes])

  if (!windowNode) return null

  return <ResizeHandlesInner windowNode={windowNode} />
}
