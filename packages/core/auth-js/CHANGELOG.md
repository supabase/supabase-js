# Changelog

## [2.65.1](https://github.com/supabase/auth-js/compare/v2.65.0...v2.65.1) (2024-10-14)


### Bug Fixes

* Call `SIGNED_OUT` event where session is removed ([#854](https://github.com/supabase/auth-js/issues/854)) ([436fd9f](https://github.com/supabase/auth-js/commit/436fd9f967ad6d515b8eca179d06032619a1b071))
* improve `mfa.enroll` return types ([#956](https://github.com/supabase/auth-js/issues/956)) ([8a1ec06](https://github.com/supabase/auth-js/commit/8a1ec0602792191bd235d51fd45c0ec2cabdf216))
* move MFA sub types to internal file ([#964](https://github.com/supabase/auth-js/issues/964)) ([4b7455c](https://github.com/supabase/auth-js/commit/4b7455c2631ca4e00f01275c7342eb37756ede23))
* remove phone mfa deletion, match on error codes ([#963](https://github.com/supabase/auth-js/issues/963)) ([ef3911c](https://github.com/supabase/auth-js/commit/ef3911cd1a082a6825ce25fe326081e096bd55f5))

## [2.65.0](https://github.com/supabase/auth-js/compare/v2.64.4...v2.65.0) (2024-08-27)


### Features

* add bindings for Multi-Factor Authentication (Phone) ([#932](https://github.com/supabase/auth-js/issues/932)) ([b957c30](https://github.com/supabase/auth-js/commit/b957c30782065e4cc421a526c62c101d35c443d4))
* add kakao to sign in with ID token ([#845](https://github.com/supabase/auth-js/issues/845)) ([e2337ba](https://github.com/supabase/auth-js/commit/e2337bad535598d9f751505de52a18c59f1505c3))
* remove session, emit `SIGNED_OUT` when JWT `session_id` is invalid ([#905](https://github.com/supabase/auth-js/issues/905)) ([db41710](https://github.com/supabase/auth-js/commit/db41710b1a35ef559158a936d0a95acc0b1fca96))


### Bug Fixes

* Correct typo in GoTrueClient warning message ([#938](https://github.com/supabase/auth-js/issues/938)) ([8222ee1](https://github.com/supabase/auth-js/commit/8222ee198a0ab10570e8b4c31ffb2aeafef86392))
* don't throw error in exchangeCodeForSession ([#946](https://github.com/supabase/auth-js/issues/946)) ([6e161ec](https://github.com/supabase/auth-js/commit/6e161ece3f8cd0d115857e2ed4346533840769f0))
* move docker compose to v2 ([#940](https://github.com/supabase/auth-js/issues/940)) ([38eef89](https://github.com/supabase/auth-js/commit/38eef89ff61b49eb65ee26b7d2201148d1fc3b77))

## [2.64.4](https://github.com/supabase/auth-js/compare/v2.64.3...v2.64.4) (2024-07-12)


### Bug Fixes

* update types  ([#930](https://github.com/supabase/auth-js/issues/930)) ([dbc5962](https://github.com/supabase/auth-js/commit/dbc5962d609cc0470b5b03160f4cd8b9e7d03ce3))

## [2.64.3](https://github.com/supabase/auth-js/compare/v2.64.2...v2.64.3) (2024-06-17)


### Bug Fixes

* don't call removeSession prematurely  ([#915](https://github.com/supabase/auth-js/issues/915)) ([e0dc518](https://github.com/supabase/auth-js/commit/e0dc51849680fa8f1900de786c4a7e77eab8760e))
* limit proxy session warning to once per client instance ([#900](https://github.com/supabase/auth-js/issues/900)) ([4ecfdda](https://github.com/supabase/auth-js/commit/4ecfdda65188b71322753e57622be8eafe97ed6b))
* patch release workflow ([#922](https://github.com/supabase/auth-js/issues/922)) ([f84fb50](https://github.com/supabase/auth-js/commit/f84fb50a4357af49acac6ca151057d2af74d63c9))
* type errors in verifyOtp ([#918](https://github.com/supabase/auth-js/issues/918)) ([dcd0b9b](https://github.com/supabase/auth-js/commit/dcd0b9b682412a2f1d2deaab26eb8094e50b67fd))

## [2.64.2](https://github.com/supabase/auth-js/compare/v2.64.1...v2.64.2) (2024-05-03)


### Bug Fixes

* signOut should ignore 403s ([#894](https://github.com/supabase/auth-js/issues/894)) ([eeb77ce](https://github.com/supabase/auth-js/commit/eeb77ce2a1ddee94c38f17533c9b748bf2950f67))
* suppress getSession warning whenever _saveSession is called ([#895](https://github.com/supabase/auth-js/issues/895)) ([59ec9af](https://github.com/supabase/auth-js/commit/59ec9affa01c780fb18f668291fa7167a65c391d))

## [2.64.1](https://github.com/supabase/auth-js/compare/v2.64.0...v2.64.1) (2024-04-25)


### Bug Fixes

* return error if missing session or missing custom auth header ([#891](https://github.com/supabase/auth-js/issues/891)) ([8d16578](https://github.com/supabase/auth-js/commit/8d165787ec46929cba68d18c35161463240f61e3))

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
