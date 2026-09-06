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

export function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return todayISOFromDate(d)
}

export function todayISOFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function clampDayInMonth(ym: string, day: number): string {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const d = Math.min(Math.max(1, day), last)
  return `${ym}-${String(d).padStart(2, '0')}`
}

export function startOfWeekISO(date = todayISO()): string {
  const d = new Date(`${date}T12:00:00`)
  const day = d.getDay() // 0 Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return todayISOFromDate(d)
}

export function endOfWeekISO(date = todayISO()): string {
  return addDaysISO(startOfWeekISO(date), 6)
}
