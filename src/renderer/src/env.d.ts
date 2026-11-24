import type { PssaApi } from '../../shared/contracts'
declare global {
  interface Window { pssa: PssaApi }
}
declare module '*.scss'
export {}
