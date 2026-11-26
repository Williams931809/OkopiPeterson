import { bindings, defineConfig } from 'cf/config'
import * as entrypoint from './worker.mjs' with { type: 'cf-worker' }

export default defineConfig({
  worker: {
    name: 'maisonpe-api',
    compatibilityDate: '2026-11-26',
    entrypoint,
    workersDev: true,
    previewUrls: false,
    observability: { enabled: true, traces: { enabled: true } },
    env: {
      DB: bindings.d1({ id: '3a6138c5-97fd-4778-9429-e8e3ccaa217a', name: 'maisonpe' }),
      FLW_MODE: bindings.text('test'),
      STOREFRONT_ORIGIN: bindings.text('https://okopipeterson.vercel.app'),
      WORKER_ORIGIN: bindings.text('https://maisonpe-api.thankgododiawa6.workers.dev'),
    },
  },
})
