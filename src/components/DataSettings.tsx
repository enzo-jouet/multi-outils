import { useEffect, useState } from 'react'
import {
  downloadManualBackup,
  linkBackupFile,
  loadBackupMeta,
  restoreFromJsonText,
  runAutoBackup,
  supportsFileBackup,
  type BackupMeta,
} from '../lib/backup'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AppSettings,
} from '../lib/settings'
import { loadBudget } from '../tools/budget/storage'
import './DataSettings.css'

type Props = {
  onRestored?: () => void
}

export function DataSettings({ onRestored }: Props) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [meta, setMeta] = useState<BackupMeta>(() => loadBackupMeta())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const accounts = loadBudget().accounts
  const fileOk = supportsFileBackup()

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    const id = window.setInterval(() => setMeta(loadBackupMeta()), 5000)
    return () => window.clearInterval(id)
  }, [])

  function patch(partial: Partial<AppSettings>) {
    setSettings((s) => ({ ...s, ...partial }))
  }

  async function onLinkFile() {
    setBusy(true)
    setMessage(null)
    try {
      const next = await linkBackupFile()
      setMeta(next)
      setMessage('Fichier de sauvegarde lié — écriture auto activée.')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setMessage(err instanceof Error ? err.message : 'Échec liaison fichier')
    } finally {
      setBusy(false)
    }
  }

  async function onBackupNow() {
    setBusy(true)
    setMessage(null)
    try {
      const next = await runAutoBackup()
      if (next) setMeta(next)
      setMessage(
        next?.hasFileHandle
          ? 'Sauvegarde écrite (IndexedDB + fichier).'
          : 'Sauvegarde IndexedDB OK. Liez un fichier pour la copie disque.',
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Échec sauvegarde')
    } finally {
      setBusy(false)
    }
  }

  function onRestoreFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        if (
          !window.confirm(
            'Restaurer cette sauvegarde ? Les données actuelles seront remplacées.',
          )
        ) {
          return
        }
        restoreFromJsonText(String(reader.result))
        setSettings(loadSettings())
        setMeta(loadBackupMeta())
        setMessage('Restauration terminée.')
        onRestored?.()
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Fichier invalide')
      }
    }
    reader.readAsText(file)
  }

  function formatWhen(iso: string | null) {
    if (!iso) return 'jamais'
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  return (
    <section className="data-settings panel">
      <h2>Données & cohérence</h2>
      <p className="hint">
        Les outils se parlent : épargne et dettes peuvent écrire dans Budget.
        La sauvegarde miroir IndexedDB + un fichier local (Chrome / Edge).
      </p>

      <div className="settings-grid">
        <fieldset>
          <legend>Liaisons</legend>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.linkSavingsToBudget}
              onChange={(e) => patch({ linkSavingsToBudget: e.target.checked })}
            />
            Objectifs d’épargne ↔ Budget (virements Courant ↔ Épargne)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.linkDebtsToBudget}
              onChange={(e) => patch({ linkDebtsToBudget: e.target.checked })}
            />
            Dettes ↔ Budget (remboursements = opérations)
          </label>
          <label>
            Compte source (épargne)
            <select
              value={settings.savingsFromAccountId}
              onChange={(e) => patch({ savingsFromAccountId: e.target.value })}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Compte destination (épargne)
            <select
              value={settings.savingsToAccountId}
              onChange={(e) => patch({ savingsToAccountId: e.target.value })}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Compte pour les dettes
            <select
              value={settings.debtsAccountId}
              onChange={(e) => patch({ debtsAccountId: e.target.value })}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>Sauvegarde automatique</legend>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.autoBackupEnabled}
              onChange={(e) => patch({ autoBackupEnabled: e.target.checked })}
            />
            Activer la sauvegarde récurrente
          </label>
          <label>
            Intervalle (minutes)
            <input
              type="number"
              min={5}
              max={180}
              value={settings.backupIntervalMinutes}
              onChange={(e) =>
                patch({
                  backupIntervalMinutes: Math.max(
                    5,
                    Number(e.target.value) || DEFAULT_SETTINGS.backupIntervalMinutes,
                  ),
                })
              }
            />
          </label>
          <p className="meta-line">
            IndexedDB : {formatWhen(meta.lastLocalAt)}
            <br />
            Fichier : {formatWhen(meta.lastFileAt)}
            {meta.fileName ? ` (${meta.fileName})` : ''}
            {meta.lastError ? (
              <>
                <br />
                <span className="err">Erreur : {meta.lastError}</span>
              </>
            ) : null}
          </p>
          <div className="settings-actions">
            {fileOk && (
              <button
                type="button"
                className="primary sm"
                disabled={busy}
                onClick={() => void onLinkFile()}
              >
                {meta.hasFileHandle ? 'Changer le fichier' : 'Lier un fichier'}
              </button>
            )}
            <button
              type="button"
              className="ghost"
              disabled={busy}
              onClick={() => void onBackupNow()}
            >
              Sauver maintenant
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => downloadManualBackup()}
            >
              Télécharger une copie
            </button>
            <label className="ghost file">
              Restaurer…
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onRestoreFile(f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {!fileOk && (
            <p className="hint">
              Votre navigateur ne gère pas l’écriture fichier continue. IndexedDB
              + téléchargement manuel restent disponibles (Firefox : liez via
              téléchargements réguliers).
            </p>
          )}
        </fieldset>
      </div>

      {message && <p className="settings-msg">{message}</p>}
    </section>
  )
}
