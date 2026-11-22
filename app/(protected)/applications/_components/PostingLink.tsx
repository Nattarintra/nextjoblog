import { APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";
import { isSafeHttpUrl } from "@/lib/applications/url";

type PostingLinkProps = {
  postingUrl: string;
  title: string;
  company: string;
  className?: string;
};

export function PostingLink({ postingUrl, title, company, className }: PostingLinkProps) {
  if (!isSafeHttpUrl(postingUrl)) return null;

  return (
    <a
      href={postingUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={APPLICATION_PAGE_MESSAGES.postingLinkLabel(title, company)}
      className={className ?? "font-semibold text-link underline"}
    >
      {APPLICATION_PAGE_MESSAGES.openPosting}
    </a>
  );
}
