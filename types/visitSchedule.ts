export interface VisitScheduleDayMeal {
  hostName?: string;
  notes?: string;
}

export interface VisitScheduleFieldServiceMeeting {
  time?: string;
  location?: string;
  leader?: string;
  group?: string;
}

export interface FieldServiceRow {
  id?: string;
  day: string;
  time: string;
  location: string;
}

export interface MealRow {
  id?: string;
  day: string;
  host: string;
  addressPhone: string;
  isLodging?: boolean;
}

export interface ShepherdingRow {
  id?: string;
  dateTime: string;
  family: string;
  companion: string;
  situation: string;
}

export interface StudyVisitRow {
  id?: string;
  day: string;
  time: string;
  companionPhone: string;
  lesson: string;
}

export interface VisitPermissions {
  allowMidweekMeetingTimeEdit?: boolean;
  allowWeekendMeetingTimeEdit?: boolean;
  allowFieldServiceEdit?: boolean;
  allowMealsEdit?: boolean;
  allowShepherdingEdit?: boolean;
  allowStudiesEdit?: boolean;
  allowAdditionalMeetingsEdit?: boolean;
  allowEldersAgendaInputEdit?: boolean;
}

export interface ElderSuggestedTopic {
  id: string;
  suggestedBy: string;
  subject: string;
  reference?: string;
}

export interface ElderSubmittedRecommendation {
  id: string;
  role: 'elder' | 'servant';
  name: string;
  notes?: string;
}

export interface ElderSubmittedRemoval {
  id: string;
  role: 'elder' | 'servant';
  name: string;
  reason: string;
}

export interface EldersMeetingInput {
  suggestedTopics: ElderSuggestedTopic[];
  recommendations: ElderSubmittedRecommendation[];
  removals: ElderSubmittedRemoval[];
}

export interface CompanionStudyGroup {
  id: string;
  name: string;
  rows: StudyVisitRow[];
  hasWife?: boolean;
  wifeName?: string;
  wifeRows?: StudyVisitRow[];
  hasShepherding?: boolean;
  shepherding?: ShepherdingRow[];
}

