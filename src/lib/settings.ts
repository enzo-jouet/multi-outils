import { loadJson, saveJson } from './storage'

export type AppSettings = {
  linkSavingsToBudget: boolean
  linkDebtsToBudget: boolean
  /** Compte débité quand on alimente un objectif */
  savingsFromAccountId: string
  /** Compte crédité (enveloppe épargne) */
  savingsToAccountId: string
  debtsAccountId: string
  autoBackupEnabled: boolean
  /** Intervalle de sauvegarde fichier (minutes) */
  backupIntervalMinutes: number
}

export const SETTINGS_KEY = 'multi-outils:settings:v1'

export const DEFAULT_SETTINGS: AppSettings = {
  linkSavingsToBudget: true,
  linkDebtsToBudget: true,
  savingsFromAccountId: 'acc-courant',
  savingsToAccountId: 'acc-epargne',
  debtsAccountId: 'acc-courant',
  autoBackupEnabled: true,
  backupIntervalMinutes: 15,
}

export function loadSettings(): AppSettings {
  const raw = loadJson<Partial<AppSettings>>(SETTINGS_KEY, {})
  return { ...DEFAULT_SETTINGS, ...raw }
}

export function saveSettings(settings: AppSettings): void {
  saveJson(SETTINGS_KEY, settings)
}
