import { PUBLIC_PATH_PREFIXES } from "@/lib/auth/paths";

// One inline script, installed before hydration, so a protected page restored
// by Back/Forward (BFCache or history traversal) is reloaded and re-guarded.
// The public-path list is injected from paths.ts so it cannot drift from the
// proxy's own definition.
const HISTORY_GUARD_SCRIPT = `
(() => {
  if (window.__nextJobLogHistoryGuardInstalled) return;
  window.__nextJobLogHistoryGuardInstalled = true;

  const publicPrefixes = ${JSON.stringify(PUBLIC_PATH_PREFIXES)};
  const isPublicPath = (pathname) =>
    publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));

  const reloadProtectedHistoryPage = () => {
    if (isPublicPath(window.location.pathname) || window.__nextJobLogHistoryReloading) return;
    window.__nextJobLogHistoryReloading = true;
    window.location.reload();
  };

  window.addEventListener("pageshow", (event) => {
    const navigation = performance.getEntriesByType("navigation")[0];
    if (event.persisted || navigation?.type === "back_forward") {
      reloadProtectedHistoryPage();
    }
  });
  window.addEventListener("popstate", reloadProtectedHistoryPage);
})();
`;

export function AuthHistoryGuard() {
  return <script dangerouslySetInnerHTML={{ __html: HISTORY_GUARD_SCRIPT }} />;
}
