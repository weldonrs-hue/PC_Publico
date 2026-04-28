'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { 
  Store, 
  Plus, 
  Edit2, 
  FileText,
  Trash2, 
  ChevronLeft,
  Search,
  MapPin,
  User,
  Users,
  Save,
  Loader2,
  ExternalLink,
  Navigation,
  ClipboardPaste,
  Map as MapIcon,
  List,
  X
} from 'lucide-react';

// Dynamically import map to avoid SSR issues
const CongregationsMap = dynamic(() => import('./CongregationsMap'), { 
  ssr: false,
  loading: () => <div className="h-[600px] w-full bg-gray-100 animate-pulse rounded-xl flex items-center justify-center text-gray-400">Carregando Mapa...</div>
});
import AppointmentLetterView from './AppointmentLetterView';
import {
  AnimatePresence,
  motion
} from 'motion/react';

import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  deleteDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface Congregation {
  id: string;
  nome: string;
  numero: string;
  parte: string;
  endereco: string;
  coordenador: string;
  telefone: string;
  cidade: string;
  cep: string;
  estado: string;
  gps?: string;
  grupos: string[];
}

interface CongregationsViewProps {
  userId: string;
  isAdmin?: boolean;
  importEnabledForAll?: boolean;
  onBack: () => void;
  initialCongregation?: Congregation | null;
}

const defaultFormData: Congregation = {
  id: '', nome: '', numero: '', parte: 'A', endereco: '', coordenador: '',
  telefone: '', cidade: '', cep: '', estado: '', gps: '', grupos: []
};

