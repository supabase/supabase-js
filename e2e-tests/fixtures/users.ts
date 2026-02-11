/**
 * Shared test user fixtures
 */

export interface TestUser {
  email: string
  password: string
  id?: string
}

/**
 * Test users from seed data (auth.users)
 */
export const testUsers = {
  user1: {
    id: '317eadce-631a-4429-a0bb-f19a7a517b4a',
    email: 'test-user1@supabase.io',
    password: 'password123',
  },
  user2: {
    id: '4d56e902-f0a0-4662-8448-a4d9e643c142',
    email: 'test-user2@supabase.io',
    password: 'password123',
  },
  admin: {
    id: 'd8c7bce9-cfeb-497b-bd61-e66ce2cbdaa2',
    email: 'test-admin@supabase.io',
    password: 'password123',
  },
} as const

/**
 * PostgREST users from seed data (public.users)
 */
export const postgrestUsers = {
  supabot: {
    username: 'supabot',
    status: 'ONLINE',
  },
  kiwicopple: {
    username: 'kiwicopple',
    status: 'OFFLINE',
  },
  awailas: {
    username: 'awailas',
    status: 'ONLINE',
  },
  dragarcia: {
    username: 'dragarcia',
    status: 'ONLINE',
  },
  jsonuser: {
    username: 'jsonuser',
    status: 'ONLINE',
  },
} as const
