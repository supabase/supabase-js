interface ModelOptions {
  /**
   * Pool embeddings by taking their mean. Applies only for `gte-small` model
   */
  mean_pool?: boolean

  /**
   * Normalize the embeddings result. Applies only for `gte-small` model
   */
  normalize?: boolean

  /**
   * Stream response from model. Applies only for LLMs like `mistral` (default: false)
   */
  stream?: boolean

  /**
   * Automatically abort the request to the model after specified time (in seconds). Applies only for LLMs like `mistral` (default: 60)
   */
  timeout?: number
}

interface Session {
  /**
   * Execute the given prompt in model session
   */
  run(prompt: string, modelOptions?: ModelOptions): unknown
}

declare var Session: {
  prototype: Session
  /**
   * Create a new model session using given model
   */
  new (model: string, sessionOptions?: unknown): Session
}

declare var Supabase: {
  /**
   * Provides AI related APIs
   */
  readonly ai: {
    readonly Session: typeof Session
  }
}
