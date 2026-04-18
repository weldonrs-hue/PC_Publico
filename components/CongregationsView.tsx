'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { 
  Store, 
  Plus, 
  Edit2, 
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
  List
} from 'lucide-react';

// Dynamically import map to avoid SSR issues
const CongregationsMap = dynamic(() => import('./CongregationsMap'), { 
  ssr: false,
  loading: () => <div className="h-[600px] w-full bg-gray-100 animate-pulse rounded-xl flex items-center justify-center text-gray-400">Carregando Mapa...</div>
});
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
  writeBatch,
  onSnapshot
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
  onBack: () => void;
  initialCongregation?: Congregation | null;
}

const defaultFormData: Congregation = {
  id: '', nome: '', numero: '', parte: 'A', endereco: '', coordenador: '',
  telefone: '', cidade: '', cep: '', estado: '', gps: '', grupos: []
};

export default function CongregationsView({ userId, onBack, initialCongregation }: CongregationsViewProps) {
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
      setCongregations(congsData);
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
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [isPasting, setIsPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [selectedCong, setSelectedCong] = useState<Congregation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchingCEP, setIsSearchingCEP] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  const [formData, setFormData] = useState<Congregation>(defaultFormData);

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 8);
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
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

    const lines = pasteText.split('\n').map(l => l.trim()).filter(l => l !== '');
    const newFormData = { ...formData };

    // 1. Nome da Congregação (Geralmente a 3ª linha no formato padrão)
    if (lines.length > 2) {
      // Se a primeira linha for "Congregação", o nome costuma estar na 3ª
      if (lines[0].toLowerCase().includes('congregação')) {
        newFormData.nome = lines[2];
      } else {
        newFormData.nome = lines[0];
      }
    }

    // 2. Endereço, Cidade, Estado, CEP
    const addressIdx = lines.findIndex(l => l.toLowerCase() === 'endereço');
    if (addressIdx !== -1) {
      // O endereço costuma ter 3 ou 4 linhas após "Endereço"
      // Ex: Rua, Bairro, Cidade/UF, CEP
      const addrLine1 = lines[addressIdx + 1] || '';
      const addrLine2 = lines[addressIdx + 2] || '';
      const addrLine3 = lines[addressIdx + 3] || '';
      const addrLine4 = lines[addressIdx + 4] || '';

      // Tenta identificar Cidade, PB e CEP
      const cityStateMatch = addrLine3.match(/^(.+),\s*([A-Z]{2})$/i);
      if (cityStateMatch) {
        newFormData.endereco = `${addrLine1}${addrLine2 ? ', ' + addrLine2 : ''}`;
        newFormData.cidade = cityStateMatch[1].toUpperCase();
        newFormData.estado = cityStateMatch[2].toUpperCase();
        newFormData.cep = addrLine4.match(/^\d{5}-\d{3}$/) ? addrLine4 : '';
      } else {
        // Fallback se o formato for um pouco diferente
        const cityStateMatch2 = addrLine2.match(/^(.+),\s*([A-Z]{2})$/i);
        if (cityStateMatch2) {
          newFormData.endereco = addrLine1;
          newFormData.cidade = cityStateMatch2[1].toUpperCase();
          newFormData.estado = cityStateMatch2[2].toUpperCase();
          newFormData.cep = addrLine3.match(/^\d{5}-\d{3}$/) ? addrLine3 : '';
        }
      }
    }

    // 3. Telefone
    const phoneIdx = lines.findIndex(l => l.toLowerCase() === 'telefone');
    if (phoneIdx !== -1 && lines[phoneIdx + 1]) {
      newFormData.telefone = formatPhone(lines[phoneIdx + 1]);
    }

    // 4. GPS
    const gpsIdx = lines.findIndex(l => l.toLowerCase().includes('coordenadas gps'));
    if (gpsIdx !== -1 && lines[gpsIdx + 1]) {
      const gpsRaw = lines[gpsIdx + 1];
      // Converte "-7.240467 -35.877171" para "-7.240467, -35.877171"
      if (gpsRaw.includes(' ') && !gpsRaw.includes(',')) {
        newFormData.gps = gpsRaw.replace(/\s+/g, ', ');
      } else {
        newFormData.gps = gpsRaw;
      }
    }

    setFormData(newFormData);
    setIsPasting(false);
    setPasteText('');
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) return;
    setIsImporting(true);

    try {
      const batch = writeBatch(db);
      let importedCount = 0;

      // Check if it's CSV format (starts with the specific header)
      const isCSV = bulkText.trim().startsWith('Congregação,"Circuito"') || bulkText.trim().startsWith('Congregação,Circuito');

      if (isCSV) {
        // Robust CSV Parser that handles newlines in quotes
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentCell = '';
        let inQuotes = false;
        
        for (let i = 0; i < bulkText.length; i++) {
          const char = bulkText[i];
          const nextChar = bulkText[i + 1];
          
          if (inQuotes) {
            if (char === '"' && nextChar === '"') {
              currentCell += '"';
              i++;
            } else if (char === '"') {
              inQuotes = false;
            } else {
              currentCell += char;
            }
          } else {
            if (char === '"') {
              inQuotes = true;
            } else if (char === ',') {
              currentRow.push(currentCell.trim());
              currentCell = '';
            } else if (char === '\n') {
              currentRow.push(currentCell.trim());
              rows.push(currentRow);
              currentRow = [];
              currentCell = '';
            } else if (char !== '\r') {
              currentCell += char;
            }
          }
        }
        if (currentRow.length > 0 || currentCell !== '') {
          currentRow.push(currentCell.trim());
          rows.push(currentRow);
        }

        // Process rows (skip header)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length < 3) continue;

          const congregation: Partial<Congregation & { userId: string }> = {
            userId,
            grupos: [],
            nome: row[0].replace(/\s+-\s+[A-Z]{2}$/, ''), // Clean "City - UF"
            numero: row[2],
          };

          // Circuit Part
          const circuitStr = row[1];
          const partMatch = circuitStr.match(/\s+([A-Z])$/);
          if (partMatch) congregation.parte = partMatch[1];

          // Address & Coordinator from column 9 (Endereço completo)
          const fullAddress = row[9] || '';
          const addressLines = fullAddress.split('\n').map(l => l.trim()).filter(l => l !== '');
          
          // Try to find coordinator
          const coordLine = addressLines.find(l => l.startsWith('A/C'));
          if (coordLine) {
            congregation.coordenador = coordLine.replace('A/C', '').trim();
          }

          // Address components
          congregation.cidade = row[16] || '';
          congregation.estado = row[17] || '';
          congregation.cep = row[14] ? (row[15] ? `${row[14]}-${row[15]}` : row[14]) : '';
          
          // Fallback if basic columns are empty
          if (!congregation.cep && fullAddress.match(/\d{5}\s*-\s*\d{3}/)) {
            const cepMatch = fullAddress.match(/\d{5}\s*-\s*\d{3}/);
            if (cepMatch) congregation.cep = cepMatch[0];
          }

          const streetParts = [row[10], row[11], row[12], row[13]].filter(Boolean);
          congregation.endereco = streetParts.length > 0 ? streetParts.join(', ') : '';

          // Telefone
          const phone = row[21] || row[22] || row[23];
          if (phone) congregation.telefone = formatPhone(phone);

          if (congregation.nome && congregation.numero) {
            const docRef = doc(collection(db, 'congregations'));
            batch.set(docRef, congregation);
            importedCount++;
          }
        }

      } else {
        // Multi-line parser
        // Split entries based on the start of a record: "Name - City/UF (Number)" followed by "Congregação"
        const entries = bulkText.split(/\n(?=[^\n]+\s*-\s*[^\n]+\s*\(\d+\)\nCongregação)/g);
        
        for (const entry of entries) {
          const lines = entry.split('\n').map(l => l.trim()).filter(l => l !== '');
          if (lines.length < 5) continue;

          const congregation: Partial<Congregation & { userId: string }> = {
            userId,
            grupos: []
          };

          // 1. Process First Line: Name - City/UF (Number)
          const firstLine = lines[0];
          const firstLineMatch = firstLine.match(/^(.*?)\s*-\s*(.*?)\s*\((\d+)\)$/);
          if (firstLineMatch) {
            congregation.nome = firstLineMatch[1].trim();
            congregation.numero = firstLineMatch[3].trim();
            
            const cityStatePart = firstLineMatch[2].trim();
            // If it ends with 2 capital letters, that's likely the state
            const stateMatch = cityStatePart.match(/\s+([A-Z]{2})$/);
            if (stateMatch) {
              congregation.estado = stateMatch[1];
              congregation.cidade = cityStatePart.replace(stateMatch[0], '').trim();
            } else if (cityStatePart.length === 2 && cityStatePart === cityStatePart.toUpperCase()) {
              congregation.estado = cityStatePart;
              // City will be same as name if not specified otherwise
              congregation.cidade = congregation.nome;
            } else {
              congregation.cidade = cityStatePart;
            }
          }

          // 2. Anchor at "Correspondência"
          const corresIdx = lines.findIndex(l => l.toLowerCase() === 'correspondência');
          if (corresIdx !== -1) {
            // Line after Correspondência is usually (Number) Name - City/UF
            // Line after that is CCA (A/C ...)
            let scanIdx = corresIdx + 2; 
            
            // Find coordinator
            if (lines[scanIdx]?.startsWith('A/C')) {
              congregation.coordenador = lines[scanIdx].replace('A/C', '').trim();
              scanIdx++;
            }

            // Collect address parts until we find indicators of other blocks
            const addressParts: string[] = [];
            const labels = ['circuito', 'colih', 'celular (correspondência)', 'telefone 1', 'telefone 2', 'lista de distribuição'];
            
            while (scanIdx < lines.length) {
              const currentLine = lines[scanIdx];
              if (labels.includes(currentLine.toLowerCase())) break;

              // Identify special fields instead of address
              if (currentLine.match(/^\d{5}\s*-\s*\d{3}$/)) {
                congregation.cep = currentLine;
              } else if (currentLine.length === 2 && currentLine === currentLine.toUpperCase()) {
                congregation.estado = currentLine;
              } else if (currentLine === currentLine.toUpperCase() && currentLine.length > 2 && !currentLine.includes(',')) {
                congregation.cidade = currentLine;
              } else {
                addressParts.push(currentLine);
              }
              scanIdx++;
            }
            
            if (addressParts.length > 0) {
              congregation.endereco = addressParts.join(', ');
            }
          }

          // 3. Phone extraction fallback
          const findValue = (label: string) => {
            const idx = lines.findIndex(l => l.toLowerCase() === label.toLowerCase());
            return idx !== -1 ? lines[idx + 1] : null;
          };

          const phoneValue = findValue('Celular (correspondência)') || findValue('Telefone 1');
          if (phoneValue && !phoneValue.toLowerCase().includes('lista')) {
            congregation.telefone = formatPhone(phoneValue);
          }

          // 4. Circuit extraction
          const circuitValue = findValue('Circuito');
          if (circuitValue) {
            const partMatch = circuitValue.match(/\s+([A-Z])$/);
            if (partMatch) congregation.parte = partMatch[1];
          }

          if (congregation.nome && congregation.numero) {
            const docRef = doc(collection(db, 'congregations'));
            batch.set(docRef, congregation);
            importedCount++;
          }
        }
      }

      if (importedCount > 0) {
        await batch.commit();
        setShowBulkImport(false);
        setBulkText('');
        alert(`${importedCount} congregações importadas com sucesso!`);
      } else {
        alert('Nenhuma congregação válida encontrada para importação.');
      }
    } catch (error) {
      console.error('Erro na importação em massa:', error);
      alert('Erro ao importar dados. Verifique o formato do texto colado.');
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
                  <button 
                    onClick={handleAddNew}
                    className="w-full md:w-auto bg-amber-600 text-white px-6 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors shadow-lg shadow-amber-200 active:scale-95"
                  >
                    <Plus size={20} />
                    Nova Congregação
                  </button>
                  <button 
                    onClick={() => setShowBulkImport(true)}
                    className="w-full md:w-auto bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 active:scale-95"
                  >
                    <ClipboardPaste size={20} />
                    Importação em Massa
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
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(cong)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={16} />
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
                          className="py-2.5 text-xs font-bold text-amber-600 border border-amber-100 rounded-xl hover:bg-amber-600 hover:text-white transition-all"
                        >
                          Ver Detalhes
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
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
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

      {/* Bulk Import Modal */}
      <AnimatePresence>
        {showBulkImport && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[3000] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl flex flex-col gap-4 border border-indigo-100"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <ClipboardPaste size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-gray-800">Importação em Massa</h3>
                    <p className="text-xs text-indigo-500 font-bold uppercase tracking-widest">Cole seus dados do clipboard</p>
                  </div>
                </div>
                <button 
                  onClick={() => !isImporting && setShowBulkImport(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                >
                  <ChevronLeft className="rotate-90" size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
                  <Store className="text-amber-600 shrink-0" size={20} />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Copie e cole a lista de congregações no formato completo (incluindo número entre parênteses, endereços e coordenador). O sistema identificará automaticamente cada registro.
                  </p>
                </div>

                <textarea 
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="Cole aqui a lista de congregações..."
                  className="w-full h-80 p-4 text-xs bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-mono resize-none transition-all custom-scrollbar"
                />

                <div className="flex gap-3">
                  <button 
                    disabled={isImporting}
                    onClick={() => setShowBulkImport(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button 
                    disabled={isImporting || !bulkText.trim()}
                    onClick={handleBulkImport}
                    className="flex-3 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        <span>Processando Importação...</span>
                      </>
                    ) : (
                      <>
                        <Save size={20} />
                        <span>Confirmar Importação em Massa</span>
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
