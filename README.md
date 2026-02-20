<br />
<p align="center">
  <a href="https://supabase.io">
        <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--light.svg">
      <img alt="Supabase Logo" width="300" src="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/logo-preview.jpg">
    </picture>
  </a>

  <h1 align="center">Supabase JS SDK</h1>

  <p align="center">
    <a href="https://supabase.com/docs/guides/getting-started">Guides</a>
    ·
    <a href="https://supabase.com/docs/reference/javascript/introduction">Reference Docs</a>
  </p>
</p>

<div align="center">

[![Build](https://github.com/supabase/supabase-js/workflows/CI/badge.svg)](https://github.com/supabase/supabase-js/actions?query=branch%3Amaster)
[![Package](https://img.shields.io/npm/v/@supabase/supabase-js)](https://www.npmjs.com/package/@supabase/postgrest-js)
[![License: MIT](https://img.shields.io/npm/l/@supabase/supabase-js)](#license)
[![pkg.pr.new](https://pkg.pr.new/badge/supabase/supabase-js)](https://pkg.pr.new/~/supabase/supabase-js)

</div>

> **For contributors: Repository Structure Changed**
>
> This repository has been restructured as a monorepo. All libraries, including `supabase-js` itself, have moved to `packages/core/`:
>
> | What You're Looking For | Where It Is Now              |
> | ----------------------- | ---------------------------- |
> | Main supabase-js code   | `packages/core/supabase-js/` |
> | Other libraries         | `packages/core/*/`           |
>
> Read the **[Migration Guide](./docs/MIGRATION.md)** to learn more.

## 📦 Libraries

This monorepo contains the complete suite of Supabase JavaScript SDK:

| Library                                                    | Description                           |
| ---------------------------------------------------------- | ------------------------------------- |
| **[@supabase/supabase-js](./packages/core/supabase-js)**   | Main isomorphic SDK for Supabase      |
| **[@supabase/auth-js](./packages/core/auth-js)**           | Authentication SDK                    |
| **[@supabase/postgrest-js](./packages/core/postgrest-js)** | PostgREST SDK for database operations |
| **[@supabase/realtime-js](./packages/core/realtime-js)**   | Real-time subscriptions SDK           |
| **[@supabase/storage-js](./packages/core/storage-js)**     | File storage SDK                      |
| **[@supabase/functions-js](./packages/core/functions-js)** | Edge Functions SDK                    |

## Support Policy

This section outlines the scope of support for various runtime environments in Supabase JavaScript client.

### Node.js

We only support Node.js versions that are in **Active LTS** or **Maintenance** status as defined by the [official Node.js release schedule](https://nodejs.org/en/about/previous-releases#release-schedule). This means we support versions that are currently receiving long-term support and critical bug fixes.

When a Node.js version reaches end-of-life and is no longer in Active LTS or Maintenance status, Supabase will drop it in a **minor release**, and **this won't be considered a breaking change**.

> ⚠️ **Node.js 18 Deprecation Notice**
>
> Node.js 18 reached end-of-life on April 30, 2025. As announced in [our deprecation notice](https://github.com/orgs/supabase/discussions/37217), support for Node.js 18 was dropped in version `2.79.0`.
>
> If you must use Node.js 18, please use version `2.78.0`, which is the last version that supported Node.js 18.

### Deno

We support Deno versions that are currently receiving active development and security updates. We follow the [official Deno release schedule](https://docs.deno.com/runtime/fundamentals/stability_and_releases/) and only support versions from the `stable` and `lts` release channels.

When a Deno version reaches end-of-life and is no longer receiving security updates, Supabase will drop it in a **minor release**, and **this won't be considered a breaking change**.

### Browsers

All modern browsers are supported. We support browsers that provide native `fetch` API. For Realtime features, browsers must also support native `WebSocket` API.

### Bun

We support Bun runtime environments. Bun provides native fetch support and is compatible with Node.js APIs. Since Bun does not follow a structured release schedule like Node.js or Deno, we support current stable versions of Bun and may drop support for older versions in minor releases without considering it a breaking change.

### React Native

We support React Native environments with fetch polyfills provided by the framework. Since React Native does not follow a structured release schedule, we support current stable versions and may drop support for older versions in minor releases without considering it a breaking change.

### Cloudflare Workers

We support Cloudflare Workers runtime environments. Cloudflare Workers provides native fetch support. Since Cloudflare Workers does not follow a structured release schedule, we support current stable versions and may drop support for older versions in minor releases without considering it a breaking change.

### Important Notes

- **Experimental features**: Features marked as experimental may be removed or changed without notice

## 🚀 Quick Start

### Installation

```bash
npm install @supabase/supabase-js
```

Read more in each package's README file.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** and add tests
4. **Run tests** (`npx nx affected --target=test`)
5. **Commit your changes** (`npm run commit`)
6. **Push to your branch** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

### Development Guidelines

- Follow [conventional commits](https://www.conventionalcommits.org/) for commit messages
- Add tests for new functionality
- Update documentation for API changes
- Run `npx nx format` before committing
- Ensure all tests pass with `npx nx affected --target=test`

## 🧪 Testing

Testing varies per package. See the top-level [TESTING.md](docs/TESTING.md) for an overview and links to package-specific guides.

## 📚 Documentation

### API Documentation

- **[Auth SDK](./packages/core/auth-js/README.md)** - Authentication and user management
- **[Database SDK](./packages/core/postgrest-js/README.md)** - Database queries and operations
- **[Realtime SDK](./packages/core/realtime-js/README.md)** - Real-time subscriptions
- **[Storage SDK](./packages/core/storage-js/README.md)** - File upload and management
- **[Functions SDK](./packages/core/functions-js/README.md)** - Edge Functions invocation
- **[Main SDK](./packages/core/supabase-js/README.md)** - Combined SDK

### Architecture Documentation

- **[Contributing](./CONTRIBUTING.md)** - Development guidelines
- **[Release Workflows](./docs/RELEASE.md)** - Release and publishing process
- **[Migration Guide](./docs/MIGRATION.md)** - Migrating to the monorepo structure
- **[Security Policy](./docs/SECURITY.md)** - Security guidelines and reporting

## 🔐 Verifying provenance attestations

You can verify registry signatures and provenance attestations for installed packages using the npm CLI:

```bash
npm audit signatures
```

Quick example for a single package install:

```bash
npm install @supabase/auth-js
npm audit signatures
```

Example output:

```text
audited 1 package in 0s

1 package has a verified registry signature
```

Because provenance attestations are a new capability, security features may evolve over time. Ensure you are using the latest npm CLI to verify attestation signatures reliably. This may require updating npm beyond the version bundled with Node.js.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🆘 Support

- **Documentation**: [supabase.com/docs](https://supabase.com/docs)
- **Community**: [GitHub Discussions](https://github.com/supabase/supabase/discussions)
- **Issues**: [GitHub Issues](https://github.com/supabase/supabase-js/issues)
- **Discord**: [Supabase Discord](https://discord.supabase.com)

---

<div align="center">

**[Website](https://supabase.com) • [Documentation](https://supabase.com/docs) • [Community](https://github.com/supabase/supabase/discussions) • [Twitter](https://twitter.com/supabase)**

</div>
