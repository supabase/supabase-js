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
