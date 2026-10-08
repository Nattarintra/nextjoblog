export function notFoundIfMissing<T>(
  row: T | null | undefined,
  notFound: () => never,
): T {
  if (row == null) notFound();
  return row;
}
