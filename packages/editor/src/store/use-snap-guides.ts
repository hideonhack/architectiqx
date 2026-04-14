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
