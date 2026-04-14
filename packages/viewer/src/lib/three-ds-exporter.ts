import { type BufferGeometry, Mesh, type Scene } from 'three'

// 3DS chunk IDs
const CHUNK_MAIN = 0x4d4d
const CHUNK_VERSION = 0x0002
const CHUNK_EDITOR = 0x3d3d
const CHUNK_OBJECT = 0x4000
const CHUNK_TRIMESH = 0x4100
const CHUNK_VERTICES = 0x4110
const CHUNK_FACES = 0x4120

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
  return offset + 2
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true)
  return offset + 4
}

function writeFloat32(view: DataView, offset: number, value: number) {
  view.setFloat32(offset, value, true)
  return offset + 4
}

function writeString(view: DataView, offset: number, str: string): number {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
  view.setUint8(offset + str.length, 0) // null terminator
  return offset + str.length + 1
}

function truncateName(name: string): string {
  // 3DS object names: max 10 chars + null terminator
  return (name || 'object').substring(0, 10)
}

interface MeshData {
  name: string
  vertices: Float32Array
  faces: Uint16Array
  faceCount: number
}

function extractMeshData(mesh: Mesh, index: number): MeshData {
  const geometry = mesh.geometry as BufferGeometry
  const name = truncateName(mesh.name || `obj${index}`)

  // Apply world matrix to get correct positions
  const geo = geometry.clone()
  geo.applyMatrix4(mesh.matrixWorld)

  const posAttr = geo.getAttribute('position')
  const vertices = new Float32Array(posAttr.count * 3)
  for (let i = 0; i < posAttr.count; i++) {
    vertices[i * 3] = posAttr.getX(i)
    vertices[i * 3 + 1] = posAttr.getY(i)
    vertices[i * 3 + 2] = posAttr.getZ(i)
  }

  let faces: Uint16Array
  let faceCount: number

  if (geo.index) {
    // Indexed geometry
    const idx = geo.index
    faceCount = Math.floor(idx.count / 3)
    faces = new Uint16Array(faceCount * 3)
    for (let i = 0; i < faceCount * 3; i++) {
      faces[i] = idx.getX(i)
    }
  } else {
    // Non-indexed geometry: every 3 vertices form a face
    faceCount = Math.floor(posAttr.count / 3)
    faces = new Uint16Array(faceCount * 3)
    for (let i = 0; i < faceCount * 3; i++) {
      faces[i] = i
    }
  }

  geo.dispose()

  return { name, vertices, faces, faceCount }
}

function calcObjectChunkSize(data: MeshData): number {
  const nameLen = data.name.length + 1 // string + null
  const vertexCount = data.vertices.length / 3
  // CHUNK_VERTICES: 6 (header) + 2 (count) + vertexCount * 12
  const verticesChunkSize = 6 + 2 + vertexCount * 12
  // CHUNK_FACES: 6 (header) + 2 (count) + faceCount * 8 (3 indices + 1 flag, each uint16)
  const facesChunkSize = 6 + 2 + data.faceCount * 8
  // CHUNK_TRIMESH: 6 (header) + vertices + faces
  const trimeshChunkSize = 6 + verticesChunkSize + facesChunkSize
  // CHUNK_OBJECT: 6 (header) + name + trimesh
  return 6 + nameLen + trimeshChunkSize
}

export class ThreeDSExporter {
  parse(scene: Scene): ArrayBuffer {
    // Collect meshes
    const meshes: MeshData[] = []
    let meshIndex = 0
    scene.traverse((obj) => {
      if (obj instanceof Mesh && obj.geometry) {
        meshes.push(extractMeshData(obj, meshIndex++))
      }
    })

    // Calculate total size
    let objectsSize = 0
    for (const m of meshes) {
      objectsSize += calcObjectChunkSize(m)
    }

    // CHUNK_VERSION: 6 (header) + 4 (version uint32)
    const versionChunkSize = 10
    // CHUNK_EDITOR: 6 (header) + all objects
    const editorChunkSize = 6 + objectsSize
    // CHUNK_MAIN: 6 (header) + version + editor
    const mainChunkSize = 6 + versionChunkSize + editorChunkSize

    const buffer = new ArrayBuffer(mainChunkSize)
    const view = new DataView(buffer)
    let offset = 0

    // MAIN chunk
    offset = writeUint16(view, offset, CHUNK_MAIN)
    offset = writeUint32(view, offset, mainChunkSize)

    // VERSION chunk
    offset = writeUint16(view, offset, CHUNK_VERSION)
    offset = writeUint32(view, offset, versionChunkSize)
    offset = writeUint32(view, offset, 3) // version 3

    // EDITOR chunk
    offset = writeUint16(view, offset, CHUNK_EDITOR)
    offset = writeUint32(view, offset, editorChunkSize)

    // Object chunks
    for (const data of meshes) {
      const objSize = calcObjectChunkSize(data)
      const nameLen = data.name.length + 1
      const vertexCount = data.vertices.length / 3

      // OBJECT chunk
      offset = writeUint16(view, offset, CHUNK_OBJECT)
      offset = writeUint32(view, offset, objSize)
      offset = writeString(view, offset, data.name)

      // TRIMESH chunk
      const verticesChunkSize = 6 + 2 + vertexCount * 12
      const facesChunkSize = 6 + 2 + data.faceCount * 8
      const trimeshSize = 6 + verticesChunkSize + facesChunkSize
      offset = writeUint16(view, offset, CHUNK_TRIMESH)
      offset = writeUint32(view, offset, trimeshSize)

      // VERTICES chunk
      offset = writeUint16(view, offset, CHUNK_VERTICES)
      offset = writeUint32(view, offset, verticesChunkSize)
      offset = writeUint16(view, offset, vertexCount)
      for (let i = 0; i < vertexCount; i++) {
        offset = writeFloat32(view, offset, data.vertices[i * 3]!)
        offset = writeFloat32(view, offset, data.vertices[i * 3 + 1]!)
        offset = writeFloat32(view, offset, data.vertices[i * 3 + 2]!)
      }

      // FACES chunk
      offset = writeUint16(view, offset, CHUNK_FACES)
      offset = writeUint32(view, offset, facesChunkSize)
      offset = writeUint16(view, offset, data.faceCount)
      for (let i = 0; i < data.faceCount; i++) {
        offset = writeUint16(view, offset, data.faces[i * 3]!)
        offset = writeUint16(view, offset, data.faces[i * 3 + 1]!)
        offset = writeUint16(view, offset, data.faces[i * 3 + 2]!)
        offset = writeUint16(view, offset, 0) // face flag
      }
    }

    return buffer
  }
}
