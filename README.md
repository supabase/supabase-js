# Supabase JS Client Libraries

_The Supabase JS monorepo containing all the Supabase JavaScript client libraries._

> **📣 Coming from our old repositories?** The `supabase-js` repository has been converted into a monorepo and all other client libraries have been absorbed into it. If you previously contributed to individual repositories like `auth-js`, `postgrest-js`, `realtime-js`, `storage-js`, or `functions-js`, please see our **[Migration Guide](./docs/MIGRATION.md)** to learn about the new structure and workflows.

## 📦 Libraries

This monorepo contains the complete suite of Supabase JavaScript client libraries:

| Library                                                    | Description                              |
| ---------------------------------------------------------- | ---------------------------------------- |
| **[@supabase/supabase-js](./packages/core/supabase-js)**   | Main isomorphic client for Supabase      |
| **[@supabase/auth-js](./packages/core/auth-js)**           | Authentication client                    |
| **[@supabase/postgrest-js](./packages/core/postgrest-js)** | PostgREST client for database operations |
| **[@supabase/realtime-js](./packages/core/realtime-js)**   | Real-time subscriptions client           |
| **[@supabase/storage-js](./packages/core/storage-js)**     | File storage client                      |
| **[@supabase/functions-js](./packages/core/functions-js)** | Edge Functions client                    |

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/supabase/supabase-js.git
cd supabase-js

# Install dependencies
npm install

# Build all packages
npx nx run-many --target=build --all

```

## 🏗️ Development

### Workspace Commands

```bash
# Build a specific library
npx nx build auth-js

# Test a specific library
npx nx test postgrest-js

# Build affected projects (only build what changed)
npx nx affected --target=build

# Generate dependency graph
npx nx graph

# Format all code
npx nx format

# Check code formatting
npx nx format:check
```

### Working with Individual Libraries

Each library can be developed independently:

```bash
# Start development with watch mode
npx nx build auth-js --watch
npx nx test auth-js --watch
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./docs/CONTRIBUTING.md) for details.

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

Quick examples:

```bash
# Run tests for a specific package
npx nx test <package-name>

# Run tests with coverage
npx nx test <package-name> --coverage
```

## 📚 Documentation

### API Documentation

- **[Auth Client](./packages/core/auth-js/README.md)** - Authentication and user management
- **[Database Client](./packages/core/postgrest-js/README.md)** - Database queries and operations
- **[Realtime Client](./packages/core/realtime-js/README.md)** - Real-time subscriptions
- **[Storage Client](./packages/core/storage-js/README.md)** - File upload and management
- **[Functions Client](./packages/core/functions-js/README.md)** - Edge Functions invocation
- **[Main Client](./packages/core/supabase-js/README.md)** - Combined client library

### Architecture Documentation

- **[Contributing](./docs/CONTRIBUTING.md)** - Development guidelines
- **[Release Workflows](./docs/RELEASE.md)** - Release and publishing process
- **[Migration Guide](./docs/MIGRATION.md)** - Migrating to the monorepo structure
- **[Security Policy](./docs/SECURITY.md)** - Security guidelines and reporting

## 🏛️ Architecture

### Monorepo Structure

```tree
supabase-js/
├── packages/
│   └── core/                  # Published libraries
│       ├── auth-js/           # Authentication client
│       ├── functions-js/      # Edge Functions client
│       ├── postgrest-js/      # PostgREST database client
│       ├── realtime-js/       # Real-time subscriptions client
│       ├── storage-js/        # File storage client
│       └── supabase-js/       # Main isomorphic client
├── nx.json                    # npx nx workspace configuration
├── package.json               # Root package.json and workspaces setup
└── ...
```

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
