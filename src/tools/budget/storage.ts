import { loadJson, saveJson } from '../../lib/storage'
import {
  BUDGET_STORAGE_KEY,
  DEFAULT_CATEGORIES,
  type BudgetState,
} from './types'

export function loadBudget(): BudgetState {
  return loadJson<BudgetState>(BUDGET_STORAGE_KEY, {
    categories: DEFAULT_CATEGORIES,
    transactions: [],
  })
}

export function saveBudget(state: BudgetState): void {
  saveJson(BUDGET_STORAGE_KEY, state)
}
