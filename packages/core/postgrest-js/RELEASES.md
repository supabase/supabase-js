# Releases 

Releases are handled by Semantic release. This document is for forcing and documenting any non-code changes.

### 0.29.0

- `csv()`: https://github.com/supabase/postgrest-js/pull/187


### v0.21.1

- Make PostgrestResponse data always an array
- Introduce PostgrestSingleResponse and make single return PromiseLike<PostgrestSingleResponse<T>>. This means single has to be called at the very end of the method chain in a TypeScript context.
- Make sure PostgrestResponse is correctly assigned as the return type of onfulfilled callback.
