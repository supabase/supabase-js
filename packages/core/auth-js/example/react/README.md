# Supabase `auth-js` example

- Created based on the [Quickstart example](https://supabase.com/docs/guides/auth/quickstarts/react) in the Supabase docs.
- Bootstrapped with Vite CLI

## Setup

### With a Supabase project

### 1. Create new project

Sign up to Supabase - [https://supabase.com/dashboard](https://supabase.com/dashboard) and create a new project. Wait for your database to start.

### 2. Get the URL and Key

Create a copy of `.env.local.example`:

```bash
cp .env.local.example .env.local
```

1. Go to the Project Settings (the cog icon)
2. Open the Data API tab, and find your API URL
3. Open the API Keys tab and create a new Publishable key
4. Set them both in your newly created `.env.local` file.O

### 3. Enable Auth providers

1. From the sidenav, go to Authentication -> Configuration -> Sign In/Providers (https://supabase.com/dashboard/project/<YOUR_PROJECT_ID>/auth/providers)
2. Enable providers as needed (for this example: Anonymous, Email, Phone, GitHub, Google)

## Run

### Install root dependencies and build `auth-js`

```bash
npm i
```

```bash
npx nx build auth-js
```

### Install the dependencies and run the example

```bash
cd example/react
```

```bash
npm i; npm run dev
```
