import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { APPLICATION_MESSAGES, APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";

type SaveFailedAlertProps = { pending: boolean };

/** Retry is a submit button, so it re-posts the retained values and the same client_id. */
export function SaveFailedAlert({ pending }: SaveFailedAlertProps) {
  return (
    <Alert
      tone="danger"
      title={APPLICATION_PAGE_MESSAGES.saveFailedTitle}
      action={
        <Button type="submit" variant="secondary" size="sm" pending={pending}>
          {APPLICATION_MESSAGES.retry}
        </Button>
      }
    >
      {APPLICATION_PAGE_MESSAGES.saveFailedDetail}
    </Alert>
  );
}
