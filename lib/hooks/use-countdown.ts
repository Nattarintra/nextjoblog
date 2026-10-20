"use client";

import { useEffect, useState } from "react";

import { COUNTDOWN_TICK_MS } from "@/lib/auth/password-reset-config";

export function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function useCountdown(seconds: number, tickMs = COUNTDOWN_TICK_MS) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.floor(seconds)));

  useEffect(() => {
    if (secondsLeft <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [secondsLeft, tickMs]);

  return {
    secondsLeft,
    isFinished: secondsLeft === 0,
    formatted: formatCountdown(secondsLeft),
  };
}
