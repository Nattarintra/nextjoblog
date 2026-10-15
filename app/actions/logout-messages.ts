export const LOGOUT_MESSAGES = {
  stillSignedIn:
    "We couldn't log you out. You're still logged in on this device. Please try again.",
  unconfirmed:
    "We couldn't confirm that you were logged out. Please try again.",
  configuration: "Log out is unavailable right now. Please try again later.",
  unknown: "We couldn't log you out. Please try again.",
  pendingLabel: "Logging out…",
  retryLabel: "Try Again",
  loggedOutBanner:
    "You've been logged out. Your applications are no longer visible on this device.",
} as const;

export const LOGOUT_LOG_EVENT = {
  providerError: "auth.logout.provider_error",
  unconfirmed: "auth.logout.unconfirmed",
  configuration: "auth.logout.configuration_error",
  unexpected: "auth.logout.unexpected_error",
} as const;
