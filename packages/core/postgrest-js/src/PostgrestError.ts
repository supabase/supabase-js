import type { PostgrestError as IPostgrestError } from './types'

export default class PostgrestError extends Error implements IPostgrestError {
  details: string
  hint: string
  code: string

  constructor(context: IPostgrestError) {
    super(context.message)
    this.name = 'PostgrestError'
    this.details = context.details
    this.hint = context.hint
    this.code = context.code
  }
}
