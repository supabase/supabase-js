import { z } from 'zod'

export const CustomUserDataTypeSchema = z.object({
  foo: z.string(),
  bar: z.object({
    baz: z.number(),
  }),
  en: z.enum(['ONE', 'TWO', 'THREE']),
  record: z.record(z.string(), z.unknown()).nullable(),
  recordNumber: z.record(z.number(), z.unknown()).nullable(),
})

export type CustomUserDataType = z.infer<typeof CustomUserDataTypeSchema>

declare global {
  // Replaces the type derived for these columns, in every select, filter and mutation payload that
  // reaches them. The column's own nullability stays outside.
  interface SupabaseColumnTypes {
    'public.users.data': CustomUserDataType
    'personal.users.data': CustomUserDataType
  }
}
