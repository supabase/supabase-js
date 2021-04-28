# Releases

Releases are handled by Semantic release. This document is for forcing and documenting any non-code changes.

## 1.11.8

- Implement @supabase/storage-js

## 1.4.0

- Ability to redirect a user to a specified location after confirmation

## 1.1.4

- bump @supabase/gotrue-js from 1.9.3.2 to [1.10.1](https://github.com/supabase/gotrue-js/releases/tag/v1.10.1)
  - Includes Next.js/Express helpers and Password reset helpers

## 1.1.3

- bump @supabase/postgrest-js from 0.21.2 to 0.22.0
- Fix: Added 'AuthUser' to the exports

## 1.0.6

- Bumps gotrue-js so that it works with React Native: https://github.com/supabase/gotrue-js/pull/26

## 1.0.5

- Adds local storage options for Auth.

## 1.0.4

- Upgrades postgrest-js dependency to fix ordering for JSON columns. (https://github.com/supabase/postgrest-js/pull/132)

## 1.0.2

- Fixes link in readme for NPM.

## 1.0.1 - Improved DX

- Upgraded the `supabase.auth` to [gotrue-js](https://github.com/supabase/gotrue-js) - supports Oath logins & more
- We always return errors, not throwing errors.
- We only generate one socket connection per supabase client.
- Native typescript
- Fixes #32 Major DX change: response and error handling
- Fixes #49 When no `supabaseKey` is passed in it throws an error
- Fixes #31 chore: set up semantic releases
- Fixes #15 `supabase.auth.logout()` throws "Invalid user" error.
- Fixes #20 Auth: Change DX of user management
- Fixes #30 Supabase auth interface missing informiation
- Fixes https://github.com/supabase/supabase/issues/147 https://github.com/supabase/supabase/issues/147
- Partial fix for https://github.com/supabase/realtime-js/issues/53 - if there is no token provided. The error needs to be caught at a socket level.

#### Breaking changes

**`body` is now `data`**

Previously:

```jsx
const { body } = supabase.from('todos').select('*')
```

Now:

```jsx
const { data } = supabase.from('todos').select('*')
```

**Errors are returned not thrown**

Previously:

```jsx
try {
  const { body } = supabase.from('todos').select('*')
} catch (error) {
  console.log(error)
}
```

Now:

```jsx
const { data, error } = supabase.from('todos').select('*')
if (error) console.log(error)
```

**`ova()` and `ovr()` are now just `ov()`**

Previously:

```jsx
try {
  const { body } = supabase.from('todos').select('*').ovr('population_range_millions', [150, 250])
} catch (error) {
  console.log(error)
}
```

Now:

```jsx
const { data, error } = supabase
  .from('todos')
  .select('*')
  .ov('population_range_millions', [150, 250])
if (error) console.log(error)
```

**`offset()` is removed**

You can now use range() instead of `limit()` + `offset()`

**`ova()` and `ovr()` are now just `ov()`**

Previously:

```js
let countries = await supabase.from('cities').select('name').offset(10).limit(10)
```

Now:

```js
let countries = await supabase.from('cities').select('name').range(10, 20)
```

**`signup()` is now `signUp()` and `email` / `password` is passed as an object**

Previously:

```jsx
const {
  body: { user },
} = await supabase.auth.signup('someone@email.com', 'password')
```

Now:

```jsx
const { user, error } = await supabase.auth.signUp({
  email: 'someone@email.com',
  password: 'password',
})
```

**`login()` is now `signIn()` and `email` / `password` is passed as an object**

Previously:

```jsx
const {
  body: { user },
} = await supabase.auth.signup('someone@email.com', 'password')
```

Now:

```jsx
const { user, error } = await supabase.auth.signIn({
  email: 'someone@email.com',
  password: 'password',
})
```

**`logout()` is now `signOut()`**

Previously:

```jsx
await supabase.auth.logout()
```

Now:

```jsx
await supabase.auth.signOut()
```
