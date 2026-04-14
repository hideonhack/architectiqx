import * as THREE from 'three'

// Production materials — match the rest of the scene (white walls, light-gray slabs).
// Indices: 0 = Wall/Trim, 1 = Deck, 2 = Interior, 3 = Shingle
export const roofMaterials: THREE.Material[] = [
  new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.85, side: THREE.DoubleSide }), // 0: Wall/Trim
  new THREE.MeshStandardMaterial({ color: '#b0a898', roughness: 0.8, side: THREE.FrontSide }), // 1: Deck
  new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide }), // 2: Interior
  new THREE.MeshStandardMaterial({ color: '#6b5c4c', roughness: 0.9, side: THREE.FrontSide }), // 3: Shingle
]

// Debug materials — vivid, distinct colours to identify each surface group.
export const roofDebugMaterials: THREE.Material[] = [
  new THREE.MeshStandardMaterial({ color: '#eaeaea', roughness: 0.8, side: THREE.DoubleSide }), // 0: Wall
  new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.9, side: THREE.FrontSide }), // 1: Deck
  new THREE.MeshStandardMaterial({ color: '#dddddd', roughness: 0.9, side: THREE.DoubleSide }), // 2: Interior
  new THREE.MeshStandardMaterial({ color: '#4ade80', roughness: 0.9, side: THREE.FrontSide }), // 3: Shingle
]
