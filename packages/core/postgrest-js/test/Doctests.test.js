import doctest from '@supabase/doctest-js'

describe('Filter Doc Tests', () => {
  // paths are relative to root of directory
  doctest('src/utils/Filters.js')
  doctest('src/utils/Helpers.js')
})
