export type ToolId =
  | 'budget'
  | 'debts'
  | 'savings'
  | 'habits'
  | 'groceries'
  | 'notes'
  | 'subscriptions'

export type ToolStatus = 'ready' | 'soon'

export type ToolMeta = {
  id: ToolId
  name: string
  tagline: string
  status: ToolStatus
  accent: string
}

export const TOOLS: ToolMeta[] = [
  {
    id: 'budget',
    name: 'Budget',
    tagline: 'Dépenses, rentrées, récurrents, comptes et budgets.',
    status: 'ready',
    accent: '#2a9d8f',
  },
  {
    id: 'debts',
    name: 'Dettes',
    tagline: 'Ce qu’on vous doit et ce que vous devez — suivi simple.',
    status: 'ready',
    accent: '#e76f51',
  },
  {
    id: 'savings',
    name: 'Objectifs d’épargne',
    tagline: 'Jauges vers un montant : voyage, fond d’urgence…',
    status: 'ready',
    accent: '#e9a825',
  },
  {
    id: 'habits',
    name: 'Habitudes',
    tagline: 'Suivi quotidien des routines (sport, sommeil, lecture…).',
    status: 'soon',
    accent: '#457b9d',
  },
  {
    id: 'groceries',
    name: 'Courses',
    tagline: 'Listes sur l’appareil, rayons et coches rapides.',
    status: 'soon',
    accent: '#264653',
  },
  {
    id: 'notes',
    name: 'Notes rapides',
    tagline: 'Mémos courts, idées et listes sans friction.',
    status: 'soon',
    accent: '#9b5de5',
  },
  {
    id: 'subscriptions',
    name: 'Abonnements',
    tagline: 'Récurrents, dates de prélèvement et coût mensuel total.',
    status: 'soon',
    accent: '#f4a261',
  },
]
