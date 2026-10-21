import { expect } from "@playwright/test";

const DEFAULT_MAIL_API_URL = "http://127.0.0.1:54324/api/v1";
const MAIL_API_URL = process.env.E2E_MAIL_API_URL ?? DEFAULT_MAIL_API_URL;
const MAIL_POLL_INTERVAL_MS = 250;
const MAIL_DELIVERY_TIMEOUT_MS = 10_000;
const MAIL_MESSAGE_LIMIT = 100;
const RESET_PATH = "/reset-password";

type MailRecipient = {
  Address?: string;
};

type MailSummary = {
  ID: string;
  To?: MailRecipient[];
};

type MailMessage = MailSummary & {
  HTML?: string;
  Text?: string;
};

type MailpitMessageList = {
  messages?: MailSummary[];
};

function messagesUrl(): string {
  return `${MAIL_API_URL}/messages?limit=${MAIL_MESSAGE_LIMIT}`;
}

function messageUrl(messageId: string): string {
  return `${MAIL_API_URL}/message/${encodeURIComponent(messageId)}`;
}

function isForRecipient(message: MailSummary, recipient: string): boolean {
  return (message.To ?? []).some(
    (address) => address.Address?.toLowerCase() === recipient.toLowerCase(),
  );
}

async function readMessages(recipient: string): Promise<MailSummary[]> {
  const response = await fetch(messagesUrl());
  expect(response.ok, `Mail API returned ${response.status}`).toBe(true);
  const payload = (await response.json()) as MailpitMessageList;
  return (payload.messages ?? []).filter((message) => isForRecipient(message, recipient));
}

async function readMessage(messageId: string): Promise<MailMessage> {
  const response = await fetch(messageUrl(messageId));
  expect(response.ok, `Mail API returned ${response.status}`).toBe(true);
  return (await response.json()) as MailMessage;
}

function extractRecoveryUrl(message: MailMessage): string | undefined {
  const content = [message.HTML, message.Text].filter(Boolean).join("\n");
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

async function deleteMessage(messageId: string): Promise<void> {
  const response = await fetch(`${MAIL_API_URL}/messages`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ IDs: [messageId] }),
  });
  expect(response.ok, `Mail API returned ${response.status}`).toBe(true);
}

export async function clearMailbox(recipient: string): Promise<void> {
  const messages = await readMessages(recipient);
  await Promise.all(messages.map(({ ID }) => deleteMessage(ID)));
}

export async function waitForRecoveryEmail(recipient: string): Promise<{ recoveryUrl: string }> {
  let recoveryUrl: string | undefined;

  await expect
    .poll(
      async () => {
        const messages = await readMessages(recipient);
        for (const { ID } of messages) {
          recoveryUrl = extractRecoveryUrl(await readMessage(ID));
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

  if (recoveryUrl) return { recoveryUrl };
  throw new Error(`Recovery email for ${recipient} disappeared after polling`);
}
