export const DEFAULT_STAIR_TYPE = 'straight' as const
export const DEFAULT_STAIR_WIDTH = 1.0
export const DEFAULT_STAIR_LENGTH = 3.0
export const DEFAULT_STAIR_HEIGHT = 2.5
export const DEFAULT_STAIR_STEP_COUNT = 10
export const DEFAULT_STAIR_ATTACHMENT_SIDE = 'front' as const
export const DEFAULT_STAIR_FILL_TO_FLOOR = true
export const DEFAULT_STAIR_THICKNESS = 0.25
export const DEFAULT_CURVED_STAIR_INNER_RADIUS = 0.9
export const DEFAULT_CURVED_STAIR_SWEEP_ANGLE = Math.PI / 2
export const DEFAULT_SPIRAL_STAIR_SWEEP_ANGLE = (400 * Math.PI) / 180
export const DEFAULT_SPIRAL_TOP_LANDING_MODE = 'none' as const
export const DEFAULT_SPIRAL_TOP_LANDING_DEPTH = 0.9
export const DEFAULT_SPIRAL_SHOW_CENTER_COLUMN = true
export const DEFAULT_SPIRAL_SHOW_STEP_SUPPORTS = true
export const DEFAULT_STAIR_RAILING_MODE = 'right' as const
export const DEFAULT_STAIR_RAILING_HEIGHT = 0.92
export const DEFAULT_STAIR_SUPPORT_TYPE = 'filled' as const
export const DEFAULT_STAIR_SUPPORT_THICKNESS = 0.05

/**
 * Preset segment configurations for L-shaped and U-shaped staircases.
 * Each preset is an array of segment descriptors used to create child StairSegmentNodes.
 */
export type StairPresetSegment = {
  segmentType: 'stair' | 'landing'
  width: number
  length: number
  height: number
  stepCount: number
  attachmentSide: 'front' | 'left' | 'right'
}

export const L_STAIR_PRESET_SEGMENTS: StairPresetSegment[] = [
  { segmentType: 'stair', width: 1.0, length: 2.0, height: 1.25, stepCount: 5, attachmentSide: 'front' },
  { segmentType: 'landing', width: 1.0, length: 1.0, height: 0, stepCount: 0, attachmentSide: 'front' },
  { segmentType: 'stair', width: 1.0, length: 2.0, height: 1.25, stepCount: 5, attachmentSide: 'left' },
]

export const U_STAIR_PRESET_SEGMENTS: StairPresetSegment[] = [
  { segmentType: 'stair', width: 1.0, length: 2.0, height: 1.25, stepCount: 5, attachmentSide: 'front' },
  { segmentType: 'landing', width: 2.0, length: 1.0, height: 0, stepCount: 0, attachmentSide: 'front' },
  { segmentType: 'stair', width: 1.0, length: 2.0, height: 1.25, stepCount: 5, attachmentSide: 'left' },
]
