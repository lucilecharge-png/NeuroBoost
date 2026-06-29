/// <reference types="react/jsx-runtime" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

import type { NeuroBoostApi } from '../../shared/types'

declare global {
  interface Window {
    api: NeuroBoostApi
  }
  namespace JSX {
    interface Element extends React.ReactElement {}
  }
}
