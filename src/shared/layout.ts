export const pages = ['dashboard','activity','analytics','queue','alerts','rewards','studio','library','profiles','integrations','settings','diagnostics','documentation'] as const
export type PageId = typeof pages[number]
export interface LayoutPreferences {
  page: PageId
  sidebarWidth: number
  collapsed: boolean
  inspectorWidth: number
  inspectorOpen: boolean
}
export const defaultLayout: LayoutPreferences = { page: 'dashboard', sidebarWidth: 248, collapsed: false, inspectorWidth: 300, inspectorOpen: true }
export const bounds = { sidebar: [208, 320], inspector: [240, 420] } as const
export function clampWidth(value: number, range: readonly [number, number]): number {
  return Math.min(range[1], Math.max(range[0], Math.round(value)))
}
export function parseLayout(value: unknown): LayoutPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid layout')
  const v = value as Record<string, unknown>
  const validWidth = (n: unknown, range: readonly [number, number]): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= range[0] && n <= range[1]
  if (typeof v.page !== 'string' || !pages.includes(v.page as PageId) ||
      !validWidth(v.sidebarWidth, bounds.sidebar) || !validWidth(v.inspectorWidth, bounds.inspector) ||
      typeof v.collapsed !== 'boolean' || typeof v.inspectorOpen !== 'boolean') throw new TypeError('Invalid layout')
  return { page: v.page as PageId, sidebarWidth: v.sidebarWidth, collapsed: v.collapsed, inspectorWidth: v.inspectorWidth, inspectorOpen: v.inspectorOpen }
}
