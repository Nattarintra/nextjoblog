export const OFFLINE_ERROR_MESSAGE =
  "You appear to be offline. Please reconnect and try again.";

export const LOGOUT_MESSAGES = {
  stillSignedIn:
    "We couldn't log you out. You're still logged in on this device. Please try again.",
  unconfirmed:
    "We couldn't confirm that you were logged out. Please try again.",
  configuration: "Log out is unavailable right now. Please try again later.",
  unknown: "We couldn't log you out. Please try again.",
  accountHeading: "Account",
  accountEmailFallback: "Your account",
  deviceNote: "Logged in on this device",
  closeLabel: "Close",
  logOutLabel: "Log Out",
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
