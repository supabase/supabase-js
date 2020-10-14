// types.ts

export type SupabaseClientOptions = {
  schema: string
  headers?: { [key: string]: string }
  autoRefreshToken?: boolean
  persistSession?: boolean
  detectSessionInUrl?: boolean
}
