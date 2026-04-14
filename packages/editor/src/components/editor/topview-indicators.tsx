import { Html, Line } from '@react-three/drei'
import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'

export function TopViewIndicators() {
  const cameraMode = useViewer((s) => s.cameraMode)
  const nodes = useScene((s) => s.nodes)

  // Only show in orthographic mode (top/plan view)
  if (cameraMode !== 'orthographic') return null

  // Filter for item nodes (furniture etc.) that are visible
  const items = Object.values(nodes).filter(
    (n) => n.type === 'item' && n.visible !== false
  )

  return (
    <group name="topview-indicators">
      {items.map((item) => {
        const [x, y, z] = item.position
        const label = item.name || 'Item'
        return (
          <group key={item.id} position={[x, y + 0.01, z]}>
            {/* Cross marker */}
            <Line
              points={[
                [-0.15, 0, 0],
                [0.15, 0, 0],
              ]}
              color="#6366f1"
              lineWidth={1.5}
            />
            <Line
              points={[
                [0, 0, -0.15],
                [0, 0, 0.15],
              ]}
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
