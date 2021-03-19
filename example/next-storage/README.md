# Supabase storage example

- Create a file `.env.local`
- Add a `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_KEY`
- Run `npm run dev`

## Database schema

```sql
-- Expose public user data
create view public.profiles as
select
  id,
  raw_user_meta_data -> 'avatar_url' as avatar_url
from auth.users
offset null; -- https://github.com/PostgREST/postgrest/issues/1647
```
