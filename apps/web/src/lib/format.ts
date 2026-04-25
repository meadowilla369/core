const shortDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit"
});

const mediumDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit"
});

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

export function formatVnd(amount: number): string {
  return currencyFormatter.format(amount);
}

export function formatShortEventDate(value: string): string {
  const date = new Date(value);
  const parts = shortDateFormatter.formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${day} Th${month}`;
}

export function formatMediumEventDate(value: string): string {
  return mediumDateFormatter.format(new Date(value));
}

export function formatTime(value: string): string {
  return timeFormatter.format(new Date(value));
}

export function formatTimeRange(startAt: string, endAt: string): string {
  return `${formatTime(startAt)} - ${formatTime(endAt)}`;
}

export function isFutureIso(value: string): boolean {
  return new Date(value).getTime() >= Date.now();
}

export function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "EN";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}
