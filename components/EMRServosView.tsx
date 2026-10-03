'use client';

import { useState, useEffect, Fragment } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { 
  GraduationCap, 
  ChevronLeft, 
  Calendar, 
  Save, 
  Loader2, 
  MapPin, 
  Check,
  CalendarDays,
  Clock,
  BookOpen,
  X,
  Mail,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { useDialog } from '@/hooks/useDialog';
import { cleanPSSMetadata, formatDocxError } from '@/lib/docxUtils';

interface EMRServosViewProps {
  userId: string;
  onBack: () => void;
  congregations?: any[];
}

interface EMRDetails {
  data: string;
  local: string;
  endereco: string;
  anfitria: string;
  horarioInicio: string;
  horarioFim: string;
  horarioEsposas: string;
}

interface EMRPartData {
  speakers: Record<string, string>;
  congregations: Record<string, string>;
  confirmations: Record<string, boolean>;
  notes: Record<string, string>;
  details: EMRDetails;
}

const EMR_SERVOS_PROGRAM_2027 = {
  title: 'Programação dos instrutores da Escola do Ministério do Reino de 2027 — Servos Ministeriais',
  year: '2027',
  color: '#F43F5E',
  sessions: [
    {
      period: 'Parte 1',
      items: [
        { id: 's1_1', time: '8:00', title: 'Cântico 101 e oração', noSpeaker: true },
        { id: 's1_2', num: '1', time: '8:05', title: 'Bem-vindos à Escola do Ministério do Reino de 2027', duration: '15 min', sigla: 'IA/SC*' },
        { id: 's1_3', num: '2', time: '8:20', title: 'Vocês são homens “cheios de espírito e de sabedoria”', duration: '25 min', sigla: 'SC/A#' },
        { 
          id: 's1_4', 
          label: 'Série de discursos:', 
          title: 'Fortaleça o seu amor por', 
          isSeries: true,
          subitems: [
            { id: 's1_4_1', num: '3', time: '8:45', title: 'Jeová', duration: '25 min', sigla: 'A' },
            { id: 's1_4_2', num: '4', time: '9:10', title: 'Jesus', duration: '25 min', sigla: 'A' },
            { id: 's1_4_3', num: '5', time: '9:35', title: 'Outros anciãos e servos ministeriais', duration: '25 min', sigla: 'A' },
            { id: 's1_4_4', num: '6', time: '10:00', title: 'Seus irmãos e irmãs', duration: '25 min', sigla: 'A' }
          ]
        },
        { id: 's1_5', time: '10:25', title: 'INTERVALO', duration: '15 min', noSpeaker: true },
        { id: 's1_6', num: '7', time: '10:40', title: 'Cumpram suas responsabilidades como servos ministeriais', duration: '20 min', sigla: 'A' },
        { id: 's1_7', num: '8', time: '11:00', title: 'Continuem progredindo como homens espirituais', duration: '20 min', sigla: 'SC/A#' },
        { id: 's1_8', num: '9', time: '11:20', title: '‘Lance toda a sua ansiedade’ sobre Jeová', duration: '25 min', sigla: 'IA/SC*' },
        { id: 's1_9', time: '11:45', title: 'Cântico 33', noSpeaker: true },
        { id: 's1_10', time: '11:50', title: 'INTERVALO', duration: '70 min', noSpeaker: true }
      ]
    },
    {
      period: 'Parte 2',
      items: [
        { id: 's2_1', time: '1:00', title: 'Cântico 78', noSpeaker: true },
        { 
          id: 's2_2', 
          label: 'Série de discursos:', 
          title: 'Seja “fervoroso no espírito”', 
          isSeries: true,
          subitems: [
            { id: 's2_2_1', num: '10', time: '1:05', title: 'Tire mais proveito do seu estudo pessoal', duration: '20 min', sigla: 'A' },
            { id: 's2_2_2', num: '11', time: '1:25', title: 'Faça discursos motivadores', duration: '20 min', sigla: 'A' },
            { id: 's2_2_3', num: '12', time: '1:45', title: 'Ensine com entusiasmo', duration: '20 min', sigla: 'A' },
            { id: 's2_2_4', num: '13', time: '2:05', title: 'Peça e aceite conselhos práticos', duration: '20 min', sigla: 'A' }
          ]
        },
        { id: 's2_3', time: '2:25', title: 'INTERVALO', duration: '20 min', noSpeaker: true },
        { id: 's2_4', num: '14', time: '2:45', title: 'Mulheres de grande fé', duration: '35 min', sigla: 'SC/A#' },
        { id: 's2_5', num: '15', time: '3:20', title: 'O que Jesus vê em você?', duration: '35 min', sigla: 'IA/SC*' },
        { id: 's2_6', time: '3:55', title: 'Cântico 107 e oração', noSpeaker: true }
      ]
    }
  ]
};

export default function EMRServosView({ userId, onBack, congregations = [] }: EMRServosViewProps) {
  const { showAlert } = useDialog();
  const [selectedTurma, setSelectedTurma] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [initialPartsData, setInitialPartsData] = useState<string>('');
  const [personalData, setPersonalData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [partsData, setPartsData] = useState<Record<number, EMRPartData>>({
    0: { speakers: {}, congregations: {}, confirmations: {}, notes: {}, details: { data: '', local: '', endereco: '', anfitria: '', horarioInicio: '', horarioFim: '', horarioEsposas: '' } },
    1: { speakers: {}, congregations: {}, confirmations: {}, notes: {}, details: { data: '', local: '', endereco: '', anfitria: '', horarioInicio: '', horarioFim: '', horarioEsposas: '' } },
    2: { speakers: {}, congregations: {}, confirmations: {}, notes: {}, details: { data: '', local: '', endereco: '', anfitria: '', horarioInicio: '', horarioFim: '', horarioEsposas: '' } },
    3: { speakers: {}, congregations: {}, confirmations: {}, notes: {}, details: { data: '', local: '', endereco: '', anfitria: '', horarioInicio: '', horarioFim: '', horarioEsposas: '' } },
  });

  const hasChanges = initialPartsData !== JSON.stringify(partsData);

  const currentPart = partsData[selectedTurma];
  const speakers = currentPart.speakers;
  const speakerCongregations = currentPart.congregations || {};
  const confirmations = currentPart.confirmations;
  const details = currentPart.details;

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'emr_servants_data', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.parts) {
            setPartsData(data.parts);
            setInitialPartsData(JSON.stringify(data.parts));
          } else {
            setInitialPartsData(JSON.stringify(partsData));
          }
        } else {
          setInitialPartsData(JSON.stringify(partsData));
        }

        // Load personal data for signatures
        const personalSnap = await getDoc(doc(db, 'personal_data', userId));
        if (personalSnap.exists()) {
          setPersonalData(personalSnap.data());
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'emr_servants_data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [userId]);

  const generateLetter = async (partId: string) => {
    setIsGenerating(partId);
    try {
      // 1. Fetch template
      const templateId = 'emr_instrutor';
      const privateId = `${userId}_${templateId}`;
      let templateSnap = await getDoc(doc(db, 'document_templates', privateId));
      if (!templateSnap.exists()) {
        templateSnap = await getDoc(doc(db, 'document_templates', templateId));
      }

      if (!templateSnap.exists()) {
        await showAlert('Modelo "Carta ao Instrutor" não encontrado. Configure-o em Cartas > EMR.', 'Erro');
        return;
      }

      const templateData = templateSnap.data();
      const binaryString = window.atob(templateData.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 2. Prepare replacements
      const now = new Date();
      const hoje = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
      
      const turmaIdx = selectedTurma;
      const turmaData = partsData[turmaIdx] || {};
      const details = turmaData.details || {};
      const speakers = turmaData.speakers || {};
      const speakerCongs = turmaData.congregations || {};

      const travelerName = personalData?.nome || '________________';
      const circuit = personalData?.circuito || '________________';
      const signatureImage = personalData?.signatureImage || '';

      const speakerName = speakers[partId] || '________________';
      const speakerCongregation = speakerCongs[partId] || '________________';
      
      let partTheme = '________________';
      let partNum = '';
      let partTime = '________________';
      let partDuration = '________________';

      EMR_SERVOS_PROGRAM_2027.sessions.forEach(s => {
        s.items.forEach(item => {
          if (item.id === partId) {
            partTheme = item.title;
            partNum = item.num || '';
            partTime = item.time || '________________';
            partDuration = item.duration || '________________';
          }
          if ((item as any).subitems) {
            (item as any).subitems.forEach((sub: any) => {
              if (sub.id === partId) {
                partTheme = `${item.label || 'Série de discursos:'} ${item.title} — ${sub.title}`;
                partNum = sub.num || '';
                partTime = sub.time || '________________';
                partDuration = sub.duration || '________________';
              }
            });
          }
        });
      });

      const replacements = {
        'TURMA': `Turma ${selectedTurma + 1}`,
        'MODALIDADE': 'Servos Ministeriais',
        'ESCOLA': 'Escola do Ministério do Reino de 2027 — Servos Ministeriais',
        'DATA': details.data || hoje,
        'LOCAL': details.local || '________________',
        'ENDERECO': details.endereco || '________________',
        'ENDEREÇO': details.endereco || '________________',
        'ANFITRIA': details.anfitria || '________________',
        'HORARIO_INICIO': details.horarioInicio || '________________',
        'HORARIO_FIM': details.horarioFim || '________________',
        'HORARIO_ESPOSAS': details.horarioEsposas || '________________',
        'HORARIO': `${details.horarioInicio} às ${details.horarioFim}`,
        'ORADOR': speakerName,
        'INSTRUTOR': speakerName,
        'CONGREGACAO': speakerCongregation,
        'CONGREGAÇÃO': speakerCongregation,
        'CONGREGACAO_INSTRUTOR': speakerCongregation,
        'TEMA': partTheme,
        'TITULO': partTheme,
        'DESIGNACAO': partTheme,
        'DESIGNAÇÃO': partTheme,
        'NUMERO': partNum,
        'N': partNum,
        'HORA': partTime,
        'DURACAO': partDuration,
        'HOJE': hoje,
        'VIAJANTE': travelerName,
        'CIRCUITO': circuit,
        'ASSINATURA': `${travelerName} (${circuit})`,
        'ASSINATURA_GLOBAL': `${travelerName} (${circuit})`,
        'ASSINATURA GLOBAL': `${travelerName} (${circuit})`,
        '%ASSINATURA': signatureImage
      };

      // 3. Process with Docxtemplater
      const hasImage = Boolean(signatureImage && typeof signatureImage === 'string' && signatureImage.startsWith('data:image'));
      let sigWidth = 150;
      let sigHeight = 60;
      if (hasImage) {
        try {
          const img = new window.Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = signatureImage;
          });
          const aspectRatio = img.width / img.height;
          sigHeight = 60;
          sigWidth = sigHeight * aspectRatio;
          if (sigWidth > 220) {
            sigWidth = 220;
            sigHeight = sigWidth / aspectRatio;
          }
        } catch (e) {
          console.warn('Could not determine signature dimensions:', e);
        }
      }

      const imgOpts: any = {
        centered: false,
        getImage: (tagValue: string) => {
          if (!tagValue || typeof tagValue !== 'string' || !tagValue.startsWith('data:image')) return null;
          try {
            const base64Data = tagValue.split(',')[1];
            if (!base64Data) return null;
            const binaryStringArray = window.atob(base64Data);
            const len = binaryStringArray.length;
            const bytesArray = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytesArray[i] = binaryStringArray.charCodeAt(i);
            }
            return bytesArray.buffer;
          } catch (e) {
            console.error('Error decoding image:', e);
            return null;
          }
        },
        getSize: () => [sigWidth, sigHeight],
      };

      const cleanedBuffer = cleanPSSMetadata(bytes.buffer);
      const zip = new PizZip(cleanedBuffer);
      
      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      xmlFiles.forEach(xmlResource => {
        let xmlContent = xmlResource.asText();
        
        if (hasImage && !xmlContent.includes('xmlns:wp=')) {
          xmlContent = xmlContent.replace(/(<w:(?:document|hdr|ftr)[^>]*)/, (match) => {
            if (match.includes('xmlns:wp=')) return match;
            return `${match} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
          });
        }

        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");

        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@|\[[#\/^>?]?)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]+|\])/g, "$1$2$4$3");
        }

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (m, o, t, c) => {
          let nt = t;
          if (hasImage) {
            nt = nt.replace(/\[ASSINATURA([\s\_]GLOBAL)?\]/gi, '[%ASSINATURA]');
            nt = nt.replace(/@Assinatura([\s\_]GLOBAL)?/gi, '[%ASSINATURA]');
          } else {
            nt = nt.replace(/@Assinatura([\s\_]GLOBAL)?/gi, '[ASSINATURA]');
            nt = nt.replace(/\[%ASSINATURA\]/gi, '[ASSINATURA]');
          }
          nt = nt.replace(/(^|[\s\W])@([A-Za-z0-9À-ÿ\_]+)/g, (match, p1, p2) => `${p1}[${p2.toUpperCase()}]`);
          return `${o}${nt}${c}`;
        });
        zip.file(xmlResource.name, xmlContent);
      });

      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      const docInstance = new Docxtemplater(zip, {
        modules: hasImage && ImageModule ? [new ImageModule(imgOpts)] : [],
        delimiters: { start: '[', end: ']' },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ''
      });

      docInstance.render(replacements);
      const out = docInstance.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
      // 4. Download
      const url = window.URL.createObjectURL(out);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Carta_Instrutor_${speakerName.replace(/\s+/g, '_')}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error generating letter:', error);
      await showAlert('Erro ao gerar carta: ' + formatDocxError(error), 'Erro');
    } finally {
      setIsGenerating(null);
    }
  };

  const generateGeneralLetter = async (templateId: string) => {
    setIsGenerating(templateId);
    try {
      // 1. Fetch template
      const privateId = `${userId}_${templateId}`;
      let templateSnap = await getDoc(doc(db, 'document_templates', privateId));
      if (!templateSnap.exists()) {
        templateSnap = await getDoc(doc(db, 'document_templates', templateId));
      }

      if (!templateSnap.exists()) {
        const name = templateId === 'emr_anfitria' ? 'Carta às congregações Anfitriãs' : 'Carta convite';
        await showAlert(`Modelo "${name}" não encontrado. Configure-o em Cartas > EMR.`, 'Erro');
        return;
      }

      const templateData = templateSnap.data();
      const binaryString = window.atob(templateData.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 2. Prepare replacements
      const now = new Date();
      const hoje = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
      
      const turmaIdx = selectedTurma;
      const turmaData = partsData[turmaIdx] || {};
      const details = turmaData.details || {};
      const speakers = turmaData.speakers || {};

      const travelerName = personalData?.nome || '________________';
      const circuit = personalData?.circuito || '________________';
      const signatureImage = personalData?.signatureImage || '';

      const instrutor1 = (speakers['s1_2'] || '');
      const instrutor2 = (speakers['s1_3'] || '');
      const allSpeakersList = Object.values(speakers).filter(Boolean) as string[];
      const uniqueSpeakers = Array.from(new Set(allSpeakersList));
      const instrutoresLista = uniqueSpeakers.length > 0
        ? uniqueSpeakers.join(', ')
        : (instrutor1 && instrutor2 ? `${instrutor1} e ${instrutor2}` : (instrutor1 || instrutor2 || '________________'));

      const replacements = {
        'TURMA': `Turma ${selectedTurma + 1}`,
        'MODALIDADE': 'Servos Ministeriais',
        'ESCOLA': 'Escola do Ministério do Reino de 2027 — Servos Ministeriais',
        'TIPO_ESCOLA': 'Servos Ministeriais',
        'DATA': details.data || hoje,
        'DATA_ESCOLA': details.data || hoje,
        'DATA_TURMA': details.data || hoje,
        'LOCAL': details.local || '________________',
        'LOCAL_ESCOLA': details.local || '________________',
        'ENDERECO': details.endereco || '________________',
        'ENDEREÇO': details.endereco || '________________',
        'ANFITRIA': details.anfitria || '________________',
        'CONGREGACAO_ANFITRIA': details.anfitria || '________________',
        'HORARIO_INICIO': details.horarioInicio || '________________',
        'HORARIO_FIM': details.horarioFim || '________________',
        'HORARIO_FINAL': details.horarioFim || '________________',
        'HORARIO_ESPOSAS': details.horarioEsposas || '________________',
        'HORARIO': `${details.horarioInicio} às ${details.horarioFim}`,
        'HORARIOS': `${details.horarioInicio} às ${details.horarioFim}`,
        'INSTRUTORES': instrutoresLista,
        'INSTRUTOR1': instrutor1 || '________________',
        'INSTRUTOR2': instrutor2 || '________________',
        'HOJE': hoje,
        'ANO': '2027',
        'VIAJANTE': travelerName,
        'CIRCUITO': circuit,
        'ASSINATURA': `${travelerName} (${circuit})`,
        'ASSINATURA_GLOBAL': `${travelerName} (${circuit})`,
        'ASSINATURA GLOBAL': `${travelerName} (${circuit})`,
        '%ASSINATURA': signatureImage
      };

      // 3. Process with Docxtemplater
      const hasImage = Boolean(signatureImage && typeof signatureImage === 'string' && signatureImage.startsWith('data:image'));
      let sigWidth = 150;
      let sigHeight = 60;
      if (hasImage) {
        try {
          const img = new window.Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = signatureImage;
          });
          const aspectRatio = img.width / img.height;
          sigHeight = 60;
          sigWidth = sigHeight * aspectRatio;
          if (sigWidth > 220) {
            sigWidth = 220;
            sigHeight = sigWidth / aspectRatio;
          }
        } catch (e) {
          console.warn('Could not determine signature dimensions:', e);
        }
      }

      const imgOpts: any = {
        centered: false,
        getImage: (tagValue: string) => {
          if (!tagValue || typeof tagValue !== 'string' || !tagValue.startsWith('data:image')) return null;
          try {
            const base64Data = tagValue.split(',')[1];
            if (!base64Data) return null;
            const binaryStringArray = window.atob(base64Data);
            const len = binaryStringArray.length;
            const bytesArray = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytesArray[i] = binaryStringArray.charCodeAt(i);
            }
            return bytesArray.buffer;
          } catch (e) {
            console.error('Error decoding image:', e);
            return null;
          }
        },
        getSize: () => [sigWidth, sigHeight],
      };

      const cleanedBuffer = cleanPSSMetadata(bytes.buffer);
      const zip = new PizZip(cleanedBuffer);
      
      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      xmlFiles.forEach(xmlResource => {
        let xmlContent = xmlResource.asText();
        
        if (hasImage && !xmlContent.includes('xmlns:wp=')) {
          xmlContent = xmlContent.replace(/(<w:(?:document|hdr|ftr)[^>]*)/, (match) => {
            if (match.includes('xmlns:wp=')) return match;
            return `${match} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
          });
        }

        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");

        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@|\[[#\/^>?]?)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]+|\])/g, "$1$2$4$3");
        }

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (m, o, t, c) => {
          let nt = t;
          if (hasImage) {
            nt = nt.replace(/\[ASSINATURA([\s\_]GLOBAL)?\]/gi, '[%ASSINATURA]');
            nt = nt.replace(/@Assinatura([\s\_]GLOBAL)?/gi, '[%ASSINATURA]');
          } else {
            nt = nt.replace(/@Assinatura([\s\_]GLOBAL)?/gi, '[ASSINATURA]');
            nt = nt.replace(/\[%ASSINATURA\]/gi, '[ASSINATURA]');
          }
          nt = nt.replace(/(^|[\s\W])@([A-Za-z0-9À-ÿ\_]+)/g, (match, p1, p2) => `${p1}[${p2.toUpperCase()}]`);
          return `${o}${nt}${c}`;
        });
        zip.file(xmlResource.name, xmlContent);
      });

      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      const docInstance = new Docxtemplater(zip, {
        modules: hasImage && ImageModule ? [new ImageModule(imgOpts)] : [],
        delimiters: { start: '[', end: ']' },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ''
      });

      docInstance.render(replacements);
      const out = docInstance.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
      // 4. Download
      const url = window.URL.createObjectURL(out);
      const a = document.createElement('a');
      const name = templateId === 'emr_anfitria' ? 'Carta_Anfitria' : 'Carta_Convite';
      a.href = url;
      a.download = `${name}_Turma_${selectedTurma + 1}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error generating letter:', error);
      await showAlert('Erro ao gerar carta: ' + formatDocxError(error), 'Erro');
    } finally {
      setIsGenerating(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'emr_servants_data', userId), {
        parts: partsData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setInitialPartsData(JSON.stringify(partsData));
      await showAlert('Programação salva com sucesso!', 'Sucesso');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'emr_servants_data');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSpeaker = (itemId: string, name: string) => {
    setPartsData(prev => ({
      ...prev,
      [selectedTurma]: {
        ...prev[selectedTurma],
        speakers: {
          ...prev[selectedTurma].speakers,
          [itemId]: name
        }
      }
    }));
  };

  const updateSpeakerCongregation = (itemId: string, cong: string) => {
    setPartsData(prev => ({
      ...prev,
      [selectedTurma]: {
        ...prev[selectedTurma],
        congregations: {
          ...(prev[selectedTurma].congregations || {}),
          [itemId]: cong
        }
      }
    }));
  };

  const toggleConfirmation = (itemId: string) => {
    setPartsData(prev => ({
      ...prev,
      [selectedTurma]: {
        ...prev[selectedTurma],
        confirmations: {
          ...prev[selectedTurma].confirmations,
          [itemId]: !prev[selectedTurma].confirmations[itemId]
        }
      }
    }));
  };

  const updateDetail = (field: keyof EMRDetails, value: string) => {
    setPartsData(prev => ({
      ...prev,
      [selectedTurma]: {
        ...prev[selectedTurma],
        details: {
          ...prev[selectedTurma].details,
          [field]: value
        }
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Loader2 className="w-12 h-12 text-[#F43F5E] animate-spin" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Programação EMR Servos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2.5 bg-white text-gray-400 hover:text-gray-600 rounded-xl border border-gray-100 shadow-sm transition-all active:scale-95"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
              <GraduationCap className="text-[#F43F5E]" size={24} />
              Escola do Ministério do Reino
            </h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Temporada 2027 — Servos Ministeriais</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => generateGeneralLetter('emr_anfitria')}
            disabled={isGenerating === 'emr_anfitria'}
            className="h-10 px-4 rounded-xl text-xs font-bold text-gray-600 bg-white hover:bg-gray-50 border border-gray-100 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            title="Gerar Carta às Congregações Anfitriãs"
          >
            {isGenerating === 'emr_anfitria' ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} className="text-blue-500" />}
            <span>Carta Anfitriã</span>
          </button>

          <button 
            onClick={() => generateGeneralLetter('emr_convite')}
            disabled={isGenerating === 'emr_convite'}
            className="h-10 px-4 rounded-xl text-xs font-bold text-gray-600 bg-white hover:bg-gray-50 border border-gray-100 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            title="Gerar Carta Convite"
          >
            {isGenerating === 'emr_convite' ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} className="text-emerald-500" />}
            <span>Carta Convite</span>
          </button>

          <button 
            onClick={() => setShowDetailsModal(true)}
            className="h-10 px-4 rounded-xl text-xs font-bold text-[#F43F5E] bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 border border-[#F43F5E]/20 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            title="Editar dados da escola (data, local, congregação, horários)"
          >
            <CalendarDays size={16} className="shrink-0" />
            <span>Dados da Escola</span>
          </button>
        </div>
      </div>

      {/* Turmas Selector */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {[0, 1, 2, 3].map((idx) => (
          <button
            key={idx}
            onClick={() => setSelectedTurma(idx)}
            className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all whitespace-nowrap ${
              selectedTurma === idx 
                ? 'bg-[#F43F5E] text-white shadow-md' 
                : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            Turma {idx + 1}
          </button>
        ))}
      </div>

      {/* Modal de Edição de Detalhes da Escola */}
      <AnimatePresence>
        {showDetailsModal && (
          <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100"
            >
              <div className="p-6 bg-[#F43F5E]/5 border-b border-[#F43F5E]/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#F43F5E]/10 rounded-xl text-[#F43F5E]">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Dados da Escola</h3>
                    <p className="text-xs text-gray-500">Turma {selectedTurma + 1} • {EMR_SERVOS_PROGRAM_2027.year}</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex flex-col max-h-[calc(100vh-140px)] sm:max-h-[85vh]">
                <div className="flex-1 p-6 space-y-5 overflow-y-auto custom-scrollbar scroll-smooth">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Local da Turma</label>
                      <div className="relative">
                        <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                        <input 
                          type="text" 
                          list="emr-servos-locais"
                          value={details.local} 
                          onChange={e => {
                            const val = e.target.value;
                            const found = congregations.find(c => c.nome === val);
                            if (found) {
                              setPartsData(prev => ({
                                ...prev,
                                [selectedTurma]: {
                                  ...prev[selectedTurma],
                                  details: {
                                    ...prev[selectedTurma].details,
                                    local: found.nome,
                                    endereco: found.endereco || ''
                                  }
                                }
                              }));
                            } else {
                              updateDetail('local', val);
                            }
                          }}
                          placeholder="Ex: Salão do Reino Central"
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-[#F43F5E] outline-none transition-all"
                        />
                        <datalist id="emr-servos-locais">
                          {congregations.map(c => (
                            <option key={c.id} value={c.nome} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Endereço do Local</label>
                      <div className="relative">
                        <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="text" 
                          value={details.endereco || ''} 
                          onChange={e => updateDetail('endereco', e.target.value)}
                          placeholder="Ex: Rua das Flores, 123"
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-[#F43F5E] outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Data da Escola</label>
                      <div className="relative">
                        <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="text" 
                          value={details.data} 
                          onChange={e => updateDetail('data', e.target.value)}
                          placeholder="Ex: 15 de Outubro de 2027"
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-[#F43F5E] outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Congregação Anfitriã</label>
                      <div className="relative">
                        <BookOpen size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="text" 
                          value={details.anfitria || ''} 
                          onChange={e => updateDetail('anfitria', e.target.value)}
                          placeholder="Ex: Congregação Centro"
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-[#F43F5E] outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Início</label>
                        <div className="relative">
                          <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input 
                            type="text" 
                            value={details.horarioInicio || ''} 
                            onChange={e => updateDetail('horarioInicio', e.target.value)}
                            placeholder="08:00"
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-[#F43F5E] outline-none transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Término</label>
                        <div className="relative">
                          <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input 
                            type="text" 
                            value={details.horarioFim || ''} 
                            onChange={e => updateDetail('horarioFim', e.target.value)}
                            placeholder="16:00"
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-[#F43F5E] outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Horário Especial (Esposas)</label>
                      <div className="relative">
                        <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="text" 
                          value={details.horarioEsposas || ''} 
                          onChange={e => updateDetail('horarioEsposas', e.target.value)}
                          placeholder="Ex: 14:00 às 16:00"
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-[#F43F5E] outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowDetailsModal(false)}
                    className="w-full mt-6 py-4 bg-[#F43F5E] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-[#F43F5E]/20 hover:bg-[#F43F5E]/90 transition-all active:scale-95"
                  >
                    Confirmar Dados
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Program Table */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-[#F43F5E] p-6 text-white text-center">
          <h1 className="text-lg md:text-xl font-black uppercase tracking-widest">{EMR_SERVOS_PROGRAM_2027.title}</h1>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 w-px whitespace-nowrap text-center">Nº</th>
                <th className="px-3 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 w-px whitespace-nowrap text-center">Horário</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Parte</th>
                <th className="px-3 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 w-px whitespace-nowrap text-center">Tempo</th>
                <th className="px-3 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 w-px whitespace-nowrap text-center">Sigla</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 min-w-[300px]">Instrutor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {EMR_SERVOS_PROGRAM_2027.sessions.map((session, sIdx) => (
                <Fragment key={sIdx}>
                  {/* Session Header */}
                  <tr className="bg-[#F43F5E]/5">
                    <td colSpan={6} className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-[#F43F5E]">
                      {session.period}
                    </td>
                  </tr>
                  
                  {session.items.map((item: any) => (
                    <Fragment key={item.id}>
                      {item.isSeries ? (
                        <>
                          <tr className="bg-gray-50/50">
                            <td className="px-3 py-4 text-center font-bold text-gray-400 text-xs"></td>
                            <td className="px-3 py-4 text-center font-bold text-gray-400 text-xs">{item.time}</td>
                            <td colSpan={4} className="px-6 py-4">
                              <span className="text-[10px] font-black uppercase tracking-widest text-[#F43F5E] block">{item.label}</span>
                              <span className="text-sm font-black text-gray-800">{item.title}</span>
                            </td>
                          </tr>
                          {item.subitems.map((sub: any) => (
                            <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-3 py-4 text-center font-black text-[#F43F5E] text-xs">{sub.num}</td>
                              <td className="px-3 py-4 text-center font-bold text-gray-400 text-xs">{sub.time}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#F43F5E] shrink-0" />
                                  <span className="text-sm font-bold text-gray-700">{sub.title}</span>
                                </div>
                              </td>
                              <td className="px-3 py-4 text-center text-[10px] font-bold text-gray-400 whitespace-nowrap">{sub.duration}</td>
                              <td className="px-3 py-4 text-center text-[10px] font-black text-[#F43F5E] whitespace-nowrap">{sub.sigla}</td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="text"
                                      value={speakers[sub.id] || ''}
                                      onChange={(e) => updateSpeaker(sub.id, e.target.value)}
                                      placeholder="[Nome]"
                                      className={`w-full min-w-[200px] px-3 py-2 bg-gray-50 border rounded-xl text-xs font-bold transition-all outline-none focus:border-[#F43F5E] ${
                                        confirmations[sub.id] ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-gray-100 text-gray-700'
                                      }`}
                                    />
                                    <button 
                                      onClick={() => toggleConfirmation(sub.id)}
                                      className={`p-2 rounded-lg transition-all ${
                                        confirmations[sub.id] 
                                          ? 'bg-emerald-500 text-white shadow-md' 
                                          : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                      }`}
                                      title={confirmations[sub.id] ? "Confirmado" : "Marcar como confirmado"}
                                    >
                                      <Check size={14} strokeWidth={4} />
                                    </button>
                                    {speakers[sub.id] && (
                                      <button 
                                        onClick={() => generateLetter(sub.id)}
                                        disabled={isGenerating === sub.id}
                                        className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 hover:bg-rose-100 transition-all shadow-sm disabled:opacity-50"
                                        title="Gerar Carta ao Instrutor"
                                      >
                                        {isGenerating === sub.id ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight shrink-0 ml-1">Cong:</span>
                                    <input 
                                      type="text"
                                      value={speakerCongregations[sub.id] || ''}
                                      onChange={(e) => updateSpeakerCongregation(sub.id, e.target.value)}
                                      placeholder="Congregação do instrutor..."
                                      className="flex-1 px-3 py-1.5 bg-white border border-gray-100 rounded-lg text-[10px] font-bold text-gray-600 outline-none focus:border-[#F43F5E]/50 transition-all"
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </>
                      ) : (
                        <tr key={item.id} className={`${item.noSpeaker ? 'bg-gray-50/30' : 'hover:bg-gray-50'} transition-colors`}>
                          <td className="px-3 py-4 text-center font-black text-[#F43F5E] text-xs">{item.num}</td>
                          <td className="px-3 py-4 text-center font-bold text-gray-400 text-xs">{item.time}</td>
                          <td className="px-6 py-4">
                            <span className={`text-sm font-black ${item.noSpeaker ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                              {item.title}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-center text-[10px] font-bold text-gray-400 whitespace-nowrap">{item.duration}</td>
                          <td className="px-3 py-4 text-center text-[10px] font-black text-[#F43F5E] whitespace-nowrap">{item.sigla}</td>
                          <td className="px-6 py-4">
                            {!item.noSpeaker && (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="text"
                                    value={speakers[item.id] || ''}
                                    onChange={(e) => updateSpeaker(item.id, e.target.value)}
                                    placeholder="Nome do Instrutor..."
                                    className={`flex-1 min-w-[200px] px-3 py-2 bg-gray-50 border rounded-xl text-xs font-bold transition-all outline-none focus:border-[#F43F5E] ${
                                      confirmations[item.id] ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-gray-100 text-gray-700'
                                    }`}
                                  />
                                  <button 
                                    onClick={() => toggleConfirmation(item.id)}
                                    className={`p-2 rounded-lg transition-all ${
                                      confirmations[item.id] 
                                        ? 'bg-emerald-500 text-white shadow-md' 
                                        : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                    }`}
                                    title={confirmations[item.id] ? "Confirmado" : "Marcar como confirmado"}
                                  >
                                    <Check size={14} strokeWidth={4} />
                                  </button>
                                  {speakers[item.id] && (
                                    <button 
                                      onClick={() => generateLetter(item.id)}
                                      disabled={isGenerating === item.id}
                                      className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 hover:bg-rose-100 transition-all shadow-sm disabled:opacity-50"
                                      title="Gerar Carta ao Instrutor"
                                    >
                                      {isGenerating === item.id ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight shrink-0 ml-1">Cong:</span>
                                  <input 
                                    type="text"
                                    value={speakerCongregations[item.id] || ''}
                                    onChange={(e) => updateSpeakerCongregation(item.id, e.target.value)}
                                    placeholder="Congregação do instrutor..."
                                    className="flex-1 px-3 py-1.5 bg-white border border-gray-100 rounded-lg text-[10px] font-bold text-gray-600 outline-none focus:border-[#F43F5E]/50 transition-all"
                                  />
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400 font-bold space-y-1">
          <p>*Se um representante de Betel ou um instrutor em campo tiver sido designado por Betel, ele fará esse discurso. Caso contrário, o superintendente de circuito fará esse discurso.</p>
          <p>#Se um representante de Betel ou um instrutor em campo tiver sido designado por Betel, o superintendente de circuito fará esse discurso. Caso contrário, um ancião local fará esse discurso.</p>
        </div>
      </div>

      {/* Floating Save Bar */}
      <AnimatePresence>
        {hasChanges && !showDetailsModal && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-6 portrait:bottom-20 landscape:bottom-6 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1002] bg-gray-950/95 text-white backdrop-blur-lg px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 sm:gap-6 border border-white/15 max-w-[calc(100vw-1.5rem)] w-auto no-print"
          >
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-semibold text-gray-200 whitespace-nowrap">
                  Alterações não salvas
                </span>
                <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                  EMR Servos 2027 • Turma {selectedTurma + 1}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setPartsData(JSON.parse(initialPartsData))}
                disabled={isSaving}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 sm:px-5 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2 disabled:opacity-50 active:scale-95"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Salvar</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
