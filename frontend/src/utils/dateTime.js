// TrioByte company timezone: India Standard Time (Asia/Kolkata).
export const COMPANY_TIME_ZONE = "Asia/Kolkata";

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: COMPANY_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: COMPANY_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatCompanyDateTime(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return dateTimeFormatter.format(date);
}

export function formatCompanyDate(value) {
  if (!value) return "—";

  // DATE values from PostgreSQL are plain YYYY-MM-DD strings. Parsing those
  // as Date objects can shift the displayed day because JS treats them as UTC.
  const plainDate = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plainDate) {
    const [, year, month, day] = plainDate;
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return dateFormatter.format(date);
}


export function formatCompanyTime(value) {
  if (!value) return "—";
  const match = String(value).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return String(value);
  const [, hourText, minute, second] = match;
  const hour = Number(hourText);
  if (hour > 23) return String(value);
  const date = new Date(2000, 0, 1, hour, Number(minute), Number(second || 0));
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
