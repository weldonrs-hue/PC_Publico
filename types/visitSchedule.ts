export interface FieldServiceRow {
  id: string;
  day: string;
  time: string;
  location: string;
}

export interface StudyVisitRow {
  id: string;
  day: string;
  time: string;
  companionPhone: string;
  lesson: string;
}

export interface MealRow {
  id: string;
  day: string;
  host: string;
  addressPhone: string;
}

export interface ShepherdingRow {
  id: string;
  dateTime: string;
  family: string;
  companion: string;
  situation: string;
}

export interface VisitPermissions {
  allowMidweekMeetingTimeEdit: boolean;
  allowWeekendMeetingTimeEdit: boolean;
  allowFieldServiceEdit: boolean;
  allowMealsEdit: boolean;
  allowShepherdingEdit: boolean;
  allowStudiesEdit: boolean;
  allowAdditionalMeetingsEdit: boolean;
}


export interface VisitSchedule {
  id?: string;
  userId: string;
  congregationId: string;
  congregationName: string;
  visitPeriod: string; // Ex: "14/10/2026 a 19/10/2026"
  coupleNames: string; // Ex: "Marcelo e Aline"
  
  // Dias da visita
  activeDays: {
    ter: boolean;
    qua: boolean;
    qui: boolean;
    sex: boolean;
    sab: boolean;
    dom: boolean;
  };

  // 1. Serviço de Campo
  fieldService: FieldServiceRow[];

  // 2. Estudos e Revisitas
  studiesAndVisits: {
    husbandName: string;
    husbandRows: StudyVisitRow[];
    wifeName: string;
    wifeRows: StudyVisitRow[];
  };

  // 3. Reuniões
  meetings: {
    midweek: {
      time: string;
      serviceTalkTheme: string;
      serviceTalkSong: string;
      finalPrayerBrother: string;
    };
    weekend: {
      day: 'sabado' | 'domingo' | '';
      time: string;
      publicTalkTheme: string;
      publicTalkSong: string;
      finalTalkTheme: string;
      finalTalkSong: string;
    };
  };

  // 4. Reuniões Adicionais
  additionalMeetings: {
    pioneers: {
      day: string;
      time: string;
    };
    eldersAndServants: {
      day: string;
      time: string;
    };
  };

  // 5. Refeições
  mealsHeaderTime: string; // Padrão: "(11:30)"
  meals: MealRow[];

  // 6. Pastoreio
  shepherding: ShepherdingRow[];

  // Controle de link e permissões
  shareToken: string;
  status: 'rascunho' | 'compartilhado' | 'preenchido' | 'finalizado';
  permissions: VisitPermissions;
  
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_VISIT_PERMISSIONS: VisitPermissions = {
  allowMidweekMeetingTimeEdit: true,
  allowWeekendMeetingTimeEdit: true,
  allowFieldServiceEdit: true,
  allowMealsEdit: true,
  allowShepherdingEdit: true,
  allowStudiesEdit: true,
  allowAdditionalMeetingsEdit: false,
};


export const INITIAL_VISIT_SCHEDULE: Omit<VisitSchedule, 'id' | 'userId' | 'congregationId' | 'congregationName' | 'visitPeriod' | 'shareToken' | 'createdAt' | 'updatedAt'> = {
  coupleNames: 'Marcelo e Aline',
  activeDays: {
    ter: true,
    qua: true,
    qui: true,
    sex: true,
    sab: true,
    dom: true,
  },
  fieldService: [
    { id: '1', day: 'Quarta', time: '', location: '' },
    { id: '2', day: 'Quarta', time: '', location: '' },
    { id: '3', day: 'Quinta', time: '', location: '' },
    { id: '4', day: 'Quinta', time: '', location: '' },
    { id: '5', day: 'Sexta', time: '', location: '' },
    { id: '6', day: 'Sábado', time: '', location: '' },
    { id: '7', day: 'Domingo', time: '', location: '' },
  ],
  studiesAndVisits: {
    husbandName: 'MARCELO',
    husbandRows: [
      { id: '1', day: 'Quarta', time: '', companionPhone: '', lesson: '' },
      { id: '2', day: 'Quinta', time: '', companionPhone: '', lesson: '' },
    ],
    wifeName: 'ALINE',
    wifeRows: [
      { id: '1', day: 'Quarta', time: '', companionPhone: '', lesson: '' },
      { id: '2', day: 'Quinta', time: '', companionPhone: '', lesson: '' },
    ],
  },
  meetings: {
    midweek: {
      time: '',
      serviceTalkTheme: '',
      serviceTalkSong: '',
      finalPrayerBrother: '',
    },
    weekend: {
      day: 'domingo',
      time: '',
      publicTalkTheme: '',
      publicTalkSong: '',
      finalTalkTheme: '',
      finalTalkSong: '',
    },
  },
  additionalMeetings: {
    pioneers: { day: '', time: '' },
    eldersAndServants: { day: '', time: '' },
  },
  mealsHeaderTime: '(11:30)',
  meals: [
    { id: '1', day: 'Terça', host: '', addressPhone: '' },
    { id: '2', day: 'Quarta', host: '', addressPhone: '' },
    { id: '3', day: 'Quinta', host: '', addressPhone: '' },
    { id: '4', day: 'Sexta', host: '', addressPhone: '' },
    { id: '5', day: 'Sábado', host: '', addressPhone: '' },
    { id: '6', day: 'Domingo', host: '', addressPhone: '' },
  ],
  shepherding: [
    { id: '1', dateTime: '', family: '', companion: '', situation: '' },
    { id: '2', dateTime: '', family: '', companion: '', situation: '' },
  ],
  status: 'rascunho',
  permissions: DEFAULT_VISIT_PERMISSIONS,
};
