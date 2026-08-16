'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Users, ChevronLeft, Calendar, Clock, BookOpen, Music, Info, User, Save, AlertTriangle, Loader2, Printer, MapPin, CalendarDays, ChevronDown, ChevronUp, CheckCircle2, Circle, Coffee, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { useDialog } from '@/hooks/useDialog';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { cleanPSSMetadata } from '@/lib/docxUtils';

interface SpecialPioneerMeetingViewProps {
  userId: string;
  isGuest?: boolean;
  onBack: () => void;
}

interface AssemblyDetails {
  eventDate: string;
  eventLocation: string;
  rehearsalDate: string;
  rehearsalLocation: string;
  assemblyTheme: string;
  startTime: string;
  material?: string;
}

const programsByYear = {
  '2026-2027': {
    title: 'Programa para a Reunião Especial com os Pioneiros e Missionários de 2027',
    year: '2026-2027',
    theme: '“Estabeleça alvos para enriquecer seu ministério!” — Prov. 4:25',
    color: '#8B5CF6', // Violet
    headerImage: '/s-312.jfif',
    sessions: [
      {
        period: 'Programa',
        items: [
          { id: 'm1', duration: 5, title: 'Cântico 84 e oração', icon: Music },
          { id: 'm2', duration: 15, title: '“Fixe o olhar diretamente na sua frente”', icon: BookOpen },
          { 
            id: 'm3', 
            duration: 60,
            label: 'SÉRIE DE DISCURSOS:', 
            title: 'Estabeleça alvos', 
            icon: BookOpen,
            noSpeaker: true,
            isHeader: true,
            subitems: [
              { id: 'm3_1', duration: 20, title: 'Quando é difícil encontrar as pessoas' },
              { id: 'm3_2', duration: 20, title: 'Quando as pessoas mostram pouco interesse' },
              { id: 'm3_3', duration: 20, title: 'Quando há muitas pessoas interessadas' }
            ]
          },
          { id: 'm4', duration: 15, title: 'Consideração das necessidades dos pioneiros', icon: Info },
          { id: 'm5', duration: 20, title: 'Intervalo', icon: Coffee, noSpeaker: true, isInterval: true },
          { 
            id: 'm6', 
            duration: 60,
            label: 'SÉRIE DE DISCURSOS:', 
            title: 'Alvos que enriquecem seu ministério', 
            icon: BookOpen,
            noSpeaker: true,
            isHeader: true,
            subitems: [
              { id: 'm6_1', duration: 15, title: 'Iniciar e dirigir estudos bíblicos progressivos' },
              { id: 'm6_2', duration: 15, title: 'Servir onde há mais necessidade' },
              { id: 'm6_3', duration: 15, title: 'Servir como pioneiro especial ou missionário' },
              { id: 'm6_4', duration: 15, title: 'Treinar e orientar outros' }
            ]
          },
          { id: 'm7', duration: 15, title: 'Alegre-se com o seu progresso!', icon: BookOpen },
          { id: 'm8', duration: 5, title: 'Cântico 58 e oração', icon: Music }
        ]
      }
    ]
  }
};

