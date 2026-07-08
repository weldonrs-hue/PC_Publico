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

interface CircuitAssemblyViewProps {
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
}

const assemblyProgram = {
  title: 'ASSEMBLEIA DE CIRCUITO COM O SUPERINTENDENTE',
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
        { id: 'm7', time: '11:35', label: 'BATISMO:', title: '“Seu Pai, que observa em secreto, o recompensará”', icon: BookOpen },
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
};

export default function CircuitAssemblyView({ userId, isGuest = false, onBack }: CircuitAssemblyViewProps) {
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

        const docRef = doc(db, 'circuit_assembly_supt_speakers', userId);
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
  }, [userId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'circuit_assembly_supt_speakers', userId);
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

    let templateId = '';
    let designation = '';

    if (item.title.toLowerCase().includes('oração')) {
      templateId = 'cong_convite_oracao';
      designation = item.title.toLowerCase().includes('final') ? 'Oração Final' : 'Oração Inicial';
    } else if (item.isRole && item.title.includes('PRESIDENTE')) {
      templateId = 'cong_presidente_sessao';
      designation = 'PRESIDENTE DE SESSÃO';
    } else {
      templateId = 'cong_aviso_treinamentos';
      designation = item.title;
    }

    const template = templates[templateId];
    if (!template) {
      await showAlert(`Template "${templateId}" não encontrado.`, 'Aviso');
      return;
    }

    setIsSaving(true);
    try {
      const binaryString = window.atob(template.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const zip = new PizZip(bytes.buffer);
      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      
      const signatureImage = personalData?.signatureImage || '';
      
      const replacements = {
        'ANO': '2026',
        'TEMA': details.assemblyTheme || assemblyProgram.theme,
        'DATA': details.eventDate || '________________',
        'LOCAL': details.eventLocation || '________________',
        'DATA_ENSAIO': details.rehearsalDate || '________________',
        'LOCAL_ENSAIO': details.rehearsalLocation || '________________',
        'DESIGNAÇÃO': designation,
        'DESIGNACAO': designation,
        'DIA': 'Assembleia',
        'ORADOR': speakerName,
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
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body * { visibility: hidden; }
          #circuit-assembly-print-content, #circuit-assembly-print-content * { visibility: visible !important; }
          #circuit-assembly-print-content { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <button onClick={handleBackClick} className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-md border border-gray-200">
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">Assembleia de Circuito 2026-2027</h2>
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
      <div className="relative h-48 md:h-72 rounded-3xl overflow-hidden shadow-lg border border-gray-100 no-print">
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
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 text-white">
          <div className="text-xl md:text-2xl font-black uppercase tracking-tight text-amber-300 drop-shadow-sm">{details.assemblyTheme}</div>
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

      {/* Program */}
      <div className="space-y-12">
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
                          <button onClick={() => generateDocument({ ...sub, title: `${item.title}: ${sub.title}` }, 'docx')} className="p-1.5 bg-gray-50 text-gray-400 rounded-lg hover:bg-amber-50 hover:text-amber-600">
                            <FileText size={14} />
                          </button>
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
