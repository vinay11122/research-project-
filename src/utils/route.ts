export function getSafeId(id: string | string[] | undefined): number | null {
  if (typeof id === 'string') {
    const parsed = parseInt(id, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}
