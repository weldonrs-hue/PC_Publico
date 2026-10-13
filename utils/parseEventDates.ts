/**
 * Parser inteligente de strings de data e hora em português para o sistema de Eventos e Tarefas (Planner).
 * Suporta formatos comuns como:
 * - "15 de Outubro de 2026"
 * - "15 de Outubro" (usa o ano padrão informado ou ano atual)
 * - "15/10/2026", "15/10"
 * - "2026-10-15"
 * - "12-14 de Junho, 2026" ou "12 a 14 de Junho" (extrai a data inicial)
 * - "Sábado, 14:00", "10 de Outubro às 19:30", "14h", "14h30", "14:00"
 */

const MONTHS_MAP: Record<string, number> = {
  janeiro: 1, jan: 1,
  fevereiro: 2, fev: 2,
  marco: 3, março: 3, mar: 3,
  abril: 4, abr: 4,
  maio: 5, mai: 5,
  junho: 6, jun: 6,
  julho: 7, jul: 7,
  agosto: 8, ago: 8,
  setembro: 9, set: 9,
  outubro: 10, out: 10,
  novembro: 11, nov: 11,
  dezembro: 12, dez: 12,
};

export interface ParsedDateTimeResult {
  date: string; // YYYY-MM-DD ou ''
  time: string; // HH:mm ou ''
  confidence: 'high' | 'medium' | 'low';
  originalText: string;
}

export function parsePortugueseDateTime(
  rawText?: string | null,
  fallbackYear?: number | string
): ParsedDateTimeResult {
  const result: ParsedDateTimeResult = {
    date: '',
    time: '',
    confidence: 'low',
    originalText: rawText || '',
  };

  if (!rawText || typeof rawText !== 'string') {
    return result;
  }

  const clean = rawText.trim();
  if (!clean) return result;

  const currentYear = fallbackYear 
    ? (typeof fallbackYear === 'number' ? fallbackYear : parseInt(String(fallbackYear).slice(0, 4), 10) || new Date().getFullYear())
    : new Date().getFullYear();

  // 1. Extração de Horário (HH:mm ou HHh ou HHhMM)
  const timeMatch = clean.match(/(?:às|as|\b)\s*(\d{1,2})(?::|h)(\d{2})?\b/i);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (hours >= 0 && hours <= 23 && mins >= 0 && mins <= 59) {
      result.time = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
  }

  // 2. Formato ISO já válido: YYYY-MM-DD
  const isoMatch = clean.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    result.date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    result.confidence = 'high';
    return result;
  }

  // 3. Formato numérico DD/MM/YYYY ou DD/MM
  const slashMatch = clean.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    let year = slashMatch[3] ? parseInt(slashMatch[3], 10) : currentYear;
    if (year < 100) year += 2000;

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      result.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      result.confidence = 'high';
      return result;
    }
  }

  // 4. Formato por extenso: "15 de Outubro de 2026", "15 de Outubro", "12 a 14 de Junho, 2026", "12-14 de Junho"
  const normalized = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const textDateMatch = normalized.match(
    /\b(\d{1,2})(?:\s*(?:-|a|ate)\s*\d{1,2})?\s+de\s+([a-z]+)(?:\s+(?:de\s+|,)?\s*(\d{4}))?/i
  );

  if (textDateMatch) {
    const day = parseInt(textDateMatch[1], 10);
    const monthName = textDateMatch[2].toLowerCase();
    const month = MONTHS_MAP[monthName];
    const year = textDateMatch[3] ? parseInt(textDateMatch[3], 10) : currentYear;

    if (day >= 1 && day <= 31 && month) {
      result.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      result.confidence = 'high';
      return result;
    }
  }

  // 5. Dia + mês sem "de" (ex: "15 Out 2026", "15 Outubro")
  const shortTextMatch = normalized.match(
    /\b(\d{1,2})\s+([a-z]{3,9})(?:\s+(\d{4}))?\b/i
  );
  if (shortTextMatch) {
    const day = parseInt(shortTextMatch[1], 10);
    const month = MONTHS_MAP[shortTextMatch[2].toLowerCase()];
    const year = shortTextMatch[3] ? parseInt(shortTextMatch[3], 10) : currentYear;

    if (day >= 1 && day <= 31 && month) {
      result.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      result.confidence = 'medium';
      return result;
    }
  }

  return result;
}
