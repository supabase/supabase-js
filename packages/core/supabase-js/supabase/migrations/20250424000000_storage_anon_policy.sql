-- Create test bucket for storage tests
insert into storage.buckets (id, name, public)
values ('test-bucket', 'test-bucket', false)
on conflict (id) do nothing;

-- Allow the anon role to upload, list, and delete files in test-bucket so
-- integration tests can exercise the storage SDK with the publishable key.
-- RLS is enabled on storage.objects by default.

drop policy if exists "anon can read test-bucket" on storage.objects;
create policy "anon can read test-bucket"
on storage.objects for select
to anon
using (bucket_id = 'test-bucket');

drop policy if exists "anon can upload to test-bucket" on storage.objects;
create policy "anon can upload to test-bucket"
on storage.objects for insert
to anon
with check (bucket_id = 'test-bucket');

drop policy if exists "anon can delete from test-bucket" on storage.objects;
create policy "anon can delete from test-bucket"
on storage.objects for delete
to anon
using (bucket_id = 'test-bucket');
