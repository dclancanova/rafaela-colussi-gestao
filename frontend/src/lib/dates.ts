// Datas sem hora (decisão BA) chegam da API como texto "2026-11-28".
// Nunca passam por `new Date("2026-11-28")`: isso é lido como meia-noite em UTC,
// que no Brasil ainda é o dia 27, e a data apareceria um dia antes.

const pad = (value: number) => String(value).padStart(2, '0');

/** Hoje no relógio do computador de quem usa (o fuso de vocês), como "2026-11-28". */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Mês atual, como "2026-11". */
export function currentMonth(now: Date = new Date()): string {
  return todayIso(now).slice(0, 7);
}

/** "2026-11-28" → "28/11/2026" */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

const monthNames = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "2026-11" → "novembro de 2026" */
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  return `${monthNames[monthNumber - 1]} de ${year}`;
}

/** "2026-11", +1 → "2026-12"; "2026-01", −1 → "2025-12" */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** Aceita só meses válidos vindos da URL ("2026-11"); qualquer outra coisa vira null. */
export function parseMonth(value: string | null): string | null {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}
