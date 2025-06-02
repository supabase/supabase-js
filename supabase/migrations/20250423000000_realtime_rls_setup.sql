create policy "authenticated can read all messages on topic"
on "realtime"."messages"
for select
to authenticated
using ( realtime.topic() like '%channel%' );

create policy "authenticated can insert messages on topic"
on "realtime"."messages"
for insert
to authenticated
with check (realtime.topic() like '%channel%');