# Supabase storage example

- Create a file `.env.local`
- Add a `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_KEY`
- Run `npm run dev`

## Database schema

```sql
create table public.profiles (
  id          uuid not null primary key, -- UUID from auth.users
  avatar_url  text
);
comment on table public.profiles is 'Public profile data for each user.';
comment on column public.profiles.id is 'References the internal Supabase Auth user.';

-- Secure the tables
alter table public.profiles enable row level security;
create policy "Allow logged-in read access" on public.profiles for select using ( auth.role() = 'authenticated' );
create policy "Allow individual insert access" on public.profiles for insert with check ( auth.uid() = id );
create policy "Allow individual update access" on public.profiles for update using ( auth.uid() = id );

-- inserts a row into public.profiles
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```
