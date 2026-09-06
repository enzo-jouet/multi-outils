import { loadJson, saveJson } from '../../lib/storage'
import { todayISO, uid } from '../../lib/format'

export type SavingsGoal = {
  id: string
  name: string
  target: number
  current: number
  deadline: string
  color: string
  note: string
  createdAt: string
}

export type SavingsState = {
  goals: SavingsGoal[]
}

export const SAVINGS_STORAGE_KEY = 'multi-outils:savings:v1'

export const GOAL_COLORS = [
  '#2a9d8f',
  '#e9a825',
  '#457b9d',
  '#e76f51',
  '#9b5de5',
  '#264653',
]

export function emptySavings(): SavingsState {
  return { goals: [] }
}

export function loadSavings(): SavingsState {
  const raw = loadJson<SavingsState>(SAVINGS_STORAGE_KEY, emptySavings())
  if (!Array.isArray(raw.goals)) return emptySavings()
  return raw
}

export function saveSavings(state: SavingsState): void {
  saveJson(SAVINGS_STORAGE_KEY, state)
}

export function createGoal(input: {
  name: string
  target: number
  current: number
  deadline: string
  color: string
  note: string
}): SavingsGoal {
  return {
    id: uid('goal'),
    name: input.name,
    target: input.target,
    current: input.current,
    deadline: input.deadline,
    color: input.color,
    note: input.note,
    createdAt: new Date().toISOString(),
  }
}

export { todayISO }
