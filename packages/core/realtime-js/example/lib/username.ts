import { randomInt } from "crypto";

const adjectives = [
  "Happy",
  "Swift",
  "Brave",
  "Clever",
  "Calm",
  "Bright",
  "Wild",
  "Cool",
  "Cosmic",
  "Lucky",
];

const nouns = [
  "Panda",
  "Eagle",
  "Tiger",
  "Fox",
  "Wolf",
  "Bear",
  "Hawk",
  "Lion",
  "Otter",
  "Raven",
];

const STORAGE_KEY = "chat_username";

/**
 * Produce a random integer in the range [0, maxExclusive).
 *
 * @param maxExclusive - Upper bound (exclusive) for the returned integer; must be greater than 0.
 * @returns An integer greater than or equal to 0 and less than `maxExclusive`.
 * @throws Error if `maxExclusive` is not greater than 0.
 */
function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) {
    throw new Error("maxExclusive must be positive");
  }

  // Use browser crypto when available
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % maxExclusive;
  }

  // Fallback to Node.js crypto
  return randomInt(0, maxExclusive);
}

/**
 * Creates a compact username by combining a randomly chosen adjective, a randomly chosen noun, and a two-digit numeric suffix.
 *
 * @returns The generated username string in the form `AdjectiveNounNN` where the numeric suffix is between 0 and 99. 
 */
export function generateUsername(): string {
  const adj = adjectives[secureRandomInt(adjectives.length)];
  const noun = nouns[secureRandomInt(nouns.length)];
  const num = secureRandomInt(100);
  return `${adj}${noun}${num}`;
}

export function getUsername(): string {
  if (typeof window === "undefined") return generateUsername();

  let username = localStorage.getItem(STORAGE_KEY);
  if (!username) {
    username = generateUsername();
    localStorage.setItem(STORAGE_KEY, username);
  }
  return username;
}