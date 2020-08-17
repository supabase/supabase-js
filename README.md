# Supabase JS

## Commands
- `npm run clean` - Remove `lib/` directory
- `npm test` - Run tests with linting and coverage results.
- `npm run test:integration` - Run the integration tests without docker (requires you to run the docker container separately)
- `npm run test:integration:full` - Run the integration tests (requires docker to be running)
- `npm test:only` - Run tests without linting or coverage.
- `npm test:watch` - You can even re-run tests on file changes!
- `npm test:prod` - Run tests with minified code.
- `npm run test:examples` - Test written examples on pure JS for better understanding module usage.
- `npm run lint` - Run ESlint with airbnb-config
- `npm run cover` - Get coverage report for your code.
- `npm run build` - Babel will transpile ES6 => ES5 and minify the code.
- `npm run build:umd` - Babel will transpile ES6 => UMD, minify the code and webpack to supabase.js
- `npm run prepublish` - Hook for npm. Do all the checks before publishing your module.


## Publishing

Bump the semver.

```sh
npm publish --access=public
```
