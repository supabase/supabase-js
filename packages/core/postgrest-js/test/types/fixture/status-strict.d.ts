export {}
declare global {
  interface SupabasePgrstStatus {
    state: 'ready'
    unplanned: 'error'
    features: { maxAffected: true; spreadToMany: true }
  }
}
