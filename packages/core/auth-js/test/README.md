# Testing

## Prerequisites

- Docker & docker compose


### Basic testing

Run all tests:

```sh
npm run test
```


### Advanced

**Start all the infrastructure:**

```sh
npm run test:infra
```

You can now open the mock mail server on `http://localhost:9000`

**Run the tests only:**

```sh
npm run test:suite
```

All emails will appear in the mock mail server. 