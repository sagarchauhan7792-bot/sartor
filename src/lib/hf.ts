// Shared loader for transformers.js.
//
// Fetched from a CDN rather than bundled: the minified bundle contains model
// architecture names that GitHub's secret scanner mistakes for an API key and
// refuses in a repository, and it drags ~23MB of ONNX runtime into the build.
// Every model here downloads its weights over the network anyway, so nothing
// is lost by fetching the library the same way.

const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm'

type ProgressEvent = { status?: string; progress?: number }
export type Progress = (msg: string) => void

interface TransformersModule {
  pipeline: (task: string, model: string, opts?: unknown) => Promise<unknown>
}

let modulePromise: Promise<TransformersModule> | null = null

async function loadTransformers(): Promise<TransformersModule> {
  if (!modulePromise) {
    modulePromise = (import(/* @vite-ignore */ CDN) as Promise<TransformersModule>).catch((e) => {
      modulePromise = null // let the user retry
      throw e
    })
  }
  return modulePromise
}

const pipelines = new Map<string, Promise<unknown>>()

/**
 * Get (and cache) a transformers.js pipeline. The first call for a model
 * downloads its weights; the browser caches them for subsequent sessions.
 */
export async function getPipeline(
  task: string,
  model: string,
  onProgress?: Progress,
  label = 'model',
): Promise<unknown> {
  const key = `${task}:${model}`
  const existing = pipelines.get(key)
  if (existing) return existing

  const created = (async () => {
    const { pipeline } = await loadTransformers()
    return pipeline(task, model, {
      progress_callback: (p: ProgressEvent) => {
        if (p.status === 'progress' && typeof p.progress === 'number') {
          const pct = Math.round(p.progress)
          // Once the weights are in, inference is the slow part — a label stuck
          // at 100% reads as finished-but-frozen.
          onProgress?.(pct >= 100 ? 'Thinking…' : `Downloading ${label} ${pct}%`)
        }
      },
    })
  })().catch((e) => {
    pipelines.delete(key)
    throw e
  })

  pipelines.set(key, created)
  return created
}
