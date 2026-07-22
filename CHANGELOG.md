## 2.110.8 (2026-07-21)

### 🩹 Fixes

- **auth:** downgrade aborted/transient fetch failures from console.error to warn ([#2544](https://github.com/supabase/supabase-js/pull/2544))
- **functions:** clean up cross-signal abort listener on invoke() return ([#2487](https://github.com/supabase/supabase-js/pull/2487))
- **functions:** match response Content-Type case-insensitively ([#2515](https://github.com/supabase/supabase-js/pull/2515))
- **storage:** url-encode object key in CDN purge methods ([#2545](https://github.com/supabase/supabase-js/pull/2545))
- **supabase:** skip Node warning in Deno ([#2541](https://github.com/supabase/supabase-js/pull/2541))

### ❤️ Thank You

- Franco Kaddour @FrancoKaddour
- Katerina Skroumpelou @mandarini
- Pedro Henrique
- Vaibhav @7ttp

## 2.110.7 (2026-07-16)

### 🩹 Fixes

- **postgrest:** correct self-reference inference ([#2525](https://github.com/supabase/supabase-js/pull/2525))
- **realtime:** trigger set auth on INITIAL_SESSION event ([#2531](https://github.com/supabase/supabase-js/pull/2531))
- **realtime:** update phoenix to fix presence issue ([#2532](https://github.com/supabase/supabase-js/pull/2532))

### ❤️ Thank You

- Eduardo Gurgel
- Filipe Cabaço @filipecabaco
- Vaibhav @7ttp

## 2.110.6 (2026-07-15)

### 🩹 Fixes

- **postgrest:** type hinted self-referencing embeds as arrays ([#2520](https://github.com/supabase/supabase-js/pull/2520))
- **realtime:** forward opts to send() in track() ([#2490](https://github.com/supabase/supabase-js/pull/2490))
- **supabase:** warn instead of throw for unrecognized sb_ API key subtypes ([#2526](https://github.com/supabase/supabase-js/pull/2526))

### ❤️ Thank You

- Franco Kaddour @FrancoKaddour
- Katerina Skroumpelou @mandarini

## 2.110.5 (2026-07-14)

### 🩹 Fixes

- **supabase:** avoid edge runtime warning ([#2522](https://github.com/supabase/supabase-js/pull/2522))

### ❤️ Thank You

- Vaibhav @7ttp

## 2.110.4 (2026-07-14)

### 🩹 Fixes

- **functions:** stop sending API key in Authorization header for function calls ([#2511](https://github.com/supabase/supabase-js/pull/2511))
- **realtime:** encode broadcast header fields as UTF-8 ([#2516](https://github.com/supabase/supabase-js/pull/2516))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- Pedro Henrique

## 2.110.3 (2026-07-13)

### 🩹 Fixes

- **auth:** preserve pkce verifier ([#2513](https://github.com/supabase/supabase-js/pull/2513))
- **postgrest:** pin tstyche target off floating latest ([#2509](https://github.com/supabase/supabase-js/pull/2509))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- Vaibhav @7ttp

## 2.110.2 (2026-07-09)

### 🩹 Fixes

- **auth:** clear local session on signout failures ([#2504](https://github.com/supabase/supabase-js/pull/2504))

### ❤️ Thank You

- Luc Peng

## 2.110.1 (2026-07-07)

### 🩹 Fixes

- **auth:** defer init-time notifications until initializePromise resolves ([#2498](https://github.com/supabase/supabase-js/pull/2498))
- **realtime:** suppress disconnected status from onHeartbeat consumers ([#2496](https://github.com/supabase/supabase-js/pull/2496))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.110.0 (2026-06-30)

### 🚀 Features

- **repo:** drop Node.js 20 support ([#2482](https://github.com/supabase/supabase-js/pull/2482))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.109.0 (2026-06-30)

### 🚀 Features

- **auth:** add custom_claims_allowlist to custom providers admin API ([#2473](https://github.com/supabase/supabase-js/pull/2473))
- **realtime:** add postgres_changes filter builder, new operators and select ([#2463](https://github.com/supabase/supabase-js/pull/2463))
- **storage:** expose purgeCache for buckets and single objects ([#2429](https://github.com/supabase/supabase-js/pull/2429))

### 🩹 Fixes

- **functions:** honor a caller's Content-Type override regardless of casing ([#2455](https://github.com/supabase/supabase-js/pull/2455))
- **realtime:** pin @supabase/phoenix and browser test CDN deps ([#2457](https://github.com/supabase/supabase-js/pull/2457))
- **realtime:** add replication connection system message option ([#2470](https://github.com/supabase/supabase-js/pull/2470))
- **storage:** keep sortBy defaults when list() is given a partial sortBy ([#2454](https://github.com/supabase/supabase-js/pull/2454))

### ❤️ Thank You

- Anubhav Anand @i-anubhav-anand
- Cemal Kılıç @cemalkilic
- Claude Opus 4.8 (1M context)
- Filipe Cabaço @filipecabaco
- Katerina Skroumpelou @mandarini
- Lenny
- Rodrigo Mansueli @mansueli

## 2.108.2 (2026-06-15)

### 🩹 Fixes

- **auth:** preserve valid session on refresh failure and cooldown repeat failures ([#2436](https://github.com/supabase/supabase-js/pull/2436))
- **realtime:** clarify httpSend() 404 error and server migration note ([#2444](https://github.com/supabase/supabase-js/pull/2444))
- **release:** pin Deno and bound JSR publish to survive stranded-task hangs ([#2439](https://github.com/supabase/supabase-js/pull/2439))
- **release:** restore JSR publish flags and enable for beta ([#2440](https://github.com/supabase/supabase-js/pull/2440))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.108.0 (2026-06-08)

### 🚀 Features

- **auth:** auth.resend() consistent confirmation flow ([#2144](https://github.com/supabase/supabase-js/pull/2144))

### 🩹 Fixes

- **auth:** do not console.error AuthApiError already returned through contract ([#2428](https://github.com/supabase/supabase-js/pull/2428))
- **postgrest:** pass request headers as plain object for RN/custom-fetch compatibility ([#2414](https://github.com/supabase/supabase-js/pull/2414))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- Lawrence Li @weilirs
- MaitreyeeDeshmukh

## 2.107.0 (2026-06-02)

### 🚀 Features

- **auth:** remove navigator.locks-based mutex; introduce commit guard + dispose() ([#2392](https://github.com/supabase/supabase-js/pull/2392))
- **realtime:** allow httpSend to send binary payload ([#2400](https://github.com/supabase/supabase-js/pull/2400))
- **supabase:** update X-Client-Info to structured metadata format ([#2359](https://github.com/supabase/supabase-js/pull/2359))

### 🩹 Fixes

- **auth:** return AuthInvalidJwtError from getClaims for expired JWT ([#2395](https://github.com/supabase/supabase-js/pull/2395))
- **auth:** recognize ?error= redirects in implicit grant gate ([#2407](https://github.com/supabase/supabase-js/pull/2407))
- **auth): revert fix(auth:** encode client-id in oauth requests ([#2383](https://github.com/supabase/supabase-js/pull/2383), [#2417](https://github.com/supabase/supabase-js/pull/2417))
- **postgrest:** return a structured error for non-JSON body on successful responses ([#2398](https://github.com/supabase/supabase-js/pull/2398))
- **release:** pin workspace:* sibling deps before JSR publish ([#2418](https://github.com/supabase/supabase-js/pull/2418))
- **release:** publish gotrue-js legacy mirror via pnpm ([#2419](https://github.com/supabase/supabase-js/pull/2419))

### ❤️ Thank You

- Claude Opus 4.7 (1M context)
- Claude Sonnet 4.6
- Eduardo Gurgel
- Guilherme Souza
- Katerina Skroumpelou @mandarini
- Omar Al Matar @Bewinxed
- youcef zr @youcefzemmar
- youcefzemmar

## 2.106.2 (2026-05-25)

### 🩹 Fixes

- **auth:** restore signup user response ([#2391](https://github.com/supabase/supabase-js/pull/2391))
- **misc:** add react-native export condition for Hermes-safe resolution ([#2393](https://github.com/supabase/supabase-js/pull/2393))

### ❤️ Thank You

- Myroslav Hryhschenko @BLOCKMATERIAL
- Vaibhav @7ttp

## 2.106.1 (2026-05-20)

### 🩹 Fixes

- **auth:** encode client-id in oauth requests ([#2383](https://github.com/supabase/supabase-js/pull/2383))
- **misc:** hide dynamic import from hermesc ([#2381](https://github.com/supabase/supabase-js/pull/2381))

### ❤️ Thank You

- Etienne Stalmans @staaldraad
- Katerina Skroumpelou @mandarini

## 2.106.0 (2026-05-18)

### 🚀 Features

- **supabase:** W3C/OpenTelemetry trace context propagation ([#2163](https://github.com/supabase/supabase-js/pull/2163))

### 🩹 Fixes

- **auth:** return null user and session for email_change single-confirmation verifyOtp ([#2378](https://github.com/supabase/supabase-js/pull/2378))
- **release:** mark @supabase/tracing private and snapshot it for JSR ([#2370](https://github.com/supabase/supabase-js/pull/2370))
- **storage:** make StreamDownloadBuilder implement Promise and memoize executor ([#2367](https://github.com/supabase/supabase-js/pull/2367))

### ❤️ Thank You

- Claude Sonnet 4.5
- Guilherme Souza
- Katerina Skroumpelou @mandarini
- oniani1

## 2.105.4 (2026-05-08)

### 🩹 Fixes

- **auth:** return null from getItemAsync on JSON parse failure ([#2336](https://github.com/supabase/supabase-js/pull/2336))
- **postgrest:** restore non-Error abort detection in fetch catch ([#2335](https://github.com/supabase/supabase-js/pull/2335))
- **realtime:** guard sessionStorage access in restricted-storage browsers ([#2339](https://github.com/supabase/supabase-js/pull/2339))

## 2.105.2 (2026-05-04)

### 🩹 Fixes

- **auth:** forward lockAcquireTimeout to SupabaseAuthClient ([#2309](https://github.com/supabase/supabase-js/pull/2309))
- **auth:** add toJSON to WebAuthnError for correct JSON serialization ([#2317](https://github.com/supabase/supabase-js/pull/2317))
- **misc:** widen enum-like unions with (string & {}) for forward compat ([#2303](https://github.com/supabase/supabase-js/pull/2303))
- **misc:** reduce any usage across packages ([#2314](https://github.com/supabase/supabase-js/pull/2314))
- **postgrest:** unify insert/upsert signatures ([#2315](https://github.com/supabase/supabase-js/pull/2315))

### ❤️ Thank You

- Muzzaiyyan Hussain @MuzzaiyyanHussain

## 2.105.1 (2026-04-28)

### 🩹 Fixes

- **postgrest:** query reassignment regression ([#2292](https://github.com/supabase/supabase-js/pull/2292))
- **realtime:** surface real Error on transport-level CHANNEL_ERROR ([#2299](https://github.com/supabase/supabase-js/pull/2299))

### ❤️ Thank You

- Vaibhav @7ttp

## 2.105.0 (2026-04-27)

### 🚀 Features

- **auth:** add passkey support with WebAuthn registration, authentication, and management ([#2283](https://github.com/supabase/supabase-js/pull/2283))
- **realtime:** Realtime deferred disconnect ([#2282](https://github.com/supabase/supabase-js/pull/2282))

### 🩹 Fixes

- **postgrest:** narrow column types after not(column, is, null) ([#2264](https://github.com/supabase/supabase-js/pull/2264))
- **realtime:** annotate Timer/Vsn getters to avoid deep phoenix imports ([#2284](https://github.com/supabase/supabase-js/pull/2284))
- **storage:** apply metadata, headers, and cacheControl dedupe to uploadToSignedUrl ([#2275](https://github.com/supabase/supabase-js/pull/2275))
- **storage:** forward duplex option for stream uploads via uploadToSignedUrl ([#2289](https://github.com/supabase/supabase-js/pull/2289))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- oniani1

## 2.104.1 (2026-04-23)

### 🩹 Fixes

- **auth:** emit PASSWORD_RECOVERY event for PKCE recovery flows ([#2272](https://github.com/supabase/supabase-js/pull/2272))
- **postgrest:** restore runtime test files to tstyche scope ([#2266](https://github.com/supabase/supabase-js/pull/2266))
- **supabase:** propagate custom fetch to realtime client ([#2267](https://github.com/supabase/supabase-js/pull/2267))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.104.0 (2026-04-20)

### 🚀 Features

- **storage:** extract shared header normalization utility ([#2251](https://github.com/supabase/supabase-js/pull/2251))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.103.3 (2026-04-16)

### 🩹 Fixes

- **realtime:** throw Error objects instead of bare strings ([#2256](https://github.com/supabase/supabase-js/pull/2256))
- **storage:** correct signedUrl type to allow null in createSignedUrls ([#2254](https://github.com/supabase/supabase-js/pull/2254))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- oniani1

## 2.103.2 (2026-04-15)

### 🩹 Fixes

- **auth:** include Cloudflare error codes in NETWORK_ERROR_CODES ([#2239](https://github.com/supabase/supabase-js/pull/2239))
- **auth:** remove Prettify wrapper from exported types for TypeDoc expansion ([#2250](https://github.com/supabase/supabase-js/pull/2250))
- **misc:** add explicit return types to toJSON methods for JSR compat ([#2252](https://github.com/supabase/supabase-js/pull/2252))
- **storage:** remove client-side signed URL render endpoint normalization ([#2249](https://github.com/supabase/supabase-js/pull/2249))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- Vansh Sharma @Vansh1811

## 2.103.1 (2026-04-15)

### 🩹 Fixes

- **auth:** add toJSON to AuthError for correct JSON serialization ([#2238](https://github.com/supabase/supabase-js/pull/2238))
- **postgrest:** handle bigint rpc ([#2245](https://github.com/supabase/supabase-js/pull/2245))
- **storage:** add toJSON to StorageError for correct JSON serialization ([#2246](https://github.com/supabase/supabase-js/pull/2246))
- **storage:** apply empty transform check to download and getPublicUrl ([#2219](https://github.com/supabase/supabase-js/pull/2219))

### ❤️ Thank You

- oniani1
- Vaibhav @7ttp

## 2.103.0 (2026-04-09)

### 🚀 Features

- **postgrest:** add stripNulls method for null value stripping ([#2189](https://github.com/supabase/supabase-js/pull/2189))
- **storage:** add cacheNonce parameter for download ([#2234](https://github.com/supabase/supabase-js/pull/2234))

### 🩹 Fixes

- **postgrest:** fix scalar computed column type inference for isNotNullable and SETOF scalar ([#2224](https://github.com/supabase/supabase-js/pull/2224))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- Seydi Charyyev @TheSeydiCharyyev
- Vaibhav @7ttp

## 2.102.1 (2026-04-07)

### 🩹 Fixes

- **functions:** add toJSON to FunctionsError for correct JSON serialization ([#2226](https://github.com/supabase/supabase-js/pull/2226))

### ❤️ Thank You

- oniani1

## 2.102.0 (2026-04-07)

### 🚀 Features

- **postgrest:** add automatic retries for transient errors ([#2072](https://github.com/supabase/supabase-js/pull/2072))
- **postgrest:** add success discriminator field to PostgREST response types ([#2198](https://github.com/supabase/supabase-js/pull/2198))
- **supabase:** export PostgrestFilterBuilder and StorageApiError from supabase-js ([#2222](https://github.com/supabase/supabase-js/pull/2222))

### 🩹 Fixes

- **auth:** downgrade console.error to console.warn for missing session ([#2214](https://github.com/supabase/supabase-js/pull/2214))
- **ci:** add --ignore-scripts to platform test installs to block post install attacks ([#2206](https://github.com/supabase/supabase-js/pull/2206))
- **postgrest:** add toJSON to PostgrestError for correct JSON serialization ([#2212](https://github.com/supabase/supabase-js/pull/2212))
- **postgrest:** reject excess properties in insert, update, and upsert ([#2186](https://github.com/supabase/supabase-js/pull/2186))
- **storage:** set correct content-type for uploads ([#2211](https://github.com/supabase/supabase-js/pull/2211))
- **storage:** avoid duplicate content-type headers in vector requests ([#2220](https://github.com/supabase/supabase-js/pull/2220))

### ❤️ Thank You

- Clay
- Guilherme Souza
- Katerina Skroumpelou @mandarini
- oniani1
- Vaibhav @7ttp

## 2.101.1 (2026-03-31)

### 🩹 Fixes

- **storage:** support exactOptionalPropertyTypes ([#2200](https://github.com/supabase/supabase-js/pull/2200))

### ❤️ Thank You

- Vaibhav @7ttp

## 2.101.0 (2026-03-30)

### 🚀 Features

- **realtime:** add `copyBindings` functionality ([#2197](https://github.com/supabase/supabase-js/pull/2197))
- **realtime:** block setting `postgres_changes` event listener after joining ([#2201](https://github.com/supabase/supabase-js/pull/2201))

### ❤️ Thank You

- Dominik Pilipczuk @snickerdoodle2

## 2.100.1 (2026-03-26)

### 🩹 Fixes

- **postgrest:** add type safety for eq() and neq() column names ([#2175](https://github.com/supabase/supabase-js/pull/2175))
- **postgrest:** fix maybeSingle for all request methods by removing Accept header override ([#2182](https://github.com/supabase/supabase-js/pull/2182))
- **postgrest:** narrow tstyche testFileMatch to only type test files ([#2193](https://github.com/supabase/supabase-js/pull/2193))
- **postgrest:** prevent Args: never functions from being classified as computed fields ([#2195](https://github.com/supabase/supabase-js/pull/2195))
- **storage:** spread all DEFAULT_FILE_OPTIONS in uploadToSignedUrl ([#2194](https://github.com/supabase/supabase-js/pull/2194))

### ❤️ Thank You

- Ayush Baluni @aayushbaluni
- Katerina Skroumpelou @mandarini

## 2.100.0 (2026-03-23)

### 🚀 Features

- **realtime:** use phoenix's js lib inside realtime-js ([#2119](https://github.com/supabase/supabase-js/pull/2119))

### 🩹 Fixes

- **auth:** guard navigator lock steal against cascade when lock is stolen by another request ([#2178](https://github.com/supabase/supabase-js/pull/2178))
- **realtime:** revert `vsn` type to `string` ([#2170](https://github.com/supabase/supabase-js/pull/2170))
- **storage:** structural detection on json() to detect Response-like errors ([#2179](https://github.com/supabase/supabase-js/pull/2179))

### ❤️ Thank You

- Alan Guzek @GuzekAlan
- Dominik Pilipczuk @snickerdoodle2
- Katerina Skroumpelou @mandarini

## 2.99.2 (2026-03-16)

### 🩹 Fixes

- **storage:** do not rewrite signed URL to render endpoint for empty transform object ([#2162](https://github.com/supabase/supabase-js/pull/2162))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.99.1 (2026-03-11)

### 🩹 Fixes

- **functions:** add RateLimitError in `Deno.errors` namespace ([#2160](https://github.com/supabase/supabase-js/pull/2160))

### ❤️ Thank You

- 냥냐챠 @nyannyacha

## 2.99.0 (2026-03-09)

### 🚀 Features

- **auth:** add custom OIDC/OAuth provider admin CRUD methods ([#2133](https://github.com/supabase/supabase-js/pull/2133))

### 🩹 Fixes

- **storage:** improve FileObject type accuracy with nullable fields ([#2116](https://github.com/supabase/supabase-js/pull/2116))

### ❤️ Thank You

- Cemal Kılıç @cemalkilic
- Katerina Skroumpelou @mandarini

## 2.98.0 (2026-02-26)

### 🚀 Features

- **auth:** add `token_endpoint_auth_method` to OAuth client create/update ([#2132](https://github.com/supabase/supabase-js/pull/2132))
- **auth:** support custom providers via `custom:` prefix in Provider type ([#2134](https://github.com/supabase/supabase-js/pull/2134))
- **auth:** add currentPassword to UserAttributes type ([#2131](https://github.com/supabase/supabase-js/pull/2131))

### 🩹 Fixes

- **auth:** recover from orphaned navigator locks via steal fallback ([#2106](https://github.com/supabase/supabase-js/pull/2106))
- **auth:** lower lockAcquireTimeout default to 5s and fix stale JSDoc ([#2125](https://github.com/supabase/supabase-js/pull/2125))
- **auth:** fixes userattributes type ([#2139](https://github.com/supabase/supabase-js/pull/2139))
- **realtime:** patch channel join payloads with resolved access token before flushing send buffer ([#2136](https://github.com/supabase/supabase-js/pull/2136))

### ❤️ Thank You

- Cemal Kılıç @cemalkilic
- Elliot Padfield @ElliotPadfield
- Etienne Stalmans @staaldraad
- Katerina Skroumpelou @mandarini

## 2.97.0 (2026-02-18)

### 🚀 Features

- **auth:** add skipAutoInitialize option to prevent constructor auto-init ([#2123](https://github.com/supabase/supabase-js/pull/2123))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.96.0 (2026-02-17)

### 🚀 Features

- **storage:** add setHeader method to BaseApiClient ([#2079](https://github.com/supabase/supabase-js/pull/2079))

### 🩹 Fixes

- **auth:** resolve Firefox content script Promise.then() security errors in locks ([#2112](https://github.com/supabase/supabase-js/pull/2112))
- **postgrest:** enforce type safety for table and view names in from() method ([#2058](https://github.com/supabase/supabase-js/pull/2058))
- **realtime:** remove unnecessary check in `removeChannel` ([#2109](https://github.com/supabase/supabase-js/pull/2109))

### ❤️ Thank You

- David Barrell @dabarrell
- Dominik Pilipczuk @snickerdoodle2
- Katerina Skroumpelou @mandarini
- Vaibhav @7ttp

## 2.95.3 (2026-02-06)

### 🚀 Features

- **supabase:** add canonical CORS headers export for edge functions ([#2071](https://github.com/supabase/supabase-js/pull/2071))

### 🩹 Fixes

- **realtime:** removeChannel when unsubscribe successfully ([#2091](https://github.com/supabase/supabase-js/pull/2091))
- **storage:** expose fetch parameters in download method ([#2090](https://github.com/supabase/supabase-js/pull/2090))

### ❤️ Thank You

- Eduardo Gurgel
- Katerina Skroumpelou @mandarini

## 2.95.0 (2026-02-05)

### 🚀 Features

- **supabase:** add canonical CORS headers export for edge functions ([#2071](https://github.com/supabase/supabase-js/pull/2071))

### 🩹 Fixes

- **realtime:** removeChannel when unsubscribe successfully ([#2091](https://github.com/supabase/supabase-js/pull/2091))
- **storage:** expose fetch parameters in download method ([#2090](https://github.com/supabase/supabase-js/pull/2090))

### ❤️ Thank You

- Eduardo Gurgel
- Katerina Skroumpelou @mandarini

## 2.94.1 (2026-02-04)

### 🩹 Fixes

- **auth:** correct OAuth authorization types to match API responses ([#2088](https://github.com/supabase/supabase-js/pull/2088))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.94.0 (2026-02-03)

### 🚀 Features

- **postgrest:** add URL length validation and timeout protection ([#2078](https://github.com/supabase/supabase-js/pull/2078))

### 🩹 Fixes

- **ci:** handle missing git auth header in release-canary script ([#2077](https://github.com/supabase/supabase-js/pull/2077))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.93.3 (2026-01-29)

### 🩹 Fixes

- **auth:** add webauthn tests and fix fallback naming ([#1763](https://github.com/supabase/supabase-js/pull/1763))
- **ci:** add persist-credentials: false to release job checkouts ([#2074](https://github.com/supabase/supabase-js/pull/2074))
- **storage:** handle empty 200 responses in vector operations ([#2073](https://github.com/supabase/supabase-js/pull/2073))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.93.2 (2026-01-27)

### 🩹 Fixes

- **supabase:** revert client platform and runtime detection headers ([#2067](https://github.com/supabase/supabase-js/pull/2067))

### ❤️ Thank You

- Guilherme Souza

## 2.93.1 (2026-01-26)

### 🩹 Fixes

- **realtime:** revert validate table filter in postgres_changes event dispatch ([#2060](https://github.com/supabase/supabase-js/pull/2060))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.93.0 (2026-01-26)

### 🚀 Features

- **auth:** add optional jwt parameter to getAuthenticatorAssuranceLevel ([#1940](https://github.com/supabase/supabase-js/pull/1940))
- **supabase:** add missing HTTP headers for client platform and runtime detection ([#2046](https://github.com/supabase/supabase-js/pull/2046))

### 🩹 Fixes

- **auth:** handle uncaught promise rejections during initialization ([#2032](https://github.com/supabase/supabase-js/pull/2032))
- **auth:** clear local storage on signOut when session is already missing ([#2026](https://github.com/supabase/supabase-js/pull/2026))
- **realtime:** send heartbeat for initial connection error ([#1746](https://github.com/supabase/supabase-js/pull/1746))
- **realtime:** add generic overload for postgres_changes event type ([#1984](https://github.com/supabase/supabase-js/pull/1984))
- **storage:** expose status and statusCode on StorageError base class ([#2018](https://github.com/supabase/supabase-js/pull/2018))
- **supabase:** safe environment detection node v browser ([#2053](https://github.com/supabase/supabase-js/pull/2053))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- Vaibhav @7ttp

## 2.91.1 (2026-01-23)

### 🩹 Fixes

- **auth:** restore SSR OAuth functionality broken in v2.91.0 ([#2039](https://github.com/supabase/supabase-js/pull/2039))

### ❤️ Thank You

- Vaibhav @7ttp

## 2.91.0 (2026-01-20)

### 🚀 Features

- **realtime:** set default serializer to 2.0.0 ([#2034](https://github.com/supabase/supabase-js/pull/2034))

### 🩹 Fixes

- **auth:** defer subscriber notification in exchangeCodeForSession to prevent deadlock ([#2014](https://github.com/supabase/supabase-js/pull/2014))
- **auth:** clarify updateUserById applies changes directly ([#2031](https://github.com/supabase/supabase-js/pull/2031))
- **supabase:** resolve Firefox extension cross-context Promise error ([#2033](https://github.com/supabase/supabase-js/pull/2033))

### ❤️ Thank You

- Eduardo Gurgel
- Vaibhav @7ttp

## 2.90.1 (2026-01-08)

### 🩹 Fixes

- **postgrest:** prevent shared state between query builder operations ([#1978](https://github.com/supabase/supabase-js/pull/1978))
- **realtime:** validate table filter in postgres_changes event dispatch ([#1999](https://github.com/supabase/supabase-js/pull/1999))

### ❤️ Thank You

- Vaibhav @7ttp

## 2.90.0 (2026-01-07)

### 🚀 Features

- **realtime:** expose heartbeat latency on heartbeat callback ([#1982](https://github.com/supabase/supabase-js/pull/1982))

### 🩹 Fixes

- **auth:** add banned_until property to user type ([#1989](https://github.com/supabase/supabase-js/pull/1989))
- **auth:** add last_challenged_at property to factor type ([#1990](https://github.com/supabase/supabase-js/pull/1990))
- **auth:** clear initial setTimeout in stopAutoRefresh ([#1993](https://github.com/supabase/supabase-js/pull/1993))
- **auth:** preserve session when magic link is clicked twice ([#1996](https://github.com/supabase/supabase-js/pull/1996))
- **auth:** add configurable lock acquisition timeout to prevent deadlocks ([#1962](https://github.com/supabase/supabase-js/pull/1962))
- **functions:** auto-stringify object body when custom Content-Type header is provided ([#1988](https://github.com/supabase/supabase-js/pull/1988))
- **postgrest:** use post with return minimal for rpc head requests with object args ([#1994](https://github.com/supabase/supabase-js/pull/1994))
- **supabase:** split type-only exports to avoid unused import warnings ([#1979](https://github.com/supabase/supabase-js/pull/1979))
- **supabase:** inline string literal in databasewithoutinternals type ([#1986](https://github.com/supabase/supabase-js/pull/1986))
- **supabase:** avoid edge runtime warnings in next.js ([#1998](https://github.com/supabase/supabase-js/pull/1998))

### ❤️ Thank You

- Eduardo Gurgel
- Nico Kempe @nicokempe
- Vaibhav @7ttp
- yoshifumi kondo @yoshifumi-kondo

## 2.89.0 (2025-12-18)

### 🚀 Features

- **auth:** add X (OAuth 2.0) provider ([#1960](https://github.com/supabase/supabase-js/pull/1960))
- **auth:** add string array support for AMR claims ([#1967](https://github.com/supabase/supabase-js/pull/1967))
- **supabase:** export DatabaseWithoutInternals utility type ([#1935](https://github.com/supabase/supabase-js/pull/1935))

### ❤️ Thank You

- Cemal Kılıç @cemalkilic
- issuedat @issuedat
- Vaibhav @7ttp

## 2.88.0 (2025-12-16)

### 🚀 Features

- **auth:** allow custom predicate for detectSessionInUrl option ([#1958](https://github.com/supabase/supabase-js/pull/1958))
- **postgrest:** add notin filter ([#1957](https://github.com/supabase/supabase-js/pull/1957))
- **repo:** migrate build system to tsdown for proper ESM/CJS support ([#1961](https://github.com/supabase/supabase-js/pull/1961))

### 🩹 Fixes

- **realtime:** handle websocket race condition in node.js ([#1946](https://github.com/supabase/supabase-js/pull/1946))
- **realtime:** omit authorization header when no access token exists ([#1937](https://github.com/supabase/supabase-js/pull/1937))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- Vaibhav @7ttp

## 2.87.3 (2025-12-15)

### 🩹 Fixes

- **supabase:** resolve jsDelivr CDN ESM import failure with .js extensions ([#1953](https://github.com/supabase/supabase-js/pull/1953))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.87.2 (2025-12-15)

### 🩹 Fixes

- **auth:** add helpful error when PKCE code verifier is missing ([#1931](https://github.com/supabase/supabase-js/pull/1931))
- **realtime:** terminate web worker on disconnect to prevent memory leak ([#1907](https://github.com/supabase/supabase-js/pull/1907))
- **supabase:** resolve jsDelivr CDN ESM import failure ([#1950](https://github.com/supabase/supabase-js/pull/1950))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- Tanmay Sharma @tanmaysharma2001

## 2.87.1 (2025-12-09)

### 🩹 Fixes

- **auth:** skip navigator lock when persistSession is false ([#1928](https://github.com/supabase/supabase-js/pull/1928))
- **realtime:** preserve custom JWT tokens across channel resubscribe ([#1908](https://github.com/supabase/supabase-js/pull/1908))
- **realtime:** handle null values in postgres changes filter comparison ([#1918](https://github.com/supabase/supabase-js/pull/1918))

### ❤️ Thank You

- Liam
- Vaibhav @7ttp

## 2.87.0 (2025-12-08)

### 🚀 Features

- **storage:** align analytics from method with { data, error } pattern ([#1927](https://github.com/supabase/supabase-js/pull/1927))

### 🩹 Fixes

- **repo:** update lock file after dependabot to use npm 11 ([#1926](https://github.com/supabase/supabase-js/pull/1926))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.86.2 (2025-12-04)

### 🩹 Fixes

- **storage:** correct QueryVectorsResponse to use vectors instead of matches ([#1922](https://github.com/supabase/supabase-js/pull/1922))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.86.1 (2025-12-04)

### 🩹 Fixes

- **auth:** suppress getsession warning when getuser is called first ([#1898](https://github.com/supabase/supabase-js/pull/1898))
- **auth:** code verifier remains in storage during edge cases ([#1759](https://github.com/supabase/supabase-js/pull/1759))
- **postgrest:** cross-schema rpc setof type inference ([#1900](https://github.com/supabase/supabase-js/pull/1900))
- **repo:** update lock file ([#1910](https://github.com/supabase/supabase-js/pull/1910))
- **repo:** lock file issues ([#1919](https://github.com/supabase/supabase-js/pull/1919))
- **repo:** update npm and install again ([#1920](https://github.com/supabase/supabase-js/pull/1920))
- **supabase:** add esm wrapper to resolve module not found error in nuxt ([#1914](https://github.com/supabase/supabase-js/pull/1914))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- Vaibhav @7ttp

## 2.86.0 (2025-11-26)

### 🚀 Features

- **storage:** install iceberg-js and add from method ([#1881](https://github.com/supabase/supabase-js/pull/1881))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.85.0 (2025-11-26)

### 🚀 Features

- **realtime:** add metadata to realtime user broadcast push ([#1894](https://github.com/supabase/supabase-js/pull/1894))

### 🩹 Fixes

- **auth:** oauth minor fixes on types ([#1891](https://github.com/supabase/supabase-js/pull/1891))

### ❤️ Thank You

- Cemal Kılıç @cemalkilic
- Eduardo Gurgel

## 2.84.0 (2025-11-20)

### 🚀 Features

- **postgrest:** add isdistinct and regex pattern matching operators ([#1875](https://github.com/supabase/supabase-js/pull/1875))

### 🩹 Fixes

- **postgrest:** validate empty or invalid relation names in Postgrest… ([#1863](https://github.com/supabase/supabase-js/pull/1863))
- **realtime:** simplify serializer by removing unnecessary types of messages ([#1871](https://github.com/supabase/supabase-js/pull/1871))

### ❤️ Thank You

- Eduardo Gurgel
- Katerina Skroumpelou @mandarini
- Soufiane Radouane @sofmega

## 2.83.0 (2025-11-18)

### 🚀 Features

- **storage:** rename StorageAnalyticsApi to StorageAnalyticsClient ([#1869](https://github.com/supabase/supabase-js/pull/1869))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.82.0 (2025-11-18)

### 🚀 Features

- **auth:** add OAuth grant listing and revocation endpoints ([#1833](https://github.com/supabase/supabase-js/pull/1833))

### 🩹 Fixes

- **postgrest:** bubble up fetch error causes and codes ([#1856](https://github.com/supabase/supabase-js/pull/1856))
- **realtime:** account for null refs when encoding messages ([#1862](https://github.com/supabase/supabase-js/pull/1862))
- **storage:** analytics bucket prop ([#1852](https://github.com/supabase/supabase-js/pull/1852))

### ❤️ Thank You

- Cemal Kılıç @cemalkilic
- Eduardo Gurgel
- Fabrizio @fenos
- Katerina Skroumpelou @mandarini

## 2.81.1 (2025-11-11)

### 🩹 Fixes

- **auth:** use Symbols for callback IDs to resolve Next.js 16 compatibility ([#1847](https://github.com/supabase/supabase-js/pull/1847))
- **auth:** add automatic browser redirect to signInWithSSO ([#1849](https://github.com/supabase/supabase-js/pull/1849))
- **realtime:** setAuth not required on custom jwt token ([#1826](https://github.com/supabase/supabase-js/pull/1826))

### ❤️ Thank You

- Filipe Cabaço @filipecabaco
- Katerina Skroumpelou @mandarini

## 2.81.0 (2025-11-10)

### 🚀 Features

- **realtime:** implement V2 serializer ([#1829](https://github.com/supabase/supabase-js/pull/1829))

### 🩹 Fixes

- **auth:** make webauthn param optional and move register params to webauthn ([#1765](https://github.com/supabase/supabase-js/pull/1765))
- **auth:** add providers type to UserAppMetadata interface ([#1760](https://github.com/supabase/supabase-js/pull/1760))
- **auth:** use direct attestation for registration/authentication ([#1764](https://github.com/supabase/supabase-js/pull/1764))
- **functions:** add configurable timeout and normalize abort/timeout errors as FunctionsFetchError ([#1837](https://github.com/supabase/supabase-js/pull/1837))
- **realtime:** ensure WebSocket connections are properly closed in teardown ([#1841](https://github.com/supabase/supabase-js/pull/1841))

### ❤️ Thank You

- Eduardo Gurgel
- Katerina Skroumpelou @mandarini
- Tanmay Sharma @tanmaysharma2001

## 2.80.0 (2025-11-06)

### 🚀 Features

- **auth:** add TypeScript types for documented JWT claims fields ([#1802](https://github.com/supabase/supabase-js/pull/1802))

### 🩹 Fixes

- **auth:** only warn if multiple clients share a storage-key ([#1767](https://github.com/supabase/supabase-js/pull/1767))

### ❤️ Thank You

- Steve Hall @sh41
- Sumit Kumar @Software-Engineering-Project-Team-Bob

## 2.79.0 (2025-11-04)

### 🚀 Features

- **auth:** support throwing errors instead of returning them ([#1766](https://github.com/supabase/supabase-js/pull/1766))
- **repo:** remove node-fetch dependency, require Node.js 20+ ([#1830](https://github.com/supabase/supabase-js/pull/1830))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.78.0 (2025-10-30)

### 🚀 Features

- **auth:** add OAuth 2.1 authorization consent management API calls ([#1793](https://github.com/supabase/supabase-js/pull/1793))
- **auth:** add OAuth client update support ([#1812](https://github.com/supabase/supabase-js/pull/1812))
- **auth:** refactor getAuthenticatorAssuranceLevel method ([#1822](https://github.com/supabase/supabase-js/pull/1822))

### 🩹 Fixes

- **auth:** remove redirection in `getAuthorizationDetails` ([#1811](https://github.com/supabase/supabase-js/pull/1811))
- **auth:** move session warning proxy from session to user object ([#1817](https://github.com/supabase/supabase-js/pull/1817))

### ❤️ Thank You

- Cemal Kılıç @cemalkilic
- Katerina Skroumpelou @mandarini
- Stojan Dimitrovski @hf

## 2.77.0 (2025-10-29)

### 🚀 Features

- **auth:** add OAuth 2.1 authorization consent management API calls ([#1793](https://github.com/supabase/supabase-js/pull/1793))
- **auth:** add OAuth client update support ([#1812](https://github.com/supabase/supabase-js/pull/1812))
- **storage:** add support for bucket pagination and sorting ([#1790](https://github.com/supabase/supabase-js/pull/1790))

### 🩹 Fixes

- **auth:** handle 204 No Content response in OAuth client delete ([#1786](https://github.com/supabase/supabase-js/pull/1786))
- **auth:** remove redirection in `getAuthorizationDetails` ([#1811](https://github.com/supabase/supabase-js/pull/1811))
- **postgrest:** add incoming major 14 support ([#1807](https://github.com/supabase/supabase-js/pull/1807))
- **repo:** add missing tslib dependency to core packages ([#1789](https://github.com/supabase/supabase-js/pull/1789))
- **repo:** cleanup package-lock.json and bun.lock ([#1799](https://github.com/supabase/supabase-js/pull/1799))
- **storage:** remove unnecessary filter ([#1809](https://github.com/supabase/supabase-js/pull/1809))

### 🔥 Performance

- precompile RegExp ([#1806](https://github.com/supabase/supabase-js/pull/1806))

### ❤️ Thank You

- Andrew Valleteau @avallete
- Cemal Kılıç @cemalkilic
- Fabrizio @fenos
- Katerina Skroumpelou @mandarini
- Kevin Grüneberg @kevcodez
- Lenny @itslenny

## 2.76.1 (2025-10-21)

### 🩹 Fixes

- **repo:** add missing tslib dependency to core packages ([#1789](https://github.com/supabase/supabase-js/pull/1789))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.76.0 (2025-10-20)

### 🚀 Features

- **realtime:** realtime explicit REST call ([#1751](https://github.com/supabase/supabase-js/pull/1751))
- **realtime:** enhance RealtimeChannel type ([#1747](https://github.com/supabase/supabase-js/pull/1747))
- **storage:** storage vectors and analytics in storage-js ([#1752](https://github.com/supabase/supabase-js/pull/1752))

### 🩹 Fixes

- **functions:** missing body when Content-Type header supplied by dev ([#1758](https://github.com/supabase/supabase-js/pull/1758))
- **functions:** add application/pdf response parsing to FunctionsClient ([#1757](https://github.com/supabase/supabase-js/pull/1757))
- **realtime:** manipulate URLs using URL object ([#1769](https://github.com/supabase/supabase-js/pull/1769))
- **repo:** convert postbuild to explicit codegen ([#1778](https://github.com/supabase/supabase-js/pull/1778))
- **storage:** correct list v2 types to correctly match data returned from api ([#1761](https://github.com/supabase/supabase-js/pull/1761))
- **storage:** use backward compatible return type in download function ([#1750](https://github.com/supabase/supabase-js/pull/1750))
- **storage:** api types ([#1784](https://github.com/supabase/supabase-js/pull/1784))

### ❤️ Thank You

- Fabrizio @fenos
- Filipe Cabaço @filipecabaco
- Guilherme Souza
- Katerina Skroumpelou @mandarini
- Lenny @itslenny

## 2.75.1 (2025-10-17)

### 🩹 Fixes

- **storage:** use backward compatible return type in download function ([#1750](https://github.com/supabase/supabase-js/pull/1750))

### ❤️ Thank You

- Lenny @itslenny

## 2.75.0 (2025-10-09)

### 🚀 Features

- **postgrest:** add embeded functions type inference ([#1632](https://github.com/supabase/supabase-js/pull/1632))

### ❤️ Thank You

- Andrew Valleteau @avallete

## 2.74.0 (2025-10-07)

### 🚀 Features

- **auth:** add deprecation notice to `onAuthStateChange` with async function ([#1580](https://github.com/supabase/supabase-js/pull/1580))
- **auth:** add OAuth 2.1 client admin endpoints ([#1582](https://github.com/supabase/supabase-js/pull/1582))
- **docs:** explicitly mark options as optional ([#1622](https://github.com/supabase/supabase-js/pull/1622))
- **realtime:** add support to configure Broadcast Replay ([#1623](https://github.com/supabase/supabase-js/pull/1623))
- **release:** enable trusted publishing ([#1592](https://github.com/supabase/supabase-js/pull/1592))
- **storage:** add support for sorting to list v2 ([#1606](https://github.com/supabase/supabase-js/pull/1606))

### 🩹 Fixes

- **storage:** remove trailing slash from baseUrl normalization ([#1589](https://github.com/supabase/supabase-js/pull/1589))

### ❤️ Thank You

- Cemal Kılıç @cemalkilic
- Doğukan Akkaya
- Eduardo Gurgel
- Etienne Stalmans @staaldraad
- Lenny @itslenny
- Stojan Dimitrovski @hf
- Taketo Yoshida
