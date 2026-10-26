// Waits until PostgREST answers (the container has no shell or curl to health-check it from inside).
const url = process.env.REST_URL ?? 'http://localhost:53000'
const deadline = Date.now() + 60_000
for (;;) {
  try {
    const response = await fetch(`${url}/authors?limit=1`)
    if (response.ok) break
  } catch {
    // not up yet
  }
  if (Date.now() > deadline) {
    console.error(`PostgREST did not answer at ${url} within 60 s`)
    process.exit(1)
  }
  await new Promise((resolve) => setTimeout(resolve, 500))
}
console.log(`PostgREST is up at ${url}`)
