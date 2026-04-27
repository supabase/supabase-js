-- Create test bucket for storage tests
insert into storage.buckets (id, name, public)
values ('test-bucket', 'test-bucket', false)
on conflict (id) do nothing;

-- Allow CRUD access to test-bucket so integration tests can exercise the
-- storage SDK with the publishable key (no service-role bypass needed).
-- RLS is enabled on storage.objects by default; FOR ALL with no role clause
-- defaults to PUBLIC and matches whichever role the storage server uses.

drop policy if exists "test-bucket public access" on storage.objects;
create policy "test-bucket public access"
on storage.objects
for all
using (bucket_id = 'test-bucket');
