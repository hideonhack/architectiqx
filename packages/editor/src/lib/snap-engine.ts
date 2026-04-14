import type { Vector3Tuple } from 'three'

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// CONSTANTS
// ============================================================================

const SNAP_THRESHOLD = 0.15 // meters

// ============================================================================
// SNAP TARGET COLLECTION
// ============================================================================

/**
 * Collect snap targets (center, 4 corners, 4 edge-centers) for all nodes
 * except the one being dragged.
 */
export function collectSnapTargets(
  nodes: Map<string, { position: Vector3Tuple; width: number; depth: number }>,
  excludeId: string,
): SnapTarget[] {
  const targets: SnapTarget[] = []

  for (const [id, node] of nodes) {
    if (id === excludeId) continue

    const [cx, cy, cz] = node.position
    const hw = node.width / 2
    const hd = node.depth / 2

    // Center
    targets.push({ position: [cx, cy, cz], type: 'center', sourceNodeId: id })

    // Four corners (XZ plane)
    targets.push({ position: [cx - hw, cy, cz - hd], type: 'corner', sourceNodeId: id })
    targets.push({ position: [cx + hw, cy, cz - hd], type: 'corner', sourceNodeId: id })
    targets.push({ position: [cx - hw, cy, cz + hd], type: 'corner', sourceNodeId: id })
    targets.push({ position: [cx + hw, cy, cz + hd], type: 'corner', sourceNodeId: id })

    // Four edge-centers
    targets.push({ position: [cx, cy, cz - hd], type: 'edge-center', sourceNodeId: id })
    targets.push({ position: [cx, cy, cz + hd], type: 'edge-center', sourceNodeId: id })
    targets.push({ position: [cx - hw, cy, cz], type: 'edge-center', sourceNodeId: id })
    targets.push({ position: [cx + hw, cy, cz], type: 'edge-center', sourceNodeId: id })
  }

  return targets
}

// ============================================================================
// SNAP DETECTION
// ============================================================================

/**
 * Find snap alignment for a position against collected targets.
 * Checks X and Z axes independently — a position can snap on one or both axes.
 * Returns the snapped position and visual guide lines.
 */
export function findSnap(
  position: Vector3Tuple,
  targets: SnapTarget[],
  threshold = SNAP_THRESHOLD,
): SnapResult {
  const [px, py, pz] = position
  let snapX: number | null = null
  let snapZ: number | null = null
  let bestDeltaX = threshold
  let bestDeltaZ = threshold
  let snapTargetX: SnapTarget | null = null
  let snapTargetZ: SnapTarget | null = null

  for (const target of targets) {
    const dx = Math.abs(target.position[0] - px)
    const dz = Math.abs(target.position[2] - pz)

    if (dx < bestDeltaX) {
      bestDeltaX = dx
      snapX = target.position[0]
      snapTargetX = target
    }

    if (dz < bestDeltaZ) {
      bestDeltaZ = dz
      snapZ = target.position[2]
      snapTargetZ = target
    }
  }

  const snapped = snapX !== null || snapZ !== null
  const snappedPosition: Vector3Tuple = [snapX ?? px, py, snapZ ?? pz]
  const guides: SnapGuide[] = []

  // Guide line along Z axis (vertical on screen) when X is snapped
  if (snapX !== null && snapTargetX) {
    const minZ = Math.min(snappedPosition[2], snapTargetX.position[2])
    const maxZ = Math.max(snappedPosition[2], snapTargetX.position[2])
    guides.push({
      from: [snapX, py + 0.05, minZ - 0.5],
      to: [snapX, py + 0.05, maxZ + 0.5],
      axis: 'x',
    })
  }

  // Guide line along X axis (horizontal on screen) when Z is snapped
  if (snapZ !== null && snapTargetZ) {
    const minX = Math.min(snappedPosition[0], snapTargetZ.position[0])
    const maxX = Math.max(snappedPosition[0], snapTargetZ.position[0])
    guides.push({
      from: [minX - 0.5, py + 0.05, snapZ],
      to: [maxX + 0.5, py + 0.05, snapZ],
      axis: 'z',
    })
  }

  return { snappedPosition, guides, snapped }
}
