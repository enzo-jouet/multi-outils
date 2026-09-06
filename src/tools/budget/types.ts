export type CategoryKind = 'expense' | 'income'

export type Category = {
  id: string
  name: string
  kind: CategoryKind
  color: string
}

export type Transaction = {
  id: string
  type: CategoryKind
  categoryId: string
  amount: number
  label: string
  date: string // YYYY-MM-DD
  createdAt: string
}

export type BudgetState = {
  categories: Category[]
  transactions: Transaction[]
}

export const BUDGET_STORAGE_KEY = 'multi-outils:budget:v1'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Alimentation', kind: 'expense', color: '#e76f51' },
  { id: 'cat-transport', name: 'Transport', kind: 'expense', color: '#457b9d' },
  { id: 'cat-housing', name: 'Logement', kind: 'expense', color: '#264653' },
  { id: 'cat-leisure', name: 'Loisirs', kind: 'expense', color: '#9b5de5' },
  { id: 'cat-health', name: 'Santé', kind: 'expense', color: '#2a9d8f' },
  { id: 'cat-other-exp', name: 'Autre dépense', kind: 'expense', color: '#6c757d' },
  { id: 'cat-salary', name: 'Salaire', kind: 'income', color: '#2a9d8f' },
  { id: 'cat-freelance', name: 'Freelance / side', kind: 'income', color: '#e9a825' },
  { id: 'cat-other-inc', name: 'Autre rentrée', kind: 'income', color: '#457b9d' },
]

export function uid(prefix = 'id'): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
