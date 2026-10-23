export {}
declare global {
  interface SupabasePgrstStatus {
    state: 'ready'
    unplanned: 'loose'
    features: { maxAffected: true; spreadToMany: true }
  }
}
