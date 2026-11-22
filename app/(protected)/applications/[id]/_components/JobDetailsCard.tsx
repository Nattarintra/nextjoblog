import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { buildJobDetailRows } from "@/lib/applications/detail-view";
import { APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";
import type { ApplicationDetail } from "@/lib/applications/types";

import { DefinitionList, DefinitionRow } from "./DefinitionList";

export function JobDetailsCard({ application }: { application: ApplicationDetail }) {
  return (
    <section>
      <SectionLabel>{APPLICATION_PAGE_MESSAGES.jobDetailsSection}</SectionLabel>
      <Card className="px-4">
        <DefinitionList>
          {buildJobDetailRows(application).map((row) => (
            <DefinitionRow key={row.key} term={row.label}>
              {row.kind === "tags" && Array.isArray(row.value) ? (
                <ul aria-label={row.label} className="flex flex-wrap justify-end gap-1.5">
                  {row.value.map((tag) => <li key={tag}><Chip>{tag}</Chip></li>)}
                </ul>
              ) : typeof row.value === "string" ? row.value : null}
            </DefinitionRow>
          ))}
        </DefinitionList>
      </Card>
    </section>
  );
}
