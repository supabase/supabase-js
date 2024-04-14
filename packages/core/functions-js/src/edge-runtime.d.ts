interface ModelOptions {
  mean_pool?: boolean
  normalize?: boolean
  stream?: boolean
  timeout?: number
}

interface Session {
  run(prompt: string, modelOptions?: ModelOptions): unknown
}

declare var Session: {
  prototype: Session
  new (modelName: string, sessionOptions?: unknown): Session
}

declare var Supabase: {
  readonly ai: {
    readonly Session: typeof Session
  }
}
