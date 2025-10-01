# Testing

## Prerequisites

- Docker & docker compose

### Basic testing

Run all tests:

```sh
npm run test
```

> Note: If tests fail due to connection issues, your tests may be running too soon and the infra is not yet ready.
> If that's the case, adjust the `sleep 10` duration in:
> `"test:infra": "cd infra && docker-compose down && docker-compose pull && docker-compose up -d && sleep 10",`
> to a value that works for your system setup.

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
