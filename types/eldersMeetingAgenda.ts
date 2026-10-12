export interface AgendaTopicItem {
  id: string;
  subject: string;
  reference: string;
}

export interface AgendaRecommendationItem {
  id: string;
  name: string;
  decision: string;
}

export interface EldersMeetingAgenda {
  id?: string;
  userId?: string;
  congregationId?: string;
  congregationName: string;
  visitPeriod: string;
  visitId?: string;
  locationAndDate: string;
  openingPrayer: string;
  closingPrayer: string;
  topics: AgendaTopicItem[];
  elderRecommendations: AgendaRecommendationItem[];
  servantRecommendations: AgendaRecommendationItem[];
  footerNote: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_AGENDA_FOOTER_NOTE =
  'Querido ancião, por favor, considere todos os assuntos com oração e com base em todas as referências bíblicas e teocráticas. (Pro. 11:14; Sal. 127:1)';

export function normalizeEldersMeetingAgenda(
  raw?: Partial<EldersMeetingAgenda> | null,
  fallbackCongregationName: string = '',
  fallbackVisitPeriod: string = ''
): EldersMeetingAgenda {
  const defaultLocationAndDate = fallbackVisitPeriod
    ? `Salão do Reino — ${fallbackVisitPeriod}`
    : 'Salão do Reino';

  if (!raw) {
    return {
      congregationName: fallbackCongregationName,
      visitPeriod: fallbackVisitPeriod,
      locationAndDate: defaultLocationAndDate,
      openingPrayer: '',
      closingPrayer: '',
      topics: [
        { id: 'topic_1', subject: '', reference: '' },
        { id: 'topic_2', subject: '', reference: '' },
        { id: 'topic_3', subject: '', reference: '' },
      ],
      elderRecommendations: [],
      servantRecommendations: [],
      footerNote: DEFAULT_AGENDA_FOOTER_NOTE,
    };
  }

  return {
    ...raw,
    congregationName: raw.congregationName ?? fallbackCongregationName,
    visitPeriod: raw.visitPeriod ?? fallbackVisitPeriod,
    locationAndDate:
      raw.locationAndDate !== undefined ? raw.locationAndDate : defaultLocationAndDate,
    openingPrayer: raw.openingPrayer ?? '',
    closingPrayer: raw.closingPrayer ?? '',
    topics:
      Array.isArray(raw.topics) && raw.topics.length > 0
        ? raw.topics.map((t, idx) => ({
            id: t.id || `topic_${idx}_${Date.now()}`,
            subject: t.subject ?? '',
            reference: t.reference ?? '',
          }))
        : [
            { id: 'topic_1', subject: '', reference: '' },
            { id: 'topic_2', subject: '', reference: '' },
            { id: 'topic_3', subject: '', reference: '' },
          ],
    elderRecommendations: Array.isArray(raw.elderRecommendations)
      ? raw.elderRecommendations.map((r, idx) => ({
          id: r.id || `elder_${idx}_${Date.now()}`,
          name: r.name ?? '',
          decision: r.decision ?? '',
        }))
      : [],
    servantRecommendations: Array.isArray(raw.servantRecommendations)
      ? raw.servantRecommendations.map((r, idx) => ({
          id: r.id || `servant_${idx}_${Date.now()}`,
          name: r.name ?? '',
          decision: r.decision ?? '',
        }))
      : [],
    footerNote:
      raw.footerNote !== undefined ? raw.footerNote : DEFAULT_AGENDA_FOOTER_NOTE,
  };
}

