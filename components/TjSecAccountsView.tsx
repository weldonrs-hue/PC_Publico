'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Landmark, 
  Search, 
  Mail, 
  ChevronLeft,
  RefreshCw,
  User as UserIcon,
  ShieldCheck,
  Users,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Phone,
  Landmark as LandmarkIcon,
  ClipboardPaste,
  Check,
  AlertCircle
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { 
  collection, 
  getDocs,
  query,
  where,
  limit,
  writeBatch,
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { useDialog } from '@/hooks/useDialog';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface Publisher {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
  situation: string;
  userId: string; // The "Key" linking to a congregation
  hasAppAccess: boolean;
  photoURL?: string;
}

interface Congregation {
  id: string;
  name: string;
  number?: string;
  circuito?: string;
  circuitOverseerEmail?: string;
}

interface CongregationGroup {
  congregation: Congregation;
  publishers: Publisher[];
  activeWithAccessCount: number;
}

interface TjSecAccountsViewProps {
  onBack: () => void;
}

export default function TjSecAccountsView({ onBack }: TjSecAccountsViewProps) {
  const { showAlert, showConfirm } = useDialog();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [congregationGroups, setCongregationGroups] = useState<CongregationGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<{ total: number; updated: number; created: number; skipped: number } | null>(null);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const userEmail = auth.currentUser?.email;
      if (!userEmail) throw new Error('Usuário não autenticado');

      const isCircuitAdmin = userEmail.endsWith('@progcir.app');
      const isSystemAdmin = ['weldonrs@gmail.com', '2283701@progcir.app', '2283701@progcir.com'].includes(userEmail);
      
      let targetCongregationIds: string[] = [];
      let congregations: Congregation[] = [];

      if (isSystemAdmin) {
        // System Admins see everything
        const congsSnap = await getDocs(collection(db, 'congregations'));
        congregations = congsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        targetCongregationIds = congregations.map(c => c.id);
      } else if (isCircuitAdmin) {
        // Circuit Overseers see their assigned congregations
        const congQuery = query(
          collection(db, 'congregations'), 
          where('circuitOverseerEmail', '==', userEmail)
        );
        const congSnap = await getDocs(congQuery);
        congregations = congSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        targetCongregationIds = congregations.map(c => c.id);
      } else {
        // Regular Secretary: Identify their own congregation ID via publishers collection
        const pubQuery = query(
          collection(db, 'publishers'), 
          where('email', '==', userEmail),
          limit(1)
        );
        const pubSnap = await getDocs(pubQuery);
        
        if (!pubSnap.empty) {
          const myData = pubSnap.docs[0].data();
          const myCongId = myData.userId; 
          targetCongregationIds = [myCongId];

          const congregationsSnap = await getDocs(collection(db, 'congregations'));
          congregations = congregationsSnap.docs
            .map(d => ({ id: d.id, ...(d.data() as any) }))
            .filter(c => c.id === myCongId);
        }
      }

      if (targetCongregationIds.length === 0) {
        setCongregationGroups([]);
        return;
      }

      // Step 2: Fetch publishers for these congregations
      // Note: If the list is large, we might need multiple queries or use 'in' operator
      const pubsSnap = await getDocs(collection(db, 'publishers'));
      const allPublishers = pubsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Publisher[];
      
      const filteredPublishers = allPublishers.filter(p => targetCongregationIds.includes(p.userId));

      const groups: CongregationGroup[] = congregations.map(cong => {
        const relatedPubs = filteredPublishers.filter(p => p.userId === cong.id);
        const activeWithAccess = relatedPubs.filter(p => p.status === 'Ativo' && p.hasAppAccess === true);

        return {
          congregation: cong,
          publishers: relatedPubs,
          activeWithAccessCount: activeWithAccess.length
        };
      });

      // Sort groups by congregation name
      groups.sort((a, b) => {
        const nameA = a.congregation?.name || '';
        const nameB = b.congregation?.name || '';
        return nameA.localeCompare(nameB);
      });

      setCongregationGroups(groups);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => 
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const handleBulkImport = async () => {
    if (!importText.trim()) return;
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const lines = importText.split(/\r?\n/);
      let currentCongId = '';
      
      const congsSnap = await getDocs(collection(db, 'congregations'));
      const congregations = congsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

      const parsedPubs: any[] = [];
      const skippedLines: string[] = [];

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // 1. Detect Congregation Header (can appear multiple times in the text)
        const numMatch = trimmedLine.match(/\((\d{4,7})\)/) || trimmedLine.match(/Nº\s*(\d{4,7})/i);
        if (numMatch) {
          const num = numMatch[1];
          const found = congregations.find(c => String(c.numero || c.number) === num);
          if (found) {
            currentCongId = found.id;
            continue; // Skip the header line for publisher parsing
          }
        }

        // 2. Parse Publisher Line
        // Skip lines that look like headers but weren't matched above, or common junk lines
        if (trimmedLine.includes('Congregação') || trimmedLine.includes('Publicador') && trimmedLine.includes('Email')) continue;

        const parts = trimmedLine.split(/\t|\||\s{2,}/).map(p => p.trim()).filter(p => p.length > 0);
        
        // Basic heuristic: must have at least a name
        if (parts.length >= 1) {
          let name = '';
          let email = '';
          let phone = '';
          let status = 'Ativo';
          let situation = 'Publicador';
          
          let startIdx = 0;
          if (/^\d+\.?$/.test(parts[0])) {
            startIdx = 1;
          }
          
          if (parts[startIdx]) name = parts[startIdx];
          
          if (name && name.length > 3) {
            if (!currentCongId) {
              skippedLines.push(trimmedLine);
              continue;
            }

            // Identify fields
            for (let j = startIdx + 1; j < parts.length; j++) {
              const part = parts[j];
              if (part.includes('@')) {
                email = part;
              } else if (part.match(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/)) {
                phone = part;
              } else if (['Ativo', 'Inativo', 'Desassociado', 'Afastado'].includes(part)) {
                status = part;
              } else if (['Publicador', 'Pioneiro Regular', 'Pioneiro Especial', 'Ancião', 'Servo Ministerial'].includes(part)) {
                situation = part;
              }
            }

            parsedPubs.push({
              name,
              email,
              phone,
              status,
              situation,
              userId: currentCongId,
              hasAppAccess: email.includes('@tjsec.app') || email.includes('@progcir.app'),
              createdAt: new Date()
            });
          }
        }
      }

      if (parsedPubs.length === 0) {
        setImportError(skippedLines.length > 0 
          ? `Não foi possível identificar a congregação para os registros. Verifique se o número da congregação entre parênteses - ex: (12345) - está presente no texto.`
          : 'Nenhum registro de publicador válido encontrado.');
        setIsImporting(false);
        return;
      }

      const batch = writeBatch(db);
      const existingPubsSnap = await getDocs(collection(db, 'publishers'));
      const existingPubs = existingPubsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

      let updated = 0;
      let created = 0;
      let ambiguous = 0;
      const ambiguousNames: string[] = [];

      for (const pub of parsedPubs) {
        // ID Strategy: 
        // 1. Email is the most secure identifier
        // 2. Name + Congregation is a secondary match, but we must be careful
        
        let existing = null;
        
        if (pub.email) {
          existing = existingPubs.find(p => p.email && p.email.toLowerCase() === pub.email.toLowerCase());
        }

        if (!existing) {
          // Check for name match in same congregation
          const nameMatch = existingPubs.find(p => 
            p.name === pub.name && 
            p.userId === pub.userId
          );
          
          if (nameMatch) {
            // If the name match has a different email than the import, it's ambiguous
            if (pub.email && nameMatch.email && nameMatch.email.toLowerCase() !== pub.email.toLowerCase()) {
              ambiguous++;
              ambiguousNames.push(pub.name);
              continue; // Skip automatic overwrite
            }
            
            // If neither has email, or they have same email, or only one has email, we can update if it's exact name
            existing = nameMatch;
          }
        }
        
        if (existing) {
          const docRef = doc(db, 'publishers', existing.id);
          batch.update(docRef, {
            ...pub,
            updatedAt: serverTimestamp()
          });
          updated++;
        } else {
          const docRef = doc(collection(db, 'publishers'));
          batch.set(docRef, {
            ...pub,
            createdAt: serverTimestamp()
          });
          created++;
        }
      }

      await batch.commit();
      setImportSuccess({ 
        total: parsedPubs.length, 
        updated, 
        created, 
        skipped: skippedLines.length + ambiguous
      });
      
      if (ambiguous > 0) {
        console.warn('Import completed with ambiguous records:', ambiguousNames);
      }
      setImportText('');
      
      if (skippedLines.length > 0) {
        console.warn('Import completed with skipped lines:', skippedLines);
      }

      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportSuccess(null);
        fetchData();
      }, 4000);

    } catch (error) {
      console.error('Error importing publishers:', error);
      setImportError('Erro ao processar importação. Verifique sua conexão ou o formato dos dados.');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredGroups = congregationGroups.filter(group => {
    const search = searchTerm.toLowerCase();
    const matchesCong = 
      (group.congregation?.name || '').toLowerCase().includes(search) ||
      (group.congregation?.number || '').includes(search);
    
    const matchesPubs = group.publishers.some(p => 
      (p.name || '').toLowerCase().includes(search) ||
      (p.email || '').toLowerCase().includes(search)
    );

    return matchesCong || matchesPubs;
  });

  const totalActiveWithAccess = congregationGroups.reduce((acc, curr) => acc + curr.activeWithAccessCount, 0);
  const totalPublishers = congregationGroups.reduce((acc, curr) => acc + curr.publishers.length, 0);
  const activeCongregations = congregationGroups.filter(g => g.activeWithAccessCount > 0).length;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-all text-[#059669] bg-white shadow-md border border-gray-200"
            title="Voltar"
          >
            <ChevronLeft size={22} strokeWidth={3} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">
              Contas do Circuito (TJSEC)
            </h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
              Gerencie acessos de publicadores por congregação
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar congregação ou publicador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/10 focus:border-[#059669] transition-all"
            />
          </div>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-[#059669] border border-emerald-200 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all shadow-sm active:scale-95"
            title="Importar lista de publicadores do TJSEC"
          >
            <ClipboardPaste size={18} />
            <span className="hidden md:inline">IMPORTAR</span>
          </button>
          <button 
            onClick={fetchData}
            disabled={refreshing}
            className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 text-gray-500 transition-all disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && congregationGroups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 group hover:border-emerald-500 transition-all"
          >
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Contas Ativas</p>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {totalActiveWithAccess}
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <Landmark size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Congregações Ativas</p>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {activeCongregations}
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Total Publicadores</p>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {totalPublishers}
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="animate-spin text-[#059669]" size={48} />
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando dados...</p>
        </div>
      ) : filteredGroups.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredGroups.map((group) => (
            <div 
              key={group.congregation.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Main Card Header */}
              <div 
                className="p-4 md:p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                onClick={() => toggleGroup(group.congregation.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#059669]/10 rounded-2xl flex items-center justify-center text-[#059669] flex-shrink-0 shadow-inner">
                    <Landmark size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">
                        {group.congregation?.name || 'Congregação sem Nome'}
                      </h3>
                      {group.congregation.number && (
                        <span className="bg-[#059669]/10 text-[#059669] text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                          Nº {group.congregation.number}
                        </span>
                      )}
                      {group.activeWithAccessCount > 0 ? (
                        <span className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase border border-emerald-200 flex items-center gap-1">
                          <div className="w-1 h-1 rounded-full bg-emerald-600 animate-pulse"></div>
                          Ativa
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-400 text-[8px] font-black px-2 py-0.5 rounded-full uppercase border border-gray-200">
                          Sem Acesso
                        </span>
                      )}
                    </div>
                    {group.congregation.circuito && (
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                        Circuito: {group.congregation.circuito}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0">
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Publicadores com Acesso</p>
                    <p className="text-2xl font-black text-gray-900 leading-none mt-1">
                      {group.activeWithAccessCount}
                    </p>
                  </div>
                  <div className={`p-2 rounded-full bg-gray-50 text-gray-400 transition-transform duration-300 ${expandedGroups.includes(group.congregation.id) ? 'rotate-180' : ''}`}>
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>

              {/* Related Users List */}
              <AnimatePresence>
                {expandedGroups.includes(group.congregation.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-50 bg-gray-50/50"
                  >
                    <div className="p-4 md:p-6 space-y-4">
                      {group.publishers.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {group.publishers
                            .filter(p => p.hasAppAccess)
                            .map((p) => (
                            <div 
                              key={p.id}
                              className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 group/item hover:border-[#059669] transition-colors"
                            >
                              <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 overflow-hidden border border-gray-100 group-hover/item:bg-[#059669]/5 group-hover/item:text-[#059669] transition-colors">
                                {p.photoURL ? (
                                  <Image 
                                    src={p.photoURL} 
                                    alt={p.name} 
                                    width={40} 
                                    height={40} 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <UserIcon size={20} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                                {p.email && <p className="text-[10px] text-gray-500 truncate">{p.email}</p>}
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                    p.status === 'Ativo' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                  }`}>
                                    {p.status}
                                  </span>
                                  <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                                    {p.situation}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {group.publishers.filter(p => !p.hasAppAccess).length > 0 && (
                            <div className="col-span-full pt-4 border-t border-gray-100">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Registros sem acesso ao App ({group.publishers.filter(p => !p.hasAppAccess).length})</p>
                              <div className="flex flex-wrap gap-2">
                                {group.publishers
                                  .filter(p => !p.hasAppAccess)
                                  .map(p => (
                                    <span key={p.id} className="text-[10px] font-medium text-gray-500 bg-white border border-gray-100 px-2 py-1 rounded-lg">
                                      {p.name}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-white/50 rounded-2xl border-2 border-dashed border-gray-200">
                          <Users size={32} className="mx-auto text-gray-300 mb-2" />
                          <p className="text-sm text-gray-500">Nenhum publicador encontrado.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-20 text-center shadow-sm border border-gray-100">
          <Landmark size={64} className="mx-auto text-gray-200 mb-4" />
          <h3 className="text-xl font-bold text-gray-800">Nenhuma congregação encontrada</h3>
          <p className="text-gray-500 mt-2">Nenhum dado disponível no banco de dados.</p>
        </div>
      )}

      {/* Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <ClipboardPaste className="text-[#059669]" size={24} />
                  <h3 className="text-lg font-bold text-gray-800">
                    Importar do TJSEC
                  </h3>
                </div>
                <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex gap-3">
                  <AlertCircle className="text-emerald-600 shrink-0" size={20} />
                  <div className="text-xs text-emerald-800 space-y-1">
                    <p className="font-bold">Instruções:</p>
                    <p>1. Copie a lista de publicadores do TJSec ou Excel.</p>
                    <p>2. Certifique-se de que a linha com o nome da congregação e número (ex: "Central (12345)") esteja presente antes da lista de nomes.</p>
                    <p>3. Você pode colar listas de múltiplas congregações sequencialmente.</p>
                  </div>
                </div>

                {importError && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium">
                    {importError}
                  </div>
                )}

                {importSuccess && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl font-medium space-y-2">
                    <div className="flex items-center gap-2">
                      <Check size={18} />
                      <p className="font-bold">Importação concluída com sucesso!</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] uppercase tracking-wider">
                      <div className="bg-white/50 p-2 rounded-lg">Novos: {importSuccess.created}</div>
                      <div className="bg-white/50 p-2 rounded-lg">Atualizados: {importSuccess.updated}</div>
                    </div>
                    {importSuccess.skipped > 0 && (
                      <p className="text-amber-600 font-bold text-[10px]">
                        Atenção: {importSuccess.skipped} registros foram ignorados por ambiguidade ou congregação não identificada.
                      </p>
                    )}
                  </div>
                )}

                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Cole aqui os dados copiados..."
                  className="w-full h-64 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all resize-none"
                />
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-100 transition-all"
                >
                  Fechar
                </button>
                <button
                  onClick={handleBulkImport}
                  disabled={isImporting || !importText.trim() || !!importSuccess}
                  className="flex-[2] py-3 px-4 bg-[#059669] hover:bg-[#047857] text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Check size={20} />
                      Iniciar Importação
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Loader2({ className, size }: { className?: string, size?: number }) {
  return (
    <div className={`animate-spin rounded-full border-4 border-gray-200 border-t-current ${className}`} style={{ width: size, height: size }} />
  );
}
