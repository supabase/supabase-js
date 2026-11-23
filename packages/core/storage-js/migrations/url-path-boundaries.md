# Object request URL validation

**Since:** v2.119.2
**Applies to:** callers using bucket or object paths that send requests outside the intended Storage endpoint or bucket, or custom fetch wrappers that compare URL strings.

## What changed

Object requests must resolve within the configured bucket endpoint. Paths that resolve outside it return a `StorageError` without sending a request. `throwOnError()` throws instead, and `exists()` propagates the error.

This applies to uploads, updates, signed uploads, single-object URL signing, downloads (including streams and image transformations), metadata/existence checks, and object CDN purges.

The complete request URL is also checked against the intended Storage endpoint, independently of the bucket argument. Bucket arguments that cause the final URL to leave that endpoint now fail locally. Existing encoding of valid bucket names is unchanged.

Valid paths retain their previous request destinations and encoding behavior. `getPublicUrl()` string generation is unchanged.

## Who is affected

**Most callers: nothing to do.** Nested paths, spaces, Unicode, and pre-encoded bucket names continue to work. Paths such as `folder/../photo.jpg` remain valid when they resolve within the same bucket.

**Callers using relative paths to reach another bucket:** these requests now fail locally.

**Custom fetch wrappers and exact-string request mocks:** URLs are now normalized before being passed to fetch. Spaces and Unicode may be percent-encoded, and dot segments may be collapsed. The destination matches what standard fetch already used.

## What to do

Existing nested bucket arguments continue to work, including paths that normalize within the same bucket:

```ts
await supabase.storage.from('uploads/images').upload('photo.jpg', file)
await supabase.storage.from('uploads/images').upload('../photo.jpg', file)
```

Requests that leave the intended Storage endpoint now fail locally. For example, `.from('..').upload('file', file)` no longer sends a request outside the object endpoint. Select the destination bucket explicitly instead.

To upload to another bucket, select it explicitly:

```ts
// Before
await supabase.storage.from('uploads').upload('../avatars/photo.jpg', file)

// After
await supabase.storage.from('avatars').upload('photo.jpg', file)
```

If a custom fetch wrapper or request mock compares URL strings, compare normalized URLs with `new URL(url).href` rather than relying on their original spelling.

No changes to stored objects or bucket names are required.
