## 2.110.8 (2026-07-21)

### 🩹 Fixes

- **supabase:** skip Node warning in Deno ([#2541](https://github.com/supabase/supabase-js/pull/2541))

### ❤️ Thank You

- Vaibhav @7ttp

## 2.110.7 (2026-07-16)

### 🩹 Fixes

- **realtime:** trigger set auth on INITIAL_SESSION event ([#2531](https://github.com/supabase/supabase-js/pull/2531))

### ❤️ Thank You

- Filipe Cabaço @filipecabaco

## 2.110.6 (2026-07-15)

### 🩹 Fixes

- **supabase:** warn instead of throw for unrecognized sb_ API key subtypes ([#2526](https://github.com/supabase/supabase-js/pull/2526))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.110.5 (2026-07-14)

### 🩹 Fixes

- **supabase:** avoid edge runtime warning ([#2522](https://github.com/supabase/supabase-js/pull/2522))

### ❤️ Thank You

- Vaibhav @7ttp

## 2.110.4 (2026-07-14)

### 🩹 Fixes

- **functions:** stop sending API key in Authorization header for function calls ([#2511](https://github.com/supabase/supabase-js/pull/2511))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.110.3 (2026-07-13)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.110.2 (2026-07-09)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.110.1 (2026-07-07)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.110.0 (2026-06-30)

### 🚀 Features

- **repo:** drop Node.js 20 support ([#2482](https://github.com/supabase/supabase-js/pull/2482))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.109.0 (2026-06-30)

### 🩹 Fixes

- **realtime:** pin @supabase/phoenix and browser test CDN deps ([#2457](https://github.com/supabase/supabase-js/pull/2457))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.108.2 (2026-06-15)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.108.0 (2026-06-08)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.107.0 (2026-06-02)

### 🚀 Features

- **auth:** remove navigator.locks-based mutex; introduce commit guard + dispose() ([#2392](https://github.com/supabase/supabase-js/pull/2392))
- **supabase:** update X-Client-Info to structured metadata format ([#2359](https://github.com/supabase/supabase-js/pull/2359))
- **realtime:** allow httpSend to send binary payload ([#2400](https://github.com/supabase/supabase-js/pull/2400))

### ❤️ Thank You

- Claude Sonnet 4.6
- Eduardo Gurgel
- Guilherme Souza
- Katerina Skroumpelou @mandarini
- Omar Al Matar @Bewinxed

## 2.106.2 (2026-05-25)

### 🩹 Fixes

- **misc:** add react-native export condition for Hermes-safe resolution ([#2393](https://github.com/supabase/supabase-js/pull/2393))

### ❤️ Thank You

- Myroslav Hryhschenko @BLOCKMATERIAL

## 2.106.1 (2026-05-20)

### 🩹 Fixes

- **misc:** hide dynamic import from hermesc ([#2381](https://github.com/supabase/supabase-js/pull/2381))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.106.0 (2026-05-18)

### 🚀 Features

- **supabase:** W3C/OpenTelemetry trace context propagation ([#2163](https://github.com/supabase/supabase-js/pull/2163))

### 🩹 Fixes

- **release:** mark @supabase/tracing private and snapshot it for JSR ([#2370](https://github.com/supabase/supabase-js/pull/2370))

### ❤️ Thank You

- Claude Sonnet 4.5
- Guilherme Souza
- Katerina Skroumpelou @mandarini

## 2.105.4 (2026-05-08)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.105.2 (2026-05-04)

### 🩹 Fixes

- **auth:** forward lockAcquireTimeout to SupabaseAuthClient ([#2309](https://github.com/supabase/supabase-js/pull/2309))
- **misc:** widen enum-like unions with (string & {}) for forward compat ([#2303](https://github.com/supabase/supabase-js/pull/2303))

### ❤️ Thank You

- Muzzaiyyan Hussain @MuzzaiyyanHussain

## 2.105.1 (2026-04-28)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.105.0 (2026-04-27)

### 🚀 Features

- **auth:** add passkey support with WebAuthn registration, authentication, and management ([#2283](https://github.com/supabase/supabase-js/pull/2283))
- **realtime:** Realtime deferred disconnect ([#2282](https://github.com/supabase/supabase-js/pull/2282))

## 2.104.1 (2026-04-23)

### 🩹 Fixes

- **supabase:** propagate custom fetch to realtime client ([#2267](https://github.com/supabase/supabase-js/pull/2267))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.104.0 (2026-04-20)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.103.3 (2026-04-16)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.103.2 (2026-04-15)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.103.1 (2026-04-15)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.103.0 (2026-04-09)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.102.1 (2026-04-07)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.102.0 (2026-04-07)

### 🚀 Features

- **supabase:** export PostgrestFilterBuilder and StorageApiError from supabase-js ([#2222](https://github.com/supabase/supabase-js/pull/2222))
- **postgrest:** add automatic retries for transient errors ([#2072](https://github.com/supabase/supabase-js/pull/2072))

### ❤️ Thank You

- Guilherme Souza
- Katerina Skroumpelou @mandarini

## 2.101.1 (2026-03-31)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.101.0 (2026-03-30)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.100.1 (2026-03-26)

### 🩹 Fixes

- **postgrest:** narrow tstyche testFileMatch to only type test files ([#2193](https://github.com/supabase/supabase-js/pull/2193))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.100.0 (2026-03-23)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.99.2 (2026-03-16)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.99.1 (2026-03-11)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.99.0 (2026-03-09)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.98.0 (2026-02-26)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.97.0 (2026-02-18)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.96.0 (2026-02-17)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.95.3 (2026-02-06)

### 🚀 Features

- **supabase:** add canonical CORS headers export for edge functions ([#2071](https://github.com/supabase/supabase-js/pull/2071))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.95.0 (2026-02-05)

### 🚀 Features

- **supabase:** add canonical CORS headers export for edge functions ([#2071](https://github.com/supabase/supabase-js/pull/2071))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.94.1 (2026-02-04)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.94.0 (2026-02-03)

### 🚀 Features

- **postgrest:** add URL length validation and timeout protection ([#2078](https://github.com/supabase/supabase-js/pull/2078))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.93.3 (2026-01-29)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.93.2 (2026-01-27)

### 🩹 Fixes

- **supabase:** revert client platform and runtime detection headers ([#2067](https://github.com/supabase/supabase-js/pull/2067))

### ❤️ Thank You

- Guilherme Souza

## 2.93.1 (2026-01-26)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.93.0 (2026-01-26)

### 🚀 Features

- **supabase:** add missing HTTP headers for client platform and runtime detection ([#2046](https://github.com/supabase/supabase-js/pull/2046))

### 🩹 Fixes

- **supabase:** safe environment detection node v browser ([#2053](https://github.com/supabase/supabase-js/pull/2053))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.91.1 (2026-01-23)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.91.0 (2026-01-20)

### 🩹 Fixes

- **supabase:** resolve Firefox extension cross-context Promise error ([#2033](https://github.com/supabase/supabase-js/pull/2033))

### ❤️ Thank You

- Vaibhav @7ttp

## 2.90.1 (2026-01-08)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.90.0 (2026-01-07)

### 🩹 Fixes

- **supabase:** avoid edge runtime warnings in next.js ([#1998](https://github.com/supabase/supabase-js/pull/1998))
- **supabase:** inline string literal in databasewithoutinternals type ([#1986](https://github.com/supabase/supabase-js/pull/1986))
- **supabase:** split type-only exports to avoid unused import warnings ([#1979](https://github.com/supabase/supabase-js/pull/1979))

### ❤️ Thank You

- Nico Kempe @nicokempe
- Vaibhav @7ttp

## 2.89.0 (2025-12-18)

### 🚀 Features

- **supabase:** export DatabaseWithoutInternals utility type ([#1935](https://github.com/supabase/supabase-js/pull/1935))

### ❤️ Thank You

- Vaibhav @7ttp

## 2.88.0 (2025-12-16)

### 🚀 Features

- **repo:** migrate build system to tsdown for proper ESM/CJS support ([#1961](https://github.com/supabase/supabase-js/pull/1961))
- **auth:** allow custom predicate for detectSessionInUrl option ([#1958](https://github.com/supabase/supabase-js/pull/1958))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.87.3 (2025-12-15)

### 🩹 Fixes

- **supabase:** resolve jsDelivr CDN ESM import failure with .js extensions ([#1953](https://github.com/supabase/supabase-js/pull/1953))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.87.2 (2025-12-15)

### 🩹 Fixes

- **supabase:** resolve jsDelivr CDN ESM import failure ([#1950](https://github.com/supabase/supabase-js/pull/1950))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.87.1 (2025-12-09)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.87.0 (2025-12-08)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.86.2 (2025-12-04)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.86.1 (2025-12-04)

### 🩹 Fixes

- **repo:** update npm and install again ([#1920](https://github.com/supabase/supabase-js/pull/1920))
- **supabase:** add esm wrapper to resolve module not found error in nuxt ([#1914](https://github.com/supabase/supabase-js/pull/1914))
- **postgrest:** cross-schema rpc setof type inference ([#1900](https://github.com/supabase/supabase-js/pull/1900))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- Vaibhav @7ttp

## 2.86.0 (2025-11-26)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.85.0 (2025-11-26)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.84.0 (2025-11-20)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.83.0 (2025-11-18)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.82.0 (2025-11-18)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.81.1 (2025-11-11)

### 🩹 Fixes

- **realtime:** setAuth not required on custom jwt token ([#1826](https://github.com/supabase/supabase-js/pull/1826))

### ❤️ Thank You

- Filipe Cabaço @filipecabaco

## 2.81.0 (2025-11-10)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.80.0 (2025-11-06)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.79.0 (2025-11-04)

### 🚀 Features

- **repo:** remove node-fetch dependency, require Node.js 20+ ([#1830](https://github.com/supabase/supabase-js/pull/1830))
- **auth:** support throwing errors instead of returning them ([#1766](https://github.com/supabase/supabase-js/pull/1766))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.78.0 (2025-10-30)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## v2.77.0 (2025-10-29)

### 🩹 Fixes

- **repo:** cleanup package-lock.json and bun.lock ([#1799](https://github.com/supabase/supabase-js/pull/1799))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.76.1 (2025-10-21)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.76.0 (2025-10-20)

### 🚀 Features

- **storage:** storage vectors and analytics in storage-js ([#1752](https://github.com/supabase/supabase-js/pull/1752))

### 🩹 Fixes

- **repo:** convert postbuild to explicit codegen ([#1778](https://github.com/supabase/supabase-js/pull/1778))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.75.1 (2025-10-17)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.

## 2.75.0 (2025-10-09)

### 🚀 Features

- **postgrest:** add embeded functions type inference ([#1632](https://github.com/supabase/supabase-js/pull/1632))

### ❤️ Thank You

- Andrew Valleteau @avallete

## 2.74.0 (2025-10-07)

This was a version bump only for @supabase/supabase-js to align it with other projects, there were no code changes.
