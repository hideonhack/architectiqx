import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneRegistry } from '../../hooks/scene-registry/scene-registry'
import { baseMaterial, glassMaterial } from '../../materials'
import type { AnyNodeId, DoorNode } from '../../schema'
import useScene from '../../store/use-scene'

// Invisible material for root mesh — used as selection hitbox only
const hitboxMaterial = new THREE.MeshBasicMaterial({ visible: false })

export const DoorSystem = () => {
  const dirtyNodes = useScene((state) => state.dirtyNodes)
  const clearDirty = useScene((state) => state.clearDirty)

  useFrame(() => {
    if (dirtyNodes.size === 0) return

    const nodes = useScene.getState().nodes

    dirtyNodes.forEach((id) => {
      const node = nodes[id]
      if (!node || node.type !== 'door') return

      const mesh = sceneRegistry.nodes.get(id) as THREE.Mesh
      if (!mesh) return // Keep dirty until mesh mounts

      updateDoorMesh(node as DoorNode, mesh)
      clearDirty(id as AnyNodeId)

      // Rebuild the parent wall so its cutout reflects the updated door geometry
      if ((node as DoorNode).parentId) {
        useScene.getState().dirtyNodes.add((node as DoorNode).parentId as AnyNodeId)
      }
    })
  }, 3)

  return null
}

function addBox(
  parent: THREE.Object3D,
  material: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  m.position.set(x, y, z)
  parent.add(m)
}

