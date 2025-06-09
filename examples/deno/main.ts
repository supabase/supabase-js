import { createClient } from 'jsr:@supabase/supabase-js@2'

// Initialize the Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'http://localhost:54321'
const supabaseKey =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(supabaseUrl, supabaseKey)

// Example function to fetch data
async function signUpWithEmailAndPassword() {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: `random${Math.random().toString(36).substring(2, 9)}@example.com`,
      password: `random${Math.random().toString(36).substring(2, 9)}`,
    })

    if (error) {
      console.error('Error signing in:', error.message)
      throw error
    }

    console.log('Signed up:', data)
  } catch (err) {
    console.error('Unexpected error:', err)
    throw err
  }
}

// Run the example
console.log('Starting Supabase Deno example...')
await signUpWithEmailAndPassword()
