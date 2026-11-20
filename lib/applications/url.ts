const SAFE_PROTOCOLS: readonly string[] = ["http:", "https:"];

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return SAFE_PROTOCOLS.includes(url.protocol) && url.hostname.length > 0;
  } catch {
    return false;
  }
}
