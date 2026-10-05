type DestinationLabel = {
  matches: (path: string) => boolean;
  label: string;
};

export const DESTINATION_LABELS: readonly DestinationLabel[] = [
  { matches: (path) => path === "/dashboard", label: "Your dashboard" },
  {
    matches: (path) => /^\/applications\/[^/]+(?:\?.*)?$/.test(path),
    label: "An application",
  },
];

export function describeDestination(safePath: string): string | undefined {
  return DESTINATION_LABELS.find(({ matches }) => matches(safePath))?.label;
}
