import { emitter, type GridEvent, type LevelNode, useScene, type WallNode } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DoubleSide, type Group, type Mesh, Shape, ShapeGeometry, Vector3 } from 'three'
import { markToolCancelConsumed } from '../../../hooks/use-keyboard'
import { EDITOR_LAYER } from '../../../lib/constants'
import { sfxEmitter } from '../../../lib/sfx-bus'
import { DimensionInputOverlay } from '../../ui/dimension-input-overlay'
import { CursorSphere } from '../shared/cursor-sphere'
import { createWallOnCurrentLevel, snapWallDraftPoint, type WallPlanPoint } from './wall-drafting'

const WALL_HEIGHT = 2.5

/**
 * Update wall preview mesh geometry to create a vertical plane between two points
 */
const updateWallPreview = (mesh: Mesh, start: Vector3, end: Vector3) => {
  // Calculate direction and perpendicular for wall thickness
  const direction = new Vector3(end.x - start.x, 0, end.z - start.z)
  const length = direction.length()

  if (length < 0.01) {
    mesh.visible = false
    return
  }

  mesh.visible = true
  direction.normalize()

  // Create wall shape (vertical rectangle in XY plane)
  const shape = new Shape()
  shape.moveTo(0, 0)
  shape.lineTo(length, 0)
  shape.lineTo(length, WALL_HEIGHT)
  shape.lineTo(0, WALL_HEIGHT)
  shape.closePath()

  // Create geometry
  const geometry = new ShapeGeometry(shape)

  // Calculate rotation angle
  // Negate the angle to fix the opposite direction issue
  const angle = -Math.atan2(direction.z, direction.x)

  // Position at start point and rotate
  mesh.position.set(start.x, start.y, start.z)
  mesh.rotation.y = angle

  // Dispose old geometry and assign new one
  if (mesh.geometry) {
    mesh.geometry.dispose()
  }
  mesh.geometry = geometry
}

const getCurrentLevelWalls = (): WallNode[] => {
  const currentLevelId = useViewer.getState().selection.levelId
  const { nodes } = useScene.getState()

  if (!currentLevelId) return []

  const levelNode = nodes[currentLevelId]
  if (!levelNode || levelNode.type !== 'level') return []

  return (levelNode as LevelNode).children
    .map((childId) => nodes[childId])
    .filter((node): node is WallNode => node?.type === 'wall')
}

