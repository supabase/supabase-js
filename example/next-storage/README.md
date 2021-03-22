# Supabase storage example

- Create a file `.env.local`
- Add a `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_KEY`
- Run `npm run dev`

## Database schema

```sql
create table public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  full_name text,
  avatar_url text
);
alter table users enable row level security;
create policy "Public profiles are viewable by everyone." on users for select using (true);
create policy "Individuals update own user data." on users for update using (auth.uid() = id);
```
