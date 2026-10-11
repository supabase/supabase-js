# Admin delete user response

**Since:** v3.

`auth.admin.deleteUser()` returns `{ data: null, error: null }` on success and
`{ data: null, error }` on failure. The Auth server sends no user data after a
hard or soft deletion.

Update callers that access `data.user` or expect a `UserResponse`. Check `error`
to determine whether deletion succeeded:

```ts
const { error } = await supabase.auth.admin.deleteUser(userId)
if (error) throw error
```

If you need the user's details, read them before deleting the user:

```ts
const { data, error: readError } = await supabase.auth.admin.getUserById(userId)
if (readError) throw readError

const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
if (deleteError) throw deleteError

const deletedUser = data.user
```
