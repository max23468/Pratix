export type QuarterOption = {
  key: string;
  label: string;
  start: string;
  end: string;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const dateInputValue = (year: number, month: number, day: number) =>
  `${year}-${pad2(month)}-${pad2(day)}`;

const compactDate = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;

export const todayDateInput = () => {
  const now = new Date();
  return dateInputValue(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

export const quarterRange = (year: number, quarter: number) => {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const endDay = new Date(year, endMonth, 0).getDate();
  return {
    start: dateInputValue(year, startMonth, 1),
    end: dateInputValue(year, endMonth, endDay),
  };
};

export const quarterOption = (year: number, quarter: number): QuarterOption => {
  const range = quarterRange(year, quarter);
  return {
    key: `${year}-Q${quarter}`,
    label: `${quarter}° trimestre ${year} (${compactDate(range.start)}-${compactDate(range.end)})`,
    ...range,
  };
};

export const currentQuarterOption = () => {
  const now = new Date();
  return quarterOption(now.getFullYear(), Math.floor(now.getMonth() / 3) + 1);
};

export const buildQuarterOptions = () => {
  const year = new Date().getFullYear();
  return [year - 2, year - 1, year, year + 1].flatMap((optionYear) =>
    [1, 2, 3, 4].map((quarter) => quarterOption(optionYear, quarter)),
  );
};

export const quarterKeyForPeriod = (start: string, end: string) => {
  const match = /^(\d{4})-(\d{2})-01$/.exec(start);
  if (!match) return null;
  const year = Number(match[1]);
  const startMonth = Number(match[2]);
  if (![1, 4, 7, 10].includes(startMonth)) return null;
  const quarter = (startMonth - 1) / 3 + 1;
  const range = quarterRange(year, quarter);
  return range.start === start && range.end === end ? `${year}-Q${quarter}` : null;
};

export const invoicePeriodLabel = (
  period?: { period_start: string; period_end: string } | null,
) => {
  if (!period?.period_start || !period.period_end) return "—";
  const quarterKey = quarterKeyForPeriod(period.period_start, period.period_end);
  if (quarterKey) {
    const [yearPart, quarterPart] = quarterKey.split("-Q");
    return `${Number(quarterPart)}° trimestre ${yearPart}`;
  }
  return `${compactDate(period.period_start)}-${compactDate(period.period_end)}`;
};
