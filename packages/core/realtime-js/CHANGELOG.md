## 2.100.0 (2026-03-23)

### 🚀 Features

- **realtime:** use phoenix's js lib inside realtime-js ([#2119](https://github.com/supabase/supabase-js/pull/2119))

### 🩹 Fixes

- **realtime:** revert `vsn` type to `string` ([#2170](https://github.com/supabase/supabase-js/pull/2170))

### ❤️ Thank You

- Alan Guzek @GuzekAlan
- Dominik Pilipczuk @snickerdoodle2

## 2.99.2 (2026-03-16)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.99.1 (2026-03-11)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.99.0 (2026-03-09)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.98.0 (2026-02-26)

### 🩹 Fixes

- **realtime:** patch channel join payloads with resolved access token before flushing send buffer ([#2136](https://github.com/supabase/supabase-js/pull/2136))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.97.0 (2026-02-18)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.96.0 (2026-02-17)

### 🩹 Fixes

- **realtime:** remove unnecessary check in `removeChannel` ([#2109](https://github.com/supabase/supabase-js/pull/2109))

### ❤️ Thank You

- Dominik Pilipczuk @snickerdoodle2

## 2.95.3 (2026-02-06)

### 🩹 Fixes

- **realtime:** removeChannel when unsubscribe successfully ([#2091](https://github.com/supabase/supabase-js/pull/2091))

### ❤️ Thank You

- Eduardo Gurgel

## 2.95.0 (2026-02-05)

### 🩹 Fixes

- **realtime:** removeChannel when unsubscribe successfully ([#2091](https://github.com/supabase/supabase-js/pull/2091))

### ❤️ Thank You

- Eduardo Gurgel

## 2.94.1 (2026-02-04)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.94.0 (2026-02-03)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.93.3 (2026-01-29)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.93.2 (2026-01-27)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.93.1 (2026-01-26)

### 🩹 Fixes

- **realtime:** revert validate table filter in postgres_changes event dispatch ([#2060](https://github.com/supabase/supabase-js/pull/2060))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.93.0 (2026-01-26)

### 🩹 Fixes

- **realtime:** add generic overload for postgres_changes event type ([#1984](https://github.com/supabase/supabase-js/pull/1984))
- **realtime:** send heartbeat for initial connection error ([#1746](https://github.com/supabase/supabase-js/pull/1746))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- Vaibhav @7ttp

## 2.91.1 (2026-01-23)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.91.0 (2026-01-20)

### 🚀 Features

- **realtime:** set default serializer to 2.0.0 ([#2034](https://github.com/supabase/supabase-js/pull/2034))

### ❤️ Thank You

- Eduardo Gurgel

## 2.90.1 (2026-01-08)

### 🩹 Fixes

- **realtime:** validate table filter in postgres_changes event dispatch ([#1999](https://github.com/supabase/supabase-js/pull/1999))

### ❤️ Thank You

- Vaibhav @7ttp

## 2.90.0 (2026-01-07)

### 🚀 Features

- **realtime:** expose heartbeat latency on heartbeat callback ([#1982](https://github.com/supabase/supabase-js/pull/1982))

### 🩹 Fixes

- **supabase:** avoid edge runtime warnings in next.js ([#1998](https://github.com/supabase/supabase-js/pull/1998))

### ❤️ Thank You

- Eduardo Gurgel
- Vaibhav @7ttp

## 2.89.0 (2025-12-18)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.88.0 (2025-12-16)

### 🚀 Features

- **repo:** migrate build system to tsdown for proper ESM/CJS support ([#1961](https://github.com/supabase/supabase-js/pull/1961))

### 🩹 Fixes

- **realtime:** omit authorization header when no access token exists ([#1937](https://github.com/supabase/supabase-js/pull/1937))
- **realtime:** handle websocket race condition in node.js ([#1946](https://github.com/supabase/supabase-js/pull/1946))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini
- Vaibhav @7ttp

## 2.87.3 (2025-12-15)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.87.2 (2025-12-15)

### 🩹 Fixes

- **realtime:** terminate web worker on disconnect to prevent memory leak ([#1907](https://github.com/supabase/supabase-js/pull/1907))

### ❤️ Thank You

- Tanmay Sharma @tanmaysharma2001

## 2.87.1 (2025-12-09)

### 🩹 Fixes

- **realtime:** handle null values in postgres changes filter comparison ([#1918](https://github.com/supabase/supabase-js/pull/1918))
- **realtime:** preserve custom JWT tokens across channel resubscribe ([#1908](https://github.com/supabase/supabase-js/pull/1908))

### ❤️ Thank You

- Liam
- Vaibhav @7ttp

## 2.87.0 (2025-12-08)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.86.2 (2025-12-04)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.86.1 (2025-12-04)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.86.0 (2025-11-26)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.85.0 (2025-11-26)

### 🚀 Features

- **realtime:** add metadata to realtime user broadcast push ([#1894](https://github.com/supabase/supabase-js/pull/1894))

### ❤️ Thank You

- Eduardo Gurgel

## 2.84.0 (2025-11-20)

### 🩹 Fixes

- **realtime:** simplify serializer by removing unnecessary types of messages ([#1871](https://github.com/supabase/supabase-js/pull/1871))

### ❤️ Thank You

- Eduardo Gurgel

## 2.83.0 (2025-11-18)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.82.0 (2025-11-18)

### 🩹 Fixes

- **realtime:** account for null refs when encoding messages ([#1862](https://github.com/supabase/supabase-js/pull/1862))

### ❤️ Thank You

- Eduardo Gurgel

## 2.81.1 (2025-11-11)

### 🩹 Fixes

- **realtime:** setAuth not required on custom jwt token ([#1826](https://github.com/supabase/supabase-js/pull/1826))

### ❤️ Thank You

- Filipe Cabaço @filipecabaco

## 2.81.0 (2025-11-10)

### 🚀 Features

- **realtime:** implement V2 serializer ([#1829](https://github.com/supabase/supabase-js/pull/1829))

### 🩹 Fixes

- **realtime:** ensure WebSocket connections are properly closed in teardown ([#1841](https://github.com/supabase/supabase-js/pull/1841))

### ❤️ Thank You

- Eduardo Gurgel
- Tanmay Sharma @tanmaysharma2001

## 2.80.0 (2025-11-06)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.79.0 (2025-11-04)

### 🚀 Features

- **repo:** remove node-fetch dependency, require Node.js 20+ ([#1830](https://github.com/supabase/supabase-js/pull/1830))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.78.0 (2025-10-30)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## v2.77.0 (2025-10-29)

### 🩹 Fixes

- **repo:** add missing tslib dependency to core packages ([#1789](https://github.com/supabase/supabase-js/pull/1789))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.76.1 (2025-10-21)

### 🩹 Fixes

- **repo:** add missing tslib dependency to core packages ([#1789](https://github.com/supabase/supabase-js/pull/1789))

### ❤️ Thank You

- Katerina Skroumpelou @mandarini

## 2.76.0 (2025-10-20)

### 🚀 Features

- **realtime:** enhance RealtimeChannel type ([#1747](https://github.com/supabase/supabase-js/pull/1747))
- **realtime:** realtime explicit REST call ([#1751](https://github.com/supabase/supabase-js/pull/1751))

### 🩹 Fixes

- **realtime:** manipulate URLs using URL object ([#1769](https://github.com/supabase/supabase-js/pull/1769))

### ❤️ Thank You

- Filipe Cabaço @filipecabaco
- Guilherme Souza
- Katerina Skroumpelou @mandarini

## 2.75.1 (2025-10-17)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.75.0 (2025-10-09)

This was a version bump only for @supabase/realtime-js to align it with other projects, there were no code changes.

## 2.74.0 (2025-10-07)

### 🚀 Features

- **realtime:** add support to configure Broadcast Replay ([#1623](https://github.com/supabase/supabase-js/pull/1623))

### ❤️ Thank You

- Eduardo Gurgel
