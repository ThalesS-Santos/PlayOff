/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** endereço da API (ex.: http://127.0.0.1:3333); sem ele, modo demonstração */
  readonly VITE_API_URL?: string
}
