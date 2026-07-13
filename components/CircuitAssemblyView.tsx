'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Store, ChevronLeft, Calendar, Clock, BookOpen, Music, Info, User, Save, AlertTriangle, Loader2, Printer, MapPin, CalendarDays, ChevronDown, ChevronUp, FileDown, FileText, Download, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { useDialog } from '@/hooks/useDialog';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { cleanPSSMetadata } from '@/lib/docxUtils';

interface CircuitAssemblyViewProps {
  userId: string;
  isGuest?: boolean;
  onBack: () => void;
  type: 'supt' | 'branch';
}

const programs = {
  supt: {
    title: 'Programa da Assembleia de Circuito de 2027 — com o Superintendente de Circuito',
    year: '2026-2027',
    theme: '“Feliz É Aquele Que Confia em Jeová” — Provérbios 16:20',
    color: '#F59E0B', // Amber
    headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102027245/univ/art/1102027245_univ_lsr_xl.jpg',
    sessions: [
      {
        period: 'Manhã',
        items: [
          { id: 'm0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
          { id: 'm1', time: '9:40', title: 'Música', icon: Music, noSpeaker: true },
          { id: 'm2', time: '9:50', title: 'Cântico 31 e oração', icon: Music },
          { id: 'm3', time: '10:00', title: 'Por que ‘confiar em Jeová de todo o seu coração’?', icon: BookOpen },
          { 
            id: 'm4', 
            time: '10:15', 
            label: 'SÉRIE DE DISCURSOS:', 
            title: 'Imite aqueles que confiaram em Jeová!', 
            icon: BookOpen,
            noSpeaker: true,
            subitems: [
              { id: 'm4_1', title: 'Baraque' },
              { id: 'm4_2', title: 'A mulher sunamita' },
              { id: 'm4_3', title: 'Daniel, Hananias, Misael e Azarias' }
            ]
          },
          { id: 'm5', time: '11:05', title: 'Cântico 57 e anúncios', icon: Info, noSpeaker: true },
          { id: 'm6', time: '11:15', title: 'Ajude as pessoas a confiar no “Deus vivente e verdadeiro”', icon: BookOpen },
          { id: 'm7', time: '11:35', title: '“Seu Pai, que observa em secreto, o recompensará”', icon: BookOpen },
          { id: 'm8', time: '12:05', title: 'Cântico 29 e intervalo', icon: Clock, noSpeaker: true }
        ]
      },
      {
        period: 'Tarde',
        items: [
          { id: 't0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
          { id: 't1', time: '1:20', title: 'Música', icon: Music, noSpeaker: true },
          { id: 't2', time: '1:30', title: 'Cântico 8 e oração', icon: Music },
          { id: 't3', time: '1:35', label: 'DISCURSO PARA O PÚBLICO:', title: 'Em quem você realmente pode confiar?', icon: BookOpen },
          { id: 't4', time: '2:05', title: 'Resumo de A Sentinela', icon: BookOpen },
          { id: 't5', time: '2:35', title: 'Cântico 135 e anúncios', icon: Info, noSpeaker: true },
          { 
            id: 't6', 
            time: '2:45', 
            label: 'SÉRIE DE DISCURSOS:', 
            title: 'Confie na sabedoria de Jeová', 
            icon: BookOpen,
            noSpeaker: true,
            subitems: [
              { id: 't6_1', title: 'Ao orientar seus filhos' },
              { id: 't6_2', title: 'Ao fazer planos para o futuro' },
              { id: 't6_3', title: 'Ao enfrentar tentações' }
            ]
          },
          { id: 't7', time: '3:30', title: '“Feliz é aquele que confia em Jeová”', icon: BookOpen },
          { id: 't8', time: '4:00', title: 'Cântico 54 e oração final', icon: Music }
        ]
      }
    ]
  },
  branch: {
    title: 'Programa da Assembleia de Circuito de 2027 — com o Representante de Betel',
    year: '2026-2027',
    theme: '“Encontre a Mais Plena Alegria em Jeová” — Salmo 37:4',
    color: '#F43F5E', // Rose
    headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102027241/univ/art/1102027241_univ_lsr_xl.jpg',
    sessions: [
      {
        period: 'Manhã',
        items: [
          { id: 'm0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
          { id: 'm1', time: '9:40', title: 'Música', icon: Music, noSpeaker: true },
          { id: 'm2', time: '9:50', title: 'Cântico 7 e oração', icon: Music },
          { id: 'm3', time: '10:00', title: '“Encontre a mais plena alegria em Jeová” — Como?', icon: BookOpen },
          { id: 'm4', time: '10:15', title: '“Feliz aquele . . . cujo pecado é desculpado”', icon: BookOpen },
          { id: 'm5', time: '10:30', title: '“Felizes são os que moram na tua casa!”', icon: BookOpen },
          { id: 'm6', time: '10:55', title: 'Cântico 37 e anúncios', icon: Info, noSpeaker: true },
          { id: 'm7', time: '11:05', title: '‘Feliz o homem que se refugia em Jeová’', icon: BookOpen },
          { id: 'm8', time: '11:35', title: '“Seu Pai, que observa em secreto, o recompensará”', icon: BookOpen },
          { id: 'm9', time: '12:05', title: 'Cântico 38 e intervalo', icon: Clock, noSpeaker: true }
        ]
      },
      {
        period: 'Tarde',
        items: [
          { id: 't0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
          { id: 't1', time: '1:20', title: 'Música', icon: Music, noSpeaker: true },
          { id: 't2', time: '1:30', title: 'Cântico 111 e oração', icon: Music },
          { id: 't3', time: '1:35', title: 'Experiências', icon: Info },
          { id: 't4', time: '1:45', title: 'Resumo de A Sentinela', icon: BookOpen },
          { 
            id: 't5', 
            time: '2:15', 
            label: 'SÉRIE DE DISCURSOS:', 
            title: 'Busque o que traz verdadeira felicidade', 
            icon: BookOpen,
            noSpeaker: true,
            subitems: [
              { id: 't5_1', title: 'Um estilo de vida simples' },
              { id: 't5_2', title: 'Bons amigos' },
              { id: 't5_3', title: 'Uma família unida' }
            ]
          },
          { id: 't6', time: '3:00', title: 'Cântico 88 e anúncios', icon: Info, noSpeaker: true },
          { id: 't7', time: '3:10', title: '“Feliz o povo cujo Deus é Jeová!”', icon: BookOpen },
          { id: 't8', time: '3:55', title: 'Cântico 161 e oração final', icon: Music }
        ]
      }
    ]
  }
};

export default function CircuitAssemblyView({ userId, isGuest = false, onBack, type }: CircuitAssemblyViewProps) {
  const assemblyProgram = programs[type];
  const { showAlert } = useDialog();
  const [speakers, setSpeakers] = useState<Record<string, string>>({});
  const [initialSpeakers, setInitialSpeakers] = useState<Record<string, string>>({});
  const [confirmedSpeakers, setConfirmedSpeakers] = useState<Record<string, boolean>>({});
  const [initialConfirmedSpeakers, setInitialConfirmedSpeakers] = useState<Record<string, boolean>>({});
  const [personalData, setPersonalData] = useState<any>(null);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string }>>({});
  const [details, setDetails] = useState<AssemblyDetails>({
    eventDate: '',
    eventLocation: '',
    rehearsalDate: '',
    rehearsalLocation: '',
    assemblyTheme: assemblyProgram.theme,
  });
  const [initialDetails, setInitialDetails] = useState<AssemblyDetails>({
    eventDate: '',
    eventLocation: '',
    rehearsalDate: '',
    rehearsalLocation: '',
    assemblyTheme: assemblyProgram.theme,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const collectionName = type === 'supt' ? 'circuit_assembly_supt_speakers' : 'circuit_assembly_branch_speakers';

  const hasChanges = JSON.stringify(speakers) !== JSON.stringify(initialSpeakers) || 
                     JSON.stringify(confirmedSpeakers) !== JSON.stringify(initialConfirmedSpeakers) ||
                     JSON.stringify(details) !== JSON.stringify(initialDetails);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const personalDocRef = doc(db, 'personal_data', userId);
        const personalSnap = await getDoc(personalDocRef);
        if (personalSnap.exists()) {
          setPersonalData(personalSnap.data());
        }

        const templatesSnapshot = await getDocs(collection(db, 'document_templates'));
        const fetchedTemplates: Record<string, any> = {};
        templatesSnapshot.forEach((doc) => {
          fetchedTemplates[doc.id] = doc.data();
        });
        setTemplates(fetchedTemplates);

        const docRef = doc(db, collectionName, userId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSpeakers(data.speakers || {});
          setInitialSpeakers(data.speakers || {});
          setConfirmedSpeakers(data.confirmations || {});
          setInitialConfirmedSpeakers(data.confirmations || {});
          const loadedDetails = {
            eventDate: data.details?.eventDate || '',
            eventLocation: data.details?.eventLocation || '',
            rehearsalDate: data.details?.rehearsalDate || '',
            rehearsalLocation: data.details?.rehearsalLocation || '',
            assemblyTheme: data.details?.assemblyTheme || assemblyProgram.theme,
          };
          setDetails(loadedDetails);
          setInitialDetails(loadedDetails);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId, collectionName, assemblyProgram.theme]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, collectionName, userId);
      await setDoc(docRef, { 
        speakers,
        confirmations: confirmedSpeakers,
        details,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setInitialSpeakers(speakers);
      setInitialConfirmedSpeakers(confirmedSpeakers);
      setInitialDetails(details);
      return true;
    } catch (error) {
      console.error('Error saving speakers:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackClick = () => {
    if (hasChanges) {
      setPendingAction(() => onBack);
      setShowConfirmModal(true);
    } else {
      onBack();
    }
  };

  const handleSpeakerChange = (id: string, value: string) => {
    setSpeakers(prev => ({ ...prev, [id]: value }));
  };

  const handleConfirmationToggle = (id: string) => {
    setConfirmedSpeakers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const generateDocument = async (item: any, type: 'docx' | 'pdf') => {
    const speakerName = speakers[item.id];
    if (!speakerName) {
      await showAlert('Por favor, informe o nome do orador primeiro.', 'Aviso');
      return;
    }

    const isSpeech = (it: any) => {
      if (it.noSpeaker || it.isRole) return false;
      const t = it.title.toLowerCase();
      // A prayer is identified by "Cântico" AND "oração"
      const isPr = t.includes('cântico') && t.includes('oração');
      if (isPr) return false;
      
      if (t.includes('música') || t.includes('anúncios') || t.includes('intervalo') || t.includes('cântico')) return false;
      return true;
    };

    let n = 0;
    let found = false;
    let parentItem: any = null;
    for (const session of assemblyProgram.sessions) {
      for (const pItem of session.items) {
        if (pItem.subitems) {
          const subTarget = pItem.subitems.find(si => si.id === item.id);
          if (subTarget) parentItem = pItem;
          
          for (const sub of pItem.subitems) {
            if (isSpeech(sub)) n++;
            if (sub.id === item.id) { found = true; break; }
          }
        } else {
          if (isSpeech(pItem)) n++;
          if (pItem.id === item.id) { found = true; break; }
        }
        if (found) break;
      }
      if (found) break;
    }

    let templateId = '';
    let designation = '';

    const isPrayer = item.title.toLowerCase().includes('cântico') && item.title.toLowerCase().includes('oração');
    const isPresident = item.isRole && item.title.toLowerCase().includes('presidente');

    if (isPrayer) {
      templateId = 'ass_convite_oracao';
      // Identify which prayer it is based on all items in the program
      const allItems: any[] = [];
      assemblyProgram.sessions.forEach(s => {
        s.items.forEach(i => {
          allItems.push(i);
          if (i.subitems) i.subitems.forEach(si => allItems.push(si));
        });
      });
      const prayerItems = allItems.filter(i => i.title.toLowerCase().includes('cântico') && i.title.toLowerCase().includes('oração'));
      const prayerIndex = prayerItems.findIndex(i => i.id === item.id);
      
      if (prayerIndex === 0) designation = 'ORAÇÃO INICIAL';
      else if (prayerIndex === 1) designation = 'ORAÇÃO DA TARDE';
      else if (prayerIndex === 2) designation = 'ORAÇÃO FINAL';
      else designation = 'ORAÇÃO';
    } else if (isPresident) {
      templateId = 'ass_convite_presidente';
      const allItems: any[] = [];
      assemblyProgram.sessions.forEach(s => {
        s.items.forEach(i => {
          allItems.push(i);
          if (i.subitems) i.subitems.forEach(si => allItems.push(si));
        });
      });
      const presidentItems = allItems.filter(i => i.isRole && i.title.toLowerCase().includes('presidente'));
      const presidentIndex = presidentItems.findIndex(i => i.id === item.id);
      
      if (presidentIndex === 0) designation = 'PRESIDENTE DE SESSÃO MANHÃ';
      else if (presidentIndex === 1) designation = 'PRESIDENTE DE SESSÃO TARDE';
      else designation = 'PRESIDENTE DE SESSÃO';
    } else {
      templateId = 'ass_carta_oradores';
      designation = item.title;
    }

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
      
      const signatureImage = personalData?.signatureImage || '';

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
            return `${p1}[${p2.toUpperCase()}]`;
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
      
      const themeValue = details.assemblyTheme || assemblyProgram.theme;
      const itemLabel = (item as any).label || '';
      const parentLabel = parentItem?.label || '';
      const parentTitle = parentItem?.title || '';

      const isSerie = parentLabel.toUpperCase().includes('SÉRIE DE DISCURSOS') || itemLabel.toUpperCase().includes('SÉRIE DE DISCURSOS');
      const isPub = itemLabel.toUpperCase().includes('DISCURSO PARA O PÚBLICO') || item.title.toUpperCase().includes('DISCURSO PARA O PÚBLICO');

      let tituloValue = (isPrayer || isPresident) ? designation : item.title;
      
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
      } else if (isPub) {
        const cleanTitle = item.title.replace(/^DISCURSO PARA O PÚBLICO:\s*/i, '');
        tituloValue = `DISCURSO PARA O PÚBLICO:\n${cleanTitle}`;
      }

      const replacements = {
        'EVENTO': assemblyProgram.title,
        'TEMA': themeValue,
        'DATA': details.eventDate || '________________',
        'LOCAL': details.eventLocation || '________________',
        'ORADOR': speakerName,
        'D_ENSAIO': details.rehearsalDate || '________________',
        'L_ENSAIO': details.rehearsalLocation || '________________',
        'HORA': item.time || '',
        'N': n.toString(),
        'TITULO': tituloValue,
        // Mantendo compatibilidade
        'ANO': '2026',
        'DATA_ENSAIO': details.rehearsalDate || '________________',
        'LOCAL_ENSAIO': details.rehearsalLocation || '________________',
        'DESIGNAÇÃO': designation,
        'DESIGNACAO': designation,
        'DIA': 'Assembleia',
        'ASSINATURA': signatureImage,
        '%ASSINATURA': signatureImage,
        'VIAJANTE': personalData?.nome || '________________',
        'CIRCUITO': personalData?.circuito || '________________',
        'FONE': personalData?.telefoneCircuito || personalData?.telefone || '________________',
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
      link.download = `Carta_${speakerName.replace(/\s+/g, '_')}.docx`;
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
    <div id="circuit-assembly-print-content" className="space-y-8 pb-12 print:p-0">
      <style jsx global>{`
        @media screen {
          .print-header, .print-theme, .print-session-title, .print-row, .print-subitem-row {
            display: none !important;
          }
        }

        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body * { visibility: hidden; }
          #circuit-assembly-print-content, #circuit-assembly-print-content * { visibility: visible !important; }
          #circuit-assembly-print-content { 
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
            border-bottom: 2px solid #F59E0B !important;
            padding-bottom: 1rem !important;
          }

          .print-title {
            display: block !important;
            font-size: 18pt !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            color: #F59E0B !important;
            margin-bottom: 0.2rem !important;
          }

          .print-theme {
            display: block !important;
            font-size: 11pt !important;
            font-style: italic !important;
            color: #4b5563 !important;
          }

          .print-details {
            display: flex !important;
            justify-content: center !important;
            gap: 2rem !important;
            margin-top: 0.5rem !important;
            font-size: 10pt !important;
            font-weight: 600 !important;
          }

          .print-session-title {
            display: block !important;
            font-size: 14pt !important;
            font-weight: 800 !important;
            background-color: #FEF3C7 !important;
            color: #92400E !important;
            padding: 4pt 10pt !important;
            margin-top: 1.5rem !important;
            text-transform: uppercase !important;
            border-radius: 4pt !important;
          }

          .print-table {
            width: 100% !important;
            margin-top: 0.5rem !important;
            border: 0.5pt solid #e5e7eb !important;
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
            color: #92400E !important;
          }

          .print-cell-content {
            flex: 1 !important;
            padding: 6pt 10pt !important;
            font-size: 10pt !important;
            line-height: 1.2 !important;
          }

          .print-item-label {
            font-size: 8pt !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            color: #D97706 !important;
            margin-bottom: 1pt !important;
            display: block !important;
          }

          .print-item-title {
            font-weight: 700 !important;
          }

          .print-cell-speaker {
            width: 160pt !important;
            padding: 6pt 10pt !important;
            font-size: 10pt !important;
            font-weight: 700 !important;
            border-left: 0.5pt solid #e5e7eb !important;
            background-color: #FFFBEB !important;
            display: flex !important;
            align-items: center !important;
          }

          .print-subitem-row {
            display: flex !important;
            border-bottom: 0.5pt solid #f3f4f6 !important;
            margin-left: 45pt !important;
            background-color: #fafafa !important;
          }

          .print-subitem-content {
            flex: 1 !important;
            padding: 4pt 10pt !important;
            font-size: 9pt !important;
            font-style: italic !important;
          }

          .print-subitem-speaker {
            width: 160pt !important;
            padding: 4pt 10pt !important;
            font-size: 9pt !important;
            font-weight: 700 !important;
            border-left: 0.5pt solid #e5e7eb !important;
            display: flex !important;
            align-items: center !important;
          }
        }
      `}</style>

      {/* Screen Header (no-print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <button onClick={handleBackClick} className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-md border border-gray-200">
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">
            {type === 'supt' ? 'CAco 2026-2027' : 'CAbr 2026-2027'}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          {hasChanges && !isGuest && (
            <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-full shadow-lg">
              {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              <span className="text-xs font-bold uppercase">Salvar</span>
            </button>
          )}
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 rounded-full shadow-md border border-gray-200">
            <Printer size={20} />
            <span className="text-xs font-bold uppercase">Imprimir</span>
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="relative h-56 md:h-80 rounded-3xl overflow-hidden shadow-lg border border-gray-100 no-print">
        <Image 
          src={assemblyProgram.headerImage} 
          alt="Assembleia de Circuito" 
          fill
          className="object-cover"
          style={{ objectPosition: 'center 33%' }}
          priority
          quality={100}
          unoptimized
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 flex flex-col justify-between p-6 text-white">
          <div className="text-xs md:text-sm font-black uppercase tracking-widest text-amber-200/80 drop-shadow-sm">
            {assemblyProgram.title}
          </div>
          
          <div className="space-y-3">
            <div className="text-xl md:text-3xl font-black uppercase tracking-tight text-amber-300 drop-shadow-sm">
              {details.assemblyTheme}
            </div>
            
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {details.eventDate && (
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/90">
                  <CalendarDays size={18} className="text-amber-400" />
                  {details.eventDate}
                </div>
              )}
              {details.eventLocation && (
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/90">
                  <MapPin size={18} className="text-amber-400" />
                  {details.eventLocation}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details Toggle */}
      <div className="flex justify-center no-print">
        <button onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-2 px-6 py-2 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200">
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
                  <input type="text" placeholder="Data do Evento" value={details.eventDate} onChange={e => setDetails(d => ({ ...d, eventDate: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold" />
                  <input type="text" placeholder="Local" value={details.eventLocation} onChange={e => setDetails(d => ({ ...d, eventLocation: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Ensaio</label>
                  <input type="text" placeholder="Data do Ensaio" value={details.rehearsalDate} onChange={e => setDetails(d => ({ ...d, rehearsalDate: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold" />
                  <input type="text" placeholder="Local do Ensaio" value={details.rehearsalLocation} onChange={e => setDetails(d => ({ ...d, rehearsalLocation: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Program (no-print) */}
      <div className="space-y-12 no-print">
        {assemblyProgram.sessions.map(session => (
          <div key={session.period} className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-200"></div>
              <h3 className="text-lg font-black text-gray-400 uppercase tracking-[0.3em]">{session.period}</h3>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-200"></div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {session.items.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    {item.time && <span className="text-sm font-black text-amber-600 w-12">{item.time}</span>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {item.label && <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">{item.label}</span>}
                        <h4 className="text-base md:text-lg font-bold text-gray-900 leading-tight truncate">{item.title}</h4>
                      </div>
                      {!item.noSpeaker && (
                        <input 
                          type="text" 
                          placeholder="Nome do Orador..." 
                          value={speakers[item.id] || ''} 
                          onChange={e => handleSpeakerChange(item.id, e.target.value)}
                          className="w-full mt-2 text-sm md:text-base font-semibold text-gray-700 bg-transparent border-b border-gray-100 focus:border-amber-500 outline-none pb-1"
                        />
                      )}
                    </div>
                    {!item.noSpeaker && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleConfirmationToggle(item.id)} className={`p-2 rounded-xl transition-all ${confirmedSpeakers[item.id] ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                          <CheckCircle2 size={18} />
                        </button>
                        <button onClick={() => generateDocument(item, 'docx')} className="p-2 bg-amber-100 text-amber-600 rounded-xl hover:bg-amber-200">
                          <FileText size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                  {item.subitems && (
                    <div className="ml-16 mt-4 space-y-3 border-l-2 border-amber-100 pl-4">
                      {item.subitems.map(sub => (
                        <div key={sub.id} className="flex items-center gap-4">
                          <div className="flex-1">
                            <span className="text-sm font-bold text-gray-800">{sub.title}</span>
                            <input 
                              type="text" 
                              placeholder="Orador..." 
                              value={speakers[sub.id] || ''} 
                              onChange={e => handleSpeakerChange(sub.id, e.target.value)}
                              className="w-full mt-1.5 text-xs md:text-sm font-semibold text-gray-600 bg-transparent border-b border-gray-100 focus:border-amber-500 outline-none pb-1"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleConfirmationToggle(sub.id)} className={`p-1.5 rounded-lg transition-all ${confirmedSpeakers[sub.id] ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                              <CheckCircle2 size={14} />
                            </button>
                            <button onClick={() => generateDocument({ ...sub, title: `${item.title}: ${sub.title}` }, 'docx')} className="p-1.5 bg-gray-50 text-gray-400 rounded-lg hover:bg-amber-50 hover:text-amber-600">
                              <FileText size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Printed Program Layout (Visible only when printing) */}
      <div className="print-header">
        <h1 className="print-title">{assemblyProgram.title}</h1>
        <p className="print-theme">{details.assemblyTheme}</p>
        <div className="print-details">
          {details.eventDate && <span>Data: {details.eventDate}</span>}
          {details.eventLocation && <span>Local: {details.eventLocation}</span>}
        </div>
      </div>

      <div className="hidden print:block">
        {assemblyProgram.sessions.map(session => (
          <div key={session.period} className="mb-8">
            <h2 className="print-session-title">{session.period}</h2>
            <div className="print-table">
              {session.items.map(item => (
                <div key={item.id} className="print:contents">
                  <div className="print-row">
                    <div className="print-cell-time">{item.time || ''}</div>
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
                  {item.subitems && item.subitems.map(sub => (
                    <div key={sub.id} className="print-subitem-row">
                      <div className="print-subitem-content">• {sub.title}</div>
                      <div className="print-subitem-speaker">
                        {speakers[sub.id] || ''}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Discard Changes Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Alterações não salvas</h3>
              <p className="text-gray-500 text-sm mb-6">Existem alterações não salvas. Deseja salvar antes de sair?</p>
              <div className="flex flex-col gap-3">
                <button onClick={async () => { await handleSave(); setShowConfirmModal(false); if (pendingAction) pendingAction(); }} className="w-full py-3 bg-emerald-500 text-white rounded-2xl font-bold">Salvar e Continuar</button>
                <button onClick={() => { setSpeakers(initialSpeakers); setConfirmedSpeakers(initialConfirmedSpeakers); setDetails(initialDetails); setShowConfirmModal(false); if (pendingAction) pendingAction(); }} className="w-full py-3 bg-red-50 text-red-600 rounded-2xl font-bold">Descartar Alterações</button>
                <button onClick={() => setShowConfirmModal(false)} className="w-full py-3 text-gray-400 font-bold">Cancelar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
