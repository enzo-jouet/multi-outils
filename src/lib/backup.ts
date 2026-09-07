import { BUDGET_STORAGE_KEY } from '../tools/budget/types'
import { DEBTS_STORAGE_KEY } from '../tools/debts/types'
import { SAVINGS_STORAGE_KEY } from '../tools/savings/types'
import { SETTINGS_KEY, loadSettings } from './settings'
import { downloadJson, loadJson, saveJson } from './storage'
import { todayISO } from './format'

export const BACKUP_META_KEY = 'multi-outils:backup-meta:v1'
const IDB_NAME = 'multi-outils'
const IDB_VERSION = 1
const STORE_DATA = 'data'
const STORE_HANDLES = 'handles'

export type AppSnapshot = {
  version: 1
  exportedAt: string
  budget: unknown
  debts: unknown
  savings: unknown
  settings: unknown
}

export type BackupMeta = {
  lastLocalAt: string | null
  lastFileAt: string | null
  lastError: string | null
  fileName: string | null
  hasFileHandle: boolean
}

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string
    types?: Array<{
      description: string
      accept: Record<string, string[]>
    }>
  }) => Promise<FileSystemFileHandle>
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    types?: Array<{
      description: string
      accept: Record<string, string[]>
    }>
  }) => Promise<FileSystemFileHandle[]>
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_DATA)) {
        db.createObjectStore(STORE_DATA)
      }
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(store: string, key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite')
        tx.objectStore(store).put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly')
        const req = tx.objectStore(store).get(key)
        req.onsuccess = () => resolve(req.result as T | undefined)
        req.onerror = () => reject(req.error)
      }),
  )
}

export function collectSnapshot(): AppSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    budget: loadJson(BUDGET_STORAGE_KEY, null),
    debts: loadJson(DEBTS_STORAGE_KEY, null),
    savings: loadJson(SAVINGS_STORAGE_KEY, null),
    settings: loadJson(SETTINGS_KEY, null),
  }
}

export function loadBackupMeta(): BackupMeta {
  return loadJson<BackupMeta>(BACKUP_META_KEY, {
    lastLocalAt: null,
    lastFileAt: null,
    lastError: null,
    fileName: null,
    hasFileHandle: false,
  })
}

function saveBackupMeta(meta: BackupMeta): void {
  // Avoid recursive backup trigger: write localStorage directly
  localStorage.setItem(BACKUP_META_KEY, JSON.stringify(meta))
}

export async function mirrorToIndexedDb(snapshot = collectSnapshot()): Promise<void> {
  await idbPut(STORE_DATA, 'latest', snapshot)
  const meta = loadBackupMeta()
  saveBackupMeta({
    ...meta,
    lastLocalAt: snapshot.exportedAt,
    lastError: null,
  })
}

export async function readIndexedDbSnapshot(): Promise<AppSnapshot | undefined> {
  return idbGet<AppSnapshot>(STORE_DATA, 'latest')
}

export function supportsFileBackup(): boolean {
  const w = window as FilePickerWindow
  return typeof w.showSaveFilePicker === 'function'
}

export async function linkBackupFile(): Promise<BackupMeta> {
  const w = window as FilePickerWindow
  if (!w.showSaveFilePicker) {
    throw new Error('Ce navigateur ne permet pas la sauvegarde fichier automatique.')
  }

  const handle = await w.showSaveFilePicker({
    suggestedName: `multi-outils-backup-${todayISO()}.json`,
    types: [
      {
        description: 'Sauvegarde Multi Outils',
        accept: { 'application/json': ['.json'] },
      },
    ],
  })

  await idbPut(STORE_HANDLES, 'backupFile', handle)
  const meta: BackupMeta = {
    ...loadBackupMeta(),
    fileName: handle.name,
    hasFileHandle: true,
    lastError: null,
  }
  saveBackupMeta(meta)
  await writeBackupFile(collectSnapshot())
  return loadBackupMeta()
}

export async function getBackupFileHandle(): Promise<FileSystemFileHandle | undefined> {
  return idbGet<FileSystemFileHandle>(STORE_HANDLES, 'backupFile')
}

