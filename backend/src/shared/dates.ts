/**
 * Fuso da confeitaria (decisão BA). O servidor pode rodar em outro fuso (em produção costuma ser UTC):
 * às 22h do dia 28 em São Paulo já é dia 29 em UTC. "Hoje" e "este mês" sempre seguem este fuso.
 */
export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

// "en-CA" formata datas como AAAA-MM-DD, o mesmo formato das colunas "date" do banco.
const isoDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data de hoje no fuso da confeitaria, como "2026-11-28". */
export function todayInBusinessTimeZone(now: Date = new Date()): string {
  return isoDateFormat.format(now);
}

/** "2026-11" → primeiro dia do mês e primeiro dia do mês seguinte (intervalo [início, fim)). */
export function monthRange(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const pad = (value: number) => String(value).padStart(2, '0');
  return { start: `${year}-${pad(monthNumber)}-01`, end: `${nextYear}-${pad(nextMonth)}-01` };
}
