# Releases 

Releases are handled by Semantic release. This document is for forcing and documenting any non-code changes.

### v1.5.10

In this one we had to roll back the automatic Semantic release, which bumped the version to 2.0.0.

This release containes some breaking changes:

```js
// previously 
let client = new Client()

// this release
let client = new GoTrueClient()
```