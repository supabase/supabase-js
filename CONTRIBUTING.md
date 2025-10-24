# Contributing to Supabase JS Libraries

Thank you for your interest in contributing to the Supabase JavaScript SDK! This guide will help you get started with contributing to the Supabase JS monorepo.

> **Repository Structure Changed:** This repository has been restructured as a monorepo. **All libraries, including `supabase-js`, are now under `packages/core/`**. If you previously contributed to `supabase-js`, `auth-js`, `postgrest-js`, `realtime-js`, `storage-js`, or `functions-js`, please read our **[Migration Guide](docs/MIGRATION.md)** to understand:
>
> - Where your code moved (everything is now in `packages/core/<library-name>/`)
> - How commands changed (`npm test` → `npx nx test <library-name>`)
> - New workflow with Nx

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)
- [Release Process](#release-process)
- [Getting Help](#getting-help)

## Getting Started

### Prerequisites

- **Node.js** (version 20 or higher)
- **npm** (comes with Node.js)
- **Docker** (required for integration tests)
- **Git**

### Initial Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:

   ```bash
   git clone git@github.com:YOUR_USERNAME/supabase-js.git
   cd supabase-js
   ```

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Build all packages**:

   ```bash
   npx nx run-many --target=build --all
   ```

5. **Run tests** to ensure everything works:

   ```bash
   npx nx affected --target=test
   ```

## Development Workflow

### Making Changes

1. **Create a new branch** from `master`:

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes** in the appropriate library under `packages/core/`

3. **Follow our coding standards**:
   - Use TypeScript for all new code
   - Follow existing code style and patterns
   - Add JSDoc comments for public APIs
   - Use meaningful commit messages (see [Commit Guidelines](#-commit-guidelines))

4. **Test your changes**:

   ```bash
   # Run affected tests
   npx nx affected --target=test

   # Run specific library tests
   npx nx test <package-name>
   ```

   For detailed testing instructions, see [TESTING.md](./TESTING.md) and the README in each package directory.

5. **Format your code**:

   ```bash
   npx nx format
   ```

6. **Build affected packages**:

   ```bash
   npx nx affected --target=build
   ```

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) with automated tooling to ensure consistent commit messages and enable automatic versioning.

### Using the Interactive Commit Tool

**You can use the interactive commit tool** instead of `git commit` directly:

```bash
npm run commit
```

This command will:

- Guide you through creating a properly formatted commit message
- Validate your commit against our rules
- Ensure all required fields are filled out correctly
- Prevent invalid commits from being created

### Commit Message Format

All commits must follow this format:

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Available Types

| Type       | Description                                                   |
| ---------- | ------------------------------------------------------------- |
| `feat`     | A new feature                                                 |
| `fix`      | A bug fix                                                     |
| `docs`     | Documentation only changes                                    |
| `style`    | Changes that do not affect the meaning of the code            |
| `refactor` | A code change that neither fixes a bug nor adds a feature     |
| `perf`     | A code change that improves performance                       |
| `test`     | Adding missing tests or correcting existing tests             |
| `build`    | Changes that affect the build system or external dependencies |
| `ci`       | Changes to our CI configuration files and scripts             |
| `chore`    | Other changes that don't modify src or test files             |
| `revert`   | Reverts a previous commit                                     |

### Available Scopes

#### Library-Specific Scopes

- `auth` - Changes to `@supabase/auth-js`
- `functions` - Changes to `@supabase/functions-js`
- `postgrest` - Changes to `@supabase/postgrest-js`
- `realtime` - Changes to `@supabase/realtime-js`
- `storage` - Changes to `@supabase/storage-js`
- `supabase` - Changes to `@supabase/supabase-js`

#### Workspace-Level Scopes

- `repo` - Repository-level changes
- `deps` - Dependencies
- `ci` - Changes to CI
- `release` - Release process
- `docs` - Documentation
- `scripts` - Build/dev scripts
- `misc` - Miscellaneous

### Commit Examples

```bash
feat(auth): add support for custom auth providers
fix(storage): resolve upload timeout issue
docs(postgrest): update filter documentation
chore(deps): update nx to latest version
ci(release): add preview package generation
```

### Important Notes

- **Scope is required** - Every commit must have a scope
- **Use imperative mood** - "add feature" not "added feature"
- **Keep subject line under 100 characters**
- **No period at the end** of the subject line
- **Use the interactive tool** - `npm run commit` ensures compliance

## Pull Request Process

### Before Submitting

1. **Ensure your branch is up to date** with `master`:

   ```bash
   git checkout master
   git pull upstream master
   git checkout your-branch
   git rebase master
   ```

2. **Run the full test suite**:

   ```bash
   npx nx affected --target=test
   ```

3. **Build all affected packages**:

   ```bash
   npx nx affected --target=build
   ```

### Submitting Your PR

1. **Push your branch** to your fork:

   ```bash
   git push origin your-branch-name
   ```

2. **Create a Pull Request** on GitHub with:
   - Clear title describing the change
   - Detailed description of what was changed and why
   - Reference any related issues
   - Screenshots or examples if applicable

### PR Requirements

All pull requests must meet these requirements:

- **✅ At least 1 approving review** from a code owner
- **✅ All status checks passing** (CI/CD pipeline)
- **✅ No merge conflicts** with the base branch
- **✅ Squash merge only** (enforced by repository settings)

### Review Process

1. **Automated checks** will run (linting, testing, building)
2. **Code owners** will be automatically requested for review
3. **Address feedback** by pushing new commits to your branch
4. **Resolve all conversations** before merge

## Testing

Each package has its own testing requirements and infrastructure. For comprehensive testing information, see:

- **[TESTING.md](./docs/TESTING.md)** - Overview of testing across all packages
- **Package-specific guides** - Detailed testing instructions in each package's README:
  - [`supabase-js`](./packages/core/supabase-js/README.md)
  - [`auth-js`](./packages/core/auth-js/README.md)
  - [`functions-js`](./packages/core/functions-js/README.md)
  - [`postgrest-js`](./packages/core/postgrest-js/README.md)
  - [`realtime-js`](./packages/core/realtime-js/README.md)
  - [`storage-js`](./packages/core/storage-js/README.md)

### Quick Testing Commands

```bash
# Run tests for a specific package
npx nx test <package-name>

# Run affected tests only (recommended during development)
npx nx affected --target=test

# Run tests with coverage
npx nx test <package> --coverage
```

### Test Requirements by Package

| Package      | Docker Required | Details                                                    |
| ------------ | --------------- | ---------------------------------------------------------- |
| auth-js      | ✅ Yes          | [See README](packages/core/auth-js/README.md#testing)      |
| functions-js | ✅ Yes          | [See README](packages/core/functions-js/README.md#testing) |
| postgrest-js | ✅ Yes          | [See README](packages/core/postgrest-js/README.md#testing) |
| realtime-js  | ❌ No           | [See README](packages/core/realtime-js/README.md#testing)  |
| storage-js   | ✅ Yes          | [See README](packages/core/storage-js/README.md#testing)   |
| supabase-js  | ❌ No\*         | [See README](packages/core/supabase-js/README.md#testing)  |

\*supabase-js integration tests require additional setup

## Documentation

### TypeScript API Documentation

We automatically generate TypeScript API documentation that is used by the main [Supabase documentation site](https://supabase.com/docs). The process works as follows:

1. **TypeDoc generates JSON specifications** from TypeScript source code
2. **GitHub Actions publishes** these specs to GitHub Pages on every push to `master`
3. **Main Supabase repository** uses these JSON files to generate the official API docs via `make` commands

#### Available Documentation Commands

```bash
# Generate JSON specs for all libraries (used by main docs)
npx nx run-many --target=docs:json --all

# Generate HTML docs for all libraries (for local viewing)
npx nx run-many --target=docs --all

# Generate docs for a specific library
npx nx docs:json auth-js
npx nx docs postgrest-js
```

#### Published API Specifications

When contributing changes that affect public APIs, the documentation will be automatically updated when your PR is merged.

## Release Process

### Fixed Version Mode

All packages in this monorepo use **fixed version mode**, meaning they share the same version number and are released together. This ensures compatibility and simplifies dependency management.

### Testing Releases

If you need to test your changes with a release build, you can use **pkg.pr.new**:

1. **Create a PR** with your changes
2. **Comment on the PR** and tag a maintainer, asking them to add the `trigger: preview` label
3. **A maintainer will add the label** to trigger the preview release
4. **Use the generated package URLs** to test your changes in other projects

This allows you to test package changes without waiting for an official release, while ensuring preview releases are controlled by maintainers.

### Official Releases

Official releases are handled by maintainers using Nx Release. You can read more in the [RELEASE.md](./RELEASE.md)

## Getting Help

### Resources

- **Documentation**: [supabase.com/docs](https://supabase.com/docs)
- **Community**: [GitHub Discussions](https://github.com/supabase/supabase/discussions)
- **Issues**: [GitHub Issues](https://github.com/supabase/supabase-js/issues)
- **Discord**: [Supabase Discord](https://discord.supabase.com)

### Reporting Issues

When reporting issues, please include:

1. **Clear description** of the problem
2. **Steps to reproduce** the issue
3. **Expected vs actual behavior**
4. **Environment information** (Node.js version, library versions, etc.)
5. **Code examples** or minimal reproduction cases

### Asking Questions

- **General questions**: Use [GitHub Discussions](https://github.com/supabase/supabase/discussions)
- **Bug reports**: Use [GitHub Issues](https://github.com/supabase/supabase-js/issues)
- **Feature requests**: Use [GitHub Issues](https://github.com/supabase/supabase-js/issues) with the "enhancement" label

## 🤝 Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please review our [Code of Conduct](https://github.com/supabase/.github/blob/main/CODE_OF_CONDUCT.md) before participating.

## 📄 License

By contributing to Supabase JS Libraries, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

---

Thank you for contributing to Supabase! 💚
