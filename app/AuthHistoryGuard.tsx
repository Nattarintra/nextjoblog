"use client";

import { useEffect, useRef } from "react";

import { isPublicPath } from "@/lib/auth/route-access";

export function AuthHistoryGuard() {
  const reloadStarted = useRef(false);

  useEffect(() => {
    const reloadProtectedHistoryPage = () => {
      if (!isPublicPath(window.location.pathname) && !reloadStarted.current) {
        reloadStarted.current = true;
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

  return null;
}
