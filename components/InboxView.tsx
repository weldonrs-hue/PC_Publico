'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs,
  getDoc,
  doc, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { 
  Plus, 
  Search, 
  Trash2, 
  Send, 
  Loader2,
  Copy,
  Mail,
  Archive,
  FileEdit,
  ExternalLink,
  ChevronDown,
  Menu,
  Paperclip,
  Smile,
  Type,
  Bold,
  Italic,
  Underline,
  List as ListIcon,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Image as ImageIcon,
  RotateCcw,
  RotateCw,
  MoreHorizontal,
  ChevronUp,
  Maximize2,
  Save,
  ArrowLeft,
  Folder,
  Layers,
  X,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDialog } from '@/hooks/useDialog';

interface Attachment {
  name: string;
  size: number;
  type: string;
  data: string; // base64
}

interface Draft {
  id: string;
  recipient: string;
  cc?: string;
  subject: string;
  content: string;
  createdAt: any;
  updatedAt: any;
  userId: string;
  attachments?: Attachment[];
  folder?: 'drafts' | 'sent';
  sentAt?: any;
}

interface Contact {
  name: string;
  email: string;
  type: 'Congregação' | 'Coordenador' | 'Secretário';
  congName: string;
}

interface InboxViewProps {
  onBack?: () => void;
}

