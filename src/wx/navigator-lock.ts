export async function navigatorLockNoOp<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  return await fn()
}
