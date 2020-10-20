import doctest from '@supabase/doctest-js'

describe('Doctests', () => {
  // file paths are relative to root of directory
  doctest('dist/main/lib/transformers.js')
})