export default function CongregationsView({ 
  userId, 
  isAdmin = false,
  importEnabledForAll = false, 
  onBack, 
  initialCongregation 
}: CongregationsViewProps) {
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialCongregation) {
      setSelectedCong(initialCongregation);
      setFormData({ ...defaultFormData, ...initialCongregation });
      setIsEditing(true);
    }
  }, [initialCongregation]);

  useEffect(() => {
    const q = query(collection(db, 'congregations'), where('userId', '==', userId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const congsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Congregation[];
      
      // Sort alphabetically by name
      const sortedCongs = congsData.sort((a, b) => a.nome.localeCompare(b.nome));
      
      setCongregations(sortedCongs);
      setLoading(false);
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, 'congregations');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const [isEditing, setIsEditing] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [isPasting, setIsPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [selectedCong, setSelectedCong] = useState<Congregation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchingCEP, setIsSearchingCEP] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);
  
  const [formData, setFormData] = useState<Congregation>(defaultFormData);

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 8);
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
  };

  const formatPhone = (value: string) => {
    let numbers = value.replace(/\D/g, '');
    // Se começar com 55 e tiver 12 ou 13 dígitos, remove o 55 (DDI do Brasil)
    if (numbers.startsWith('55') && (numbers.length === 12 || numbers.length === 13)) {
      numbers = numbers.slice(2);
    }
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const handleCEPSearch = async () => {
    const cep = formData.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setIsSearchingCEP(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          endereco: `${data.logradouro}${data.bairro ? `, ${data.bairro}` : ''}`,
          cidade: data.localidade.toUpperCase(),
          estado: data.uf.toUpperCase(),
          cep: formatCEP(data.cep)
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setIsSearchingCEP(false);
    }
  };

  const handleAddGroup = () => {
    setFormData(prev => ({
      ...prev,
      grupos: [...prev.grupos, '']
    }));
  };

  const handleGroupChange = (index: number, value: string) => {
    const newGrupos = [...formData.grupos];
    newGrupos[index] = value;
    setFormData(prev => ({ ...prev, grupos: newGrupos }));
  };

  const handleRemoveGroup = (index: number) => {
    setFormData(prev => ({
      ...prev,
      grupos: prev.grupos.filter((_, i) => i !== index)
    }));
  };

  const handleAddNew = () => {
    setSelectedCong(null);
    setFormData(defaultFormData);
    setIsEditing(true);
  };

  const handleNavigate = (cong: Congregation) => {
    let gpsClean = cong.gps?.trim();
    
    // Se tiver espaço mas não vírgula, tenta converter para vírgula
    if (gpsClean && gpsClean.includes(' ') && !gpsClean.includes(',')) {
      gpsClean = gpsClean.replace(/\s+/g, ',');
    }

    if (gpsClean && gpsClean.includes(',')) {
      const [lat, lng] = gpsClean.split(',').map(p => p.trim());
      if (lat && lng) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
        return;
      }
    }

    // Fallback para endereço
    const addressParts = [cong.endereco, cong.cidade, cong.estado, cong.cep].filter(Boolean);
    const fullAddress = addressParts.join(', ');
    if (fullAddress) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`, '_blank');
    }
  };

  const handleEdit = (cong: Congregation) => {
    setSelectedCong(cong);
    setFormData({ ...defaultFormData, ...cong });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'congregations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'congregations');
    }
    setShowDeleteConfirm(null);
  };

  const handlePasteData = () => {
    if (!pasteText.trim()) return;

    const text = pasteText;
    const newFormData = { ...formData };
    
    // Regexes para capturar os dados
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
    const congregacaoIdx = lines.findIndex(l => l.toLowerCase().includes('congregação'));
    
    // Prioridade 1: Padrão de Correspondência (Mais preciso em exportações do Hub)
    const corrIdx = lines.findIndex(l => l.toLowerCase().includes('correspondência'));
    if (corrIdx !== -1) {
      const targetLine = lines[corrIdx].includes('(') ? lines[corrIdx] : lines[corrIdx + 1];
      if (targetLine) {
        const corrMatch = targetLine.match(/\((\d+)\)\s*(.*?)\s*-\s*(.*)/);
        if (corrMatch) {
          newFormData.numero = corrMatch[1];
          const rawName = corrMatch[2].trim();
          const rawInfo = corrMatch[3].trim();
          
          const stateMatch = rawInfo.match(/\s([A-Z]{2})$/) || rawInfo.match(/^([A-Z]{2})$/);
          if (stateMatch) {
            const state = stateMatch[stateMatch.length - 1];
            const city = rawInfo.replace(state, '').trim();
            if (city) {
              newFormData.cidade = city.toUpperCase();
              newFormData.estado = state.toUpperCase();
              newFormData.nome = rawName;
            } else {
              newFormData.cidade = rawName.toUpperCase();
              newFormData.estado = state.toUpperCase();
              newFormData.nome = rawName;
            }
          }
        }
      }
    }

    // Prioridade 2: Busca por A/C (Aos Cuidados) - CCA e Endereço
    const acIdx = lines.findIndex(l => l.toUpperCase().startsWith('A/C'));
    if (acIdx !== -1) {
      // Coordenador (remover prefixo A/C do primeiro encontrado)
      const coordName = lines[acIdx].replace(/A\/C[\s:]*/i, '').trim();
      if (!newFormData.coordenador || newFormData.coordenador.includes('Corpo')) {
        newFormData.coordenador = coordName;
      }
      
      // Pula todas as linhas consecutivas que começam com A/C para encontrar o endereço
      let lastAcIdx = acIdx;
      while (lines[lastAcIdx + 1]?.toUpperCase().startsWith('A/C')) {
        lastAcIdx++;
      }
      
      // Endereço (as duas próximas linhas após o último A/C)
      if (!newFormData.endereco) {
        const addrLine1 = lines[lastAcIdx + 1] || '';
        const addrLine2 = lines[lastAcIdx + 2] || '';
        
        // Verifica se a linha 2 contém cidade/estado
        const cityStateMatch = addrLine2.match(/([A-ZÀ-Ú\s]+),\s*([A-Z]{2})/i);
        if (cityStateMatch) {
          newFormData.endereco = addrLine1;
          newFormData.cidade = cityStateMatch[1].trim().toUpperCase();
          newFormData.estado = cityStateMatch[2].trim().toUpperCase();
        } else {
          newFormData.endereco = `${addrLine1}, ${addrLine2}`.trim().replace(/,$/, '');
        }
      }
      
      // CEP (procura nas linhas próximas ao A/C se ainda não tiver)
      if (!newFormData.cep) {
        for (let i = 1; i <= 6; i++) {
          const l = lines[lastAcIdx + i];
          const cepM = l?.match(/(\d{5}-\d{3})/);
          if (cepM) {
            newFormData.cep = cepM[1];
            break;
          }
        }
      }
    }

    const addressMatch = text.match(/Endereço\s*\n+([^\n]+)/i);
    if (addressMatch) {
      const addrLinesInternal = text.split('\n').map(l => l.trim()).filter(l => l !== '');
      const addrIdx = addrLinesInternal.findIndex(l => l.toLowerCase() === 'endereço');
      
      if (addrIdx !== -1) {
        const addrLinesSub = addrLinesInternal.slice(addrIdx + 1, addrIdx + 5);
        // Procura a linha com Cidade, UF (ex: "Campina Grande, PB")
        const cityLineIdx = addrLinesSub.findIndex(l => l.includes(',') && l.match(/[A-ZÀ-Ú\s]+,\s*[A-Z]{2}$/i));
        
        if (cityLineIdx !== -1) {
          const [city, state] = addrLinesSub[cityLineIdx].split(',').map(s => s.trim());
          newFormData.cidade = city.toUpperCase();
          newFormData.estado = state.toUpperCase();
          
          // O que vier antes da cidade no bloco de endereço é o endereço completo (Rua + Bairro)
          newFormData.endereco = addrLinesSub.slice(0, cityLineIdx).join(', ');
        } else {
          // Fallback se não encontrar o padrão Cidade, UF no bloco
          newFormData.endereco = addrLinesSub[0] || '';
        }
      }
    }

    const numberMatch = text.match(/Nº\s*(\d+)/i) || text.match(/\((\d{4,6})\)/);
    if (numberMatch) {
      newFormData.numero = (numberMatch[1] || numberMatch[0].replace(/\D/g, '')).trim();
    }

    const parteMatch = text.match(/Parte\s*([A-C])/i);
    if (parteMatch) {
      newFormData.parte = parteMatch[1].toUpperCase();
    }

    if (congregacaoIdx !== -1) {
      // Procura o nome nas próximas linhas, pulando idiomas conhecidos
      const idiomas = ['português', 'espanhol', 'inglês', 'libras', 'francês', 'italiano', 'alemão', 'guarani', 'chinês', 'japonês'];
      for (let i = 1; i <= 3; i++) {
        const candidate = lines[congregacaoIdx + i];
        if (candidate && !idiomas.some(id => candidate.toLowerCase().includes(id)) && !candidate.startsWith('Nº') && !candidate.includes(' mi)')) {
          // Trata os padrões: "Nome - Cidade UF" ou "Nome - UF"
          let cleanName = candidate;
          
          // Remove número entre parênteses se houver (ex: "Central - Campina Grande PB (14738)")
          cleanName = cleanName.replace(/\(\d+\)/, '').trim();

          if (cleanName.includes(' - ')) {
             const parts = cleanName.split(' - ');
             cleanName = parts[0].trim();
             
             // Extração de backup para cidade/estado se ainda não encontrados
             const extraInfo = parts[1].trim();
             const stateMatch = extraInfo.match(/\s([A-Z]{2})$/) || extraInfo.match(/^([A-Z]{2})$/);
             
             if (stateMatch) {
               const state = stateMatch[stateMatch.length - 1];
               const city = extraInfo.replace(state, '').trim();
               
               if (city) {
                 // Padrão: Nome - Cidade UF
                 if (!newFormData.cidade) newFormData.cidade = city.toUpperCase();
                 if (!newFormData.estado) newFormData.estado = state.toUpperCase();
               } else {
                 // Padrão: Nome - UF (Onde Nome == Cidade)
                 if (!newFormData.cidade) newFormData.cidade = cleanName.toUpperCase();
                 if (!newFormData.estado) newFormData.estado = state.toUpperCase();
               }
             }
          }
          newFormData.nome = cleanName;
          break;
        }
      }
    }

    const cepMatch = text.match(/(\d{5}-\d{3})/);
    if (cepMatch) newFormData.cep = cepMatch[1];

    const linesArr = text.split('\n').map(l => l.trim());
    const telIdx = linesArr.findIndex(l => l.toLowerCase().startsWith('telefone') || l.toLowerCase().startsWith('celular'));
    if (telIdx !== -1) {
      let tel = '';
      const lineContent = linesArr[telIdx].replace(/telefone|celular/i, '').replace(/[:\s]/g, '');
      if (lineContent.replace(/\D/g, '').length >= 8) {
        tel = linesArr[telIdx].replace(/telefone|celular/i, '').replace(/^[:\s]+/, '');
      } else if (linesArr[telIdx + 1] && linesArr[telIdx + 1].replace(/\D/g, '').length >= 8) {
        tel = linesArr[telIdx + 1];
      }
      if (tel) newFormData.telefone = formatPhone(tel);
    }
    
    const coordMatch = text.match(/(?:Coordenador|CCA|A\/C)[\s:]*([A-ZÀ-Ú\s]+)/i);
    if (coordMatch && (!newFormData.coordenador || newFormData.coordenador.includes('Corpo'))) {
      newFormData.coordenador = coordMatch[1].trim();
    }

    const gpsMatch = text.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)|(-?\d+\.\d+)\s+(-?\d+\.\d+)/);
    if (gpsMatch) {
      if (gpsMatch[1] && gpsMatch[2]) {
        newFormData.gps = `${gpsMatch[1]}, ${gpsMatch[2]}`;
      } else if (gpsMatch[3] && gpsMatch[4]) {
        newFormData.gps = `${gpsMatch[3]}, ${gpsMatch[4]}`;
      }
    }

    setFormData(newFormData);
    setIsPasting(false);
    setPasteText('');
  };

  const handleBulkImport = async () => {
    if (!importText.trim()) return;
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      // Divide o texto em blocos de congregação
      // O delimitador comum é o cabeçalho "Congregação"
      const blocks = importText.split(/(?=Congregação)/i).filter(b => b.trim().length > 20);
      
      if (blocks.length === 0) {
        setImportError('Nenhum dado de congregação identificado. Certifique-se de copiar as congregações do JW.org ou Hub.');
        setIsImporting(false);
        return;
      }

      const batch = writeBatch(db);
      let count = 0;

      for (const block of blocks) {
        const bLines = block.split('\n').map(l => l.trim()).filter(l => l !== '');
        
        let nome = '';
        let numero = '';
        let cidade = '';
        let estado = '';
        let endereco = '';
        let cep = '';
        let coordenador = '';
        let telefone = '';
        let gps = '';
        let parte = 'A';

        // Prioridade 1: Padrão de Correspondência (Hub)
        const corrIdx = bLines.findIndex(l => l.toLowerCase().includes('correspondência'));
        if (corrIdx !== -1) {
          const targetLine = bLines[corrIdx].includes('(') ? bLines[corrIdx] : bLines[corrIdx + 1];
          if (targetLine) {
            const corrMatch = targetLine.match(/\((\d+)\)\s*(.*?)\s*-\s*(.*)/);
            if (corrMatch) {
              numero = corrMatch[1];
              const rawName = corrMatch[2].trim();
              const rawInfo = corrMatch[3].trim();
              
              const stateMatch = rawInfo.match(/\s([A-Z]{2})$/) || rawInfo.match(/^([A-Z]{2})$/);
              if (stateMatch) {
                const state = stateMatch[stateMatch.length - 1];
                const city = rawInfo.replace(state, '').trim();
                nome = rawName;
                estado = state.toUpperCase();
                cidade = city ? city.toUpperCase() : rawName.toUpperCase();
              }
            }
          }
        }

        const acIdx = bLines.findIndex(l => l.toUpperCase().startsWith('A/C'));
        if (acIdx !== -1) {
          const coordName = bLines[acIdx].replace(/A\/C[\s:]*/i, '').trim();
          if (!coordenador || coordenador.toLowerCase().includes('corpo')) {
            coordenador = coordName;
          }
          
          // Pula todas as linhas consecutivas que começam com A/C
          let lastAcIdx = acIdx;
          while (bLines[lastAcIdx + 1]?.toUpperCase().startsWith('A/C')) {
            lastAcIdx++;
          }
          
          if (!endereco && bLines[lastAcIdx + 1]) {
            const addrLine1 = bLines[lastAcIdx + 1] || '';
            const addrLine2 = bLines[lastAcIdx + 2] || '';
            const csMatch = addrLine2.match(/([A-ZÀ-Ú\s]+),\s*([A-Z]{2})/i);
            if (csMatch) {
              endereco = addrLine1;
              if (!cidade) cidade = csMatch[1].trim().toUpperCase();
              if (!estado) estado = csMatch[2].trim().toUpperCase();
            } else {
              endereco = `${addrLine1}, ${addrLine2}`.trim().replace(/,$/, '');
            }
          }
          
          if (!cep) {
            for (let i = 1; i <= 6; i++) {
              const cepM = bLines[lastAcIdx + i]?.match(/(\d{5}-\d{3})/);
              if (cepM) {
                cep = cepM[1];
                break;
              }
            }
          }
        }

        const enderecoMatch = block.match(/Endereço\s*\n+([^\n]+)/i);
        
        if (enderecoMatch) {
          const addrIdx = bLines.findIndex(l => l.toLowerCase() === 'endereço');
          if (addrIdx !== -1) {
            const addrLinesSub = bLines.slice(addrIdx + 1, addrIdx + 5);
            const cityLineIdx = addrLinesSub.findIndex(l => l.includes(',') && l.match(/[A-ZÀ-Ú\s]+,\s*[A-Z]{2}$/i));
            
            if (cityLineIdx !== -1) {
              const parts = addrLinesSub[cityLineIdx].split(',');
              if (!cidade) cidade = parts[0].trim().toUpperCase();
              if (!estado) estado = parts[1].trim().toUpperCase();
              endereco = addrLinesSub.slice(0, cityLineIdx).join(', ');
            } else {
              endereco = addrLinesSub[0] || '';
            }
          }
        }

        const cIdx = bLines.findIndex(l => l.toLowerCase().includes('congregação'));
        
        if (!nome && cIdx !== -1) {
          const idiomas = ['português', 'espanhol', 'inglês', 'libras', 'francês', 'italiano', 'alemão', 'guarani', 'chinês', 'japonês'];
          for (let i = 1; i <= 3; i++) {
            const candidate = bLines[cIdx + i];
            if (candidate && !idiomas.some(id => candidate.toLowerCase().includes(id)) && !candidate.startsWith('Nº') && !candidate.includes(' mi)')) {
              let cleanName = candidate;
              
              cleanName = cleanName.replace(/\(\d+\)/, '').trim();

              if (cleanName.includes(' - ')) {
                const parts = cleanName.split(' - ');
                cleanName = parts[0].trim();
                
                const extraInfo = parts[1].trim();
                const stateMatch = extraInfo.match(/\s([A-Z]{2})$/) || extraInfo.match(/^([A-Z]{2})$/);
                
                if (stateMatch) {
                  const state = stateMatch[stateMatch.length - 1];
                  const city = extraInfo.replace(state, '').trim();
                  
                  if (city) {
                    if (!cidade) cidade = city.toUpperCase();
                    if (!estado) estado = state.toUpperCase();
                  } else {
                    if (!cidade) cidade = cleanName.toUpperCase();
                    if (!estado) estado = state.toUpperCase();
                  }
                }
              }
              nome = cleanName;
              break;
            }
          }
        }

        if (!numero) {
          const numeroMatch = block.match(/Nº\s*(\d+)/i) || block.match(/\((\d{4,6})\)/);
          numero = numeroMatch ? (numeroMatch[1] || numeroMatch[0].replace(/\D/g, '')).trim() : '';
        }
        
        const pMatch = block.match(/Parte\s*([A-C])/i);
        if (pMatch) parte = pMatch[1].toUpperCase();

        if (!nome || !numero) continue;
        
        if (!cep) {
          cep = block.match(/(\d{5}-\d{3})/)?.[1] || '';
        }
        
        const telIdx = bLines.findIndex(l => l.toLowerCase().startsWith('telefone') || l.toLowerCase().startsWith('celular'));
        if (telIdx !== -1) {
          let tel = '';
          const lineContent = bLines[telIdx].replace(/telefone|celular/i, '').replace(/[:\s]/g, '');
          if (lineContent.replace(/\D/g, '').length >= 8) {
            tel = bLines[telIdx].replace(/telefone|celular/i, '').replace(/^[:\s]+/, '');
          } else if (bLines[telIdx + 1] && bLines[telIdx + 1].replace(/\D/g, '').length >= 8) {
            tel = bLines[telIdx + 1];
          }
          if (tel) {
            telefone = formatPhone(tel);
          }
        }

        const coordMatch = block.match(/(?:Coordenador|CCA|A\/C)[\s:]*([A-ZÀ-Ú\s]+)/i);
        if (coordMatch && (!coordenador || coordenador.toLowerCase().includes('corpo'))) {
          coordenador = coordMatch[1].trim();
        }
        
        const gpsMatch = block.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)|(-?\d+\.\d+)\s+(-?\d+\.\d+)/);
        if (gpsMatch) {
          gps = gpsMatch[1] && gpsMatch[2] ? `${gpsMatch[1]}, ${gpsMatch[2]}` : `${gpsMatch[3]}, ${gpsMatch[4]}`;
        }

        const newDocRef = doc(collection(db, 'congregations'));
        batch.set(newDocRef, {
          nome,
          numero,
          parte,
          endereco,
          cidade,
          estado,
          cep,
          telefone,
          coordenador,
          gps,
          grupos: [],
          userId,
          createdAt: new Date()
        });
        count++;
      }

      if (count > 0) {
        await batch.commit();
        setImportSuccess(count);
        setImportText('');
        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportSuccess(null);
        }, 2000);
      } else {
        setImportError('Nenhum registro válido foi encontrado no texto colado.');
      }
    } catch (error) {
      console.error('Erro na importação em massa:', error);
      setImportError('Ocorreu um erro ao processar os dados. Verifique o formato e tente novamente.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let docRef;
      if (selectedCong) {
        docRef = doc(db, 'congregations', selectedCong.id);
      } else {
        docRef = doc(collection(db, 'congregations'));
      }

      const { id, ...dataToSave } = formData;
      await setDoc(docRef, { ...dataToSave, userId });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'congregations');
    }
  };

  const filteredCongregations = congregations.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.numero.includes(searchTerm)
  );

  if (showLetter && selectedCong) {
    return (
      <AppointmentLetterView
        userId={userId}
        congregation={{
          nome: selectedCong.nome,
          numero: selectedCong.numero,
          cidade: selectedCong.cidade,
          estado: selectedCong.estado,
          endereco: selectedCong.endereco,
          coordenador: selectedCong.coordenador,
          cep: selectedCong.cep
        }}
        visitDate={new Date().toLocaleDateString('pt-BR')}
        onBack={() => setShowLetter(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-all text-amber-600 bg-white shadow-md border border-gray-200"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={28} strokeWidth={3} />
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          Gestão de Congregações
        </h2>
      </div>

      <AnimatePresence mode="wait">
        {!isEditing ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Search and Add Bar */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text"
                      placeholder="Buscar por nome ou número..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors"
                    />
                  </div>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      title="Ver Lista"
                    >
                      <List size={20} />
                    </button>
                    <button 
                      onClick={() => setViewMode('map')}
                      className={`p-2 rounded-md transition-all ${viewMode === 'map' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      title="Ver Mapa"
                    >
                      <MapIcon size={20} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                  <a 
                    href="https://hub.jw.org/meetings/pt?q=%7B%22meetingType%22:%22meetings%22,%22location%22:%22Sua%20localiza%C3%A7%C3%A3o%22%7D"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full md:w-auto bg-white text-amber-600 border border-amber-200 px-6 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors shadow-sm"
                  >
                    <ExternalLink size={20} />
                    Buscar no JW.org
                  </a>
                  {(isAdmin || importEnabledForAll) && (
                    <button 
                      onClick={() => setIsImportModalOpen(true)}
                      className="w-full md:w-auto bg-white text-amber-600 border border-amber-200 px-6 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors shadow-sm"
                    >
                      <ClipboardPaste size={20} />
                      Importação em Massa
                    </button>
                  )}
                  <button 
                    onClick={handleAddNew}
                    className="w-full md:w-auto bg-amber-600 text-white px-6 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors shadow-lg shadow-amber-200 active:scale-95"
                  >
                    <Plus size={20} />
                    Nova Congregação
                  </button>
                </div>
              </div>

            {/* List or Map Grid */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-amber-500" size={48} />
              </div>
            ) : viewMode === 'map' ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 h-[600px]">
                  <CongregationsMap 
                    congregations={filteredCongregations} 
                    onEdit={(cong) => handleEdit(cong)}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <MapPin size={14} className="text-amber-500" />
                  <span>
                    Mostrando {
                      filteredCongregations.filter(c => {
                        const gps = c.gps?.trim();
                        return gps && (gps.includes(',') || gps.includes(' '));
                      }).length
                    } de {filteredCongregations.length} congregações no mapa.
                  </span>
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCongregations.length > 0 ? (
                  filteredCongregations.map((cong) => (
                    <div 
                      key={cong.id}
                      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-amber-500/5 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300 shadow-inner">
                            <Store size={22} />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">{cong.nome}</h3>
                            <p className="text-xs text-gray-500 font-mono">Nº {cong.numero} • Parte {cong.parte}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setSelectedCong(cong);
                              setShowLetter(true);
                            }}
                            className="p-2 text-[#512da8] hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Carta de Designação"
                          >
                            <FileText size={16} />
                          </button>
                          <button 
                            onClick={() => setShowDeleteConfirm(cong.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-gray-400" />
                          <span className="truncate">{cong.cidade} - {cong.estado}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          <span className="truncate">{cong.coordenador || 'Sem coordenador'}</span>
                        </div>
                        {cong.gps ? (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-amber-500" />
                            <span className="text-xs font-mono text-amber-600">{cong.gps}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-gray-300" />
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase">Sem GPS</span>
                          </div>
                        )}
                        {cong.grupos && cong.grupos.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Users size={14} className="text-gray-400" />
                            <span className="text-xs">{cong.grupos.length} Grupo(s)</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button 
                          onClick={() => handleEdit(cong)}
                          className="py-2.5 text-xs font-bold text-amber-600 border border-amber-100 rounded-xl hover:bg-amber-600 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                          <Edit2 size={14} />
                          Editar Detalhes
                        </button>
                        <button 
                          onClick={() => handleNavigate(cong)}
                          className="py-2 text-xs font-bold text-blue-600 border border-blue-100 rounded-lg hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-1"
                        >
                          <Navigation size={12} />
                          Como Chegar
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <Store className="mx-auto text-gray-300 mb-2" size={48} />
                    <p className="text-gray-500 font-medium">Nenhuma congregação encontrada.</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-5 text-white flex justify-between items-center">
              <h3 className="font-bold">
                {selectedCong ? 'Editar Congregação' : 'Nova Congregação'}
              </h3>
              {!selectedCong && (
                <button 
                  type="button"
                  onClick={() => setIsPasting(true)}
                  className="flex items-center gap-1 text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-all"
                >
                  <ClipboardPaste size={12} />
                  Colar Dados
                </button>
              )}
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              {isPasting && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-blue-800 uppercase">Cole os dados abaixo</h4>
                    <button 
                      type="button"
                      onClick={() => setIsPasting(false)}
                      className="text-blue-400 hover:text-blue-600 text-[10px] font-bold"
                    >
                      Cancelar
                    </button>
                  </div>
                  <textarea 
                    autoFocus
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Cole aqui o texto da congregação..."
                    className="w-full h-32 p-3 text-xs bg-white border border-blue-200 rounded-lg outline-none focus:border-blue-500 font-mono"
                  />
                  <button 
                    type="button"
                    onClick={handlePasteData}
                    className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all"
                  >
                    Processar e Preencher
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Basic Info */}
                <div className="md:col-span-2 space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Nome da Congregação</label>
                      <input 
                        required
                        value={formData.nome}
                        onChange={(e) => setFormData({...formData, nome: e.target.value})}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors"
                        placeholder="Ex: Central"
                      />
                    </div>
                    <div className="w-full md:w-[140px] space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Número</label>
                      <input 
                        required
                        value={formData.numero}
                        onChange={(e) => setFormData({...formData, numero: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors"
                        placeholder="000000"
                      />
                    </div>
                    <div className="w-full md:w-[100px] space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Parte</label>
                      <input 
                        value={formData.parte}
                        onChange={(e) => setFormData({...formData, parte: e.target.value.toUpperCase().slice(0, 1)})}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors text-center"
                        placeholder="A"
                        maxLength={1}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Endereço Completo</label>
                    <input 
                      value={formData.endereco}
                      onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-[180px] space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">CEP</label>
                      <div className="relative">
                        <input 
                           value={formData.cep}
                          onChange={(e) => setFormData({...formData, cep: formatCEP(e.target.value)})}
                          onBlur={handleCEPSearch}
                          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors pr-8"
                          placeholder="00000-000"
                          maxLength={9}
                        />
                        <button 
                          type="button"
                          onClick={handleCEPSearch}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-600 hover:text-amber-800"
                        >
                          {isSearchingCEP ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Cidade</label>
                      <input 
                        value={formData.cidade}
                        onChange={(e) => setFormData({...formData, cidade: e.target.value.toUpperCase()})}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors"
                        placeholder="CIDADE"
                      />
                    </div>
                    <div className="w-full md:w-[80px] space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">UF</label>
                      <input 
                        value={formData.estado}
                        onChange={(e) => setFormData({...formData, estado: e.target.value.toUpperCase().replace(/[^A-Z]/g, '')})}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors text-center"
                        placeholder="UF"
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Coordenadas GPS</label>
                    <input 
                      value={formData.gps || ''}
                      onChange={(e) => setFormData({...formData, gps: e.target.value})}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors"
                      placeholder="Ex: -23.5505, -46.6333"
                    />
                  </div>
                </div>

                {/* Contact Info */}
                <div className="bg-gray-50 p-4 rounded-xl space-y-4 shadow-inner">
                  <h4 className="text-sm font-bold text-gray-700 border-b border-gray-200 pb-2">
                    Coordenador
                  </h4>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Nome do CCA</label>
                    <input 
                      value={formData.coordenador}
                      onChange={(e) => setFormData({...formData, coordenador: e.target.value})}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Telefone</label>
                    <input 
                      value={formData.telefone}
                      onChange={(e) => setFormData({...formData, telefone: formatPhone(e.target.value)})}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors"
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                    />
                  </div>
                </div>
              </div>

              {/* Groups Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <h4 className="text-sm font-bold text-gray-700">
                    Grupos e Pré-grupos
                  </h4>
                  <button 
                    type="button"
                    onClick={handleAddGroup}
                    className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-xl transition-all border border-amber-100"
                  >
                    <Plus size={14} /> Adicionar Grupo
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {formData.grupos.map((grupo, index) => (
                    <div key={index} className="relative group">
                      <input 
                        value={grupo}
                        onChange={(e) => handleGroupChange(index, e.target.value)}
                        placeholder={`Nome do Grupo ${index + 1}`}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors pr-8"
                      />
                      <button 
                        type="button"
                        onClick={() => handleRemoveGroup(index)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {formData.grupos.length === 0 && (
                    <p className="text-xs text-gray-400 italic col-span-full">Nenhum grupo adicionado. Clique no &quot;+&quot; para adicionar.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-8 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 flex items-center gap-2 active:scale-95"
                >
                  <Save size={20} />
                  Salvar Congregação
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
          >
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-gray-800">Excluir Congregação</h3>
              <p className="text-gray-600">Tem certeza que deseja excluir esta congregação? Esta ação não pode ser desfeita.</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button 
                onClick={() => handleDelete(showDeleteConfirm)}
                className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
              >
                Confirmar Exclusão
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Importar em Massa */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100"
            >
              <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <ClipboardPaste size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Importação em Massa</h3>
                    <p className="text-xs text-white/80">Adicione várias congregações de uma vez</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <h4 className="text-sm font-bold text-amber-800 mb-1">Como usar:</h4>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    1. Vá ao JW.org ou Hub de Reuniões.<br />
                    2. Localize as congregações do seu circuito.<br />
                    3. Selecione e copie o texto completo das congregações.<br />
                    4. Cole no campo abaixo e clique em &quot;Processar e Importar&quot;.
                  </p>
                </div>

                <textarea 
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Cole aqui os dados das congregações..."
                  className="w-full h-64 p-4 text-sm bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all font-mono"
                />

                {importError && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                    {importError}
                  </div>
                )}

                {importSuccess && (
                  <div className="p-4 bg-green-50 border border-green-100 rounded-xl text-green-600 text-sm font-bold flex items-center gap-2 animate-in zoom-in">
                    <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center">✓</div>
                    {importSuccess} congregações importadas com sucesso!
                  </div>
                )}

                <div className="flex gap-4 pt-2">
                  <button 
                    onClick={() => setIsImportModalOpen(false)}
                    className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleBulkImport}
                    disabled={isImporting || !importText.trim()}
                    className="flex-3 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Save size={20} />
                        Processar e Importar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
