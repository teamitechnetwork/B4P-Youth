const dateOnlyFields = new Set([
  "dateOfBirth",
  "deadline",
  "startDate",
  "endDate",
  "applicationDeadline",
  "date",
  "eventDate",
]);

function normalizeDates(value: unknown, key?: string): unknown {
  if (value instanceof Date) {
    return dateOnlyFields.has(key ?? "")
      ? value.toISOString().slice(0, 10)
      : value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDates(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        normalizeDates(childValue, childKey),
      ]),
    );
  }
  return value;
}

export function parseApiResponse(
  schema: { parse(value: unknown): unknown },
  value: unknown,
): unknown {
  return normalizeDates(schema.parse(value));
}
