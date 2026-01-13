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
