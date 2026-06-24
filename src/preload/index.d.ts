import type { NeuroBoostApi } from '../shared/types'

declare global {
  interface Window {
    api: NeuroBoostApi
  }
}
