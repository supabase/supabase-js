# Changelog

## [2.64.0](https://github.com/supabase/auth-js/compare/v2.63.2...v2.64.0) (2024-04-25)


### Features

* remove `cache: no-store` as it breaks cloudflare ([#886](https://github.com/supabase/auth-js/issues/886)) ([10e9d38](https://github.com/supabase/auth-js/commit/10e9d3871c5a9ce50d15c35c7fd7045cad504670))


### Bug Fixes

* Revert "fix: `getUser` returns null if there is no session ([#876](https://github.com/supabase/auth-js/issues/876))" ([#889](https://github.com/supabase/auth-js/issues/889)) ([6755fef](https://github.com/supabase/auth-js/commit/6755fef2aefd1bc84a26182f848c0912492cb106))
* revert check for access token in header ([#885](https://github.com/supabase/auth-js/issues/885)) ([03d8ba7](https://github.com/supabase/auth-js/commit/03d8ba7ca5c485979788d6f121199e4370622491))

## [2.63.2](https://github.com/supabase/auth-js/compare/v2.63.1...v2.63.2) (2024-04-20)


### Bug Fixes

* check for access token in header ([#882](https://github.com/supabase/auth-js/issues/882)) ([ae4a53d](https://github.com/supabase/auth-js/commit/ae4a53de7eb41ebde3b4e1abe823e2ffcb53a71d))

## [2.63.1](https://github.com/supabase/auth-js/compare/v2.63.0...v2.63.1) (2024-04-18)


### Bug Fixes

* `getUser` returns null if there is no session ([#876](https://github.com/supabase/auth-js/issues/876)) ([6adf8ca](https://github.com/supabase/auth-js/commit/6adf8caa4ca803e65f943cc88a2849f5905a044a))
* implement exponential back off on the retries of `_refreshAccessToken` method ([#869](https://github.com/supabase/auth-js/issues/869)) ([f66711d](https://github.com/supabase/auth-js/commit/f66711ddf87ea705a972a860d7ebfb6e0d003c6b))
* update session warning ([#879](https://github.com/supabase/auth-js/issues/879)) ([3661130](https://github.com/supabase/auth-js/commit/36611300fa6d1378a7633c62d2f816d3803f2774))

## [2.63.0](https://github.com/supabase/gotrue-js/compare/v2.62.2...v2.63.0) (2024-03-26)


### Features

* add method for anonymous sign-in ([#858](https://github.com/supabase/gotrue-js/issues/858)) ([e8a1fc9](https://github.com/supabase/gotrue-js/commit/e8a1fc9a40947b949080107138eade09f06f5868))
* add support for error codes ([#855](https://github.com/supabase/gotrue-js/issues/855)) ([99821f4](https://github.com/supabase/gotrue-js/commit/99821f4a1f6fdb3a222cd0f660210016e6cc823e))
* explicit `cache: no-store` in fetch ([#847](https://github.com/supabase/gotrue-js/issues/847)) ([034bee0](https://github.com/supabase/gotrue-js/commit/034bee09c3f0a4613d9a3e7bd3bc5f70682f5a66))
* warn use of `getSession()` when `isServer` on storage ([#846](https://github.com/supabase/gotrue-js/issues/846)) ([9ea94fe](https://github.com/supabase/gotrue-js/commit/9ea94fe11f4a6a4b6305aa4fe75c4661074437a7))


### Bug Fixes

* refactor all pkce code into a single method ([#860](https://github.com/supabase/gotrue-js/issues/860)) ([860bffc](https://github.com/supabase/gotrue-js/commit/860bffc8f75292e71630fb7241e11a754200dab8))
* remove data type ([#848](https://github.com/supabase/gotrue-js/issues/848)) ([15c7c82](https://github.com/supabase/gotrue-js/commit/15c7c8258b2d42d3378be4f7738c728a07523579))
