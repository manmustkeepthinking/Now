import type { PatternState, TrackId } from '../audio/types'
import { detectFundamentalHz } from '../audio/tuning'

const DB_NAME = 'now-beat-lab'
const DB_VERSION = 1

export interface StoredSample {
  id: string
  name: string
  type: SampleType
  mime: string
  createdAt: number
  /** ArrayBuffer of original file */
  data: ArrayBuffer
  duration: number
  rootHz: number | null
}

export type SampleType = '808' | 'kick' | 'snare' | 'hat' | 'loop' | 'one-shot' | 'other'

export interface StoredProject {
  id: string
  name: string
  updatedAt: number
  pattern: PatternState
  song: string[]
  activePattern: string
  patterns: Record<string, PatternState>
  trackSamples: Partial<Record<TrackId, string>>
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('samples')) {
        db.createObjectStore('samples', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export function inferSampleType(name: string): SampleType {
  const n = name.toLowerCase()
  if (/808|sub[- ]?bass|boom/.test(n)) return '808'
  if (/kick|bd|bassdrum|bass.?drum/.test(n)) return 'kick'
  if (/snare|sd|clap/.test(n)) return 'snare'
  if (/hat|hh|hi[- ]?hat|cym/.test(n)) return 'hat'
  if (/loop|break|drum.?loop/.test(n)) return 'loop'
  if (/oneshot|one[- ]?shot|hit|perc/.test(n)) return 'one-shot'
  return 'other'
}

export async function listSamples(): Promise<StoredSample[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction('samples', 'readonly').objectStore('samples').getAll()
    req.onsuccess = () => resolve(req.result as StoredSample[])
    req.onerror = () => reject(req.error)
  })
}

export async function putSample(sample: StoredSample): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('samples', 'readwrite')
  tx.objectStore('samples').put(sample)
  await txDone(tx)
}

export async function deleteSample(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('samples', 'readwrite')
  tx.objectStore('samples').delete(id)
  await txDone(tx)
}

export async function importFiles(
  files: FileList | File[],
  decode: (ab: ArrayBuffer) => Promise<AudioBuffer>,
): Promise<StoredSample[]> {
  const out: StoredSample[] = []
  const list = Array.from(files)
  for (const file of list) {
    if (!/\.(wav|mp3|aiff?|flac|ogg|m4a)$/i.test(file.name) && !file.type.startsWith('audio/')) {
      continue
    }
    const data = await file.arrayBuffer()
    let duration = 0
    let rootHz: number | null = null
    try {
      const buf = await decode(data.slice(0))
      duration = buf.duration
      const type = inferSampleType(file.name)
      if (type === '808' || /808/.test(file.name.toLowerCase())) {
        rootHz = detectFundamentalHz(buf)
      }
    } catch {
      // still store raw bytes
    }
    const sample: StoredSample = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: inferSampleType(file.name),
      mime: file.type || 'audio/wav',
      createdAt: Date.now(),
      data,
      duration,
      rootHz,
    }
    await putSample(sample)
    out.push(sample)
  }
  return out
}

export async function saveProject(project: StoredProject): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('projects', 'readwrite')
  tx.objectStore('projects').put(project)
  await txDone(tx)
}

export async function loadProject(id: string): Promise<StoredProject | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction('projects', 'readonly').objectStore('projects').get(id)
    req.onsuccess = () => resolve((req.result as StoredProject) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function listProjects(): Promise<StoredProject[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction('projects', 'readonly').objectStore('projects').getAll()
    req.onsuccess = () => resolve(req.result as StoredProject[])
    req.onerror = () => reject(req.error)
  })
}

export async function shareOrDownload(
  blob: Blob,
  filename: string,
): Promise<void> {
  const file = new File([blob], filename, { type: blob.type })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch {
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
