-- Create test bucket for storage tests
insert into storage.buckets (id, name, public)
values ('test-bucket', 'test-bucket', false)
on conflict (id) do nothing;