export async function writeBackupFile(
  snapshot = collectSnapshot(),
): Promise<BackupMeta> {
  const handle = await getBackupFileHandle()
  if (!handle) {
    const meta = loadBackupMeta()
    return { ...meta, hasFileHandle: false }
  }

  try {
    // Permission may need re-request after reload
    const permission = await queryPermission(handle)
    if (permission === 'prompt') {
      const next = await requestPermission(handle)
      if (next !== 'granted') {
        throw new Error('Permission fichier refusée — recliquez « Lier un fichier ».')
      }
    } else if (permission === 'denied') {
      throw new Error('Permission fichier refusée — recliquez « Lier un fichier ».')
    }

    const writable = await handle.createWritable()
    await writable.write(JSON.stringify(snapshot, null, 2))
    await writable.close()

    const meta: BackupMeta = {
      ...loadBackupMeta(),
      lastFileAt: snapshot.exportedAt,
      lastLocalAt: snapshot.exportedAt,
      fileName: handle.name,
      hasFileHandle: true,
      lastError: null,
    }
    saveBackupMeta(meta)
    await idbPut(STORE_DATA, 'latest', snapshot)
    return meta
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Échec écriture fichier'
    const meta: BackupMeta = {
      ...loadBackupMeta(),
      lastError: message,
      hasFileHandle: true,
    }
    saveBackupMeta(meta)
    throw err
  }
}

async function queryPermission(
  handle: FileSystemFileHandle,
): Promise<PermissionState | 'prompt'> {
  const h = handle as FileSystemFileHandle & {
    queryPermission?: (o: { mode: string }) => Promise<PermissionState>
  }
  if (typeof h.queryPermission === 'function') {
    return h.queryPermission({ mode: 'readwrite' })
  }
  return 'granted'
}

async function requestPermission(
  handle: FileSystemFileHandle,
): Promise<PermissionState | 'prompt'> {
  const h = handle as FileSystemFileHandle & {
    requestPermission?: (o: { mode: string }) => Promise<PermissionState>
  }
  if (typeof h.requestPermission === 'function') {
    return h.requestPermission({ mode: 'readwrite' })
  }
  return 'granted'
}

export function downloadManualBackup(): void {
  downloadJson(`multi-outils-backup-${todayISO()}.json`, collectSnapshot())
  const meta = loadBackupMeta()
  saveBackupMeta({
    ...meta,
    lastLocalAt: new Date().toISOString(),
  })
}

export function applySnapshot(snapshot: AppSnapshot): void {
  if (snapshot.budget != null) saveJson(BUDGET_STORAGE_KEY, snapshot.budget)
  if (snapshot.debts != null) saveJson(DEBTS_STORAGE_KEY, snapshot.debts)
  if (snapshot.savings != null) saveJson(SAVINGS_STORAGE_KEY, snapshot.savings)
  if (snapshot.settings != null) saveJson(SETTINGS_KEY, snapshot.settings)
}

export async function restoreFromFilePicker(): Promise<void> {
  const w = window as FilePickerWindow
  if (w.showOpenFilePicker) {
    const [handle] = await w.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'Sauvegarde Multi Outils',
          accept: { 'application/json': ['.json'] },
        },
      ],
    })
    const file = await handle.getFile()
    const text = await file.text()
    const parsed = JSON.parse(text) as AppSnapshot
    if (parsed.version !== 1) throw new Error('Fichier de sauvegarde inconnu.')
    applySnapshot(parsed)
    await mirrorToIndexedDb(parsed)
    return
  }

  // Fallback: classic input handled by UI
  throw new Error('OPEN_INPUT')
}

export function restoreFromJsonText(text: string): void {
  const parsed = JSON.parse(text) as AppSnapshot
  if (parsed.version !== 1) throw new Error('Fichier de sauvegarde inconnu.')
  applySnapshot(parsed)
  void mirrorToIndexedDb(parsed)
}

let debounceTimer: number | null = null
let intervalTimer: number | null = null
let started = false

export async function runAutoBackup(): Promise<BackupMeta | null> {
  const settings = loadSettings()
  const snapshot = collectSnapshot()
  await mirrorToIndexedDb(snapshot)

  if (!settings.autoBackupEnabled) {
    return loadBackupMeta()
  }

  const handle = await getBackupFileHandle()
  if (!handle) return loadBackupMeta()

  try {
    return await writeBackupFile(snapshot)
  } catch {
    return loadBackupMeta()
  }
}

export function scheduleAutoBackup(delayMs = 1500): void {
  if (debounceTimer != null) window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    void runAutoBackup()
  }, delayMs)
}

export function startBackupScheduler(): void {
  if (started) return
  started = true

  void (async () => {
    const handle = await getBackupFileHandle()
    const meta = loadBackupMeta()
    saveBackupMeta({ ...meta, hasFileHandle: Boolean(handle) })
    await runAutoBackup()
  })()

  const tick = () => {
    const minutes = Math.max(5, loadSettings().backupIntervalMinutes || 15)
    if (intervalTimer != null) window.clearInterval(intervalTimer)
    intervalTimer = window.setInterval(
      () => {
        void runAutoBackup()
      },
      minutes * 60 * 1000,
    )
  }

  tick()
  window.setInterval(tick, 60 * 1000)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void runAutoBackup()
  })

  window.addEventListener('pagehide', () => {
    void runAutoBackup()
  })
}
