# Releases

Releases are handled by Semantic release. This document is for forcing and documenting any non-code changes.

### v1.7.0

In this release we added `client.api.sendMagicLinkEmail()` and updated `client.signIn()` to support magic link login by only providing email credentials without a password.

### v1.6.1

In this release we strip out the session data from the URL once it is detected.

### v1.6.0

In this release we added `client.user()`, `client.session()`, and `client.refreshSession()`.

### v1.5.10

In this one we had to roll back the automatic Semantic release, which bumped the version to 2.0.0.

This release containes some breaking changes:

```js
// previously
let client = new Client()

// this release
let client = new GoTrueClient()
```
