/// <reference types="react/jsx-runtime" />

import type { NeuroBoostApi } from '../../shared/types'

declare global {
  interface Window {
    api: NeuroBoostApi
  }
  namespace JSX {
    interface Element extends React.ReactElement {}
  }
}
