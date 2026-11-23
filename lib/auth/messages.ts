import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_HELPER_TEXT,
} from "@/lib/auth/password-policy";

export const OFFLINE_ERROR_MESSAGE =
  "You appear to be offline. Please reconnect and try again.";

export const AUTH_ACTION_LABELS = {
  backToLogin: "Back to Log In",
  requestNewLink: "Request a New Link",
} as const;

const SHOW_PASSWORD_LABEL = "Show";
const HIDE_PASSWORD_LABEL = "Hide";

export const PASSWORD_INPUT_MESSAGES = {
  toggleText: (isVisible: boolean) =>
    isVisible ? HIDE_PASSWORD_LABEL : SHOW_PASSWORD_LABEL,
  toggleLabel: (isVisible: boolean, fieldLabel: string) =>
    `${isVisible ? HIDE_PASSWORD_LABEL : SHOW_PASSWORD_LABEL} ${fieldLabel.toLowerCase()}`,
  visibleAnnouncement: (fieldLabel: string) =>
    `Password is visible for ${fieldLabel.toLowerCase()}.`,
} as const;

export const PASSWORD_RESET_MESSAGES = {
  checking: "Checking your reset link…",
  formHeading: "Set a New Password",
  formSubtitle: (email: string) =>
    `Choose a new password for ${email}. You'll stay logged in once it's saved.`,
  resettingFor: (email: string) => `Resetting the password for ${email}.`,
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
    loginRequired:
      "Your password was updated, but we couldn't log you in. Log in with your new password.",
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
    requestLink: AUTH_ACTION_LABELS.requestNewLink,
    backToLogin: AUTH_ACTION_LABELS.backToLogin,
    footnote: "No account details were shown",
  },
} as const;

export const LOGOUT_MESSAGES = {
  stillSignedIn:
    "We couldn't log you out. You're still logged in on this device. Check your connection and try again.",
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

export const PASSWORD_RESET_CONFIRM_LOG_EVENT = {
  providerError: "auth.password_reset_confirm.provider_error",
  sessionStartError: "auth.password_reset_confirm.session_start_error",
  unexpectedError: "auth.password_reset_confirm.unexpected_error",
} as const;

export const AUTH_BRAND_MESSAGES = {
  headline: "Every application, every step, in one place.",
  paragraph:
    "Built for applying to many roles at once across Malmö, Lund, Copenhagen and remote.",
  bullets: [
    "Never lose track of where you applied",
    "Follow-up reminders that actually fire",
    "See which CV gets responses",
  ],
  footer: "Your data is visible only to you",
  productName: "NextJobLog",
} as const;

export const LOGIN_MESSAGES = {
  heading: "Log In",
  redirectHeading: "Log In to Continue",
  subtitle: "Log your job applications and track every step in one place.",
  redirectSubtitle: "You need to be logged in to open this page.",
  emailLabel: "Email",
  passwordLabel: "Password",
  invalidCredentials: "Email or password is incorrect",
  configuration: "We're unable to log in right now. Please try again shortly.",
  confirmationRequired:
    "Please verify your email before logging in. Check your inbox for the verification link.",
  forgotPassword: "Forgot password?",
  submit: "Log In",
  pendingSubmit: "Logging in…",
  noAccount: "Don't have an account?",
  signUp: "Sign Up",
  sessionExpired: {
    heading: "Log In Again",
    message:
      "Your login ended. Logins last 30 days unless you choose to stay logged in. Your applications are safe — log in to see them.",
  },
} as const;

export const SIGNUP_MESSAGES = {
  heading: "Create Your NextJobLog Account",
  subtitle: "Your application data is encrypted and visible only to you.",
  emailLabel: "Email",
  passwordLabel: "Password",
  duplicateEmailPrefix: "This email is already in use —",
  duplicateEmailAction: "Log In",
  duplicateEmailSuffix: "instead",
  submit: "Sign Up",
  pendingSubmit: "Creating account…",
  haveAccount: "Already have an account?",
  logIn: "Log In",
} as const;

export const FORGOT_MESSAGES = {
  heading: "Forgot Your Password?",
  subtitle:
    "Enter the email you signed up with. We'll send you a link to set a new password.",
  hint: "The link works once. You'll set your new password on the page it opens.",
  emailLabel: "Email",
  submit: "Send Reset Link",
  pendingSubmit: "Sending reset link…",
  invalidEmail: "Enter a valid email address, like you@example.com",
  backToLogin: "← Back to Log In",
  sent: {
    heading: "Check Your Email",
    status: "If this email exists in our system, we've sent a link.",
    steps: [
      "Open the email from NextJobLog. It can take a minute to arrive.",
      "Tap the link to set a new password. It only works once.",
      "Nothing there? Check your spam folder, or make sure the email above is the one you signed up with.",
    ],
    resend: "Resend Link",
    resendIn: (formatted: string) => `Resend Link in ${formatted}`,
    differentEmail: "Use a different email",
  },
  limited: {
    heading: "Too Many Reset Requests",
    description:
      "To protect your inbox and your account, we've paused reset emails from this device for a short while.",
    waitLabel: "You can try again in",
    waitNote:
      "Any link we already sent still works. Check your inbox before requesting another.",
    requestNewLink: AUTH_ACTION_LABELS.requestNewLink,
    footnote: "Same message for every email address",
  },
} as const;

export const SESSION_ERROR_MESSAGES = {
  heading: "We Couldn't Verify Your Session",
  description:
    "Something went wrong while checking that it's you, so your applications are hidden until we can confirm it.",
  steps: [
    "Check that you're connected to the internet.",
    "Tap Try Again. You'll stay on this page if it works.",
    "If it keeps failing, log in again.",
  ],
  retry: "Try Again",
  goToLogin: "Go to Log In",
  footnote: "No application data was loaded",
} as const;
