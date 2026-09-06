export type ToolId = 'budget' | 'habits' | 'groceries' | 'notes' | 'subscriptions'

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
    tagline: 'Dépenses, rentrées et catégories — vue claire du mois.',
    status: 'ready',
    accent: '#2a9d8f',
  },
  {
    id: 'habits',
    name: 'Habitudes',
    tagline: 'Suivi quotidien des routines (sport, sommeil, lecture…).',
    status: 'soon',
    accent: '#e76f51',
  },
  {
    id: 'groceries',
    name: 'Courses',
    tagline: 'Listes partagées sur l’appareil, rayons et coches rapides.',
    status: 'soon',
    accent: '#457b9d',
  },
  {
    id: 'notes',
    name: 'Notes rapides',
    tagline: 'Mémos courts, idées et listes sans friction.',
    status: 'soon',
    accent: '#e9a825',
  },
  {
    id: 'subscriptions',
    name: 'Abonnements',
    tagline: 'Récurrents, dates de prélèvement et coût mensuel total.',
    status: 'soon',
    accent: '#9b5de5',
  },
]
