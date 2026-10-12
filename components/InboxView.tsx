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
  FileEdit,
  ChevronDown,
  Paperclip,
  Save,
  ArrowLeft,
  X,
  Check,
  Inbox,
  SendHorizonal,
  PenLine,
  MailOpen,
  SidebarOpen,
  SidebarClose,
  MoreVertical
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
  userId?: string;
  user?: any;
  personalDataProp?: any;
  onBack?: () => void;
}

export default function InboxView({ userId, user: propUser, personalDataProp, onBack }: InboxViewProps) {
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [isMicrosoftConnected, setIsMicrosoftConnected] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recipientSuggestions, setRecipientSuggestions] = useState<Contact[]>([]);
  const [ccSuggestions, setCcSuggestions] = useState<Contact[]>([]);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'recipient' | 'cc' | null>(null);
  const [personalData, setPersonalData] = useState<any>(personalDataProp || null);

  const effectiveUserId = userId || propUser?.id || propUser?.usuario || auth.currentUser?.uid || '';
  const candidateUserIds = useMemo(() => {
    const list = [effectiveUserId, userId, propUser?.id, propUser?.usuario, propUser?.email, auth.currentUser?.uid];
    return Array.from(new Set(list.filter((x): x is string => typeof x === 'string' && x.trim().length > 0))).slice(0, 10);
  }, [effectiveUserId, userId, propUser?.id, propUser?.usuario, propUser?.email]);

  // Sincroniza personalDataProp se fornecido pelo pai
  useEffect(() => {
    if (personalDataProp) {
      setPersonalData(personalDataProp);
    }
  }, [personalDataProp]);
  
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
    if (!effectiveUserId) {
      setLoading(false);
      return;
    }

    // Check Microsoft connection
    const checkConnection = async () => {
      try {
        onSnapshot(doc(db, 'microsoft_connections', effectiveUserId), (snap) => {
          setIsMicrosoftConnected(snap.exists());
        });
      } catch (err) {
        console.error('Error checking MS connection:', err);
      }
    };

    checkConnection();

    let unsubscribe: () => void = () => {};

    const sortDocs = (docsList: any[]) => {
      return [...docsList].sort((a, b) => {
        const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    };

    try {
      const q = candidateUserIds.length > 1
        ? query(collection(db, 'email_drafts'), where('userId', 'in', candidateUserIds))
        : query(collection(db, 'email_drafts'), where('userId', '==', effectiveUserId));

      unsubscribe = onSnapshot(q, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Draft));
        setDrafts(sortDocs(docs));
        setLoading(false);
      }, (err) => {
        console.warn('Error listening to drafts, retrying single-user query:', err);
        const fallbackQ = query(collection(db, 'email_drafts'), where('userId', '==', effectiveUserId));
        unsubscribe = onSnapshot(fallbackQ, (snap) => {
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Draft));
          setDrafts(sortDocs(docs));
          setLoading(false);
        }, (fallbackErr) => {
          console.error('Final drafts error:', fallbackErr);
          setLoading(false);
        });
      });
    } catch (queryErr) {
      console.error('Failed to construct drafts query:', queryErr);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [effectiveUserId, candidateUserIds]);

  // Fetch personal data for signature
  useEffect(() => {
    if (!effectiveUserId) return;
    if (personalDataProp) {
      setPersonalData(personalDataProp);
      return;
    }

    const docRef = doc(db, 'personal_data', effectiveUserId);
    getDoc(docRef).then(snap => {
      if (snap.exists()) {
        setPersonalData(snap.data());
      }
    }).catch(err => console.warn('InboxView: Error fetching personal data:', err));
  }, [effectiveUserId, personalDataProp]);

  // Fetch congregations to build contacts list
  useEffect(() => {
    if (!effectiveUserId) return;

    const q = query(collection(db, 'congregations'), where('userId', '==', effectiveUserId));
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
  }, [effectiveUserId]);

  // Seeding logic for default drafts
  useEffect(() => {
    if (!effectiveUserId || loading || !personalData) return;

    const seedVersion = 'v4_progcir_defaults'; // Change this to trigger new seeds
    const seeded = localStorage.getItem(`progcir_drafts_seeded_${effectiveUserId}`);
    
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
              where('userId', '==', effectiveUserId),
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
              userId: effectiveUserId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              attachments: []
            },
            {
              subject: 'ProgCir: Relatório da Visita (S-303)',
              content: `Prezados Irmãos:\n\nSegue em anexo o relatório da visita (S-303) referente à congregação Central, Campina Grande (14738).\n\n${signature}`,
              recipient: '',
              folder: 'drafts',
              userId: effectiveUserId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              attachments: []
            },
            {
              subject: 'ProgCir: Aviso de Visita (S-302)',
              content: `Prezados Irmãos:\n\nSegue em anexo o aviso de visita (S-302) referente à congregação Central, Campina Grande (14738).\n\n${signature}`,
              recipient: '',
              folder: 'drafts',
              userId: effectiveUserId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              attachments: []
            },
            {
              subject: 'ProgCir: Carta de Designação e Remoção',
              content: `Prezados Irmãos:\n\nSegue em anexo a carta de designação e remoção referente à congregação Central, Campina Grande (14738).\n\n${signature}`,
              recipient: '',
              folder: 'drafts',
              userId: effectiveUserId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              attachments: []
            },
            {
              subject: 'ProgCir: Aviso de Assembleia (S-307)',
              content: `Prezados Irmãos:\n\nSegue em anexo o aviso de assembleia (S-307) para conhecimento de todos os anciãos do circuito ${circuit}.\n\n${signature}`,
              recipient: '',
              folder: 'drafts',
              userId: effectiveUserId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              attachments: []
            }
          ];

          for (const d of defaultDrafts) {
            await addDoc(collection(db, 'email_drafts'), d);
          }
          localStorage.setItem(`progcir_drafts_seeded_${effectiveUserId}`, seedVersion);
        } catch (err) {
          console.error('Error seeding drafts:', err);
        }
      };

      seedDefaults();
    }
  }, [effectiveUserId, loading, personalData]);

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
    if (!effectiveUserId) return;

    try {
      setSaving(true);
      const docRef = await addDoc(collection(db, 'email_drafts'), {
        userId: effectiveUserId,
        recipient: '',
        subject: '',
        content: '',
        attachments: [],
        folder: 'drafts',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setCurrentFolder('drafts');
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
    if (!effectiveUserId) return;

    try {
      setSaving(true);
      const docRef = await addDoc(collection(db, 'email_drafts'), {
        userId: effectiveUserId,
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
    if (!effectiveUserId) return;

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
          uid: effectiveUserId,
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
    if (!effectiveUserId || !selectedId) return;

    try {
      // Create a copy in 'sent' folder for history
      await addDoc(collection(db, 'email_drafts'), {
        userId: effectiveUserId,
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
          cc: '',
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

  const draftsCount = drafts.filter(d => (d.folder || 'drafts') === 'drafts').length;
  const sentCount = drafts.filter(d => d.folder === 'sent').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary-200" />
        <p className="text-sm font-bold text-typography-400 uppercase tracking-widest">Carregando Caixa de Entrada...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] sm:h-[calc(100dvh-6.5rem)] md:h-[calc(100vh-7.5rem)] min-h-[500px] w-full">
      {/* Hidden File Input */}
      <input 
        type="file" 
        multiple 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* ================================================================ */}
      {/* TOP BAR                                                           */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between gap-3 bg-surface-100 p-3 sm:p-4 rounded-3xl border border-surface-300 shadow-xs flex-wrap mb-3 flex-shrink-0 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />
        <div className="flex items-center gap-3 min-w-0">
          {/* Back Button */}
          {onBack && (
            <button
              onClick={onBack}
              className="h-9 w-9 sm:h-10 sm:w-10 p-1.5 sm:p-2 hover:bg-surface-200 active:scale-95 rounded-xl transition-all text-typography-900 bg-surface-200/80 shadow-xs border border-surface-300 flex items-center justify-center shrink-0 cursor-pointer"
              title="Voltar para Diversos"
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
            </button>
          )}

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-typography-900 tracking-tight leading-none truncate">
                Caixa de Entrada
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-primary-200/10 text-primary-200 border border-primary-200/20 shrink-0">
                {currentFolder === 'drafts' ? 'Rascunhos' : 'Enviados'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs font-medium text-typography-500 truncate mt-0.5">
              Composição e envio de e-mails para congregações
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Folder Switch Tabs */}
          <div className="flex items-center bg-surface-200/80 p-1 rounded-2xl border border-surface-300">
            <button
              onClick={() => {
                setCurrentFolder('drafts');
                setActiveMobilePane('list');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentFolder === 'drafts'
                  ? 'bg-surface-100 text-primary-200 shadow-xs'
                  : 'text-typography-600 hover:text-typography-900'
              }`}
            >
              <FileEdit size={13} />
              <span>Rascunhos ({draftsCount})</span>
            </button>
            <button
              onClick={() => {
                setCurrentFolder('sent');
                setActiveMobilePane('list');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentFolder === 'sent'
                  ? 'bg-surface-100 text-primary-200 shadow-xs'
                  : 'text-typography-600 hover:text-typography-900'
              }`}
            >
              <Send size={13} />
              <span>Enviados ({sentCount})</span>
            </button>
          </div>

          {/* New Draft Button */}
          {currentFolder === 'drafts' && (
            <button
              onClick={handleCreateNew}
              disabled={saving}
              className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-2xl text-xs font-bold text-white bg-primary-200 hover:bg-primary-200/90 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Criar novo rascunho"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
              <span>Novo Rascunho</span>
            </button>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* MAIN BODY — 3 PANES                                               */}
      {/* ================================================================ */}
      <div className="flex-1 flex gap-3 overflow-hidden min-h-0">

        {/* ============================================================== */}
        {/* PANE 1: Folder Navigation (Pastas)                              */}
        {/* ============================================================== */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.nav
              key="sidebar"
              initial={{ opacity: 0, x: -20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 'auto' }}
              exit={{ opacity: 0, x: -20, width: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="bg-surface-100 rounded-3xl border border-surface-300 shadow-xs flex flex-col overflow-hidden flex-shrink-0 w-56 lg:w-64"
            >
              <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-surface-300">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-typography-500">Pastas</span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 rounded-lg text-typography-400 hover:text-typography-700 hover:bg-surface-200 transition-colors md:hidden cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="flex-1 p-3 space-y-1">
                {/* Rascunhos */}
                <button
                  onClick={() => {
                    setCurrentFolder('drafts');
                    setActiveMobilePane('list');
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                    currentFolder === 'drafts'
                      ? 'bg-primary-200/10 text-primary-200 border border-primary-200/20'
                      : 'text-typography-700 hover:bg-surface-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileEdit size={15} className={currentFolder === 'drafts' ? 'text-primary-200' : 'text-typography-400'} />
                    <span>Rascunhos</span>
                  </div>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                    currentFolder === 'drafts'
                      ? 'bg-primary-200 text-white'
                      : 'bg-surface-300 text-typography-500'
                  }`}>
                    {draftsCount}
                  </span>
                </button>

                {/* Itens Enviados */}
                <button
                  onClick={() => {
                    setCurrentFolder('sent');
                    setActiveMobilePane('list');
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                    currentFolder === 'sent'
                      ? 'bg-primary-200/10 text-primary-200 border border-primary-200/20'
                      : 'text-typography-700 hover:bg-surface-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Send size={15} className={currentFolder === 'sent' ? 'text-primary-200' : 'text-typography-400'} />
                    <span>Enviados</span>
                  </div>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                    currentFolder === 'sent'
                      ? 'bg-primary-200 text-white'
                      : 'bg-surface-300 text-typography-500'
                  }`}>
                    {sentCount}
                  </span>
                </button>
              </div>

              {/* New Draft CTA at bottom of sidebar */}
              {currentFolder === 'drafts' && (
                <div className="p-3 border-t border-surface-300">
                  <button
                    onClick={handleCreateNew}
                    disabled={saving}
                    className="w-full py-2.5 bg-primary-200 hover:bg-primary-200/90 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={14} />
                    Novo Rascunho
                  </button>
                </div>
              )}
            </motion.nav>
          )}
        </AnimatePresence>

        {/* ============================================================== */}
        {/* PANE 2: Drafts List (Lista)                                     */}
        {/* ============================================================== */}
        <div
          className={`bg-surface-100 rounded-3xl border border-surface-300 shadow-xs flex flex-col overflow-hidden flex-shrink-0 w-full sm:w-80 lg:w-96 ${
            selectedId && activeMobilePane === 'editor' ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {/* List Header */}
          <div className="px-4 pt-4 pb-3 border-b border-surface-300 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-typography-900 tracking-tight">
                {currentFolder === 'drafts' ? 'Rascunhos' : 'Itens Enviados'}
              </h2>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-primary-200/10 text-primary-200 border border-primary-200/20">
                {drafts.filter(d => (d.folder || 'drafts') === currentFolder).length}
              </span>
            </div>
            {/* Mobile New button */}
            {currentFolder === 'drafts' && (
              <button
                onClick={handleCreateNew}
                disabled={saving}
                className="flex sm:hidden items-center gap-1 px-2.5 py-1.5 bg-primary-200 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Plus size={13} />
                Novo
              </button>
            )}
          </div>

          {/* Search */}
          <div className="px-3 py-2.5 border-b border-surface-300/60 flex-shrink-0">
            <div className="flex items-center gap-2 bg-surface-200/60 border border-surface-300 focus-within:border-primary-200/60 focus-within:ring-2 focus-within:ring-primary-200/20 rounded-2xl px-3 py-2 transition-all">
              <Search size={13} className="text-typography-400 shrink-0" />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-typography-800 placeholder:text-typography-400 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-typography-400 hover:text-typography-600 cursor-pointer">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* List Items */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2">
            {Object.entries(groupedDrafts).map(([groupName, groupItems]) => (
              groupItems.length > 0 && (
                <div key={groupName}>
                  <div className="px-4 pt-3 pb-1.5 text-[10px] font-extrabold text-typography-400 uppercase tracking-wider">
                    {groupName}
                  </div>
                  {groupItems.map((draft) => {
                    const isSelected = selectedId === draft.id;
                    const draftAttachmentsCount = (draft.attachments?.length || 0);
                    const timestamp = draft.sentAt || draft.updatedAt;
                    const timeStr = timestamp?.toDate
                      ? timestamp.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                      : '';

                    return (
                      <button
                        key={draft.id}
                        onClick={() => handleSelectDraft(draft.id)}
                        className={`w-full text-left px-3 py-3.5 rounded-2xl transition-all cursor-pointer mb-1 ${
                          isSelected
                            ? 'bg-primary-200/10 border border-primary-200/20'
                            : 'hover:bg-surface-200/60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-primary-200 text-white' : 'bg-surface-200 text-typography-500'
                          }`}>
                            {draft.folder === 'sent' ? <Send size={13} /> : <FileEdit size={13} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between items-baseline gap-1 mb-1">
                              <span className={`text-xs font-black truncate leading-tight ${isSelected ? 'text-primary-200' : 'text-typography-800'}`}>
                                {draft.subject || '(Sem assunto)'}
                              </span>
                              <span className="text-[10px] text-typography-400 shrink-0 font-medium">{timeStr}</span>
                            </div>
                            <p className="text-[11px] text-typography-500 truncate leading-tight">
                              {draft.recipient || 'Sem destinatário'}
                            </p>
                            {draftAttachmentsCount > 0 && (
                              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-blue-500 font-medium">
                                <Paperclip size={10} />
                                <span>{draftAttachmentsCount} anexo(s)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ))}

            {Object.values(groupedDrafts).flat().length === 0 && (
              <div className="p-8 text-center text-typography-400 flex flex-col items-center gap-3">
                <MailOpen size={36} className="opacity-25" />
                <div>
                  <p className="text-xs font-bold text-typography-500">
                    {currentFolder === 'drafts' ? 'Nenhum rascunho' : 'Nenhuma mensagem enviada'}
                  </p>
                  <p className="text-[11px] text-typography-400 mt-0.5">
                    {currentFolder === 'drafts'
                      ? 'Clique em "Novo" para começar.'
                      : 'Suas mensagens enviadas aparecerão aqui.'}
                  </p>
                </div>
                {currentFolder === 'drafts' && (
                  <button
                    onClick={handleCreateNew}
                    className="mt-2 px-4 py-2 bg-primary-200 text-white rounded-2xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    Criar Rascunho
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Mobile FAB */}
          {currentFolder === 'drafts' && (
            <div className="sm:hidden absolute bottom-4 right-4 z-20">
              <button
                onClick={handleCreateNew}
                disabled={saving}
                className="p-4 bg-primary-200 hover:bg-primary-200/90 text-white rounded-2xl shadow-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                title="Novo Rascunho"
              >
                <Plus size={20} />
              </button>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* PANE 3: Editor (Compor Mensagem)                                */}
        {/* ============================================================== */}
        <div
          className={`flex-1 bg-surface-100 rounded-3xl border border-surface-300 shadow-xs flex flex-col overflow-hidden min-w-0 ${
            selectedId && activeMobilePane === 'editor' ? 'flex' : 'hidden sm:flex'
          }`}
        >
          {selectedId ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Mobile Editor Top Bar: Back to List */}
              <div className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-surface-300 flex-shrink-0">
                <button
                  onClick={() => setActiveMobilePane('list')}
                  className="flex items-center gap-1.5 text-xs font-bold text-typography-700 hover:text-primary-200 cursor-pointer transition-colors"
                >
                  <ArrowLeft size={15} className="text-primary-200" />
                  <span>Lista ({drafts.length})</span>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDuplicate}
                    className="p-2 text-typography-500 hover:text-primary-200 rounded-xl hover:bg-surface-200 transition-colors cursor-pointer"
                    title="Duplicar modelo"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(selectedId, e)}
                    className="p-2 text-typography-500 hover:text-rose-500 rounded-xl hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Recipient Headers */}
              <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-surface-300 flex-shrink-0 space-y-2.5">
                {/* Para row */}
                <div className="flex items-center gap-2.5 relative">
                  <span className="w-10 py-1 px-2 bg-surface-200 text-typography-600 text-[10px] font-bold rounded-lg text-center select-none flex-shrink-0 uppercase tracking-wider">
                    Para
                  </span>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="destinatario@jwpub.org"
                      value={form.recipient}
                      onChange={(e) => handleUpdate('recipient', e.target.value)}
                      onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                      className="w-full bg-transparent border border-transparent hover:border-surface-300 focus:border-primary-200/60 focus:ring-2 focus:ring-primary-200/20 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-normal text-typography-800 outline-none placeholder:text-typography-400 transition-all"
                    />

                    <AnimatePresence>
                      {activeSuggestionField === 'recipient' && recipientSuggestions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="absolute left-0 right-0 top-full mt-1 bg-surface-100 border border-surface-300 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto"
                        >
                          {recipientSuggestions.map((c, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => selectSuggestion('recipient', c)}
                              className="w-full text-left px-3 py-2.5 hover:bg-surface-200/60 flex flex-col border-b border-surface-300/50 last:border-none transition-colors cursor-pointer"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-typography-800">{c.name}</span>
                                <span className="text-[10px] bg-surface-200 text-typography-500 px-1.5 py-0.5 rounded-full uppercase font-bold">{c.type}</span>
                              </div>
                              <div className="flex justify-between items-center mt-0.5">
                                <span className="text-[11px] text-typography-500 font-mono">{c.email}</span>
                                <span className="text-[10px] text-primary-200 font-semibold">{c.congName}</span>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    onClick={() => setShowCc(!showCc)}
                    className={`text-[10px] px-2 py-1.5 rounded-xl transition-colors flex-shrink-0 font-bold cursor-pointer ${
                      showCc
                        ? 'bg-primary-200/10 text-primary-200 border border-primary-200/20'
                        : 'text-typography-500 hover:text-typography-800 hover:bg-surface-200 border border-transparent'
                    }`}
                  >
                    Cc
                  </button>
                </div>

                {/* Optional Cc row */}
                <AnimatePresence>
                  {showCc && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2.5 relative overflow-hidden"
                    >
                      <span className="w-10 py-1 px-2 bg-surface-200 text-typography-600 text-[10px] font-bold rounded-lg text-center select-none flex-shrink-0 uppercase tracking-wider">
                        Cc
                      </span>
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="copia@jwpub.org"
                          value={form.cc}
                          onChange={(e) => handleUpdate('cc', e.target.value)}
                          onBlur={() => setTimeout(() => setActiveSuggestionField(null), 200)}
                          className="w-full bg-transparent border border-transparent hover:border-surface-300 focus:border-primary-200/60 focus:ring-2 focus:ring-primary-200/20 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-normal text-typography-800 outline-none placeholder:text-typography-400 transition-all"
                        />

                        <AnimatePresence>
                          {activeSuggestionField === 'cc' && ccSuggestions.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="absolute left-0 right-0 top-full mt-1 bg-surface-100 border border-surface-300 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto"
                            >
                              {ccSuggestions.map((c, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => selectSuggestion('cc', c)}
                                  className="w-full text-left px-3 py-2.5 hover:bg-surface-200/60 flex flex-col border-b border-surface-300/50 last:border-none transition-colors cursor-pointer"
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-typography-800">{c.name}</span>
                                    <span className="text-[10px] bg-surface-200 text-typography-500 px-1.5 py-0.5 rounded-full uppercase font-bold">{c.type}</span>
                                  </div>
                                  <div className="flex justify-between items-center mt-0.5">
                                    <span className="text-[11px] text-typography-500 font-mono">{c.email}</span>
                                    <span className="text-[10px] text-primary-200 font-semibold">{c.congName}</span>
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Subject row */}
                <div>
                  <input
                    type="text"
                    placeholder="Adicione um assunto..."
                    value={form.subject}
                    onChange={(e) => handleUpdate('subject', e.target.value)}
                    className="w-full bg-transparent border-b border-surface-300 focus:border-primary-200/60 px-1 py-1.5 text-xs sm:text-sm font-semibold text-typography-800 outline-none placeholder:text-typography-400 transition-all"
                  />
                </div>
              </div>

              {/* Attachments Bar */}
              {(form.attachments.length > 0 || volatileAttachments.length > 0) && (
                <div className="px-4 sm:px-6 py-2.5 border-b border-surface-300 flex flex-wrap gap-2 max-h-28 overflow-y-auto flex-shrink-0 bg-surface-200/30">
                  {/* Saved Attachments */}
                  {form.attachments.map((file, idx) => (
                    <div key={`saved-${idx}`} className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-100 border border-blue-500/20 rounded-xl shadow-2xs group">
                      <div className="p-1 bg-blue-500/10 rounded-lg text-blue-500 flex-shrink-0">
                        <Save size={11} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-typography-800 truncate max-w-[120px] sm:max-w-[180px]">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-typography-400">
                          {formatFileSize(file.size)} · Salvo
                        </span>
                      </div>
                      <button
                        onClick={() => removeAttachment(idx, false)}
                        className="p-1 text-typography-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Remover anexo"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}

                  {/* Volatile Attachments */}
                  {volatileAttachments.map((file, idx) => (
                    <div key={`volatile-${idx}`} className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-100 border border-amber-500/20 rounded-xl shadow-2xs group">
                      <div className="p-1 bg-amber-500/10 rounded-lg text-amber-500 flex-shrink-0">
                        <Paperclip size={11} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-typography-800 truncate max-w-[120px] sm:max-w-[180px]">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-amber-500">
                          {formatFileSize(file.size)} · Na memória
                        </span>
                      </div>
                      <button
                        onClick={() => removeAttachment(idx, true)}
                        className="p-1 text-typography-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Remover anexo"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Message Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <textarea
                  name="message-body"
                  placeholder="Escreva sua mensagem aqui..."
                  value={form.content}
                  onChange={(e) => handleUpdate('content', e.target.value)}
                  className="w-full h-full border-none p-4 sm:p-6 text-xs sm:text-sm text-typography-800 leading-relaxed focus:ring-0 resize-none font-sans bg-transparent outline-none"
                  style={{ minHeight: '300px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                />
              </div>

              {/* Footer Toolbar */}
              <div className="border-t border-surface-300 px-4 sm:px-6 py-3 bg-surface-200/30 flex-shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Send */}
                    <button
                      onClick={handleSendEmail}
                      disabled={sending}
                      className="bg-primary-200 hover:bg-primary-200/90 text-white text-xs font-bold px-4 sm:px-5 py-2.5 rounded-2xl shadow-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {sending ? <Loader2 size={13} className="animate-spin" /> : <SendHorizonal size={13} />}
                      <span>{sending ? 'Enviando...' : 'Enviar'}</span>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={(e) => handleDelete(selectedId, e)}
                      className="px-3 py-2.5 rounded-2xl text-xs font-bold text-typography-600 hover:text-rose-500 bg-surface-200/80 hover:bg-rose-500/10 border border-surface-300 hover:border-rose-500/20 transition-all cursor-pointer"
                      title="Excluir este rascunho"
                    >
                      <Trash2 size={13} className="sm:hidden" />
                      <span className="hidden sm:inline">Descartar</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Duplicate */}
                    <button
                      onClick={handleDuplicate}
                      className="p-2.5 hover:bg-surface-200 rounded-xl text-typography-500 hover:text-typography-800 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                      title="Duplicar modelo"
                    >
                      <Copy size={14} />
                      <span className="hidden lg:inline">Duplicar</span>
                    </button>

                    {/* Attach - visible for MS connected */}
                    {isMicrosoftConnected && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 hover:bg-surface-200 rounded-xl text-typography-500 hover:text-typography-800 transition-colors cursor-pointer"
                        title="Anexar arquivo"
                      >
                        <Paperclip size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Empty state — no draft selected
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-surface-200 border border-surface-300 flex items-center justify-center">
                <Inbox size={36} className="text-typography-400" />
              </div>
              <div className="max-w-xs space-y-2">
                <h3 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">Caixa de Entrada</h3>
                <p className="text-xs sm:text-sm text-typography-500 font-medium leading-relaxed">
                  Selecione um rascunho na lista para editar, ou crie uma nova mensagem.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  onClick={handleCreateNew}
                  className="px-5 py-2.5 bg-primary-200 text-white rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-primary-200/90 transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  Novo Rascunho
                </button>
                <button
                  onClick={() => setActiveMobilePane('list')}
                  className="sm:hidden px-4 py-2.5 bg-surface-200 text-typography-700 rounded-2xl text-xs font-semibold hover:bg-surface-300 transition-colors cursor-pointer border border-surface-300"
                >
                  Ver Lista ({drafts.length})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
