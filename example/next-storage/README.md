# Supabase storage example

- Create a file `.env.local`
- Add a `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_KEY`
- Run `npm run dev`

## Database schema

```sql
create table public.profiles (
  id uuid references auth.users not null,
  username text unique,
  avatar_url text,
  dob date,

  primary key (id),
  unique(username),
  constraint username_length check (char_length(username) >= 3)
);
alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);
```
