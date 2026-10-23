import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_HELPER_TEXT,
} from "@/lib/auth/password-policy";

export const OFFLINE_ERROR_MESSAGE =
  "You appear to be offline. Please reconnect and try again.";

export const PASSWORD_RESET_MESSAGES = {
  formHeading: "Set a New Password",
  formSubtitle: (email: string) =>
    `Choose a new password for ${email}. You'll stay logged in once it's saved.`,
  newPasswordLabel: "New Password",
  confirmPasswordLabel: "Confirm New Password",
  passwordRequirements: {
    length: PASSWORD_HELPER_TEXT,
    match: "Both passwords match",
  },
  saveButton: "Save New Password",
  savingButton: "Saving…",
  errors: {
    tooShort: `Use at least ${MIN_PASSWORD_LENGTH} characters. Your password hasn't been changed.`,
    mismatch: "Passwords do not match. Your password hasn't been changed.",
    offline: OFFLINE_ERROR_MESSAGE,
    samePassword: "Choose a password that is different from your current password.",
    network: "We couldn't save your password. Check your connection and try again.",
    unknown: "We couldn't save your password. Please try again.",
  },
  toast: {
    title: "Password updated",
    body: "You're logged in with your new password.",
    dismissLabel: "Dismiss password-updated message",
  },
  expired: {
    heading: "This Reset Link No Longer Works",
    description:
      "Reset links work once and only for a limited time. This one has expired or was already used, so your password hasn't been changed.",
    steps: [
      "Request a new link below.",
      "Open the newest email from NextJobLog. Older links stop working once a new one is sent.",
      "Already changed your password? Just log in with it.",
    ],
    requestLink: "Request a New Link",
    backToLogin: "Back to Log In",
    footnote: "No account details were shown",
  },
} as const;

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

export const EXPIRED_SESSION_LOG_EVENT = {
  providerError: "auth.expired_session.provider_error",
  configuration: "auth.expired_session.configuration_error",
  unexpected: "auth.expired_session.unexpected_error",
} as const;
