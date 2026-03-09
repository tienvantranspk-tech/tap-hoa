const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
};

export const nextDailyCode = (prefix: string, lastCode: string | null, date = new Date()) => {
  const datePart = formatDate(date);
  const nextSeq = lastCode ? Number(lastCode.split("-").at(-1) ?? "0") + 1 : 1;
  return `${prefix}-${datePart}-${String(nextSeq).padStart(4, "0")}`;
};

export const dayRange = (date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};
