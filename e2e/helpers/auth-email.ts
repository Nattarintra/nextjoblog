import { expect } from "@playwright/test";

const DEFAULT_MAIL_API_URL = "http://127.0.0.1:54324/api/v1";
const MAIL_API_URL = process.env.E2E_MAIL_API_URL ?? DEFAULT_MAIL_API_URL;
const MAIL_POLL_INTERVAL_MS = 250;
const MAIL_DELIVERY_TIMEOUT_MS = 10_000;
const RESET_PATH = "/reset-password";

type MailSummary = {
  id: string;
};

type MailMessage = {
  body?: string;
  html?: string;
  text?: string;
};

function mailboxUrl(recipient: string): string {
  return `${MAIL_API_URL}/mailbox/${encodeURIComponent(recipient)}`;
}

async function readMailbox(recipient: string): Promise<MailSummary[]> {
  const response = await fetch(mailboxUrl(recipient));
  expect(response.ok, `Mail API returned ${response.status}`).toBe(true);
  return (await response.json()) as MailSummary[];
}

async function readMessage(recipient: string, messageId: string): Promise<MailMessage> {
  const response = await fetch(`${mailboxUrl(recipient)}/${encodeURIComponent(messageId)}`);
  expect(response.ok, `Mail API returned ${response.status}`).toBe(true);
  return (await response.json()) as MailMessage;
}

function extractRecoveryUrl(message: MailMessage): string | undefined {
  const content = [message.html, message.body, message.text].filter(Boolean).join("\n");
  const candidates = content.match(/https?:\/\/[^\s"'<>]+/g) ?? [];

  return candidates
    .map((candidate) => candidate.replaceAll("&amp;", "&"))
    .find((candidate) => {
      try {
        return new URL(candidate).searchParams.get("redirect_to")?.includes(RESET_PATH) ?? false;
      } catch {
        return false;
      }
    });
}

export async function clearMailbox(recipient: string): Promise<void> {
  const messages = await readMailbox(recipient);
  await Promise.all(
    messages.map(async ({ id }) => {
      const response = await fetch(`${mailboxUrl(recipient)}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      expect(response.ok, `Mail API returned ${response.status}`).toBe(true);
    }),
  );
}

export async function waitForRecoveryEmail(recipient: string): Promise<{ recoveryUrl: string }> {
  await expect
    .poll(
      async () => {
        const messages = await readMailbox(recipient);
        for (const { id } of messages) {
          const recoveryUrl = extractRecoveryUrl(await readMessage(recipient, id));
          if (recoveryUrl) return recoveryUrl;
        }
        return undefined;
      },
      {
        intervals: [MAIL_POLL_INTERVAL_MS],
        timeout: MAIL_DELIVERY_TIMEOUT_MS,
        message: `Timed out waiting for a recovery email for ${recipient}`,
      },
    )
    .toBeDefined();

  const messages = await readMailbox(recipient);
  for (const { id } of messages) {
    const recoveryUrl = extractRecoveryUrl(await readMessage(recipient, id));
    if (recoveryUrl) return { recoveryUrl };
  }

  throw new Error(`Recovery email for ${recipient} disappeared after polling`);
}