export const WallTool: React.FC = () => {
  const cursorRef = useRef<Group>(null)
  const wallPreviewRef = useRef<Mesh>(null!)
  const startingPoint = useRef(new Vector3(0, 0, 0))
  const endingPoint = useRef(new Vector3(0, 0, 0))
  const buildingState = useRef(0)
  const shiftPressed = useRef(false)
  const dimensionInputActive = useRef(false)

  const [dimensionOverlay, setDimensionOverlay] = useState<{
    visible: boolean
    currentLength: number
  }>({ visible: false, currentLength: 0 })

  const openDimensionInput = useCallback(() => {
    if (buildingState.current !== 1) return
    const dx = endingPoint.current.x - startingPoint.current.x
    const dz = endingPoint.current.z - startingPoint.current.z
    const length = Math.sqrt(dx * dx + dz * dz)
    if (length < 0.01) return
    dimensionInputActive.current = true
    setDimensionOverlay({ visible: true, currentLength: length })
  }, [])

  const handleDimensionSubmit = useCallback((length: number) => {
    if (buildingState.current !== 1) return
    const dx = endingPoint.current.x - startingPoint.current.x
    const dz = endingPoint.current.z - startingPoint.current.z
    const currentLength = Math.sqrt(dx * dx + dz * dz)
    if (currentLength < 0.01) return

    // Calculate end point at exact length along current direction
    const dirX = dx / currentLength
    const dirZ = dz / currentLength
    const exactEnd: WallPlanPoint = [
      startingPoint.current.x + dirX * length,
      startingPoint.current.z + dirZ * length,
    ]

    createWallOnCurrentLevel(
      [startingPoint.current.x, startingPoint.current.z],
      exactEnd,
    )

    // Update preview to show final wall, then hide
    if (wallPreviewRef.current) {
      const finalEnd = new Vector3(exactEnd[0], endingPoint.current.y, exactEnd[1])
      updateWallPreview(wallPreviewRef.current, startingPoint.current, finalEnd)
      wallPreviewRef.current.visible = false
    }

    buildingState.current = 0
    dimensionInputActive.current = false
    setDimensionOverlay({ visible: false, currentLength: 0 })
  }, [])

  const handleDimensionCancel = useCallback(() => {
    dimensionInputActive.current = false
    setDimensionOverlay({ visible: false, currentLength: 0 })
  }, [])

  useEffect(() => {
    let gridPosition: WallPlanPoint = [0, 0]
    let previousWallEnd: [number, number] | null = null

    // All positions are building-local: this tool is inside the ToolManager building group,
    // so local coords are used for both data and visual positioning.
    const onGridMove = (event: GridEvent) => {
      if (!(cursorRef.current && wallPreviewRef.current)) return
      // Pause preview updates while dimension input is active
      if (dimensionInputActive.current) return

      const walls = getCurrentLevelWalls()
      // event.localPosition is building-local — consistent with stored wall start/end
      const localPoint: WallPlanPoint = [event.localPosition[0], event.localPosition[2]]
      gridPosition = snapWallDraftPoint({ point: localPoint, walls })

      if (buildingState.current === 1) {
        const snappedLocal = snapWallDraftPoint({
          point: localPoint,
          walls,
          start: [startingPoint.current.x, startingPoint.current.z],
          angleSnap: !shiftPressed.current,
        })
        endingPoint.current.set(snappedLocal[0], event.localPosition[1], snappedLocal[1])
        cursorRef.current.position.copy(endingPoint.current)

        // Play snap sound only when the actual wall end position changes
        const currentWallEnd: [number, number] = [snappedLocal[0], snappedLocal[1]]
        if (
          previousWallEnd &&
          (currentWallEnd[0] !== previousWallEnd[0] || currentWallEnd[1] !== previousWallEnd[1])
        ) {
          sfxEmitter.emit('sfx:grid-snap')
        }
        previousWallEnd = currentWallEnd

        updateWallPreview(wallPreviewRef.current, startingPoint.current, endingPoint.current)
      } else {
        // Not drawing a wall yet, show the snapped anchor point.
        cursorRef.current.position.set(gridPosition[0], event.localPosition[1], gridPosition[1])
      }
    }

    const onGridClick = (event: GridEvent) => {
      // Ignore clicks while dimension input is active
      if (dimensionInputActive.current) return

      const walls = getCurrentLevelWalls()
      const localClick: WallPlanPoint = [event.localPosition[0], event.localPosition[2]]

      if (buildingState.current === 0) {
        const snappedStart = snapWallDraftPoint({ point: localClick, walls })
        gridPosition = snappedStart
        startingPoint.current.set(snappedStart[0], event.localPosition[1], snappedStart[1])
        endingPoint.current.copy(startingPoint.current)
        buildingState.current = 1
        wallPreviewRef.current.visible = true
      } else if (buildingState.current === 1) {
        const snappedEnd = snapWallDraftPoint({
          point: localClick,
          walls,
          start: [startingPoint.current.x, startingPoint.current.z],
          angleSnap: !shiftPressed.current,
        })
        const dx = snappedEnd[0] - startingPoint.current.x
        const dz = snappedEnd[1] - startingPoint.current.z
        if (dx * dx + dz * dz < 0.01 * 0.01) return
        // Both start and end are building-local
        createWallOnCurrentLevel([startingPoint.current.x, startingPoint.current.z], snappedEnd)
        wallPreviewRef.current.visible = false
        buildingState.current = 0
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftPressed.current = true
        return
      }

      // Only trigger dimension input when drawing (buildingState === 1) and not already active
      if (buildingState.current === 1 && !dimensionInputActive.current) {
        if (e.key === 'Tab' || (e.key >= '0' && e.key <= '9')) {
          e.preventDefault()
          e.stopPropagation()
          openDimensionInput()
        }
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftPressed.current = false
      }
    }

    const onCancel = () => {
      if (dimensionInputActive.current) {
        markToolCancelConsumed()
        dimensionInputActive.current = false
        setDimensionOverlay({ visible: false, currentLength: 0 })
        return
      }
      if (buildingState.current === 1) {
        markToolCancelConsumed()
        buildingState.current = 0
        wallPreviewRef.current.visible = false
      }
    }

    emitter.on('grid:move', onGridMove)
    emitter.on('grid:click', onGridClick)
    emitter.on('tool:cancel', onCancel)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      emitter.off('grid:move', onGridMove)
      emitter.off('grid:click', onGridClick)
      emitter.off('tool:cancel', onCancel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [openDimensionInput])

  return (
    <group>
      {/* Cursor indicator */}
      <CursorSphere ref={cursorRef} />

      {/* Wall preview */}
      <mesh layers={EDITOR_LAYER} ref={wallPreviewRef} renderOrder={1} visible={false}>
        <shapeGeometry />
        <meshBasicMaterial
          color="#818cf8"
          depthTest={false}
          depthWrite={false}
          opacity={0.5}
          side={DoubleSide}
          transparent
        />
      </mesh>

      {/* Dimension input overlay — rendered in DOM via portal */}
      {createPortal(
        <DimensionInputOverlay
          currentLength={dimensionOverlay.currentLength}
          onSubmit={handleDimensionSubmit}
          onCancel={handleDimensionCancel}
          visible={dimensionOverlay.visible}
        />,
        document.body,
      )}
    </group>
  )
}
