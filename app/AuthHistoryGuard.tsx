"use client";

import { useEffect } from "react";

import { isPublicPath } from "@/lib/auth/route-access";

export function AuthHistoryGuard() {
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !isPublicPath(window.location.pathname)) {
        window.location.reload();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return null;
}
