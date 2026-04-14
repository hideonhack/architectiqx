'use client'

import { Line } from '@react-three/drei'
import { useSnapGuides } from '../../store/use-snap-guides'
import { EDITOR_LAYER } from '../../lib/constants'

/**
 * Renders dashed cyan alignment guide lines in the 3D scene
 * when object snapping is active.
 */
export function SnapGuides() {
  const guides = useSnapGuides((s) => s.guides)

  if (guides.length === 0) return null

  return (
    <>
      {guides.map((guide, i) => (
        <Line
          key={`${guide.axis}-${i}`}
          points={[guide.from, guide.to]}
          color="#22d3ee"
          lineWidth={1.5}
          dashed
          dashSize={0.1}
          gapSize={0.05}
          layers={EDITOR_LAYER}
          depthTest={false}
        />
      ))}
    </>
  )
}
