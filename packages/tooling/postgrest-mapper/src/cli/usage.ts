export const USAGE = `postgrest-mapper: typed PostgREST selects without TypeScript 7.1

Usage:
  postgrest-mapper generate --project <tsconfig> --out <file.d.ts> [--check | --watch]
  postgrest-mapper print    --project <tsconfig>
  postgrest-mapper refresh  --project <tsconfig> [--out <file.d.ts>]
  postgrest-mapper init     --project <tsconfig> [--out <file.d.ts>]
  postgrest-mapper snapshot --out <file.json> [--check]

Commands:
  generate   Writes the declarations the content mapper would produce. --check exits 1 when the file is
             stale and never writes; --watch regenerates when a scanned file or the snapshot changes.
  print      Prints the declarations to stdout.
  refresh    Clears the generator cache (node_modules/.cache/postgrest-mapper), touches the refresh stamp
             that makes a running watch or content mapper server acquire the live schema again, and
             regenerates.
  init       Sets a project up: adds the .pgrst-index contentMappers entry to the tsconfig (schema source
             supabase-local next to a supabase/config.toml, a snapshot otherwise), creates the index file,
             adds it and the generated file to "include" (or "files") and, next to a deno.json, to
             "compilerOptions.types". Comments are kept; running it again changes nothing.
  snapshot   Acquires the schema and writes a snapshot file; --check compares instead of writing.

Options:
  --project <file>           tsconfig.json with a contentMappers entry for .pgrst-index (default: tsconfig.json)
  --out <file>               Output file
  --schema-source <source>   supabase-local, postgrest or snapshot. For generate, print and refresh it
                             overrides the tsconfig's schema option; snapshot reads from the first two.
  --snapshot <file>          Snapshot to read (implies --schema-source snapshot)
  --db-url-env <NAME>        Environment variable holding the database URL (postgrest source)
  --workdir <dir>            snapshot: directory holding supabase/config.toml (supabase-local)
  --project-id <id>          snapshot: the Supabase CLI project_id (supabase-local)
  --supabase-command <cmd>   snapshot: the Supabase CLI invocation, for example "npx supabase"
  --image <image>            snapshot: PostgREST image (postgrest source)
  --network <name>           snapshot: docker network (postgrest source)
  --check                    Compare instead of writing (generate, snapshot)
  --watch                    Regenerate on changes (generate)
  --help, --version

Exit codes: 0 success, 1 failure (diagnostics, drift, acquisition errors), 2 usage error.
`