export default function InboxView({ onBack }: InboxViewProps) {
  const { showAlert, showConfirm, showDeleteConfirm } = useDialog();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  
  // Responsive navigation state:
  // On mobile/tablet, activeMobilePane controls which pane is active: 'folders' | 'list' | 'editor'
  const [activeMobilePane, setActiveMobilePane] = useState<'folders' | 'list' | 'editor'>('list');
  const [currentFolder, setCurrentFolder] = useState<'drafts' | 'sent'>('drafts');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default to false for better mobile/narrow experience
  const [showCc, setShowCc] = useState(false);
  const [isMicrosoftConnected, setIsMicrosoftConnected] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recipientSuggestions, setRecipientSuggestions] = useState<Contact[]>([]);
  const [ccSuggestions, setCcSuggestions] = useState<Contact[]>([]);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'recipient' | 'cc' | null>(null);
  const [personalData, setPersonalData] = useState<any>(null);
  
  // Set initial sidebar state based on screen size
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [form, setForm] = useState({
    recipient: '',
    cc: '',
    subject: '',
    content: '',
    attachments: [] as Attachment[]
  });

  // Volatile (memory-only) attachments - not saved to Firestore drafts (> 700kb)
  const [volatileAttachments, setVolatileAttachments] = useState<Attachment[]>([]);

  const selectedDraft = drafts.find(d => d.id === selectedId);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Check Microsoft connection
    const checkConnection = async () => {
      try {
        onSnapshot(doc(db, 'microsoft_connections', user.uid), (snap) => {
          setIsMicrosoftConnected(snap.exists());
        });
      } catch (err) {
        console.error('Error checking MS connection:', err);
      }
    };

    checkConnection();

    const q = query(
      collection(db, 'email_drafts'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Draft));
      setDrafts(docs);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching drafts:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch personal data for signature
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const docRef = doc(db, 'personal_data', user.uid);
    getDoc(docRef).then(snap => {
      if (snap.exists()) {
        setPersonalData(snap.data());
      }
    }).catch(err => console.warn('InboxView: Error fetching personal data:', err));
  }, []);

  // Fetch congregations to build contacts list
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(collection(db, 'congregations'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const contactsList: Contact[] = [];
      snap.docs.forEach(doc => {
        const data = doc.data();
        const congName = data.nome || '';
        
        // Add Congregation email
        if (data.emailJWPub) {
          contactsList.push({
            name: congName,
            email: data.emailJWPub,
            type: 'Congregação',
            congName: congName
          });
        }
        
        // Add Coordinator
        if (data.coordenadorEmail) {
          contactsList.push({
            name: data.coordenador || 'Coordenador',
            email: data.coordenadorEmail,
            type: 'Coordenador',
            congName: congName
          });
        }
        
        // Add Secretary
        if (data.secretarioEmail) {
          contactsList.push({
            name: data.secretario || 'Secretário',
            email: data.secretarioEmail,
            type: 'Secretário',
            congName: congName
          });
        }
      });
      setContacts(contactsList);
    }, (err) => {
      console.error('Error fetching contacts:', err);
    });

    return () => unsubscribe();
  }, []);

  // Seeding logic for default drafts
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || loading || !personalData) return;

    const seedVersion = 'v4_progcir_defaults'; // Change this to trigger new seeds
    const seeded = localStorage.getItem(`progcir_drafts_seeded_${user.uid}`);
    
    if (seeded !== seedVersion) {
      const seedDefaults = async () => {
        try {
          // Cleanup: Remove previous default drafts if they exist
          const oldSubjects = [
            'ProgCir: Carta de Designação - Discurso Público',
            'ProgCir: Relatório de Visita à Congregação',
            'ProgCir: Circular - Próxima Assembleia',
            'ProgCir: Relatório de Atividades S-302',
            'ProgCir: Formulário S-62',
            'ProgCir: Relatório da Visita (S-303)',
            'ProgCir: Aviso de Visita (S-302)',
            'ProgCir: Carta de Designação e Remoção',
            'ProgCir: Aviso de Assembleia (S-307)'
          ];
          
          const existingDraftsSnap = await getDocs(
            query(
              collection(db, 'email_drafts'),
              where('userId', '==', user.uid),
              where('folder', '==', 'drafts')
            )
          );

          for (const docSnap of existingDraftsSnap.docs) {
            const data = docSnap.data();
            if (oldSubjects.includes(data.subject)) {
              await deleteDoc(doc(db, 'email_drafts', docSnap.id));
            }
          }

          const userName = personalData?.nome || 'Weldon Rodrigues da Silva';
          const circuit = personalData?.circuito || 'PB-003';
          const whatsapp = personalData?.celular || '(84) 99929-0128';
          const landline = personalData?.telefone || '(98) 98766-3875';

          const signature = `Seu irmão,\n${userName}, ${circuit}\n📱 ${whatsapp} – WhatsApp\n📞 ${landline} – Convencional`;

          const defaultDrafts = [
            {
              subject: 'ProgCir: Formulário S-62',
              content: `Prezados Irmãos:\n\nSegue em anexo o formulário S-62 referente à congregação Central, Campina Grande (14738).\n\n${signature}`,
              recipient: '',
              folder: 'drafts',
              userId: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              attachments: []
            },
            {
              subject: 'ProgCir: Relatório da Visita (S-303)',
              content: `Prezados Irmãos:\n\nSegue em anexo o relatório da visita (S-303) referente à congregação Central, Campina Grande (14738).\n\n${signature}`,
              recipient: '',
              folder: 'drafts',
              userId: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              attachments: []
            },
            {
              subject: 'ProgCir: Aviso de Visita (S-302)',
              content: `Prezados Irmãos:\n\nSegue em anexo o aviso de visita (S-302) referente à congregação Central, Campina Grande (14738).\n\n${signature}`,
              recipient: '',
              folder: 'drafts',
              userId: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              attachments: []
            },
            {
              subject: 'ProgCir: Carta de Designação e Remoção',
              content: `Prezados Irmãos:\n\nSegue em anexo a carta de designação e remoção referente à congregação Central, Campina Grande (14738).\n\n${signature}`,
              recipient: '',
              folder: 'drafts',
              userId: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              attachments: []
            },
            {
              subject: 'ProgCir: Aviso de Assembleia (S-307)',
              content: `Prezados Irmãos:\n\nSegue em anexo o aviso de assembleia (S-307) para conhecimento de todos os anciãos do circuito ${circuit}.\n\n${signature}`,
              recipient: '',
              folder: 'drafts',
              userId: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              attachments: []
            }
          ];

          for (const d of defaultDrafts) {
            await addDoc(collection(db, 'email_drafts'), d);
          }
          localStorage.setItem(`progcir_drafts_seeded_${user.uid}`, seedVersion);
        } catch (err) {
          console.error('Error seeding drafts:', err);
        }
      };

      seedDefaults();
    }
  }, [loading, personalData]);

  useEffect(() => {
    if (selectedDraft) {
      setForm({
        recipient: selectedDraft.recipient || '',
        cc: selectedDraft.cc || '',
        subject: selectedDraft.subject || '',
        content: selectedDraft.content || '',
        attachments: selectedDraft.attachments || []
      });
      setVolatileAttachments([]);
      
      // Auto-adjust textarea height after state update
      setTimeout(() => {
        const textarea = document.querySelector('textarea[name="message-body"]') as HTMLTextAreaElement;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        }
      }, 50);
    } else if (selectedId) {
      // If we have an ID but no draft yet (e.g. just created), reset form to empty
      // This prevents seeing the previous draft's data
      setForm({
        recipient: '',
        cc: '',
        subject: '',
        content: '',
        attachments: []
      });
      setVolatileAttachments([]);
    }
  }, [selectedId, selectedDraft]);

  const handleSelectDraft = (id: string) => {
    setSelectedId(id);
    setActiveMobilePane('editor');
  };

  const handleCreateNew = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      setSaving(true);
      const docRef = await addDoc(collection(db, 'email_drafts'), {
        userId: user.uid,
        recipient: '',
        subject: '',
        content: '',
        attachments: [],
        folder: 'drafts',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setCurrentFolder('drafts'); // Ensure we are in drafts folder to see it
      setSelectedId(docRef.id);
      setActiveMobilePane('editor');
    } catch (err) {
      console.error('Error creating draft:', err);
      showAlert('Não foi possível criar um novo rascunho.', 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedDraft) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
      setSaving(true);
      const docRef = await addDoc(collection(db, 'email_drafts'), {
        userId: user.uid,
        recipient: selectedDraft.recipient || '',
        subject: selectedDraft.subject ? `${selectedDraft.subject} (Cópia)` : '(Cópia)',
        content: selectedDraft.content || '',
        attachments: selectedDraft.attachments || [],
        folder: 'drafts',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setCurrentFolder('drafts');
      setSelectedId(docRef.id);
      setActiveMobilePane('editor');
      showAlert('Modelo duplicado com sucesso!', 'Sucesso');
    } catch (err) {
      console.error('Error duplicating draft:', err);
      showAlert('Erro ao duplicar rascunho.', 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (field: string, value: any) => {
    if (!selectedId) return;
    
    // Optimistic update
    setForm(prev => ({ ...prev, [field]: value }));

    // Handle suggestions
    if (field === 'recipient' || field === 'cc') {
      const val = value as string;
      const lastPart = val.split(/[,;]\s*/).pop() || '';
      
      if (lastPart.length >= 2) {
        const filtered = contacts.filter(c => 
          c.name.toLowerCase().includes(lastPart.toLowerCase()) || 
          c.email.toLowerCase().includes(lastPart.toLowerCase()) ||
          c.congName.toLowerCase().includes(lastPart.toLowerCase())
        ).slice(0, 8);
        
        if (field === 'recipient') {
          setRecipientSuggestions(filtered);
          setActiveSuggestionField('recipient');
        } else {
          setCcSuggestions(filtered);
          setActiveSuggestionField('cc');
        }
      } else {
        if (field === 'recipient') setRecipientSuggestions([]);
        else setCcSuggestions([]);
        setActiveSuggestionField(null);
      }
    }

    try {
      await updateDoc(doc(db, 'email_drafts', selectedId), {
        [field]: value,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error('Error updating draft:', err);
      if (err.code === 'out-of-range' || err.message?.includes('too large')) {
        showAlert('O rascunho ficou grande demais para ser salvo. Tente diminuir o texto ou remover anexos salvos.', 'Erro de Tamanho');
      } else {
        showAlert('Erro ao sincronizar rascunho com o servidor.', 'Erro');
      }
    }
  };

  const selectSuggestion = (field: 'recipient' | 'cc', contact: Contact) => {
    const currentVal = form[field];
    const parts = currentVal.split(/[,;]\s*/);
    parts.pop(); // Remove the typed part
    parts.push(contact.email);
    const newValue = parts.join(', ') + (parts.length > 0 ? ', ' : '');
    
    handleUpdate(field, newValue);
    if (field === 'recipient') setRecipientSuggestions([]);
    else setCcSuggestions([]);
    setActiveSuggestionField(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedId) return;

    const newVolatile: Attachment[] = [...volatileAttachments];
    const newPersistent: Attachment[] = [...form.attachments];
    let hasNewPersistent = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Limit total file size to 4MB
      if (file.size > 4 * 1024 * 1024) {
        showAlert(`O arquivo "${file.name}" é muito grande (${formatFileSize(file.size)}). O limite para envio é de 4MB.`, 'Arquivo Muito Grande');
        continue;
      }

      try {
        const reader = new FileReader();
        const fileData = await new Promise<string>((resolve, reject) => {
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(file);
        });

        const attachment: Attachment = {
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          data: fileData
        };

        // Attachments > 700kb are memory-only (volatile) to protect Firestore 1MB doc limit
        if (file.size > 700 * 1024) {
          newVolatile.push(attachment);
        } else {
          newPersistent.push(attachment);
          hasNewPersistent = true;
        }
      } catch (err) {
        console.error('Error reading file:', err);
        showAlert(`Erro ao ler o arquivo "${file.name}".`, 'Erro de Leitura');
      }
    }

    if (hasNewPersistent) {
      handleUpdate('attachments', newPersistent);
    }
    setVolatileAttachments(newVolatile);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number, isVolatile: boolean) => {
    if (isVolatile) {
      setVolatileAttachments(prev => prev.filter((_, i) => i !== index));
    } else {
      const newPersistent = form.attachments.filter((_, i) => i !== index);
      handleUpdate('attachments', newPersistent);
    }
  };

  const handleSendEmail = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const allAttachments = [...form.attachments, ...volatileAttachments];

    // If no Microsoft connection and no attachments, open OWA URL directly
    if (!isMicrosoftConnected && allAttachments.length === 0) {
      window.open(`https://mail.jwpub.org/owa/?path=/mail/action/compose&to=${encodeURIComponent(form.recipient)}&subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(form.content)}`, '_blank');
      await recordSentHistory();
      return;
    }

    // If attachments present but no Microsoft API connection, inform user and open OWA
    if (!isMicrosoftConnected && allAttachments.length > 0) {
      await showAlert('Como sua conta jw.org não está conectada via API, o Outlook Web será aberto com o destinatário, assunto e texto. Você só precisará clicar no ícone do clipe no Outlook para anexar os arquivos.', 'Anexo Manual no Outlook');
      window.open(`https://mail.jwpub.org/owa/?path=/mail/action/compose&to=${encodeURIComponent(form.recipient)}&subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(form.content)}`, '_blank');
      await recordSentHistory();
      return;
    }

    try {
      setSending(true);
      const response = await fetch('/api/microsoft/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          recipient: form.recipient,
          subject: form.subject,
          content: form.content,
          attachments: allAttachments
        })
      });

      const data = await response.json();

      if (data.success && data.webLink) {
        window.open(data.webLink, '_blank');
        setVolatileAttachments([]);
        
        // Record in history and update draft timestamp
        await recordSentHistory();
      } else {
        throw new Error(data.error || 'Erro desconhecido ao preparar e-mail.');
      }
    } catch (err: any) {
      console.error('Error preparing email:', err);
      showAlert(`Falha ao preparar e-mail no Outlook: ${err.message}`, 'Erro de Envio');
    } finally {
      setSending(false);
    }
  };

  // Helper to record sent history and update original draft
  const recordSentHistory = async () => {
    const user = auth.currentUser;
    if (!user || !selectedId) return;

    try {
      // Create a copy in 'sent' folder for history
      await addDoc(collection(db, 'email_drafts'), {
        userId: user.uid,
        recipient: form.recipient,
        cc: form.cc || '',
        subject: form.subject,
        content: form.content,
        attachments: form.attachments,
        folder: 'sent',
        sentAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update the original draft's timestamp so it stays "Recent"
      await updateDoc(doc(db, 'email_drafts', selectedId), {
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error recording sent history:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDelete = async (id: string | null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!id) return;
    
    const confirmed = await showDeleteConfirm('Você tem certeza que deseja excluir permanentemente este rascunho?', 'Excluir Rascunho');
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'email_drafts', id));
      if (selectedId === id) {
        setSelectedId(null);
        setForm({
          recipient: '',
          subject: '',
          content: '',
          attachments: []
        });
        setActiveMobilePane('list');
      }
      showAlert('Rascunho excluído com sucesso.', 'Sucesso');
    } catch (err) {
      console.error('Error deleting draft:', err);
      showAlert('Erro ao excluir rascunho. Por favor, tente novamente.', 'Erro');
    }
  };

  const groupedDrafts = useMemo(() => {
    const filtered = drafts.filter(d => 
      (d.folder || 'drafts') === currentFolder &&
      (d.subject?.toLowerCase().includes(search.toLowerCase()) ||
       d.recipient?.toLowerCase().includes(search.toLowerCase()) ||
       d.content?.toLowerCase().includes(search.toLowerCase()))
    );

    const groups: { [key: string]: Draft[] } = {
      'Recentes': [],
      'Semana passada': [],
      'Mais Antigo': []
    };

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    filtered.forEach(d => {
      // Use updatedAt if available, fallback to createdAt, then to now (for new unsynced docs)
      const timestamp = d.updatedAt || d.createdAt;
      const date = timestamp?.toDate ? timestamp.toDate() : new Date();
      
      if (date > oneWeekAgo) {
        groups['Recentes'].push(d);
      } else if (date > new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)) {
        groups['Semana passada'].push(d);
      } else {
        groups['Mais Antigo'].push(d);
      }
    });

    return groups;
  }, [drafts, search, currentFolder]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#de4b39]" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Carregando Caixa de Entrada...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] sm:h-[calc(100dvh-6.5rem)] md:h-[calc(100vh-7.5rem)] min-h-[500px] w-full bg-white shadow-2xl border border-gray-200 rounded-xl md:rounded-2xl overflow-hidden font-sans text-[#323130] selection:bg-[#fdedec]">
      {/* Hidden File Input */}
      <input 
        type="file" 
        multiple 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />
      
      {/* Outlook Top Header Ribbon */}
      <header className="h-12 md:h-11 flex-shrink-0 flex items-center justify-between border-b border-gray-200 bg-white px-2 md:px-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Back to App Menu / Diversos button */}
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors text-xs font-semibold flex-shrink-0"
              title="Voltar para o menu principal"
            >
              <ArrowLeft size={16} className="text-[#de4b39]" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
          )}

          {/* Sidebar Toggle Button - Visible on all screens now */}
          <button
            onClick={() => {
              setIsSidebarOpen(!isSidebarOpen);
              if (!isSidebarOpen) setActiveMobilePane('folders');
            }}
            className="flex p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"
            title={isSidebarOpen ? "Ocultar pastas" : "Mostrar pastas"}
          >
            <Menu size={16} />
          </button>

          {/* Search Box - Responsive */}
          <div className="w-40 sm:w-56 md:w-64 flex items-center bg-[#faf9f8] hover:bg-[#f3f2f1] border border-transparent focus-within:border-[#de4b39] px-2 py-1 rounded transition-colors">
            <input 
              type="text"
              placeholder="Pesquisar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-xs focus:ring-0 placeholder:text-gray-500 text-gray-800"
            />
            {search ? (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 ml-1">
                <X size={12} />
              </button>
            ) : (
              <Search size={14} className="text-[#de4b39] ml-1 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Top Actions Ribbon */}
        <div className="flex items-center gap-1 text-xs font-normal">
          {/* Primary Send Button */}
          <button 
            onClick={handleSendEmail}
            disabled={!selectedId || sending}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-white font-medium bg-[#de4b39] hover:bg-[#c73e2d] transition-all shadow-sm ${(!selectedId || sending) ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'}`}
            title="Enviar pelo Outlook"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span className="hidden xs:inline sm:inline">{sending ? 'Enviando' : 'Enviar'}</span>
          </button>

          {/* Attach Button - Only visible if Microsoft is connected */}
          {isMicrosoftConnected && (
            <button 
              onClick={() => {
                if (!selectedId) {
                  showAlert('Selecione ou crie um rascunho primeiro para anexar arquivos.', 'Aviso');
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={!selectedId}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded text-gray-700 hover:text-[#de4b39] hover:bg-gray-100 transition-colors ${!selectedId ? 'opacity-40 cursor-not-allowed' : ''}`}
              title="Anexar arquivos"
            >
              <Paperclip size={14} className="text-[#de4b39]" />
              <span className="hidden sm:inline">Anexar</span>
            </button>
          )}

          {/* Discard / Delete Button */}
          {selectedId && (
            <button 
              onClick={(e) => handleDelete(selectedId, e)}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-gray-700 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Descartar rascunho"
            >
              <Trash2 size={14} />
              <span className="hidden md:inline">Descartar</span>
            </button>
          )}

          {/* New Draft Button (Desktop) - Visible when in Drafts folder */}
          {currentFolder === 'drafts' && (
            <button
              onClick={handleCreateNew}
              disabled={saving}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors font-semibold"
              title="Criar novo rascunho"
            >
              <Plus size={14} className="text-[#de4b39]" />
              <span className="text-xs">Novo</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Multi-Pane Body - Allows horizontal navigation on narrow screens */}
      <div className="flex-1 flex overflow-x-auto lg:overflow-hidden relative custom-scrollbar">
        {/* ============================================================== */}
        {/* PANE 1: Folders Navigation (Pastas) */}
        {/* ============================================================== */}
        <nav 
          className={`
            bg-[#fbfaf9] border-r border-[#edebe9] flex flex-col py-2 z-10 flex-shrink-0 transition-all duration-300
            w-64 md:w-48 lg:w-52
            ${isSidebarOpen ? 'flex' : 'hidden'}
          `}
        >
          <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100 md:border-none">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Caixas de Correio</span>
            {activeMobilePane === 'folders' && (
              <button 
                onClick={() => setActiveMobilePane('list')} 
                className="md:hidden text-xs text-[#de4b39] font-bold px-2 py-0.5 rounded hover:bg-gray-200"
              >
                Ver Lista &rarr;
              </button>
            )}
          </div>

          <div className="mb-3 px-1">
            <div className="flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700">
              <ChevronDown size={12} className="mr-2 text-gray-400" />
              <span>Favoritos</span>
            </div>
            <ul className="mt-1 space-y-1">
              <li>
                <button
                  onClick={() => {
                    setCurrentFolder('drafts');
                    setActiveMobilePane('list');
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2 text-xs transition-colors ${currentFolder === 'drafts' ? 'bg-[#f3c4c0]/50 font-bold border-l-4 border-[#de4b39] text-gray-800' : 'text-gray-700 hover:bg-gray-100 border-l-4 border-transparent'}`}
                >
                  <div className="flex items-center gap-2">
                    <FileEdit size={14} className={currentFolder === 'drafts' ? 'text-[#de4b39]' : 'text-gray-500'} />
                    <span className="truncate">Rascunhos</span>
                  </div>
                  <span className={`text-xs ${currentFolder === 'drafts' ? 'bg-[#de4b39] text-white' : 'bg-gray-200 text-gray-500'} px-1.5 py-0.2 rounded-full font-bold`}>
                    {drafts.filter(d => (d.folder || 'drafts') === 'drafts').length}
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setCurrentFolder('sent');
                    setActiveMobilePane('list');
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2 text-xs transition-colors ${currentFolder === 'sent' ? 'bg-[#f3c4c0]/50 font-bold border-l-4 border-[#de4b39] text-gray-800' : 'text-gray-700 hover:bg-gray-100 border-l-4 border-transparent'}`}
                >
                  <div className="flex items-center gap-2">
                    <Send size={14} className={currentFolder === 'sent' ? 'text-[#de4b39]' : 'text-gray-500'} />
                    <span className="truncate">Itens Enviados</span>
                  </div>
                  <span className={`text-xs ${currentFolder === 'sent' ? 'bg-[#de4b39] text-white' : 'bg-gray-200 text-gray-500'} px-1.5 py-0.2 rounded-full font-bold`}>
                    {drafts.filter(d => d.folder === 'sent').length}
                  </span>
                </button>
              </li>
            </ul>
          </div>

          {/* Mobile Back to Dashboard option */}
          {onBack && (
            <div className="md:hidden mx-3 mb-3">
              <button
                onClick={onBack}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
              >
                <ArrowLeft size={14} />
                <span>Voltar ao Menu Principal</span>
              </button>
            </div>
          )}

          <div className="mt-auto px-3 py-2 border-t border-[#edebe9]">
            {currentFolder === 'drafts' && (
              <button 
                onClick={handleCreateNew}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#de4b39] hover:bg-[#c73e2d] text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Plus size={16} />
                <span>Novo Rascunho</span>
              </button>
            )}
          </div>
        </nav>

        {/* ============================================================== */}
        {/* PANE 2: Drafts List (Lista de Rascunhos) */}
        {/* ============================================================== */}
        <section 
          className={`
            bg-white border-r border-[#edebe9] flex flex-col h-full overflow-hidden flex-shrink-0
            w-full md:w-72 lg:w-80
            ${selectedId && activeMobilePane === 'editor' ? 'hidden md:flex' : 'flex'}
          `}
        >
          {/* Subheader: Rascunhos title + count + actions */}
          <div className="flex items-center justify-between px-3 md:px-4 py-2.5 border-b border-gray-100 flex-shrink-0 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold text-gray-800">
                {currentFolder === 'drafts' ? 'Rascunhos' : 'Itens Enviados'}
              </h1>
              <span className="text-xs bg-red-100 text-[#de4b39] font-bold px-2 py-0.5 rounded-full">
                {drafts.filter(d => (d.folder || 'drafts') === currentFolder).length}
              </span>
            </div>

            {/* Mobile New button right in the header - Visible when in Drafts folder */}
            {currentFolder === 'drafts' && (
              <button
                onClick={handleCreateNew}
                disabled={saving}
                className="flex md:hidden items-center gap-1 px-3 py-1.5 bg-[#de4b39] text-white rounded-lg text-xs font-bold shadow-sm active:scale-95"
              >
                <Plus size={14} />
                <span>Novo</span>
              </button>
            )}
          </div>

          {/* Drafts List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 custom-scrollbar">
            {Object.entries(groupedDrafts).map(([groupName, groupItems]) => (
              groupItems.length > 0 && (
                <div key={groupName} className="flex flex-col">
                  <div className="px-3 pt-3 pb-1 text-[11px] font-bold text-[#de4b39] uppercase tracking-wider bg-gray-50/40">
                    {groupName}
                  </div>
                  {groupItems.map((draft) => {
                    const isSelected = selectedId === draft.id;
                    const draftAttachmentsCount = (draft.attachments?.length || 0);

                    return (
                      <article
                        key={draft.id}
                        onClick={() => handleSelectDraft(draft.id)}
                        className={`p-3 cursor-pointer transition-all border-l-4 ${
                          isSelected 
                            ? 'bg-[#fdedec] border-[#de4b39]' 
                            : 'hover:bg-gray-50 border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input 
                            type="checkbox" 
                            readOnly 
                            checked={isSelected}
                            className="mt-1 rounded text-[#de4b39] focus:ring-0 border-gray-300 w-3.5 h-3.5 pointer-events-none" 
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between items-baseline gap-1">
                              <span className={`text-[10px] font-bold truncate px-1.5 py-0.5 rounded ${
                                (draft.folder === 'sent') 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-red-50 text-[#de4b39]'
                              }`}>
                                {draft.folder === 'sent' ? 'ENVIADO' : 'RASCUNHO'}
                              </span>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">
                                {draft.sentAt?.toDate 
                                  ? draft.sentAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                                  : (draft.updatedAt?.toDate ? draft.updatedAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '')}
                              </span>
                            </div>
                            <h2 className="text-xs font-bold text-gray-800 truncate mt-0.5">
                              {draft.subject || '(Sem assunto)'}
                            </h2>
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {draft.recipient ? `${draft.recipient} — ` : ''}
                              {draft.content || '(Nenhum texto de mensagem)'}
                            </p>
                            {draftAttachmentsCount > 0 && (
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-600 font-medium">
                                <Paperclip size={11} />
                                <span>{draftAttachmentsCount} anexo(s)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )
            ))}

            {Object.values(groupedDrafts).flat().length === 0 && (
              <div className="p-8 md:p-12 text-center text-gray-400">
                <Mail size={40} className="mx-auto mb-3 opacity-25" />
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  {currentFolder === 'drafts' ? 'Nenhum rascunho' : 'Nenhuma mensagem enviada'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {currentFolder === 'drafts' 
                    ? 'Clique em "+ Novo" para começar a redigir.' 
                    : 'Suas mensagens enviadas aparecerão aqui.'}
                </p>
                {currentFolder === 'drafts' && (
                  <button
                    onClick={handleCreateNew}
                    className="mt-4 px-4 py-2 bg-[#de4b39] text-white rounded-lg text-xs font-bold shadow-sm"
                  >
                    Criar Primeiro Rascunho
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Floating Action Button for Mobile - Visible when in Drafts folder */}
          {currentFolder === 'drafts' && (
            <div className="md:hidden absolute bottom-4 right-4 z-20">
              <button
                onClick={handleCreateNew}
                disabled={saving}
                className="p-3.5 bg-[#de4b39] hover:bg-[#c73e2d] text-white rounded-full shadow-xl flex items-center justify-center active:scale-95 transition-all"
                title="Novo Rascunho"
              >
                <Plus size={22} />
              </button>
            </div>
          )}
        </section>

        {/* ============================================================== */}
        {/* PANE 3: Editor / Message Compose (Editor de Mensagem) */}
        {/* ============================================================== */}
        <main 
          className={`
            flex-1 flex flex-col bg-white overflow-hidden min-w-[320px] md:min-w-[400px]
            ${selectedId && activeMobilePane === 'editor' ? 'flex' : 'hidden md:flex'}
          `}
        >
          {selectedId ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Mobile Editor Top Bar: Back to List Button + Quick Send */}
              <div className="md:hidden flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                <button
                  onClick={() => setActiveMobilePane('list')}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-[#de4b39]"
                >
                  <ArrowLeft size={16} className="text-[#de4b39]" />
                  <span>Voltar para Lista ({drafts.length})</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleDelete(selectedId, e)}
                    className="p-1.5 text-gray-500 hover:text-red-600 rounded"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                {/* Recipient Headers */}
                <section className="p-3 md:p-4 border-b border-gray-100 flex-shrink-0 space-y-2.5 bg-white">
                  {/* "Para" row */}
                  <div className="flex items-center gap-2 relative">
                    <span className="w-12 py-1 px-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded text-center select-none flex-shrink-0">
                      Para
                    </span>
                    <div className="flex-1 relative">
                      <input 
                        type="text"
                        placeholder="destinatario@jwpub.org"
                        value={form.recipient}
                        onChange={(e) => handleUpdate('recipient', e.target.value)}
                        onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                        className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-[#de4b39] rounded px-2 py-1 text-xs md:text-sm font-normal text-gray-800 focus:ring-0 placeholder:text-gray-400"
                      />
                      
                      <AnimatePresence>
                        {activeSuggestionField === 'recipient' && recipientSuggestions.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto"
                          >
                            {recipientSuggestions.map((c, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => selectSuggestion('recipient', c)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex flex-col border-b border-gray-50 last:border-none"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-gray-800">{c.name}</span>
                                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase">{c.type}</span>
                                </div>
                                <div className="flex justify-between items-center mt-0.5">
                                  <span className="text-[11px] text-gray-500 font-mono">{c.email}</span>
                                  <span className="text-[10px] text-[#de4b39] font-semibold">{c.congName}</span>
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button 
                      onClick={() => setShowCc(!showCc)}
                      className={`text-xs px-2 py-1 rounded transition-colors flex-shrink-0 ${showCc ? 'bg-red-50 text-[#de4b39] font-bold' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                      Cc
                    </button>
                  </div>

                  {/* Optional "Cc" row */}
                  {showCc && (
                    <div className="flex items-center gap-2 relative">
                      <span className="w-12 py-1 px-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded text-center select-none flex-shrink-0">
                        Cc
                      </span>
                      <div className="flex-1 relative">
                        <input 
                          type="text"
                          placeholder="copia@jwpub.org"
                          value={form.cc}
                          onChange={(e) => handleUpdate('cc', e.target.value)}
                          onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                          className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-[#de4b39] rounded px-2 py-1 text-xs md:text-sm font-normal text-gray-800 focus:ring-0 placeholder:text-gray-400"
                        />

                        <AnimatePresence>
                          {activeSuggestionField === 'cc' && ccSuggestions.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto"
                            >
                              {ccSuggestions.map((c, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => selectSuggestion('cc', c)}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex flex-col border-b border-gray-50 last:border-none"
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-gray-800">{c.name}</span>
                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase">{c.type}</span>
                                  </div>
                                  <div className="flex justify-between items-center mt-0.5">
                                    <span className="text-[11px] text-gray-500 font-mono">{c.email}</span>
                                    <span className="text-[10px] text-[#de4b39] font-semibold">{c.congName}</span>
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}

                  {/* Subject row */}
                  <div className="pt-1">
                    <input 
                      type="text"
                      placeholder="Adicione um assunto"
                      value={form.subject}
                      onChange={(e) => handleUpdate('subject', e.target.value)}
                      className="w-full border-b border-gray-200 focus:border-[#de4b39] px-1 py-1.5 text-xs md:text-sm font-semibold text-gray-800 focus:ring-0 placeholder:text-gray-400"
                    />
                  </div>
                </section>

                {/* Attachments Bar */}
                {(form.attachments.length > 0 || volatileAttachments.length > 0) && (
                  <section className="px-3 md:px-4 py-2 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {/* Saved Attachments */}
                    {form.attachments.map((file, idx) => (
                      <div key={`saved-${idx}`} className="flex items-center gap-2 px-2.5 py-1 bg-white border border-blue-200 rounded-lg shadow-2xs group max-w-full">
                        <div className="p-1 bg-blue-50 rounded text-blue-600 flex-shrink-0">
                          <Save size={12} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-semibold text-gray-800 truncate max-w-[140px] md:max-w-[200px]">
                            {file.name}
                          </span>
                          <span className="text-[9px] text-gray-400">
                            {formatFileSize(file.size)} (Salvo)
                          </span>
                        </div>
                        <button 
                          onClick={() => removeAttachment(idx, false)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors ml-1"
                          title="Remover anexo"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}

                    {/* Volatile Attachments */}
                    {volatileAttachments.map((file, idx) => (
                      <div key={`volatile-${idx}`} className="flex items-center gap-2 px-2.5 py-1 bg-white border border-gray-200 rounded-lg shadow-2xs group max-w-full">
                        <div className="p-1 bg-gray-100 rounded text-gray-600 flex-shrink-0">
                          <Paperclip size={12} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-semibold text-gray-800 truncate max-w-[140px] md:max-w-[200px]">
                            {file.name}
                          </span>
                          <span className="text-[9px] text-amber-600">
                            {formatFileSize(file.size)} (Na memória)
                          </span>
                        </div>
                        <button 
                          onClick={() => removeAttachment(idx, true)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors ml-1"
                          title="Remover anexo"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </section>
                )}

                {/* Message Body */}
                <div className="flex-1 p-3 md:p-6 min-h-[300px]">
                  <textarea 
                    name="message-body"
                    placeholder="Escreva sua mensagem aqui..."
                    value={form.content}
                    onChange={(e) => handleUpdate('content', e.target.value)}
                    className="w-full h-full border-none p-0 text-xs md:text-sm text-gray-900 leading-relaxed focus:ring-0 resize-none font-sans overflow-hidden"
                    style={{ minHeight: '300px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = target.scrollHeight + 'px';
                    }}
                  />
                </div>
              </div>

              {/* Footer Toolbar: Action Buttons */}
              <footer className="border-t border-gray-200 p-2 md:p-2.5 bg-[#fcfbfa] flex-shrink-0 flex flex-col gap-2">
                {/* Send / Discard / Duplicate Buttons */}
                <div className="flex items-center justify-between pt-1 gap-2">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleSendEmail}
                      disabled={sending}
                      className="bg-[#de4b39] hover:bg-[#c73e2d] text-white text-xs font-bold px-4 md:px-5 py-2 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      <span>{sending ? 'Enviando...' : 'Enviar'}</span>
                    </button>

                    <button 
                      onClick={(e) => handleDelete(selectedId, e)}
                      className="bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                      title="Excluir este rascunho"
                    >
                      <Trash2 size={13} className="md:hidden" />
                      <span className="hidden md:inline">Descartar</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={handleDuplicate}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors flex items-center gap-1 text-xs" 
                      title="Duplicar modelo"
                    >
                      <Copy size={14} />
                      <span className="hidden lg:inline text-xs">Duplicar</span>
                    </button>
                  </div>
                </div>
              </footer>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 text-center space-y-4">
              <div className="relative">
                <div className="p-8 md:p-10 bg-white rounded-3xl shadow-xl border border-gray-100">
                  <FileEdit size={48} className="text-[#de4b39] md:w-16 md:h-16" />
                </div>
              </div>
              <div className="max-w-xs space-y-2">
                <h3 className="text-xl md:text-2xl font-black text-gray-900 uppercase tracking-tight">Caixa de Entrada</h3>
                <p className="text-xs md:text-sm text-gray-500 font-medium leading-relaxed">
                  Selecione um rascunho na lista para editar ou clique em "Novo Rascunho" para criar uma nova mensagem.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button 
                  onClick={handleCreateNew}
                  className="px-6 py-2.5 bg-[#de4b39] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#c73e2d] transition-all active:scale-95 shadow-lg shadow-red-100"
                >
                  Novo Rascunho
                </button>
                {/* On mobile, also provide a button to switch to the drafts list */}
                <button
                  onClick={() => setActiveMobilePane('list')}
                  className="md:hidden px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors"
                >
                  Ver Lista ({drafts.length})
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
