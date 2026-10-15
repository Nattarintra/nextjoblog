"use client";

import { useEffect, useRef } from "react";

import { isPublicPath } from "@/lib/auth/route-access";

const HISTORY_GUARD_SCRIPT = `
(() => {
  if (window.__nextJobLogHistoryGuardInstalled) return;
  window.__nextJobLogHistoryGuardInstalled = true;

  const isPublicPath = (pathname) =>
    ["/login", "/signup", "/forgot-password", "/reset-password", "/api/auth"]
      .some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));

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
  const reloadStarted = useRef(false);

  useEffect(() => {
    const reloadProtectedHistoryPage = () => {
      if (
        !isPublicPath(window.location.pathname) &&
        !reloadStarted.current &&
        !window.__nextJobLogHistoryReloading
      ) {
        reloadStarted.current = true;
        window.__nextJobLogHistoryReloading = true;
        window.location.reload();
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      const restoredByHistory = navigation?.type === "back_forward";

      if (event.persisted || restoredByHistory) reloadProtectedHistoryPage();
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", reloadProtectedHistoryPage);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", reloadProtectedHistoryPage);
    };
  }, []);

  return <script dangerouslySetInnerHTML={{ __html: HISTORY_GUARD_SCRIPT }} />;
}
