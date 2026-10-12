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
    { day: 'Terça-feira', host: '', addressPhone: '' },
    { day: 'Quarta-feira', host: '', addressPhone: '' },
    { day: 'Quinta-feira', host: '', addressPhone: '' },
    { day: 'Sexta-feira', host: '', addressPhone: '' },
    { day: 'Sábado', host: '', addressPhone: '' },
    { day: 'Domingo', host: '', addressPhone: '' },
  ],
  shepherding: [
    { dateTime: 'Terça 15:00', family: '', companion: '', situation: '' },
    { dateTime: 'Quarta 15:00', family: '', companion: '', situation: '' },
    { dateTime: 'Quinta 15:00', family: '', companion: '', situation: '' },
    { dateTime: 'Sexta 15:00', family: '', companion: '', situation: '' },
    { dateTime: 'Sábado 15:00', family: '', companion: '', situation: '' },
  ],
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
    fieldService: Array.isArray(raw.fieldService) ? raw.fieldService : [...INITIAL_VISIT_SCHEDULE.fieldService],
    meals: Array.isArray(raw.meals) ? raw.meals : [...INITIAL_VISIT_SCHEDULE.meals],
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
  };
}