function updateDoorMesh(node: DoorNode, mesh: THREE.Mesh) {
  // Root mesh is an invisible hitbox; all visuals live in child meshes
  mesh.geometry.dispose()
  mesh.geometry = new THREE.BoxGeometry(node.width, node.height, node.frameDepth)
  mesh.material = hitboxMaterial

  // Sync transform from node (React may lag behind the system by a frame during drag)
  mesh.position.set(node.position[0], node.position[1], node.position[2])
  mesh.rotation.set(node.rotation[0], node.rotation[1], node.rotation[2])

  // Dispose and remove all old visual children; preserve 'cutout'
  for (const child of [...mesh.children]) {
    if (child.name === 'cutout') continue
    if (child instanceof THREE.Mesh) child.geometry.dispose()
    mesh.remove(child)
  }

  const {
    width,
    height,
    frameThickness,
    frameDepth,
    threshold,
    thresholdHeight,
    segments,
    handle,
    handleHeight,
    handleSide,
    doorCloser,
    panicBar,
    panicBarHeight,
    contentPadding,
    hingesSide,
    doorStyle = 'single',
    leafRatio = 0.5,
    slideDirection = 'left',
    foldPanels = 4,
  } = node

  // Leaf occupies the full opening (no bottom frame bar — door opens to floor)
  const leafW = width - 2 * frameThickness
  const leafH = height - frameThickness // only top frame
  const leafDepth = 0.04
  // Leaf center is shifted down from door center by half the top frame
  const leafCenterY = -frameThickness / 2

  // ── Frame members ──
  // Left post — full height
  addBox(
    mesh,
    baseMaterial,
    frameThickness,
    height,
    frameDepth,
    -width / 2 + frameThickness / 2,
    0,
    0,
  )
  // Right post — full height
  addBox(
    mesh,
    baseMaterial,
    frameThickness,
    height,
    frameDepth,
    width / 2 - frameThickness / 2,
    0,
    0,
  )
  // Head (top bar) — full width
  addBox(
    mesh,
    baseMaterial,
    width,
    frameThickness,
    frameDepth,
    0,
    height / 2 - frameThickness / 2,
    0,
  )

  // ── Threshold (inside the frame) ──
  if (threshold) {
    addBox(
      mesh,
      baseMaterial,
      leafW,
      thresholdHeight,
      frameDepth,
      0,
      -height / 2 + thresholdHeight / 2,
      0,
    )
  }

  // ── Helper: build a single leaf with segments at given offset ──
  const buildLeaf = (lw: number, offsetX: number, offsetZ: number) => {
    const cpX = contentPadding[0]
    const cpY = contentPadding[1]
    if (cpY > 0) {
      addBox(mesh, baseMaterial, lw, cpY, leafDepth, offsetX, leafCenterY + leafH / 2 - cpY / 2, offsetZ)
      addBox(mesh, baseMaterial, lw, cpY, leafDepth, offsetX, leafCenterY - leafH / 2 + cpY / 2, offsetZ)
    }
    if (cpX > 0) {
      const innerH = leafH - 2 * cpY
      addBox(mesh, baseMaterial, cpX, innerH, leafDepth, offsetX - lw / 2 + cpX / 2, leafCenterY, offsetZ)
      addBox(mesh, baseMaterial, cpX, innerH, leafDepth, offsetX + lw / 2 - cpX / 2, leafCenterY, offsetZ)
    }

    const contentW = lw - 2 * cpX
    const contentH = leafH - 2 * cpY
    const totalRatio = segments.reduce((sum, s) => sum + s.heightRatio, 0)
    const contentTop = leafCenterY + contentH / 2

    let segY = contentTop
    for (const seg of segments) {
      const segH = (seg.heightRatio / totalRatio) * contentH
      const segCenterY = segY - segH / 2

      const numCols = seg.columnRatios.length
      const colSum = seg.columnRatios.reduce((a, b) => a + b, 0)
      const usableW = contentW - (numCols - 1) * seg.dividerThickness
      const colWidths = seg.columnRatios.map((r) => (r / colSum) * usableW)

      const colXCenters: number[] = []
      let cx = -contentW / 2
      for (let c = 0; c < numCols; c++) {
        colXCenters.push(offsetX + cx + colWidths[c]! / 2)
        cx += colWidths[c]!
        if (c < numCols - 1) cx += seg.dividerThickness
      }

      cx = -contentW / 2
      for (let c = 0; c < numCols - 1; c++) {
        cx += colWidths[c]!
        addBox(
          mesh,
          baseMaterial,
          seg.dividerThickness,
          segH,
          leafDepth + 0.001,
          offsetX + cx + seg.dividerThickness / 2,
          segCenterY,
          offsetZ,
        )
        cx += seg.dividerThickness
      }

      for (let c = 0; c < numCols; c++) {
        const colW = colWidths[c]!
        const colX = colXCenters[c]!

        if (seg.type === 'glass') {
          const glassDepth = Math.max(0.004, leafDepth * 0.15)
          addBox(mesh, glassMaterial, colW, segH, glassDepth, colX, segCenterY, offsetZ)
        } else if (seg.type === 'panel') {
          addBox(mesh, baseMaterial, colW, segH, leafDepth, colX, segCenterY, offsetZ)
          const panelW = colW - 2 * seg.panelInset
          const panelH = segH - 2 * seg.panelInset
          if (panelW > 0.01 && panelH > 0.01) {
            const effectiveDepth = Math.abs(seg.panelDepth) < 0.002 ? 0.005 : Math.abs(seg.panelDepth)
            const panelZ = offsetZ + leafDepth / 2 + effectiveDepth / 2
            addBox(mesh, baseMaterial, panelW, panelH, effectiveDepth, colX, segCenterY, panelZ)
          }
        } else {
          addBox(mesh, baseMaterial, colW, segH, leafDepth, colX, segCenterY, offsetZ)
        }
      }

      segY -= segH
    }
  }

  // ── Helper: add 3 hinges at given X ──
  const buildHinges = (hingeX: number) => {
    const hingeZ = 0
    const hingeH = 0.1
    const hingeW = 0.024
    const hingeD = leafDepth + 0.016
    const leafBottom = leafCenterY - leafH / 2
    const leafTop = leafCenterY + leafH / 2
    addBox(mesh, baseMaterial, hingeW, hingeH, hingeD, hingeX, leafBottom + 0.25, hingeZ)
    addBox(mesh, baseMaterial, hingeW, hingeH, hingeD, hingeX, (leafBottom + leafTop) / 2, hingeZ)
    addBox(mesh, baseMaterial, hingeW, hingeH, hingeD, hingeX, leafTop - 0.25, hingeZ)
  }

  // ── Build leaves based on door style ──
  const isSwingStyle = doorStyle === 'single' || doorStyle === 'double'

  if (doorStyle === 'double') {
    // Two leaves with a small gap
    const gap = 0.005
    const leftW = leafW * leafRatio - gap / 2
    const rightW = leafW * (1 - leafRatio) - gap / 2
    const leftX = -leafW / 2 + leftW / 2
    const rightX = leafW / 2 - rightW / 2

    buildLeaf(leftW, leftX, 0)
    buildLeaf(rightW, rightX, 0)

    // Left leaf hinges on left side
    buildHinges(-leafW / 2 + 0.012)
    // Right leaf hinges on right side
    buildHinges(leafW / 2 - 0.012)
  } else if (doorStyle === 'sliding' || doorStyle === 'pocket') {
    // Leaf sits slightly in front of the wall plane
    const slideZ = frameDepth / 2 + leafDepth / 2 + 0.005
    buildLeaf(leafW, 0, slideZ)

    // Rail track at the top
    const railW = doorStyle === 'pocket' ? leafW : leafW
    addBox(mesh, baseMaterial, railW, 0.02, 0.04, 0, leafCenterY + leafH / 2 + 0.01, slideZ)
    // No hinges for sliding/pocket
  } else if (doorStyle === 'barn') {
    // Leaf in front of wall
    const slideZ = frameDepth / 2 + leafDepth / 2 + 0.005
    buildLeaf(leafW, 0, slideZ)

    // Exposed rail with overhang
    const railOverhang = 0.3
    const railW = leafW + railOverhang * 2
    const railY = leafCenterY + leafH / 2 + 0.025
    addBox(mesh, baseMaterial, railW, 0.03, 0.05, 0, railY, slideZ)

    // Two roller cylinders on top of the leaf
    const rollerR = 0.02
    const rollerSpacing = leafW * 0.3
    for (const sign of [-1, 1]) {
      const rollerX = sign * rollerSpacing
      const rollerGeo = new THREE.CylinderGeometry(rollerR, rollerR, 0.03, 12)
      rollerGeo.rotateX(Math.PI / 2) // orient along Z
      const rollerMesh = new THREE.Mesh(rollerGeo, baseMaterial)
      rollerMesh.position.set(rollerX, railY, slideZ)
      mesh.add(rollerMesh)
    }
    // No hinges for barn
  } else if (doorStyle === 'bifold') {
    // Multiple panels of equal width
    const panelCount = foldPanels
    const panelW = leafW / panelCount
    for (let p = 0; p < panelCount; p++) {
      const px = -leafW / 2 + panelW / 2 + p * panelW
      buildLeaf(panelW, px, 0)

      // Alternating hinge positions (left-right-left-right)
      const hingeOnLeft = p % 2 === 0
      const hingeX = hingeOnLeft ? px - panelW / 2 + 0.012 : px + panelW / 2 - 0.012
      buildHinges(hingeX)
    }
  } else {
    // 'single' (default) — original behavior
    buildLeaf(leafW, 0, 0)
    buildHinges(hingesSide === 'right' ? leafW / 2 - 0.012 : -leafW / 2 + 0.012)
  }

  // ── Handle ──
  if (handle) {
    const handleY = handleHeight - height / 2
    const leafZ = (doorStyle === 'sliding' || doorStyle === 'pocket' || doorStyle === 'barn')
      ? frameDepth / 2 + leafDepth / 2 + 0.005
      : 0
    const faceZ = leafZ + leafDepth / 2

    if (doorStyle === 'double') {
      // Handles on both leaves near the center gap
      const gap = 0.005
      const leftW = leafW * leafRatio - gap / 2
      const rightW = leafW * (1 - leafRatio) - gap / 2
      const leftHandleX = -leafW / 2 + leftW - 0.045
      const rightHandleX = leafW / 2 - rightW + 0.045
      // Left leaf handle
      addBox(mesh, baseMaterial, 0.028, 0.14, 0.01, leftHandleX, handleY, faceZ + 0.005)
      addBox(mesh, baseMaterial, 0.022, 0.1, 0.035, leftHandleX, handleY, faceZ + 0.025)
      // Right leaf handle
      addBox(mesh, baseMaterial, 0.028, 0.14, 0.01, rightHandleX, handleY, faceZ + 0.005)
      addBox(mesh, baseMaterial, 0.022, 0.1, 0.035, rightHandleX, handleY, faceZ + 0.025)
    } else {
      const handleX = handleSide === 'right' ? leafW / 2 - 0.045 : -leafW / 2 + 0.045
      addBox(mesh, baseMaterial, 0.028, 0.14, 0.01, handleX, handleY, faceZ + 0.005)
      addBox(mesh, baseMaterial, 0.022, 0.1, 0.035, handleX, handleY, faceZ + 0.025)
    }
  }

  // ── Door closer (commercial hardware at top) ──
  if (doorCloser) {
    const closerY = leafCenterY + leafH / 2 - 0.04
    addBox(mesh, baseMaterial, 0.28, 0.055, 0.055, 0, closerY, leafDepth / 2 + 0.03)
    addBox(
      mesh,
      baseMaterial,
      0.14,
      0.015,
      0.015,
      leafW / 4,
      closerY + 0.025,
      leafDepth / 2 + 0.015,
    )
  }

  // ── Panic bar ──
  if (panicBar) {
    const barY = panicBarHeight - height / 2
    addBox(mesh, baseMaterial, leafW * 0.72, 0.04, 0.055, 0, barY, leafDepth / 2 + 0.03)
  }

  // ── Cutout (for wall CSG) ──
  let cutout = mesh.getObjectByName('cutout') as THREE.Mesh | undefined
  if (!cutout) {
    cutout = new THREE.Mesh()
    cutout.name = 'cutout'
    mesh.add(cutout)
  }
  cutout.geometry.dispose()
  // Pocket doors need a wider cutout so the leaf can slide into the wall
  const cutoutWidth = doorStyle === 'pocket' ? node.width * 2 : node.width
  const cutoutOffsetX = doorStyle === 'pocket'
    ? (slideDirection === 'left' ? -node.width / 2 : node.width / 2)
    : 0
  cutout.geometry = new THREE.BoxGeometry(cutoutWidth, node.height, 1.0)
  cutout.position.set(cutoutOffsetX, 0, 0)
  cutout.visible = false
}
