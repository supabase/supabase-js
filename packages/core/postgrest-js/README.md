# Postgrest JS

Isomorphic JavaScript client for [PostgREST](https://postgrest.org).

**Contents**

- [Usage](#usage)
- [Development](#development)
  - [Commands](#commands)
  - [Publishing](#publishing)
- [Contributing](#contributing)
- [License](#license)
- [Credits](#credits)

## Usage

## Development

### Commands

- `npm run clean` - Remove `lib/` directory
- `npm test` - Run tests with linting and coverage results.
- `npm run test:only` - Run tests without linting or coverage.
- `npm run test:watch` - You can even re-run tests on file changes!
- `npm run test:prod` - Run tests with minified code.
- `npm run test:examples` - Test written examples on pure JS for better understanding module usage.
- `npm run lint` - Run ESlint with airbnb-config
- `npm run cover` - Get coverage report for your code.
- `npm run build` - Babel will transpile ES6 => ES5 and minify the code.
- `npm run prepublish` - Hook for npm. Do all the checks before publishing your module.

### Publishing

Bump the semver.

```sh
npm publish --access=public
```

## Contributing

We welcome any issues, pull requests, and feedback.

## License

This repo is liscenced under MIT.

## Credits

- https://github.com/calebmer/postgrest-client - originally forked and adapted from @calebmer's library
