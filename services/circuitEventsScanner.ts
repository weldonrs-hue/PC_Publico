import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { parsePortugueseDateTime } from '@/utils/parseEventDates';

export interface ScannedCircuitEvent {
  key: string;              // Identificador único (ex: 'assembly_supt_part_0_event')
  category: 'assembly' | 'convention' | 'pioneer_meeting' | 'emr' | 'pioneer_school';
  categoryLabel: string;   // Ex: 'Assembleia com Viajante (CAco)'
  title: string;           // Ex: 'Assembleia de Circuito • Parte A'
  subtitle?: string;       // Ex: 'Evento Oficial' ou 'Ensaio'
  rawDate: string;         // String original cadastrada
  date: string;            // YYYY-MM-DD sugerido
  time: string;            // HH:mm sugerido
  location: string;        // Local cadastrado
  notes?: string;          // Informações adicionais
  alreadyImported: boolean;// Se já existe evento idêntico em planner_items
  selected: boolean;       // Marcado para importação
}

/**
 * Escaneia todas as coleções de eventos do circuito do usuário e retorna a lista de eventos encontrados
 * com datas sugeridas prontas para confirmação.
 */
export async function scanCircuitEvents(userId: string): Promise<ScannedCircuitEvent[]> {
  if (!userId) return [];

  const foundEvents: ScannedCircuitEvent[] = [];

  // 0. Buscar itens já existentes em planner_items para saber se já foi importado
  const existingKeys = new Set<string>();
  try {
    const qPlanner = query(collection(db, 'planner_items'), where('userId', '==', userId));
    const plannerSnap = await getDocs(qPlanner);
    plannerSnap.forEach((d) => {
      const data = d.data();
      if (data.notes && typeof data.notes === 'string') {
        const match = data.notes.match(/\[origem:([^\]]+)\]/);
        if (match) existingKeys.add(match[1]);
      }
      // Também verifica combinação de título + data
      if (data.title && data.date) {
        existingKeys.add(`${data.title.toLowerCase().trim()}_${data.date}`);
      }
    });
  } catch (err) {
    console.warn('Erro ao verificar eventos existentes no planner:', err);
  }

  // Helper para cadastrar item encontrado
  const addEvent = (
    key: string,
    category: ScannedCircuitEvent['category'],
    categoryLabel: string,
    title: string,
    subtitle: string,
    rawDate: string | undefined | null,
    location: string | undefined | null,
    notes?: string,
    fallbackYear?: number | string
  ) => {
    if (!rawDate || !rawDate.trim()) return;

    const parsed = parsePortugueseDateTime(rawDate, fallbackYear);
    const dateKey = `${title.toLowerCase().trim()}_${parsed.date}`;
    const alreadyImported = existingKeys.has(key) || (parsed.date ? existingKeys.has(dateKey) : false);

    foundEvents.push({
      key,
      category,
      categoryLabel,
      title,
      subtitle,
      rawDate: rawDate.trim(),
      date: parsed.date,
      time: parsed.time,
      location: (location || '').trim(),
      notes,
      alreadyImported,
      selected: !alreadyImported && Boolean(parsed.date),
    });
  };

  // 1. ASSEMBLEIA COM O VIAJANTE (CAco)
  try {
    const snapSupt = await getDoc(doc(db, 'circuit_assembly_supt_speakers', userId));
    if (snapSupt.exists()) {
      const data = snapSupt.data();
      const parts = data.parts || {};
      const partLetters = ['Parte A', 'Parte B', 'Parte C', 'Parte D'];

      Object.keys(parts).forEach((k) => {
        const idx = parseInt(k, 10);
        const part = parts[idx];
        const label = partLetters[idx] || `Parte ${idx + 1}`;
        if (part?.details) {
          // Evento
          addEvent(
            `assembly_supt_part_${idx}_event`,
            'assembly',
            'Assembleia de Circuito (CAco)',
            `Assembleia com Viajante • ${label}`,
            'Evento',
            part.details.eventDate,
            part.details.eventLocation,
            `Assembleia com o Superintendente de Circuito (${label})`
          );
          // Ensaio
          addEvent(
            `assembly_supt_part_${idx}_rehearsal`,
            'assembly',
            'Assembleia de Circuito (CAco)',
            `Ensaio da Assembleia • ${label}`,
            'Ensaio',
            part.details.rehearsalDate,
            part.details.rehearsalLocation,
            `Ensaio da Assembleia (${label})`
          );
        }
      });
    }
  } catch (err) {
    console.error('Erro ao buscar dados de Assembleia CAco:', err);
  }

  // 2. ASSEMBLEIA COM O REPRESENTANTE DE BETEL (CAbr)
  try {
    const snapBranch = await getDoc(doc(db, 'circuit_assembly_branch_speakers', userId));
    if (snapBranch.exists()) {
      const data = snapBranch.data();
      const parts = data.parts || {};
      const partLetters = ['Parte A', 'Parte B', 'Parte C', 'Parte D'];

      Object.keys(parts).forEach((k) => {
        const idx = parseInt(k, 10);
        const part = parts[idx];
        const label = partLetters[idx] || `Parte ${idx + 1}`;
        if (part?.details) {
          // Evento
          addEvent(
            `assembly_branch_part_${idx}_event`,
            'assembly',
            'Assembleia de Circuito (CAbr)',
            `Assembleia com Representante • ${label}`,
            'Evento',
            part.details.eventDate,
            part.details.eventLocation,
            `Assembleia com o Representante de Betel (${label})`
          );
          // Ensaio
          addEvent(
            `assembly_branch_part_${idx}_rehearsal`,
            'assembly',
            'Assembleia de Circuito (CAbr)',
            `Ensaio da Assembleia • ${label}`,
            'Ensaio',
            part.details.rehearsalDate,
            part.details.rehearsalLocation,
            `Ensaio da Assembleia (${label})`
          );
        }
      });
    }
  } catch (err) {
    console.error('Erro ao buscar dados de Assembleia CAbr:', err);
  }

  // 3. CONGRESSO REGIONAL
  try {
    const snapCongresso = await getDoc(doc(db, 'regional_convention_speakers', userId));
    if (snapCongresso.exists()) {
      const data = snapCongresso.data();
      if (data.details) {
        // Evento
        addEvent(
          'regional_convention_event',
          'convention',
          'Congresso Regional',
          'Congresso Regional',
          'Evento (3 Dias)',
          data.details.eventDate,
          data.details.eventLocation,
          data.details.conventionTheme ? `Tema: “${data.details.conventionTheme}”` : undefined
        );
        // Treinamento / Ensaio
        if (data.details.trainingDate) {
          addEvent(
            'regional_convention_training',
            'convention',
            'Congresso Regional',
            'Reunião Preparatória do Congresso',
            'Reunião / Treinamento',
            data.details.trainingDate,
            data.details.trainingLocation
          );
        }
      }
    }
  } catch (err) {
    console.error('Erro ao buscar dados do Congresso Regional:', err);
  }

  // 4. REUNIÃO ESPECIAL COM PIONEIROS (S-312)
  try {
    const snapPio = await getDoc(doc(db, 'special_pioneer_meeting_speakers', userId));
    if (snapPio.exists()) {
      const data = snapPio.data();
      const parts = data.parts || {};
      const partLetters = ['Parte A', 'Parte B', 'Parte C', 'Parte D'];

      Object.keys(parts).forEach((k) => {
        const idx = parseInt(k, 10);
        const part = parts[idx];
        const label = partLetters[idx] || `Parte ${idx + 1}`;
        if (part?.details) {
          // Reunião
          addEvent(
            `special_pioneer_part_${idx}_event`,
            'pioneer_meeting',
            'Reunião Especial de Pioneiros (S-312)',
            `Reunião com Pioneiros • ${label}`,
            'Reunião Especial',
            part.details.eventDate,
            part.details.eventLocation,
            part.details.startTime ? `Início às ${part.details.startTime}` : undefined
          );
          // Ensaio
          addEvent(
            `special_pioneer_part_${idx}_rehearsal`,
            'pioneer_meeting',
            'Reunião Especial de Pioneiros (S-312)',
            `Ensaio da Reunião de Pioneiros • ${label}`,
            'Ensaio',
            part.details.rehearsalDate,
            part.details.rehearsalLocation
          );
        }
      });
    }
  } catch (err) {
    console.error('Erro ao buscar dados da Reunião Especial de Pioneiros:', err);
  }

  // 5. ESCOLA DO MINISTÉRIO DO REINO (EMR - Anciãos e Servos)
  try {
    // EMR Anciãos
    const snapEmrAncians = await getDoc(doc(db, 'emr_ancians_data', userId));
    if (snapEmrAncians.exists()) {
      const data = snapEmrAncians.data();
      const parts = data.parts || {};
      Object.keys(parts).forEach((k) => {
        const idx = parseInt(k, 10);
        const part = parts[idx];
        if (part?.details?.data) {
          addEvent(
            `emr_ancians_turma_${idx}`,
            'emr',
            'Escola do Ministério do Reino',
            `EMR (Anciãos) • Turma ${idx + 1}`,
            'Escola',
            part.details.data,
            part.details.local || part.details.endereco,
            part.details.horarioInicio ? `Horário: ${part.details.horarioInicio} às ${part.details.horarioFim || '16:00'}` : undefined
          );
        }
      });
    }

    // EMR Servos
    const snapEmrServants = await getDoc(doc(db, 'emr_servants_data', userId));
    if (snapEmrServants.exists()) {
      const data = snapEmrServants.data();
      const parts = data.parts || {};
      Object.keys(parts).forEach((k) => {
        const idx = parseInt(k, 10);
        const part = parts[idx];
        if (part?.details?.data) {
          addEvent(
            `emr_servants_turma_${idx}`,
            'emr',
            'Escola do Ministério do Reino',
            `EMR (Servos Ministeriais) • Turma ${idx + 1}`,
            'Escola',
            part.details.data,
            part.details.local || part.details.endereco,
            part.details.horarioInicio ? `Horário: ${part.details.horarioInicio} às ${part.details.horarioFim || '16:00'}` : undefined
          );
        }
      });
    }
  } catch (err) {
    console.error('Erro ao buscar dados da EMR:', err);
  }

  // 6. ESCOLA DE PIONEIROS
  try {
    for (const turmaNum of ['1', '2', '3']) {
      const snapPioSchool = await getDoc(doc(db, 'pioneer_school_info', `${userId}_turma${turmaNum}`));
      if (snapPioSchool.exists()) {
        const data = snapPioSchool.data();
        if (data.dataTurma) {
          addEvent(
            `pioneer_school_turma_${turmaNum}`,
            'pioneer_school',
            'Escola de Pioneiros',
            `Escola de Pioneiros • Turma ${turmaNum}`,
            'Escola',
            data.dataTurma,
            data.localEscola || data.enderecoEscola,
            data.instrutorA ? `Instrutores: ${data.instrutorA}${data.instrutorB ? ` e ${data.instrutorB}` : ''}` : undefined
          );
        }
      }
    }
  } catch (err) {
    console.error('Erro ao buscar dados da Escola de Pioneiros:', err);
  }

  return foundEvents;
}
