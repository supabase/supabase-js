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

export function generateUsername(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
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