export default function SpecialPioneerMeetingView({ userId, isGuest = false, onBack }: SpecialPioneerMeetingViewProps) {
  const [selectedYear, setSelectedYear] = useState<'2026-2027'>('2026-2027');
  const [selectedPart, setSelectedPart] = useState<number>(0);
  const program = programsByYear[selectedYear];
  const { showAlert } = useDialog();
  
  // State for all 4 parts
  const [partsData, setPartsData] = useState<Record<number, {
    speakers: Record<string, string>,
    confirmations: Record<string, boolean>,
    details: AssemblyDetails
  }>>({
    0: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: program.theme, startTime: '09:00', material: '' } },
    1: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: program.theme, startTime: '09:00', material: '' } },
    2: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: program.theme, startTime: '09:00', material: '' } },
    3: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: program.theme, startTime: '09:00', material: '' } },
  });

  const [initialPartsData, setInitialPartsData] = useState<string>('');
  
  // Helper to add minutes to HH:mm time string
  const calculateTime = (startTime: string, minutesToAdd: number) => {
    if (!startTime) return '';
    const [hours, mins] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, mins, 0, 0);
    date.setMinutes(date.getMinutes() + minutesToAdd);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const [personalData, setPersonalData] = useState<any>(null);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string }>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Active part data
  const currentPart = partsData[selectedPart];
  const speakers = currentPart.speakers;
  const confirmedSpeakers = currentPart.confirmations;
  const details = currentPart.details;

  const collectionName = 'special_pioneer_meeting_speakers';

  const hasChanges = initialPartsData !== JSON.stringify(partsData);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const personalDataRef = collection(db, 'personal_data');
        const personalDataQuery = query(personalDataRef, where('userId', '==', userId));
        const personalDataSnapshot = await getDocs(personalDataQuery);
        
        if (!personalDataSnapshot.empty) {
          setPersonalData(personalDataSnapshot.docs[0].data());
        }

        const docId = selectedYear === '2026-2027' ? userId : `${userId}_${selectedYear}`;
        const docRef = doc(db, collectionName, docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.parts) {
            setPartsData(data.parts);
            setInitialPartsData(JSON.stringify(data.parts));
          } else {
            const migratedData = {
              0: { 
                speakers: data.speakers || {}, 
                confirmations: data.confirmations || {}, 
                details: {
                  eventDate: data.details?.eventDate || '',
                  eventLocation: data.details?.eventLocation || '',
                  rehearsalDate: data.details?.rehearsalDate || '',
                  rehearsalLocation: data.details?.rehearsalLocation || '',
                  assemblyTheme: data.details?.assemblyTheme || program.theme,
                  startTime: data.details?.startTime || '09:00',
                }
              },
              1: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: program.theme, startTime: '09:00' } },
              2: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: program.theme, startTime: '09:00' } },
              3: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: program.theme, startTime: '09:00' } },
            };
            setPartsData(migratedData);
            setInitialPartsData(JSON.stringify(migratedData));
          }
        } else {
          setInitialPartsData(JSON.stringify(partsData));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Real-time templates listener (matching AssemblyLetters logic)
    const templatesQuery = query(collection(db, 'document_templates'), where('category', '==', 'assembleias'));
    const unsubscribeTemplates = onSnapshot(templatesQuery, (snapshot) => {
      const fetchedTemplates: Record<string, any> = {};
      snapshot.forEach((doc) => {
        fetchedTemplates[doc.id] = doc.data();
      });
      setTemplates(fetchedTemplates);
    });

    loadData();
    return () => unsubscribeTemplates();
  }, [userId, selectedYear, program.theme]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docId = selectedYear === '2026-2027' ? userId : `${userId}_${selectedYear}`;
      const docRef = doc(db, collectionName, docId);
      await setDoc(docRef, { 
        parts: partsData,
        updatedAt: new Date().toISOString(),
        year: selectedYear
      }, { merge: true });
      
      setInitialPartsData(JSON.stringify(partsData));
      return true;
    } catch (error) {
      console.error('Error saving data:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSpeakerChange = (id: string, value: string) => {
    setPartsData(prev => ({
      ...prev,
      [selectedPart]: {
        ...prev[selectedPart],
        speakers: { ...prev[selectedPart].speakers, [id]: value }
      }
    }));
  };

  const handleConfirmationToggle = (id: string) => {
    if (!partsData[selectedPart].speakers[id]) {
      showAlert('É necessário designar um orador antes de confirmar.', 'Aviso');
      return;
    }
    setPartsData(prev => ({
      ...prev,
      [selectedPart]: {
        ...prev[selectedPart],
        confirmations: { ...prev[selectedPart].confirmations, [id]: !prev[selectedPart].confirmations[id] }
      }
    }));
  };

  const updateDetails = (updater: (prev: AssemblyDetails) => AssemblyDetails) => {
    setPartsData(prev => ({
      ...prev,
      [selectedPart]: {
        ...prev[selectedPart],
        details: updater(prev[selectedPart].details)
      }
    }));
  };

  const handleBackClick = () => {
    if (hasChanges) {
      setPendingAction(() => onBack);
      setShowConfirmModal(true);
    } else {
      onBack();
    }
  };

  const generateS302 = async () => {
    // Standard ID for pioneer letter template
    const pioneerId = 'ass_carta_pioneiros';
    let template = templates[`${userId}_${pioneerId}`] || templates[pioneerId];
    
    // Fallback for legacy names if the standard one is not found
    if (!template) {
      const legacyIds = ['2026 CA_AOS_PIONEIROS', 'Carta aos pioneiros', 'ass_convite_pioneiros'];
      for (const id of legacyIds) {
        template = templates[`${userId}_${id}`] || templates[id];
        if (template) break;
      }
    }
    
    if (!template) {
      await showAlert(`Template "Carta aos pioneiros" não encontrado. Verifique se carregou o arquivo em Cartas > Gerenciar > Cartas Assembleias (último botão).`, 'Aviso');
      return;
    }

    setIsSaving(true);
    try {
      const binaryString = window.atob(template.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const cleanedBuffer = cleanPSSMetadata(bytes.buffer);
      const zip = new PizZip(cleanedBuffer);
      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      
      const signatureImage = personalData?.signatureImage || personalData?.signature || '';

      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      xmlFiles.forEach(xmlResource => {
        let xmlContent = xmlResource.asText();
        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\u00C0-\u00FF\_\s]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_\s]+)/g, "$1$3$2");
        }
        xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\_]*)(<\/w:t><\/w:r><w:r><w:t>)/g, "$1");

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match, opening, text, closing) => {
          let newText = text;
          newText = newText.replace(/@Assinatura([A-Za-z0-9À-ÿ\_]*\s*Global|_Global)?/gi, '[%ASSINATURA]');
          newText = newText.replace(/(^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g, (m, p1, p2) => {
            const tag = p2.toUpperCase();
            if (tag.includes('ASSINATURA') || tag.includes('SIGNATURE')) return `${p1}[%ASSINATURA]`;
            return `${p1}[${tag}]`;
          });
          return `${opening}${newText}${closing}`;
        });
        zip.file(xmlResource.name, xmlContent);
      });

      let sigWidth = 150;
      let sigHeight = 60;
      
      const isBase64Image = signatureImage && signatureImage.startsWith('data:image');
      if (isBase64Image) {
        const img = new window.Image();
        const promise = new Promise((resolve) => {
          img.onload = resolve;
          img.src = signatureImage;
        });
        await promise;
        const aspectRatio = img.width / img.height;
        sigHeight = 60;
        sigWidth = sigHeight * aspectRatio;
        if (sigWidth > 220) {
          sigWidth = 220;
          sigHeight = sigWidth / aspectRatio;
        }
      }

      const opts: any = {
        centered: false,
        getImage: (tagValue: string) => {
          if (!tagValue || typeof tagValue !== 'string' || !tagValue.startsWith('data:image')) return null;
          try {
            const base64Data = tagValue.split(',')[1];
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

      const now = new Date();
      const hoje = new Intl.DateTimeFormat('pt-BR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }).format(now);

      const replacements = {
        'EVENTO': program.title,
        'TEMA': details.assemblyTheme || program.theme,
        'DATA': details.eventDate || '________________',
        'HOJE': hoje,
        'data': hoje,
        'LOCAL': details.eventLocation || '________________',
        'DATA_EVENTO': details.eventDate || '________________',
        'LOCAL_EVENTO': details.eventLocation || '________________',
        'CIRCUITO': personalData?.circuito || '________________',
        'VIAJANTE': personalData?.nome || '________________',
        'NOME': personalData?.nome || '________________',
        'FONE': personalData?.telefoneCircuito || personalData?.telefone || '________________',
        'TELEFONE': personalData?.telefoneCircuito || personalData?.telefone || '________________',
        'ENSAIOS': details.eventDate || '________________', // For S-302, use event date as default for ENSAIOS
        'ENDEREÇO': details.eventLocation || '________________', // For S-302, use event location as default for ENDEREÇO
        'MATERIAL': details.material || '________________',
        'ASSINATURA': signatureImage,
        '%ASSINATURA': signatureImage,
      };

      const doc = new Docxtemplater(zip, {
        modules: [new ImageModule(opts)],
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' }
      });

      doc.render(replacements);
      const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
      try {
        const fileSaver = await import('file-saver');
        const saveAs = fileSaver.saveAs || (fileSaver as any).default;
        if (typeof saveAs === 'function') {
          saveAs(out, `S-312_Carta convite aos pioneiros_${details.eventDate || 'Evento'}.docx`);
        } else {
          throw new Error('saveAs is not a function');
        }
      } catch (e) {
        // Fallback to manual download if file-saver fails
        const url = window.URL.createObjectURL(out);
        const link = document.createElement('a');
        link.href = url;
        link.download = `S-312_Carta convite aos pioneiros_${details.eventDate || 'Evento'}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error generating S-302:', error);
      await showAlert('Erro ao gerar o documento. Verifique o template.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  const generateDocument = async (item: any) => {
    const speakerName = speakers[item.id];
    if (!speakerName) {
      await showAlert('Por favor, informe o nome do orador primeiro.', 'Aviso');
      return;
    }

    const templateId = item.title.toLowerCase().includes('cântico') && item.title.toLowerCase().includes('oração') 
      ? 'ass_convite_oracao' 
      : 'ass_carta_oradores';

    const template = templates[templateId] || templates[`${userId}_${templateId}`];
    if (!template) {
      await showAlert(`Template "${templateId}" não encontrado. Por favor, carregue-o em Cartas > Gerenciar.`, 'Aviso');
      return;
    }

    setIsSaving(true);
    try {
      const binaryString = window.atob(template.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const cleanedBuffer = cleanPSSMetadata(bytes.buffer);
      const zip = new PizZip(cleanedBuffer);
      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      
      const signatureImage = personalData?.signatureImage || personalData?.signature || '';

      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      xmlFiles.forEach(xmlResource => {
        let xmlContent = xmlResource.asText();
        // Remove Word spell/gram error nodes that split tags
        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
        
        // Loop to merge split tags: @Ti</w:t>...<w:t>tulo -> @Titulo
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\u00C0-\u00FF\_\s]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_\s]+)/g, "$1$3$2");
        }
        
        xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\_]*)(<\/w:t><\/w:r><w:r><w:t>)/g, "$1");

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match, opening, text, closing) => {
          let newText = text;
          newText = newText.replace(/@Assinatura([A-Za-z0-9À-ÿ\_]*\s*Global|_Global)?/gi, '[%ASSINATURA]');
          newText = newText.replace(/(^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g, (m, p1, p2) => {
            const tag = p2.toUpperCase();
            if (tag.includes('ASSINATURA') || tag.includes('SIGNATURE')) return `${p1}[%ASSINATURA]`;
            return `${p1}[${tag}]`;
          });
          return `${opening}${newText}${closing}`;
        });
        zip.file(xmlResource.name, xmlContent);
      });

      let sigWidth = 150;
      let sigHeight = 60;
      
      const isBase64Image = signatureImage && signatureImage.startsWith('data:image');
      if (isBase64Image) {
        const img = new window.Image();
        const promise = new Promise((resolve) => {
          img.onload = resolve;
          img.src = signatureImage;
        });
        await promise;
        const aspectRatio = img.width / img.height;
        sigHeight = 60;
        sigWidth = sigHeight * aspectRatio;
        if (sigWidth > 220) {
          sigWidth = 220;
          sigHeight = sigWidth / aspectRatio;
        }
      }

      const imgOpts: any = {
        centered: false,
        getImage: (tagValue: string) => {
          if (!tagValue || typeof tagValue !== 'string' || !tagValue.startsWith('data:image')) return null;
          try {
            const base64Data = tagValue.split(',')[1];
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
      
      // Logic to determine if an item is a speech for sequential numbering
      const isSpeech = (it: any) => {
        if (it.noSpeaker || it.isRole) return false;
        const t = it.title.toLowerCase();
        // A prayer is identified by "Cântico" AND "oração"
        const isPr = t.includes('cântico') && t.includes('oração');
        if (isPr) return false;
        
        if (t.includes('música') || t.includes('anúncios') || t.includes('intervalo') || t.includes('cântico')) return false;
        return true;
      };

      // Calculate start time and sequential number for the current item
      let currentOffset = 0;
      let sequentialNumber = 0;
      let itemStartTime = "";
      let found = false;
      let parentItem: any = null;

      for (const session of program.sessions) {
        for (const sItem of session.items) {
          const sItemDuration = (sItem as any).duration || 0;
          
          if ((sItem as any).subitems) {
            let subOffset = currentOffset;
            const subTarget = (sItem as any).subitems.find((si: any) => si.id === item.id);
            if (subTarget) parentItem = sItem;

            for (const sub of (sItem as any).subitems) {
              if (isSpeech(sub)) sequentialNumber++;
              if (sub.id === item.id) {
                itemStartTime = calculateTime(details.startTime, subOffset);
                found = true;
                break;
              }
              subOffset += (sub as any).duration || 0;
            }
          } else {
            if (isSpeech(sItem)) sequentialNumber++;
            if (sItem.id === item.id) {
              itemStartTime = calculateTime(details.startTime, currentOffset);
              found = true;
              break;
            }
          }
          
          if (found) break;
          currentOffset += sItemDuration;
        }
        if (found) break;
      }

      const itemLabel = (item as any).label || '';
      const parentLabel = (parentItem as any)?.label || '';
      const parentTitle = (parentItem as any)?.title || '';
      const isSerie = parentLabel.toUpperCase().includes('SÉRIE DE DISCURSOS') || itemLabel.toUpperCase().includes('SÉRIE DE DISCURSOS');

      let tituloValue = item.title;
      if (isSerie) {
        const seriesTheme = (parentTitle || item.title).replace(/^SÉRIE DE DISCURSOS:\s*/i, '').trim();
        let partTitle = item.title.replace(/^SÉRIE DE DISCURSOS:\s*/i, '').trim();
        
        if (parentItem && partTitle !== seriesTheme) {
          if (partTitle.startsWith(seriesTheme)) {
            partTitle = partTitle.substring(seriesTheme.length).replace(/^[—\-\s:]+/, '').trim();
          }
          tituloValue = `SÉRIE DE DISCURSOS:\n${seriesTheme}${partTitle ? `\n${partTitle}` : ''}`;
        } else {
          tituloValue = `SÉRIE DE DISCURSOS:\n${seriesTheme}`;
        }
      }

      const replacements = {
        'EVENTO': program.title,
        'TEMA': details.assemblyTheme || program.theme,
        'DATA': details.eventDate || '________________',
        'LOCAL': details.eventLocation || '________________',
        'DATA_EVENTO': details.eventDate || '________________',
        'LOCAL_EVENTO': details.eventLocation || '________________',
        'MATERIAL': details.material || '________________',
        'ORADOR': speakerName,
        'TITULO': tituloValue,
        'HORA': itemStartTime,
        'N': sequentialNumber.toString(),
        // Multiple aliases for rehearsal info to match assembly logic
        'ENSAIOS': details.rehearsalDate || '________________',
        'ENDEREÇO': details.rehearsalLocation || '________________',
        'D_ENSAIO': details.rehearsalDate || '________________',
        'L_ENSAIO': details.rehearsalLocation || '________________',
        'DATA_ENSAIO': details.rehearsalDate || '________________',
        'LOCAL_ENSAIO': details.rehearsalLocation || '________________',
        'DATAHORA': details.rehearsalDate || '________________',
        'LOCALTREINO': details.rehearsalLocation || '________________',
        
        'CIRCUITO': personalData?.circuito || '________________',
        'VIAJANTE': personalData?.nome || '________________',
        'NOME': personalData?.nome || '________________',
        'FONE': personalData?.telefoneCircuito || personalData?.telefone || '________________',
        'TELEFONE': personalData?.telefoneCircuito || personalData?.telefone || '________________',
        'ASSINATURA': signatureImage,
        '%ASSINATURA': signatureImage,
      };

      const docObj = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' },
        modules: ImageModule ? [new ImageModule(imgOpts)] : []
      });

      docObj.render(replacements);

      const out = docObj.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const url = URL.createObjectURL(out);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Convite_${speakerName.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating document:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 size={40} className="text-[#512da8] animate-spin" />
        <p className="text-gray-500 font-medium">Carregando programação...</p>
      </div>
    );
  }

  return (
    <div id="pioneer-meeting-print-content" className="space-y-8 pb-12 print:p-0">
      <style jsx global>{`
        @media screen {
          .print-header, .print-theme, .print-session-title, .print-row, .print-subitem-row {
            display: none !important;
          }
        }
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body * { visibility: hidden; }
          #pioneer-meeting-print-content, #pioneer-meeting-print-content * { visibility: visible !important; }
          #pioneer-meeting-print-content { 
            position: absolute !important; 
            top: 0 !important; 
            left: 0 !important; 
            width: 100% !important; 
            display: block !important;
          }
          .no-print { display: none !important; }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-header {
            display: block !important;
            text-align: center !important;
            margin-bottom: 1.5rem !important;
            border-bottom: 2px solid #8B5CF6 !important;
            padding-bottom: 1rem !important;
          }
          .print-title {
            display: block !important;
            font-size: 16pt !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            color: #8B5CF6 !important;
            margin-bottom: 0.2rem !important;
          }
          .print-theme {
            display: block !important;
            font-size: 11pt !important;
            font-style: italic !important;
            color: #4b5563 !important;
          }
          .print-row {
            display: flex !important;
            border-bottom: 0.5pt solid #e5e7eb !important;
            align-items: stretch !important;
            break-inside: avoid !important;
          }
          .print-cell-time {
            width: 45pt !important;
            padding: 6pt !important;
            font-size: 9pt !important;
            font-weight: 700 !important;
            border-right: 0.5pt solid #e5e7eb !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            color: #8B5CF6 !important;
          }
          .print-cell-content {
            flex: 1 !important;
            padding: 6pt 10pt !important;
            font-size: 10pt !important;
          }
          .print-cell-speaker {
            width: 160pt !important;
            padding: 6pt 10pt !important;
            font-size: 10pt !important;
            font-weight: 700 !important;
            border-left: 0.5pt solid #e5e7eb !important;
            background-color: #F5F3FF !important;
          }
        }
      `}</style>

      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <button onClick={handleBackClick} className="p-1.5 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-md border border-gray-200">
            <ChevronLeft size={22} strokeWidth={3} />
          </button>
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-gray-800 leading-tight">
              Reunião Especial {selectedYear}
            </h2>
          </div>
        </div>
        
        {/* Occasion Selector */}
        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
          {[0, 1, 2, 3].map((part) => (
            <button
              key={part}
              onClick={() => setSelectedPart(part)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                selectedPart === part 
                  ? 'bg-white text-violet-600 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Parte {part + 1}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && !isGuest && (
            <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg shadow-md">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span className="text-[10px] font-bold uppercase">Salvar</span>
            </button>
          )}
          <button onClick={generateS302} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg shadow-md hover:bg-violet-700 transition-all">
            <FileText size={16} />
            <span className="text-[10px] font-bold uppercase">Convite</span>
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg shadow-sm border border-gray-200">
            <Printer size={16} />
            <span className="text-[10px] font-bold uppercase">Imprimir</span>
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="relative h-56 md:h-80 rounded-3xl overflow-hidden shadow-lg border border-gray-100 no-print">
        <Image 
          src={program.headerImage} 
          alt="Reunião Especial" 
          fill
          className="object-cover"
          style={{ objectPosition: 'center 33%' }}
          priority
          quality={100}
          unoptimized
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 flex flex-col justify-between p-6 text-white">
          <div className="text-xs md:text-sm font-black uppercase tracking-widest text-violet-200/80 drop-shadow-sm">
            {program.title}
          </div>
          
          <div className="space-y-3">
            <div className="text-xl md:text-3xl font-black uppercase tracking-tight text-violet-300 drop-shadow-sm">
              {details.assemblyTheme}
            </div>
            
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {details.eventDate && (
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/90">
                  <CalendarDays size={18} className="text-violet-400" />
                  {details.eventDate}
                </div>
              )}
              {details.eventLocation && (
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/90">
                  <MapPin size={18} className="text-violet-400" />
                  {details.eventLocation}
                </div>
              )}
              {details.rehearsalDate && (
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/70">
                  <Clock size={18} className="text-violet-400/70" />
                  Ensaio: {details.rehearsalDate}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details Toggle */}
      <div className="flex justify-center no-print">
        <button onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-2 px-6 py-2 bg-violet-100 text-violet-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-violet-200">
          {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showDetails ? 'Ocultar Informações' : 'Dados do Evento'}
        </button>
      </div>

      <AnimatePresence>
        {showDetails && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="no-print">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Evento</label>
                  <input type="time" placeholder="Horário de Início" value={details.startTime} onChange={e => updateDetails(d => ({ ...d, startTime: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold mb-2" />
                  <input type="text" placeholder="Data do Evento" value={details.eventDate} onChange={e => updateDetails(d => ({ ...d, eventDate: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold" />
                  <input type="text" placeholder="Local" value={details.eventLocation} onChange={e => updateDetails(d => ({ ...d, eventLocation: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Ensaio</label>
                  <input type="text" placeholder="Data do Ensaio" value={details.rehearsalDate} onChange={e => updateDetails(d => ({ ...d, rehearsalDate: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold" />
                  <input type="text" placeholder="Local do Ensaio" value={details.rehearsalLocation} onChange={e => updateDetails(d => ({ ...d, rehearsalLocation: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2 col-span-1 md:col-span-2">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Material Necessário</label>
                <textarea 
                  placeholder="Liste o material necessário para a reunião..." 
                  value={details.material} 
                  onChange={e => updateDetails(d => ({ ...d, material: e.target.value }))} 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold min-h-[100px] resize-none"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Program */}
      <div className="space-y-6 no-print">
        {program.sessions.map(session => (
          <div key={session.period} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {session.items.map((item: any, idx: number) => {
                // Calculate start time for this item
                let currentOffset = 0;
                for (let i = 0; i < idx; i++) {
                  currentOffset += session.items[i].duration || 0;
                }
                const itemStartTime = calculateTime(details.startTime, currentOffset);

                return (
                  <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-black text-violet-600 w-12">{itemStartTime}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.label && <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">{item.label}</span>}
                          <h4 className="text-base font-bold text-gray-900 leading-tight truncate">{item.title}</h4>
                        </div>
                        {!item.noSpeaker && (
                          <input 
                            type="text" 
                            placeholder="Nome do Orador..." 
                            value={speakers[item.id] || ''} 
                            onChange={e => handleSpeakerChange(item.id, e.target.value)}
                            className="w-full mt-2 text-sm font-semibold text-gray-700 bg-transparent border-b border-gray-100 focus:border-violet-500 outline-none pb-1"
                          />
                        )}
                      </div>
                      {!item.noSpeaker && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleConfirmationToggle(item.id)} className={`p-2 rounded-xl transition-all ${confirmedSpeakers[item.id] ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                            {confirmedSpeakers[item.id] ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                          </button>
                          <button onClick={() => generateDocument(item)} className="p-2 bg-violet-100 text-violet-600 rounded-xl hover:bg-violet-200 transition-all">
                            <Printer size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                    {item.subitems && (
                      <div className="mt-4 ml-16 space-y-3">
                        {item.subitems.map((sub: any, subIdx: number) => {
                          // Calculate sub-item start time
                          let subOffset = currentOffset;
                          for (let i = 0; i < subIdx; i++) {
                            subOffset += item.subitems[i].duration || 0;
                          }
                          const subStartTime = calculateTime(details.startTime, subOffset);

                          return (
                            <div key={sub.id} className="flex items-center gap-4 group">
                              <span className="text-[10px] font-black text-violet-400 w-8">{subStartTime}</span>
                              <div className="flex-1 min-w-0">
                                <h5 className="text-sm font-bold text-gray-600 group-hover:text-violet-600 transition-colors">{sub.title}</h5>
                                <input 
                                  type="text" 
                                  placeholder="Nome do Orador..." 
                                  value={speakers[sub.id] || ''} 
                                  onChange={e => handleSpeakerChange(sub.id, e.target.value)}
                                  className="w-full mt-1 text-xs font-semibold text-gray-600 bg-transparent border-b border-gray-100 focus:border-violet-500 outline-none"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleConfirmationToggle(sub.id)} className={`p-1.5 rounded-lg transition-all ${confirmedSpeakers[sub.id] ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                                  {confirmedSpeakers[sub.id] ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                                </button>
                                <button onClick={() => generateDocument(sub)} className="p-1.5 bg-violet-100 text-violet-600 rounded-lg hover:bg-violet-200 transition-all">
                                  <Printer size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Print View */}
      <div className="print-header">
        <h1 className="print-title">{program.title}</h1>
        <p className="print-theme">{details.assemblyTheme}</p>
        {(details.eventDate || details.eventLocation) && (
          <div className="print-details">
            {details.eventDate && <span>Data: {details.eventDate}</span>}
            {details.eventLocation && <span>Local: {details.eventLocation}</span>}
          </div>
        )}
      </div>

      <div className="print-table">
        {program.sessions.map(session => (
          <div key={session.period}>
            <div className="print-session-title">{session.period}</div>
            {session.items.map((item: any, idx: number) => {
              // Calculate start time for this item
              let currentOffset = 0;
              for (let i = 0; i < idx; i++) {
                currentOffset += session.items[i].duration || 0;
              }
              const itemStartTime = calculateTime(details.startTime, currentOffset);

              return (
                <div key={item.id}>
                  <div className="print-row">
                    <div className="print-cell-time">{itemStartTime}</div>
                    <div className="print-cell-content">
                      {item.label && <span className="print-item-label">{item.label}</span>}
                      <span className="print-item-title">{item.title}</span>
                    </div>
                    {!item.noSpeaker && (
                      <div className="print-cell-speaker">
                        {speakers[item.id] || ''}
                      </div>
                    )}
                  </div>
                  {item.subitems && item.subitems.map((sub: any, subIdx: number) => {
                    // Calculate sub-item start time
                    let subOffset = currentOffset;
                    for (let i = 0; i < subIdx; i++) {
                      subOffset += item.subitems[i].duration || 0;
                    }
                    const subStartTime = calculateTime(details.startTime, subOffset);

                    return (
                      <div key={sub.id} className="print-subitem-row">
                        <div className="print-cell-time" style={{ fontSize: '8pt', color: '#6b7280' }}>{subStartTime}</div>
                        <div className="print-subitem-content">
                          {sub.title}
                        </div>
                        <div className="print-subitem-speaker">
                          {speakers[sub.id] || ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Confirm Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100">
              <div className="flex items-center gap-3 text-amber-600 mb-4">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-black uppercase tracking-tight">Alterações não salvas</h3>
              </div>
              <p className="text-gray-600 text-sm font-medium mb-6">
                Você fez alterações que ainda não foram salvas. Deseja salvar antes de sair?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setShowConfirmModal(false); if (pendingAction) pendingAction(); }} className="px-4 py-2 bg-gray-100 text-gray-500 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-colors">
                  Sair sem salvar
                </button>
                <button onClick={async () => { const success = await handleSave(); if (success) { setShowConfirmModal(false); if (pendingAction) pendingAction(); } }} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-colors">
                  Salvar e sair
                </button>
              </div>
              <button onClick={() => setShowConfirmModal(false)} className="w-full mt-3 py-2 text-gray-400 text-[10px] font-black uppercase tracking-widest hover:text-gray-600 transition-colors">
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
