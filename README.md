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


## Sponsors

We are building the features of Firebase using enterprise-grade, open source products. We support existing communities wherever possible, and if the products don’t exist we build them and open source them ourselves. Thanks to these sponsors who are making the OSS ecosystem better for everyone.

[![Worklife VC](https://user-images.githubusercontent.com/10214025/90451355-34d71200-e11e-11ea-81f9-1592fd1e9146.png)](https://www.worklife.vc)
[![New Sponsor](https://user-images.githubusercontent.com/10214025/90518111-e74bbb00-e198-11ea-8f88-c9e3c1aa4b5b.png)](https://github.com/sponsors/supabase)
