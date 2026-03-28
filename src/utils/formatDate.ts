export function formatDate(dateString: string) {
  const d = new Date(dateString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} (UTC)`;
}

export function formatUTC(isoOrDate: string | Date) {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d) + " UTC";
}

export function parseDatetimeLocalAsUTC(value: string) {
  if (!value) return null;
  // value is "YYYY-MM-DDTHH:mm"
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  // Create Date object using UTC components
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0)).toISOString();
}