export interface VisitSchedule {
  id?: string;
  userId?: string;
  congregationId?: string;
  congregationName: string;
  visitPeriod: string;
  visitId?: string;
  shareToken: string;
  circuit?: string;
  coupleNames?: string;
  activeDays?: Record<string, boolean>;
  permissions?: VisitPermissions;
  fieldService: FieldServiceRow[];
  studiesAndVisits: {
    husbandName?: string;
    wifeName?: string;
    husbandRows: StudyVisitRow[];
    wifeRows: StudyVisitRow[];
    companions?: CompanionStudyGroup[];
    [key: string]: any;
  };
  meetings: {
    midweek: {
      time?: string;

      finalPrayerBrother?: string;
      serviceTalkTheme?: string;
      serviceTalkSong?: string;
      [key: string]: any;
    };
    weekend: {
      day?: 'sabado' | 'domingo' | string;
      time?: string;
      publicTalkTheme?: string;
      publicTalkSong?: string;
      finalTalkTheme?: string;
      finalTalkSong?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  additionalMeetings: {
    pioneers: {
      day?: string;
      time?: string;
      [key: string]: any;
    };
    eldersAndServants: {
      day?: string;
      time?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  mealsHeaderTime?: string;
  meals: MealRow[];
  shepherding: ShepherdingRow[];
  eldersMeetingInput?: EldersMeetingInput;
  status?: 'rascunho' | 'preenchido' | 'confirmado';
  createdAt?: string;
  updatedAt?: string;
}

export const INITIAL_VISIT_SCHEDULE: Omit<VisitSchedule, 'id' | 'congregationId' | 'congregationName' | 'visitPeriod' | 'shareToken' | 'createdAt' | 'updatedAt'> = {
  circuit: '',
  coupleNames: '',
  activeDays: {
    terca: true,
    quarta: true,
    quinta: true,
    sexta: true,
    sabado: true,
    domingo: true,
  },
  permissions: {
    allowMidweekMeetingTimeEdit: true,
    allowWeekendMeetingTimeEdit: true,
    allowFieldServiceEdit: true,
    allowMealsEdit: true,
    allowShepherdingEdit: true,
    allowStudiesEdit: true,
    allowAdditionalMeetingsEdit: true,
    allowEldersAgendaInputEdit: true,
  },
  fieldService: [
    { day: 'Terça-feira', time: '09:00', location: 'Salão do Reino' },
    { day: 'Quarta-feira', time: '09:00', location: 'Salão do Reino' },
    { day: 'Quinta-feira', time: '09:00', location: 'Salão do Reino' },
    { day: 'Sexta-feira', time: '09:00', location: 'Salão do Reino' },
    { day: 'Sábado', time: '09:00', location: 'Salão do Reino' },
    { day: 'Domingo', time: '09:00', location: 'Salão do Reino' },
  ],
  studiesAndVisits: {
    husbandName: '',
    wifeName: '',
    husbandRows: [
      { day: 'Quarta-feira', time: '', companionPhone: '', lesson: '' },
      { day: 'Quinta-feira', time: '', companionPhone: '', lesson: '' },
      { day: 'Sexta-feira', time: '', companionPhone: '', lesson: '' },
    ],
    wifeRows: [
      { day: 'Quarta-feira', time: '', companionPhone: '', lesson: '' },
      { day: 'Quinta-feira', time: '', companionPhone: '', lesson: '' },
      { day: 'Sexta-feira', time: '', companionPhone: '', lesson: '' },
    ],
  },
  meetings: {
    midweek: {
      time: '19:30',
      finalPrayerBrother: '',
      serviceTalkTheme: '',
      serviceTalkSong: '',
    },
    weekend: {
      day: 'domingo',
      time: '09:00',
      publicTalkTheme: '',
      publicTalkSong: '',
      finalTalkTheme: '',
      finalTalkSong: '',
    },
  },
  additionalMeetings: {
    pioneers: {
      day: 'Sexta-feira',
      time: '18:00',
    },
    eldersAndServants: {
      day: 'Sábado',
      time: '17:00',
    },
  },
  mealsHeaderTime: '12:00',
  meals: [
    { day: 'Terça', host: '', addressPhone: '', isLodging: false },
    { day: 'Quarta', host: '', addressPhone: '', isLodging: false },
    { day: 'Quinta', host: '', addressPhone: '', isLodging: false },
    { day: 'Sexta', host: '', addressPhone: '', isLodging: false },
    { day: 'Sábado', host: '', addressPhone: '', isLodging: false },
    { day: 'Domingo', host: '', addressPhone: '', isLodging: false },
  ],
  shepherding: [
    { dateTime: 'Terça 15:00', family: '', companion: '', situation: '' },
    { dateTime: 'Quarta 15:00', family: '', companion: '', situation: '' },
    { dateTime: 'Quinta 15:00', family: '', companion: '', situation: '' },
    { dateTime: 'Sexta 15:00', family: '', companion: '', situation: '' },
    { dateTime: 'Sábado 15:00', family: '', companion: '', situation: '' },
  ],
  eldersMeetingInput: {
    suggestedTopics: [],
    recommendations: [],
    removals: [],
  },
  status: 'rascunho',
};

export function generateShareToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(12);
    crypto.getRandomValues(arr);
    let token = '';
    for (let i = 0; i < arr.length; i++) {
      token += chars[arr[i] % chars.length];
    }
    return token;
  }
  return Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8);
}

export function normalizeVisitSchedule(raw?: Partial<VisitSchedule> | null): VisitSchedule {
  if (!raw) {
    return {
      ...INITIAL_VISIT_SCHEDULE,
      congregationName: "",
      visitPeriod: "Semana da Visita",
      shareToken: generateShareToken(),
      fieldService: [...INITIAL_VISIT_SCHEDULE.fieldService],
      meals: [...INITIAL_VISIT_SCHEDULE.meals],
      shepherding: [...INITIAL_VISIT_SCHEDULE.shepherding],
      studiesAndVisits: {
        ...INITIAL_VISIT_SCHEDULE.studiesAndVisits,
        husbandRows: [...INITIAL_VISIT_SCHEDULE.studiesAndVisits.husbandRows],
        wifeRows: [...INITIAL_VISIT_SCHEDULE.studiesAndVisits.wifeRows],
      },
      eldersMeetingInput: {
        suggestedTopics: [],
        recommendations: [],
        removals: [],
      },
    };
  }

  return {
    ...INITIAL_VISIT_SCHEDULE,
    ...raw,
    congregationName: raw.congregationName || "",
    visitPeriod: raw.visitPeriod || "Semana da Visita",
    shareToken: raw.shareToken || generateShareToken(),
    activeDays: {
      ...INITIAL_VISIT_SCHEDULE.activeDays,
      ...(raw.activeDays || {}),
    },
    permissions: {
      ...INITIAL_VISIT_SCHEDULE.permissions,
      ...(raw.permissions || {}),
    },
    fieldService: Array.isArray(raw.fieldService)
      ? raw.fieldService.map((fs: any) => ({
          ...fs,
          day: (fs.day || '').replace(/doming0/gi, 'Domingo').trim(),
        }))
      : [...INITIAL_VISIT_SCHEDULE.fieldService],
    meals: Array.isArray(raw.meals)
      ? raw.meals.map((m: any, idx: number) => ({
          id: m.id || Date.now().toString() + '_' + idx,
          day: (m.day || '').replace(/-feira/gi, '').replace(/doming0/gi, 'Domingo').trim(),
          host: m.isLodging ? (m.host || 'Hospedagem') : (m.host || ''),
          addressPhone: m.isLodging ? (m.addressPhone || 'Almoço na Hospedagem') : (m.addressPhone || ''),
          isLodging: !!m.isLodging,
        }))
      : [...INITIAL_VISIT_SCHEDULE.meals],
    shepherding: Array.isArray(raw.shepherding) ? raw.shepherding : [...INITIAL_VISIT_SCHEDULE.shepherding],
    studiesAndVisits: {
      ...INITIAL_VISIT_SCHEDULE.studiesAndVisits,
      ...(raw.studiesAndVisits || {}),
      husbandName: raw.studiesAndVisits?.husbandName || "",
      wifeName: raw.studiesAndVisits?.wifeName || "",
      husbandRows: Array.isArray(raw.studiesAndVisits?.husbandRows)
        ? raw.studiesAndVisits.husbandRows
        : [...INITIAL_VISIT_SCHEDULE.studiesAndVisits.husbandRows],
      wifeRows: Array.isArray(raw.studiesAndVisits?.wifeRows)
        ? raw.studiesAndVisits.wifeRows
        : [...INITIAL_VISIT_SCHEDULE.studiesAndVisits.wifeRows],
      companions: Array.isArray(raw.studiesAndVisits?.companions)
        ? raw.studiesAndVisits.companions.map((c: any) => ({
            id: c.id || Date.now().toString(),
            name: c.name || '',
            rows: Array.isArray(c.rows) ? c.rows : [],
            hasWife: !!c.hasWife,
            wifeName: c.wifeName || '',
            wifeRows: Array.isArray(c.wifeRows) ? c.wifeRows : [],
            hasShepherding: !!c.hasShepherding,
            shepherding: Array.isArray(c.shepherding) ? c.shepherding : [],
          }))
        : [],
    },

    meetings: {
      ...INITIAL_VISIT_SCHEDULE.meetings,
      ...(raw.meetings || {}),
      midweek: {
        ...INITIAL_VISIT_SCHEDULE.meetings.midweek,
        ...(raw.meetings?.midweek || {}),
      },
      weekend: {
        ...INITIAL_VISIT_SCHEDULE.meetings.weekend,
        ...(raw.meetings?.weekend || {}),
      },
    },
    additionalMeetings: {
      ...INITIAL_VISIT_SCHEDULE.additionalMeetings,
      ...(raw.additionalMeetings || {}),
      pioneers: {
        ...INITIAL_VISIT_SCHEDULE.additionalMeetings.pioneers,
        ...(raw.additionalMeetings?.pioneers || {}),
      },
      eldersAndServants: {
        ...INITIAL_VISIT_SCHEDULE.additionalMeetings.eldersAndServants,
        ...(raw.additionalMeetings?.eldersAndServants || {}),
      },
    },
    eldersMeetingInput: {
      suggestedTopics: Array.isArray(raw.eldersMeetingInput?.suggestedTopics)
        ? raw.eldersMeetingInput!.suggestedTopics.map((t: any, idx: number) => ({
            id: t.id || `sug_${idx}_${Date.now()}`,
            suggestedBy: t.suggestedBy || '',
            subject: (t.subject || '').toUpperCase(),
            reference: t.reference || '',
          }))
        : [],
      recommendations: Array.isArray(raw.eldersMeetingInput?.recommendations)
        ? raw.eldersMeetingInput!.recommendations.map((r: any, idx: number) => ({
            id: r.id || `rec_${idx}_${Date.now()}`,
            role: r.role === 'servant' ? 'servant' : 'elder',
            name: r.name || '',
            notes: r.notes || '',
          }))
        : [],
      removals: Array.isArray(raw.eldersMeetingInput?.removals)
        ? raw.eldersMeetingInput!.removals.map((rem: any, idx: number) => ({
            id: rem.id || `rem_${idx}_${Date.now()}`,
            role: rem.role === 'servant' ? 'servant' : 'elder',
            name: rem.name || '',
            reason: rem.reason || '',
          }))
        : [],
    },
  };
}
