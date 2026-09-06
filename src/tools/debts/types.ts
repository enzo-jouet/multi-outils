import { loadJson, saveJson } from '../../lib/storage'
import { todayISO, uid } from '../../lib/format'

export type DebtDirection = 'owed_to_me' | 'i_owe'

export type Debt = {
  id: string
  person: string
  direction: DebtDirection
  amount: number
  paid: number
  note: string
  dueDate: string
  createdAt: string
  settled: boolean
}

export type DebtsState = {
  debts: Debt[]
}

export const DEBTS_STORAGE_KEY = 'multi-outils:debts:v1'

export function emptyDebts(): DebtsState {
  return { debts: [] }
}

export function loadDebts(): DebtsState {
  const raw = loadJson<DebtsState>(DEBTS_STORAGE_KEY, emptyDebts())
  if (!Array.isArray(raw.debts)) return emptyDebts()
  return raw
}

export function saveDebts(state: DebtsState): void {
  saveJson(DEBTS_STORAGE_KEY, state)
}

export function createDebt(input: {
  person: string
  direction: DebtDirection
  amount: number
  note: string
  dueDate: string
}): Debt {
  return {
    id: uid('debt'),
    person: input.person,
    direction: input.direction,
    amount: input.amount,
    paid: 0,
    note: input.note,
    dueDate: input.dueDate || todayISO(),
    createdAt: new Date().toISOString(),
    settled: false,
  }
}
