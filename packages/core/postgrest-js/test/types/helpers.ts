export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false
export type Expect<T extends true> = T
type Ok<P> = Awaited<P> extends infer R ? (R extends { error: null } ? R : never) : never
export type Data<P> = Ok<P> extends { data: infer D } ? D : never
export type Count<P> = Ok<P> extends { count: infer C } ? C : never
export type Status = 'ONLINE' | 'OFFLINE'
export type Theme = { theme: 'light' | 'dark' }
