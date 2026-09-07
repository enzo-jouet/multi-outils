import { todayISO, uid } from './format'
import { loadSettings } from './settings'
import {
  BUDGET_STORAGE_KEY,
  migrateBudget,
  type BudgetState,
  type Category,
  type Transaction,
} from '../tools/budget/types'
import { loadJson, saveJson } from './storage'

export const LINKED_CATEGORIES: Category[] = [
  {
    id: 'cat-savings',
    name: 'Épargne (objectifs)',
    kind: 'expense',
    color: '#2a9d8f',
  },
  {
    id: 'cat-savings-back',
    name: 'Retrait objectif',
    kind: 'income',
    color: '#e9a825',
  },
  {
    id: 'cat-debt-in',
    name: 'Remboursement reçu',
    kind: 'income',
    color: '#2a9d8f',
  },
  {
    id: 'cat-debt-out',
    name: 'Remboursement versé',
    kind: 'expense',
    color: '#e76f51',
  },
  {
    id: 'cat-transfer-out',
    name: 'Virement sortant',
    kind: 'expense',
    color: '#6c757d',
  },
  {
    id: 'cat-transfer-in',
    name: 'Virement entrant',
    kind: 'income',
    color: '#6c757d',
  },
]

export type TxSource = {
  tool: 'savings' | 'debts' | 'transfer'
  refId?: string
}

function loadBudgetState(): BudgetState {
  return migrateBudget(loadJson(BUDGET_STORAGE_KEY, null))
}

function saveBudgetState(state: BudgetState): void {
  saveJson(BUDGET_STORAGE_KEY, state)
}

export function ensureLinkedCategories(state: BudgetState): BudgetState {
  let categories = state.categories
  let changed = false
  for (const cat of LINKED_CATEGORIES) {
    if (!categories.some((c) => c.id === cat.id)) {
      categories = [...categories, cat]
      changed = true
    }
  }
  return changed ? { ...state, categories } : state
}

function resolveAccount(
  state: BudgetState,
  preferredId: string,
  fallbackId?: string,
): string {
  if (state.accounts.some((a) => a.id === preferredId)) return preferredId
  if (fallbackId && state.accounts.some((a) => a.id === fallbackId)) {
    return fallbackId
  }
  return state.accounts[0]?.id ?? 'acc-courant'
}

/** Virement interne entre deux comptes (paire de mouvements liés). */
export function createAccountTransfer(input: {
  fromAccountId: string
  toAccountId: string
  amount: number
  label: string
  note?: string
  date?: string
  source?: TxSource
}): void {
  if (input.amount <= 0 || input.fromAccountId === input.toAccountId) return
  let state = ensureLinkedCategories(loadBudgetState())
  const from = resolveAccount(state, input.fromAccountId)
  const to = resolveAccount(state, input.toAccountId)
  if (from === to) return

  const groupId = uid('xfer')
  const date = input.date ?? todayISO()
  const createdAt = new Date().toISOString()
  const label = input.label.trim() || 'Virement'
  const note = input.note ?? ''
  const source = input.source ?? { tool: 'transfer' as const, refId: groupId }

  const outTx: Transaction = {
    id: uid('tx'),
    type: 'expense',
    categoryId: 'cat-transfer-out',
    accountId: from,
    amount: input.amount,
    label: `${label} →`,
    note,
    date,
    status: 'confirmed',
    createdAt,
    transferGroupId: groupId,
    source,
  }

  const inTx: Transaction = {
    id: uid('tx'),
    type: 'income',
    categoryId: 'cat-transfer-in',
    accountId: to,
    amount: input.amount,
    label: `${label} ←`,
    note,
    date,
    status: 'confirmed',
    createdAt,
    transferGroupId: groupId,
    source,
  }

  saveBudgetState({
    ...state,
    transactions: [outTx, inTx, ...state.transactions],
  })
}

/** Alimentation ou retrait d’un objectif d’épargne → budget. */
export function syncSavingsMove(input: {
  goalId: string
  goalName: string
  amount: number
  /** +1 = vers l’objectif, -1 = retrait */
  sign: 1 | -1
}): void {
  const settings = loadSettings()
  if (!settings.linkSavingsToBudget || input.amount <= 0) return

  const state = ensureLinkedCategories(loadBudgetState())
  const from = resolveAccount(state, settings.savingsFromAccountId, 'acc-courant')
  const to = resolveAccount(state, settings.savingsToAccountId, 'acc-epargne')

  if (input.sign === 1) {
    createAccountTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount: input.amount,
      label: `Épargne · ${input.goalName}`,
      note: `Objectif ${input.goalName}`,
      source: { tool: 'savings', refId: input.goalId },
    })
    return
  }

  createAccountTransfer({
    fromAccountId: to,
    toAccountId: from,
    amount: input.amount,
    label: `Retrait · ${input.goalName}`,
    note: `Objectif ${input.goalName}`,
    source: { tool: 'savings', refId: input.goalId },
  })
}

/** Paiement de dette → opération budget confirmée. */
export function syncDebtPayment(input: {
  debtId: string
  person: string
  direction: 'owed_to_me' | 'i_owe'
  amount: number
}): void {
  const settings = loadSettings()
  if (!settings.linkDebtsToBudget || input.amount <= 0) return

  const state = ensureLinkedCategories(loadBudgetState())
  const accountId = resolveAccount(
    state,
    settings.debtsAccountId,
    'acc-courant',
  )

  const isIncome = input.direction === 'owed_to_me'
  const tx: Transaction = {
    id: uid('tx'),
    type: isIncome ? 'income' : 'expense',
    categoryId: isIncome ? 'cat-debt-in' : 'cat-debt-out',
    accountId,
    amount: input.amount,
    label: isIncome
      ? `Remboursement de ${input.person}`
      : `Remboursement à ${input.person}`,
    note: `Dette liée · ${input.person}`,
    date: todayISO(),
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    source: { tool: 'debts', refId: input.debtId },
  }

  saveBudgetState({
    ...state,
    transactions: [tx, ...state.transactions],
  })
}
