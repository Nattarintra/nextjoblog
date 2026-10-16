// Mirrors proxy.ts's own derivation of the @supabase/ssr cookie storage key.
export function authCookieStorageKey(): string {
  return `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]}-auth-token`;
}

// Match @supabase/ssr's `isChunkLike` behavior: the session is either stored
// directly at the storage key or split into numeric `.0`, `.1`, … chunks.
// Do not use `startsWith(storageKey)`: auth-js also creates PKCE verifier
// cookies such as `<storageKey>-flow-…-code-verifier`, which are not session
// cookies and are deliberately left alone by proxy.ts.
export function isAuthSessionCookie(cookieName: string, storageKey: string): boolean {
  return cookieName === storageKey || new RegExp(`^${storageKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\d+$`).test(cookieName);
}
