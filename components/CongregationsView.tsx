'use client';

import { useState, useEffect, useMemo } from 'react';
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
  X,
  Phone,
  Mail,
  Clock,
  Shield,
  UserCheck,
  Globe,
  Crosshair,
  AlertTriangle,
  CheckCircle2,
  Sparkles
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
  circuito?: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  gps?: string;
  coordenador: string;
  telefone: string;
  coordenadorTelefone?: string;
  coordenadorEmail?: string;
  secretario?: string;
  secretarioTelefone?: string;
  secretarioEmail?: string;
  reuniaoMeioSemana?: string;
  reuniaoFimSemana?: string;
  reunioes?: string;
  idioma?: string;
  necessidadesRelatadas?: number | string;
  grupos: string[];
}

interface CongregationsViewProps {
  userId: string;
  isAdmin?: boolean;
  importEnabledForAll?: boolean;
  onBack: () => void;
  initialCongregation?: Congregation | null;
  userRole?: string;
}

const defaultFormData: Congregation = {
  id: '', 
  nome: '', 
  numero: '', 
  parte: 'A', 
  circuito: '',
  endereco: '', 
  cidade: '', 
  estado: '', 
  cep: '', 
  gps: '', 
  coordenador: '',
  telefone: '', 
  coordenadorTelefone: '',
  coordenadorEmail: '',
  secretario: '',
  secretarioTelefone: '',
  secretarioEmail: '',
  reuniaoMeioSemana: '',
  reuniaoFimSemana: '',
  reunioes: '',
  idioma: 'Português (Brasil)',
  necessidadesRelatadas: '0',
  grupos: []
};

export default function CongregationsView({ 
  userId, 
  isAdmin = false,
  importEnabledForAll = false, 
  onBack, 
  initialCongregation,
  userRole = 'viajante'
}: CongregationsViewProps) {
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [loading, setLoading] = useState(true);
  const isPioneer = userRole === 'pioneiro_especial' || userRole === 'pioneiro_regular';

  useEffect(() => {
    if (initialCongregation) {
      setSelectedCong(initialCongregation);
      const data = { ...defaultFormData, ...initialCongregation };
      setFormData(data);
      setInitialFormData(JSON.stringify(data));
      setIsEditing(true);
    }
  }, [initialCongregation]);

  useEffect(() => {
    const q = query(collection(db, 'congregations'), where('userId', '==', userId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const congsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          nome: data.nome || '',
          numero: data.numero ? String(data.numero) : '',
          cidade: data.cidade || '',
          estado: data.estado || '',
          endereco: data.endereco || '',
          coordenador: data.coordenador || '',
          telefone: data.telefone || data.coordenadorTelefone || '',
          coordenadorTelefone: data.coordenadorTelefone || data.telefone || '',
          coordenadorEmail: data.coordenadorEmail || '',
          secretario: data.secretario || '',
          secretarioTelefone: data.secretarioTelefone || '',
          secretarioEmail: data.secretarioEmail || '',
          reuniaoMeioSemana: data.reuniaoMeioSemana || '',
          reuniaoFimSemana: data.reuniaoFimSemana || '',
          reunioes: data.reunioes || '',
          circuito: data.circuito || '',
          idioma: data.idioma || 'Português (Brasil)',
          necessidadesRelatadas: data.necessidadesRelatadas ?? '0',
          cep: data.cep || '',
          parte: data.parte || 'A',
          gps: data.gps || '',
          grupos: data.grupos || []
        };
      }) as Congregation[];
      
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
  const [isExtractingGPS, setIsExtractingGPS] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<{
    type: 'success' | 'warning' | 'error';
    title: string;
    message: string;
    details?: string;
    precision?: 'street' | 'neighborhood' | 'postcode' | 'city' | 'unknown';
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<{ total: number; updated: number; created: number } | null>(null);
  
  const [formData, setFormData] = useState<Congregation>(defaultFormData);
  const [initialFormData, setInitialFormData] = useState<string>(JSON.stringify(defaultFormData));

  const hasChanges = useMemo(() => {
    if (!isEditing) return false;
    return JSON.stringify(formData) !== initialFormData;
  }, [isEditing, formData, initialFormData]);

  // Alerta ao sair com alterações não salvas
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

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

  const handleExtractGPS = async () => {
    const rawEndereco = formData.endereco?.trim() || '';
    const rawCidade = formData.cidade?.trim() || '';
    const rawEstado = formData.estado?.trim() || '';
    const rawCep = formData.cep?.replace(/\D/g, '') || '';

    if (!rawEndereco && !rawCidade && !rawCep) {
      setGpsStatus({
        type: 'error',
        title: 'Dados insuficientes',
        message: 'Preencha ao menos o Endereço, CEP ou Cidade/UF para buscar as coordenadas GPS.'
      });
      return;
    }

    setIsExtractingGPS(true);
    setGpsStatus(null);

    try {
      const queryNominatim = async (queryStr: string) => {
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(queryStr)}&limit=1`;
          const res = await fetch(url, {
            headers: {
              'Accept-Language': 'pt-BR,pt;q=0.9',
            }
          });
          if (!res.ok) return null;
          const data = await res.json();
          return Array.isArray(data) && data.length > 0 ? data[0] : null;
        } catch {
          return null;
        }
      };

      const candidates: { query: string; expectedPrecision: 'street' | 'postcode' | 'city' }[] = [];

      const cleanedAddress = rawEndereco
        .replace(/^(Salão do Reino|Salao do Reino|A\/C|Aos Cuidados)[\s\:\-]*/i, '')
        .trim();

      if (cleanedAddress && rawCidade) {
        candidates.push({
          query: [cleanedAddress, rawCidade, rawEstado, 'Brasil'].filter(Boolean).join(', '),
          expectedPrecision: 'street'
        });
        candidates.push({
          query: [cleanedAddress.split(',')[0], rawCidade, rawEstado, 'Brasil'].filter(Boolean).join(', '),
          expectedPrecision: 'street'
        });
        candidates.push({
          query: [cleanedAddress.split(',')[0], rawCidade, 'Brasil'].filter(Boolean).join(', '),
          expectedPrecision: 'street'
        });
      }

      if (rawCep && rawCidade) {
        candidates.push({
          query: [`CEP ${rawCep}`, rawCidade, rawEstado, 'Brasil'].filter(Boolean).join(', '),
          expectedPrecision: 'postcode'
        });
      }

      if (rawCidade) {
        candidates.push({
          query: [rawCidade, rawEstado, 'Brasil'].filter(Boolean).join(', '),
          expectedPrecision: 'city'
        });
      }

      let result = null;
      let matchedCandidate: (typeof candidates)[0] | null = null;

      for (const cand of candidates) {
        result = await queryNominatim(cand.query);
        if (result && result.lat && result.lon) {
          matchedCandidate = cand;
          break;
        }
      }

      if (!result || !result.lat || !result.lon) {
        setGpsStatus({
          type: 'error',
          title: 'Coordenadas não encontradas',
          message: 'Não foi possível localizar o endereço no mapa. Verifique se o nome da rua, número, cidade e estado estão corretos.'
        });
        return;
      }

      const lat = parseFloat(result.lat).toFixed(6);
      const lon = parseFloat(result.lon).toFixed(6);
      const newGps = `${lat}, ${lon}`;

      setFormData(prev => ({
        ...prev,
        gps: newGps
      }));

      const placeRank = result.place_rank ? parseInt(result.place_rank, 10) : 0;
      const type = (result.type || '').toLowerCase();
      const addresstype = (result.addresstype || '').toLowerCase();
      const displayName = result.display_name || '';

      const isHighPrecision = (
        matchedCandidate?.expectedPrecision === 'street' &&
        (placeRank >= 26 || ['house', 'building', 'road', 'street', 'residential', 'amenity'].includes(type) || ['house', 'building', 'road', 'street'].includes(addresstype))
      );

      const isMediumPrecision = (
        matchedCandidate?.expectedPrecision === 'postcode' ||
        placeRank >= 22 ||
        ['neighbourhood', 'suburb', 'postcode', 'quarter', 'hamlet', 'village'].includes(type) ||
        ['neighbourhood', 'suburb', 'postcode'].includes(addresstype)
      );

      if (isHighPrecision) {
        setGpsStatus({
          type: 'success',
          precision: 'street',
          title: 'GPS Localizado com Alta Precisão',
          message: 'Coordenadas obtidas no nível exato de logradouro/rua.',
          details: displayName
        });
      } else if (isMediumPrecision) {
        setGpsStatus({
          type: 'warning',
          precision: 'neighborhood',
          title: 'Atenção: GPS Aproximado (Nível de Bairro / CEP)',
          message: 'As coordenadas foram localizadas por bairro ou CEP. O ponto exato do Salão do Reino pode variar em algumas ruas. Recomendamos conferir no mapa.',
          details: displayName
        });
      } else {
        setGpsStatus({
          type: 'warning',
          precision: 'city',
          title: 'Atenção: GPS Incerto (Centro do Município)',
          message: `O endereço exato não foi encontrado no mapa. As coordenadas apontam para o centro de ${rawCidade || 'cidade'}. Recomendamos abrir o Google Maps e colar as coordenadas exatas.`,
          details: displayName
        });
      }

    } catch (error) {
      console.error('Erro na extração do GPS:', error);
      setGpsStatus({
        type: 'error',
        title: 'Falha na conexão',
        message: 'Ocorreu um erro ao consultar o serviço de geolocalização. Tente novamente em instantes.'
      });
    } finally {
      setIsExtractingGPS(false);
    }
  };

  const handleAddNew = () => {
    setSelectedCong(null);
    setFormData(defaultFormData);
    setInitialFormData(JSON.stringify(defaultFormData));
    setGpsStatus(null);
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
    const data = { ...defaultFormData, ...cong };
    setFormData(data);
    setInitialFormData(JSON.stringify(data));
    setGpsStatus(null);
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

  // Helper to split multi-congregation text into distinct blocks
  const splitCongregationBlocks = (rawText: string): string[] => {
    const lines = rawText.split(/\r?\n/);
    const blocks: string[] = [];
    let currentBlock: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Detect start of a congregation:
      // 1) Line containing '(12345)' e.g., "Alcantil - PB (170431)" or "Central - Campina Grande PB (14738)"
      // 2) Line starting with "Congregação"
      // 3) Line starting with "Correspondência"
      const isNewHeader = (
        /\(\d{4,7}\)/.test(trimmed) ||
        /^congregaç[aã]o/i.test(trimmed) ||
        /^correspond[eê]ncia/i.test(trimmed)
      );

      if (isNewHeader && currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'));
    }

    return blocks.filter(b => b.trim().length > 10);
  };

  // Comprehensive parser for a single congregation block
  const parseSingleCongregation = (block: string): Partial<Congregation> | null => {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
    if (lines.length === 0) return null;

    let nome = '';
    let numero = '';
    let parte = 'A';
    let circuito = '';
    let cidade = '';
    let estado = '';
    let endereco = '';
    let cep = '';
    let gps = '';
    let coordenador = '';
    let coordenadorTelefone = '';
    let coordenadorEmail = '';
    let secretario = '';
    let secretarioTelefone = '';
    let secretarioEmail = '';
    let reuniaoMeioSemana = '';
    let reuniaoFimSemana = '';
    let reunioes = '';
    let idioma = 'Português (Brasil)';
    let necessidadesRelatadas = '0';

    // 1. Extração do Número e Nome do Cabeçalho
    const headerLineIdx = lines.findIndex(l => /\(\d{4,7}\)/.test(l) || /Nº\s*\d{4,7}/i.test(l) || /^congregaç[aã]o/i.test(l));
    const headerLine = headerLineIdx !== -1 ? lines[headerLineIdx] : lines[0];

    const numMatch = headerLine.match(/\((\d{4,7})\)/) || block.match(/Nº\s*(\d{4,7})/i) || block.match(/\((\d{4,7})\)/);
    if (numMatch) {
      numero = numMatch[1];
    }

    if (headerLine) {
      let cleanHeader = headerLine.replace(/\(\d{4,7}\)/, '').replace(/^congregaç[aã]o\s+/i, '').trim();
      if (cleanHeader.includes(' - ')) {
        const [rawName, rest] = cleanHeader.split(' - ').map(s => s.trim());
        nome = rawName;
        if (rest) {
          const stateMatch = rest.match(/^(.*?)\s*([A-Z]{2})$/);
          if (stateMatch) {
            estado = stateMatch[2].toUpperCase();
            const cityCandidate = stateMatch[1].trim();
            cidade = cityCandidate ? cityCandidate.toUpperCase() : rawName.toUpperCase();
          } else {
            cidade = rest.toUpperCase();
          }
        }
      } else {
        nome = cleanHeader;
      }
    }

    // 2. Reuniões
    const reunioesIdx = lines.findIndex(l => /^reuni[oõ]es/i.test(l));
    if (reunioesIdx !== -1) {
      const meetingLines: string[] = [];
      for (let i = reunioesIdx + 1; i < lines.length && i < reunioesIdx + 6; i++) {
        const l = lines[i];
        if (/^idioma|^local de reuni|^endereço|^parte/i.test(l)) break;
        if (l.includes(':') || /feira|s[aá]bado|domingo/i.test(l)) {
          meetingLines.push(l);
        }
      }

      meetingLines.forEach(m => {
        if (/segunda|ter[cç]a|quarta|quinta|sexta/i.test(m)) {
          reuniaoMeioSemana = m;
        } else if (/s[aá]bado|domingo/i.test(m)) {
          reuniaoFimSemana = m;
        }
      });
      reunioes = meetingLines.join(' • ');
    }

    // 3. Idioma
    const idiomaIdx = lines.findIndex(l => /^idioma/i.test(l));
    if (idiomaIdx !== -1 && lines[idiomaIdx + 1] && !/^local|^parte|^coordenador/i.test(lines[idiomaIdx + 1])) {
      idioma = lines[idiomaIdx + 1];
    }

    // 4. Local de reuniões / Endereço / CEP / Cidade / Estado
    const localIdx = lines.findIndex(l => /^local de reuni|^endereço/i.test(l));
    if (localIdx !== -1) {
      const addrLines: string[] = [];
      for (let i = localIdx + 1; i < lines.length && i < localIdx + 8; i++) {
        const l = lines[i];
        if (/^parte de circuito|^circuito|^portugu[eê]s|^coordenador|^secret[aá]rio|^necessidades/i.test(l)) break;
        
        // CEP
        const cepMatch = l.match(/(\d{2}\.?\d{3}-?\d{3}|\d{5}-?\d{3}|\d{8})/);
        if (cepMatch) {
          const rawCepDigits = cepMatch[1].replace(/\D/g, '');
          if (rawCepDigits.length === 8) {
            cep = `${rawCepDigits.slice(0, 5)}-${rawCepDigits.slice(5)}`;
          }
          continue;
        }

        // Cidade, UF
        const cityUfMatch = l.match(/^([A-ZÀ-Úa-z\s\.\'\-]+),\s*([A-Z]{2})$/);
        if (cityUfMatch) {
          cidade = cityUfMatch[1].trim().toUpperCase();
          estado = cityUfMatch[2].trim().toUpperCase();
          continue;
        }

        addrLines.push(l);
      }

      if (addrLines.length > 0) {
        endereco = addrLines.join(', ');
      }
    }

    // Fallback de endereço por A/C
    const acIdx = lines.findIndex(l => l.toUpperCase().startsWith('A/C'));
    if (acIdx !== -1) {
      const coordName = lines[acIdx].replace(/A\/C[\s:]*/i, '').trim();
      if (!coordenador) coordenador = coordName;
      let lastAc = acIdx;
      while (lines[lastAc + 1]?.toUpperCase().startsWith('A/C')) lastAc++;
      if (!endereco && lines[lastAc + 1]) {
        endereco = lines[lastAc + 1];
      }
    }

    // Fallback para CEP
    if (!cep) {
      const cepGlobal = block.match(/(\d{2}\.?\d{3}-?\d{3}|\d{5}-?\d{3})/);
      if (cepGlobal) {
        const digits = cepGlobal[1].replace(/\D/g, '');
        if (digits.length === 8) {
          cep = `${digits.slice(0, 5)}-${digits.slice(5)}`;
        }
      }
    }

    // 5. Parte de circuito / Circuito
    const circIdx = lines.findIndex(l => /^parte de circuito|^circuito/i.test(l));
    if (circIdx !== -1 && lines[circIdx + 1]) {
      const circLine = lines[circIdx + 1];
      circuito = circLine;
      const parteMatch = circLine.match(/([A-C])$/i) || circLine.match(/Parte\s*([A-C])/i);
      if (parteMatch) {
        parte = parteMatch[1].toUpperCase();
      }
    } else {
      const pMatch = block.match(/Parte\s*([A-C])/i);
      if (pMatch) parte = pMatch[1].toUpperCase();
    }

    // 6. Coordenador
    const coordIdx = lines.findIndex(l => /^coordenador|^cca/i.test(l));
    if (coordIdx !== -1) {
      for (let i = coordIdx + 1; i < lines.length && i < coordIdx + 10; i++) {
        const l = lines[i];
        if (/^secret[aá]rio|^necessidades|^local/i.test(l)) break;

        if (/^nome/i.test(l)) {
          coordenador = l.replace(/^nome[:\s]*/i, '').trim();
        } else if (/^telefone|^celular/i.test(l)) {
          const rawTel = l.replace(/^telefone[:\s]*|^celular[:\s]*/i, '').trim();
          coordenadorTelefone = formatPhone(rawTel);
        } else if (/^e-?mail/i.test(l)) {
          coordenadorEmail = l.replace(/^e-?mail[:\s]*/i, '').trim();
        }
      }
    }

    // 7. Secretário
    const secIdx = lines.findIndex(l => /^secret[aá]rio|^sec/i.test(l));
    if (secIdx !== -1) {
      for (let i = secIdx + 1; i < lines.length && i < secIdx + 10; i++) {
        const l = lines[i];
        if (/^necessidades|^coordenador|^local/i.test(l)) break;

        if (/^nome/i.test(l)) {
          secretario = l.replace(/^nome[:\s]*/i, '').trim();
        } else if (/^telefone|^celular/i.test(l)) {
          const rawTel = l.replace(/^telefone[:\s]*|^celular[:\s]*/i, '').trim();
          secretarioTelefone = formatPhone(rawTel);
        } else if (/^e-?mail/i.test(l)) {
          secretarioEmail = l.replace(/^e-?mail[:\s]*/i, '').trim();
        }
      }
    }

    // 8. Necessidades relatadas
    const necIdx = lines.findIndex(l => /^necessidades relatadas/i.test(l));
    if (necIdx !== -1 && lines[necIdx + 1]) {
      necessidadesRelatadas = lines[necIdx + 1].trim();
    }

    // 9. GPS
    const gpsMatch = block.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)|(-?\d+\.\d+)\s+(-?\d+\.\d+)/);
    if (gpsMatch) {
      gps = gpsMatch[1] && gpsMatch[2] ? `${gpsMatch[1]}, ${gpsMatch[2]}` : `${gpsMatch[3]}, ${gpsMatch[4]}`;
    }

    if (!nome && !numero) return null;

    return {
      nome: nome || `Congregação ${numero}`,
      numero: numero || '',
      parte: parte || 'A',
      circuito: circuito || '',
      endereco: endereco || '',
      cidade: cidade || '',
      estado: estado || '',
      cep: cep || '',
      gps: gps || '',
      coordenador: coordenador || '',
      telefone: coordenadorTelefone || '',
      coordenadorTelefone: coordenadorTelefone || '',
      coordenadorEmail: coordenadorEmail || '',
      secretario: secretario || '',
      secretarioTelefone: secretarioTelefone || '',
      secretarioEmail: secretarioEmail || '',
      reuniaoMeioSemana: reuniaoMeioSemana || '',
      reuniaoFimSemana: reuniaoFimSemana || '',
      reunioes: reunioes || '',
      idioma: idioma || 'Português (Brasil)',
      necessidadesRelatadas: necessidadesRelatadas || '0',
      grupos: []
    };
  };

  const normalizeCongName = (name: string) => {
    return (name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^(congrega[cç][aã]o|congregacao|cong\.?)\s+/i, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  const handlePasteData = () => {
    if (!pasteText.trim()) return;
    const parsed = parseSingleCongregation(pasteText);
    if (parsed) {
      const normNum = parsed.numero ? parsed.numero.replace(/\D/g, '') : '';
      const normName = parsed.nome ? normalizeCongName(parsed.nome) : '';

      // Tenta encontrar congregação existente por número ou por nome normalizado
      const existing = congregations.find(c => {
        const cNum = c.numero ? c.numero.replace(/\D/g, '') : '';
        const cName = c.nome ? normalizeCongName(c.nome) : '';
        if (normNum && cNum && normNum === cNum) return true;
        if (normName && cName && normName === cName) return true;
        return false;
      });

      if (existing && !selectedCong) {
        setSelectedCong(existing);
      }

      setFormData(prev => {
        const base = existing || prev;
        return {
          ...base,
          ...parsed,
          // Preserva grupos existentes se a congregação já tinha grupos configurados
          grupos: (existing?.grupos && existing.grupos.length > 0) 
            ? existing.grupos 
            : (prev.grupos.length > 0 ? prev.grupos : (parsed.grupos || [])),
          // Preserva GPS se o parsed não tiver GPS mas já existia
          gps: parsed.gps ? parsed.gps : (base.gps || '')
        };
      });
    }
    setIsPasting(false);
    setPasteText('');
  };

  const handleBulkImport = async () => {
    if (!importText.trim()) return;
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const blocks = splitCongregationBlocks(importText);
      
      if (blocks.length === 0) {
        setImportError('Nenhum dado de congregação identificado. Certifique-se de copiar as congregações no formato do JW.org ou Hub.');
        setIsImporting(false);
        return;
      }

      // Buscar congregações existentes do usuário para atualizar ao invés de duplicar
      const existingSnapshot = await getDocs(query(collection(db, 'congregations'), where('userId', '==', userId)));
      const existingByNumero = new Map<string, { id: string; data: Record<string, any> }>();
      const existingByNome = new Map<string, { id: string; data: Record<string, any> }>();

      existingSnapshot.docs.forEach(d => {
        const data = d.data();
        const num = data.numero ? String(data.numero).replace(/\D/g, '').trim() : '';
        const normName = data.nome ? normalizeCongName(data.nome) : '';

        if (num) existingByNumero.set(num, { id: d.id, data });
        if (normName) existingByNome.set(normName, { id: d.id, data });
      });

      const batch = writeBatch(db);
      let updatedCount = 0;
      let createdCount = 0;

      for (const block of blocks) {
        const parsed = parseSingleCongregation(block);
        if (!parsed || (!parsed.nome && !parsed.numero)) continue;

        const numKey = parsed.numero ? String(parsed.numero).replace(/\D/g, '').trim() : '';
        const nameKey = parsed.nome ? normalizeCongName(parsed.nome) : '';

        const existingMatch = (numKey && existingByNumero.get(numKey)) || (nameKey && existingByNome.get(nameKey));

        let docRef;
        let dataToSave: Record<string, any>;

        if (existingMatch) {
          // Atualiza congregação existente mantendo dados customizados não presentes no bloco (como grupos ou GPS prévio)
          docRef = doc(db, 'congregations', existingMatch.id);
          const existingData = existingMatch.data;

          const updatedFields: Record<string, any> = {};
          (Object.keys(parsed) as (keyof typeof parsed)[]).forEach(key => {
            const val = parsed[key];
            if (key === 'grupos') {
              if (Array.isArray(val) && val.length > 0) {
                updatedFields[key] = val;
              }
            } else if (typeof val === 'string') {
              if (val.trim() !== '') {
                updatedFields[key] = val;
              }
            } else if (val !== undefined && val !== null) {
              updatedFields[key] = val;
            }
          });

          dataToSave = {
            ...existingData,
            ...updatedFields,
            userId,
            updatedAt: new Date()
          };

          // Atualiza cache local para processar blocos repetidos no mesmo import
          if (numKey) existingByNumero.set(numKey, { id: existingMatch.id, data: dataToSave });
          if (nameKey) existingByNome.set(nameKey, { id: existingMatch.id, data: dataToSave });

          batch.set(docRef, dataToSave, { merge: true });
          updatedCount++;
        } else {
          // Cria nova congregação
          docRef = doc(collection(db, 'congregations'));
          dataToSave = {
            ...parsed,
            userId,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          if (numKey) existingByNumero.set(numKey, { id: docRef.id, data: dataToSave });
          if (nameKey) existingByNome.set(nameKey, { id: docRef.id, data: dataToSave });

          batch.set(docRef, dataToSave);
          createdCount++;
        }
      }

      const totalProcessed = updatedCount + createdCount;

      if (totalProcessed > 0) {
        await batch.commit();
        setImportSuccess({
          total: totalProcessed,
          updated: updatedCount,
          created: createdCount
        });
        setImportText('');
        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportSuccess(null);
        }, 2500);
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

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!formData.nome.trim() || !formData.numero.trim()) {
      alert('Por favor, preencha ao menos o Nome e o Número da congregação.');
      return;
    }

    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
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
          className="p-1.5 hover:bg-gray-100 rounded-full transition-all text-amber-600 bg-white shadow-md border border-gray-200"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={22} strokeWidth={3} />
        </button>
        <h2 className="text-xl font-bold text-gray-800">
          {isPioneer ? 'Dados da Congregação' : 'Gestão de Congregações'}
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
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors"
                  />
                </div>
                <div className="flex bg-gray-100 p-0.5 rounded-lg">
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    title="Ver Lista"
                  >
                    <List size={18} />
                  </button>
                  <button 
                    onClick={() => setViewMode('map')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'map' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    title="Ver Mapa"
                  >
                    <MapIcon size={18} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                <a 
                  href="https://hub.jw.org/meetings/pt?q=%7B%22meetingType%22:%22meetings%22,%22location%22:%22Sua%20localiza%C3%A7%C3%A3o%22%7D"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full md:w-auto bg-white text-amber-600 border border-amber-200 px-4 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors shadow-sm"
                >
                  <ExternalLink size={16} />
                  JW.ORG
                </a>
                {(isAdmin || importEnabledForAll) && !isPioneer && (
                  <button 
                    onClick={() => setIsImportModalOpen(true)}
                    className="w-full md:w-auto bg-white text-amber-600 border border-amber-200 px-4 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors shadow-sm"
                  >
                    <ClipboardPaste size={16} />
                    IMPORTAR
                  </button>
                )}
                <button 
                  onClick={handleAddNew}
                  disabled={isPioneer && congregations.length > 0}
                  className="w-full md:w-auto bg-amber-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors shadow-lg shadow-amber-200 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                >
                  <Plus size={16} />
                  {isPioneer ? 'CONFIRMAR' : 'NOVA'}
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
                      className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-amber-500/5 transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300 shadow-inner shrink-0">
                              <Store size={20} />
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900 leading-tight">{cong.nome}</h3>
                              <p className="text-xs text-gray-500 font-mono">
                                Nº {cong.numero} • Parte {cong.parte}
                                {cong.circuito ? ` • ${cong.circuito}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setSelectedCong(cong);
                                setShowLetter(true);
                              }}
                              className="p-1.5 text-[#512da8] hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Carta de Designação"
                            >
                              <FileText size={16} />
                            </button>
                            <button 
                              onClick={() => setShowDeleteConfirm(cong.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-xs text-gray-600 border-t border-gray-50 pt-3">
                          <div className="flex items-center gap-2">
                            <MapPin size={13} className="text-gray-400 shrink-0" />
                            <span className="truncate">{cong.cidade || 'Cidade não informada'}{cong.estado ? ` - ${cong.estado}` : ''}</span>
                          </div>

                          {/* Reuniões */}
                          {(cong.reuniaoMeioSemana || cong.reuniaoFimSemana || cong.reunioes) && (
                            <div className="flex items-start gap-2 bg-amber-50/50 p-2 rounded-lg text-amber-900">
                              <Clock size={13} className="text-amber-600 shrink-0 mt-0.5" />
                              <div className="text-[11px] leading-tight space-y-0.5">
                                {cong.reuniaoMeioSemana && <div>{cong.reuniaoMeioSemana}</div>}
                                {cong.reuniaoFimSemana && <div>{cong.reuniaoFimSemana}</div>}
                                {!cong.reuniaoMeioSemana && !cong.reuniaoFimSemana && cong.reunioes && (
                                  <div>{cong.reunioes}</div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Coordenador */}
                          <div className="flex items-start gap-2">
                            <User size={13} className="text-amber-600 shrink-0 mt-0.5" />
                            <div className="truncate text-[11px]">
                              <span className="font-semibold text-gray-700">CCA: </span>
                              <span>{cong.coordenador || 'Não informado'}</span>
                              {(cong.coordenadorTelefone || cong.telefone) && (
                                <span className="text-gray-400 ml-1">({cong.coordenadorTelefone || cong.telefone})</span>
                              )}
                            </div>
                          </div>

                          {/* Secretário */}
                          {cong.secretario && (
                            <div className="flex items-start gap-2">
                              <UserCheck size={13} className="text-indigo-600 shrink-0 mt-0.5" />
                              <div className="truncate text-[11px]">
                                <span className="font-semibold text-gray-700">Sec: </span>
                                <span>{cong.secretario}</span>
                                {cong.secretarioTelefone && (
                                  <span className="text-gray-400 ml-1">({cong.secretarioTelefone})</span>
                                )}
                              </div>
                            </div>
                          )}

                          {cong.gps ? (
                            <div className="flex items-center gap-2">
                              <MapPin size={13} className="text-amber-500 shrink-0" />
                              <span className="text-[11px] font-mono text-amber-600 truncate">{cong.gps}</span>
                            </div>
                          ) : null}

                          {cong.grupos && cong.grupos.length > 0 && (
                            <div className="flex items-center gap-2 text-gray-500">
                              <Users size={13} className="text-gray-400 shrink-0" />
                              <span className="text-[11px]">{cong.grupos.length} Grupo(s)</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100">
                        <button 
                          onClick={() => handleEdit(cong)}
                          className="py-2 text-xs font-bold text-amber-600 border border-amber-100 rounded-xl hover:bg-amber-600 hover:text-white transition-all flex items-center justify-center gap-1.5"
                        >
                          <Edit2 size={13} />
                          Editar
                        </button>
                        <button 
                          onClick={() => handleNavigate(cong)}
                          className="py-2 text-xs font-bold text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-1.5"
                        >
                          <Navigation size={13} />
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
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-4 sm:p-5 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 bg-white/15 hover:bg-white/25 rounded-lg transition-all text-white flex items-center justify-center cursor-pointer"
                  title="Voltar para a lista"
                >
                  <ChevronLeft size={18} />
                </button>
                <h3 className="font-bold text-base sm:text-lg">
                  {selectedCong ? 'Editar Congregação' : 'Nova Congregação'}
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                {!selectedCong && (
                  <button 
                    type="button"
                    onClick={() => setIsPasting(true)}
                    className="flex items-center gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
                  >
                    <ClipboardPaste size={14} />
                    <span>Colar Dados</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 bg-white/15 hover:bg-white/25 rounded-lg transition-all text-white flex items-center justify-center cursor-pointer"
                  title="Fechar edição"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <form id="congregation-form" onSubmit={handleSave} className="p-6 space-y-6 pb-28">
              {isPasting && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-blue-800 uppercase">Cole os dados da congregação</h4>
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
                    placeholder="Cole aqui o texto da congregação (com Reuniões, Coordenador, Secretário, etc.)..."
                    className="w-full h-36 p-3 text-xs bg-white border border-blue-200 rounded-lg outline-none focus:border-blue-500 font-mono"
                  />
                  <button 
                    type="button"
                    onClick={handlePasteData}
                    className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                  >
                    Processar e Preencher Automaticamente
                  </button>
                </div>
              )}

              {/* Seção 1: Dados Gerais e Reuniões */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider border-b border-gray-100 pb-2">
                  1. Informações Básicas e Circuito
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-5 space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Nome da Congregação</label>
                    <input 
                      required
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors text-sm"
                      placeholder="Ex: Alcantil"
                    />
                  </div>

                  <div className="md:col-span-3 space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Número</label>
                    <input 
                      required
                      value={formData.numero}
                      onChange={(e) => setFormData({...formData, numero: e.target.value.replace(/\D/g, '').slice(0, 7)})}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors text-sm font-mono"
                      placeholder="170431"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Parte</label>
                    <input 
                      value={formData.parte}
                      onChange={(e) => setFormData({...formData, parte: e.target.value.toUpperCase().slice(0, 1)})}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors text-center font-bold text-sm"
                      placeholder="A"
                      maxLength={1}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Circuito</label>
                    <input 
                      value={formData.circuito || ''}
                      onChange={(e) => setFormData({...formData, circuito: e.target.value.toUpperCase()})}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors text-sm font-mono"
                      placeholder="PB-003 A"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                      <Clock size={14} className="text-amber-600" />
                      Reunião Meio de Semana
                    </label>
                    <input 
                      value={formData.reuniaoMeioSemana || ''}
                      onChange={(e) => setFormData({...formData, reuniaoMeioSemana: e.target.value})}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors text-sm"
                      placeholder="Ex: Terça-feira, 19:00"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                      <Clock size={14} className="text-amber-600" />
                      Reunião Fim de Semana
                    </label>
                    <input 
                      value={formData.reuniaoFimSemana || ''}
                      onChange={(e) => setFormData({...formData, reuniaoFimSemana: e.target.value})}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors text-sm"
                      placeholder="Ex: Sábado, 17:00 ou Domingo, 09:30"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 2: Localização e Endereço */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider border-b border-gray-100 pb-2">
                  2. Local de Reuniões e Endereço
                </h4>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Endereço Completo</label>
                  <input 
                    value={formData.endereco}
                    onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors text-sm"
                    placeholder="Rua / Avenida, Número, Bairro"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">CEP</label>
                    <div className="relative">
                      <input 
                        value={formData.cep}
                        onChange={(e) => setFormData({...formData, cep: formatCEP(e.target.value)})}
                        onBlur={handleCEPSearch}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors pr-8 text-sm font-mono"
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

                  <div className="md:col-span-6 space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Cidade</label>
                    <input 
                      value={formData.cidade}
                      onChange={(e) => setFormData({...formData, cidade: e.target.value.toUpperCase()})}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors text-sm uppercase"
                      placeholder="CIDADE"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">UF</label>
                    <input 
                      value={formData.estado}
                      onChange={(e) => setFormData({...formData, estado: e.target.value.toUpperCase().replace(/[^A-Z]/g, '')})}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors text-center font-bold text-sm uppercase"
                      placeholder="PB"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="space-y-2 bg-amber-50/30 p-3.5 rounded-xl border border-amber-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                      <MapPin size={14} className="text-amber-600" />
                      Coordenadas GPS (Latitude, Longitude)
                    </label>
                    
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExtractGPS}
                        disabled={isExtractingGPS}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                        title="Extrair latitude e longitude a partir do endereço, CEP e cidade"
                      >
                        {isExtractingGPS ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Buscando GPS...</span>
                          </>
                        ) : (
                          <>
                            <Crosshair size={13} />
                            <span>Extrair GPS do Endereço</span>
                          </>
                        )}
                      </button>

                      {formData.gps && (
                        <button
                          type="button"
                          onClick={() => {
                            const gpsValue = formData.gps || '';
                            let coords = gpsValue.replace(/\s+/g, ',');
                            if (gpsValue.includes(',')) coords = gpsValue;
                            window.open(`https://www.google.com/maps?q=${encodeURIComponent(coords)}`, '_blank');
                          }}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                          title="Abrir e conferir localização no Google Maps"
                        >
                          <ExternalLink size={12} />
                          <span>Ver no Maps</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <input 
                    value={formData.gps || ''}
                    onChange={(e) => {
                      setFormData({...formData, gps: e.target.value});
                      if (gpsStatus) setGpsStatus(null);
                    }}
                    className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors text-sm font-mono"
                    placeholder="Ex: -7.743120, -35.981240"
                  />

                  {/* Alerta de Incerteza / Sucesso / Erro do GPS */}
                  {gpsStatus && (
                    <div 
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                        gpsStatus.type === 'success' 
                          ? 'bg-green-50 border-green-200 text-green-800' 
                          : gpsStatus.type === 'warning'
                          ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm'
                          : 'bg-red-50 border-red-200 text-red-800'
                      }`}
                    >
                      {gpsStatus.type === 'success' ? (
                        <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
                      ) : gpsStatus.type === 'warning' ? (
                        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <X size={18} className="text-red-600 shrink-0 mt-0.5" />
                      )}
                      
                      <div className="flex-1 space-y-1">
                        <div className="font-bold flex items-center justify-between gap-2">
                          <span>{gpsStatus.title}</span>
                          {gpsStatus.precision && (
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                              gpsStatus.precision === 'street' 
                                ? 'bg-green-200 text-green-800' 
                                : 'bg-amber-200 text-amber-900'
                            }`}>
                              {gpsStatus.precision === 'street' ? 'Alta Certeza' : gpsStatus.precision === 'city' ? 'Incerto (Cidade)' : 'Aproximado (Bairro/CEP)'}
                            </span>
                          )}
                        </div>
                        <p className="leading-relaxed">{gpsStatus.message}</p>
                        {gpsStatus.details && (
                          <p className="text-[11px] text-gray-500 font-mono truncate max-w-full">
                            📍 {gpsStatus.details}
                          </p>
                        )}
                        {gpsStatus.type === 'warning' && (
                          <div className="pt-1 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (formData.gps) {
                                  window.open(`https://www.google.com/maps?q=${encodeURIComponent(formData.gps)}`, '_blank');
                                }
                              }}
                              className="text-xs font-bold text-amber-900 underline hover:text-amber-950 flex items-center gap-1"
                            >
                              <ExternalLink size={12} />
                              Conferir ponto no Google Maps
                            </button>
                          </div>
                        )}
                      </div>

                      <button 
                        type="button" 
                        onClick={() => setGpsStatus(null)}
                        className="text-gray-400 hover:text-gray-600 p-0.5"
                        title="Fechar aviso"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Seção 3: Anciãos de Contato (Coordenador e Secretário) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider border-b border-gray-100 pb-2">
                  3. Anciãos de Contato
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Coordenador */}
                  <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-3">
                    <div className="flex items-center gap-2 pb-1 border-b border-amber-200/50">
                      <User size={16} className="text-amber-600" />
                      <h5 className="text-xs font-bold text-amber-900 uppercase">
                        Coordenador do Corpo de Anciãos (CCA)
                      </h5>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Nome Completo</label>
                      <input 
                        value={formData.coordenador}
                        onChange={(e) => setFormData({...formData, coordenador: e.target.value})}
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-amber-500 text-xs"
                        placeholder="Nome do Coordenador"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                        <Phone size={11} className="text-gray-400" /> Telefone / WhatsApp
                      </label>
                      <input 
                        value={formData.coordenadorTelefone || formData.telefone || ''}
                        onChange={(e) => {
                          const val = formatPhone(e.target.value);
                          setFormData({
                            ...formData, 
                            telefone: val,
                            coordenadorTelefone: val
                          });
                        }}
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-amber-500 text-xs font-mono"
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                        <Mail size={11} className="text-gray-400" /> E-mail (JWPub)
                      </label>
                      <input 
                        value={formData.coordenadorEmail || ''}
                        onChange={(e) => setFormData({...formData, coordenadorEmail: e.target.value.trim()})}
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-amber-500 text-xs font-mono"
                        placeholder="nome@jwpub.org"
                      />
                    </div>
                  </div>

                  {/* Secretário */}
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
                    <div className="flex items-center gap-2 pb-1 border-b border-indigo-200/50">
                      <UserCheck size={16} className="text-indigo-600" />
                      <h5 className="text-xs font-bold text-indigo-900 uppercase">
                        Secretário
                      </h5>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Nome Completo</label>
                      <input 
                        value={formData.secretario || ''}
                        onChange={(e) => setFormData({...formData, secretario: e.target.value})}
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-500 text-xs"
                        placeholder="Nome do Secretário"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                        <Phone size={11} className="text-gray-400" /> Telefone / WhatsApp
                      </label>
                      <input 
                        value={formData.secretarioTelefone || ''}
                        onChange={(e) => setFormData({...formData, secretarioTelefone: formatPhone(e.target.value)})}
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-500 text-xs font-mono"
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                        <Mail size={11} className="text-gray-400" /> E-mail (JWPub)
                      </label>
                      <input 
                        value={formData.secretarioEmail || ''}
                        onChange={(e) => setFormData({...formData, secretarioEmail: e.target.value.trim()})}
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-500 text-xs font-mono"
                        placeholder="nome@jwpub.org"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 4: Grupos e Pré-grupos */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                    4. Grupos e Pré-grupos
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
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors pr-8 text-xs"
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

            </form>

            {/* Floating Save Bar (só aparece se houver alterações não salvas) */}
            <AnimatePresence>
              {hasChanges && (
                <motion.div 
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 40 }}
                  className="fixed bottom-6 portrait:bottom-20 landscape:bottom-6 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1002] bg-gray-950/95 text-white backdrop-blur-lg px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 sm:gap-6 border border-white/15 max-w-[calc(100vw-1.5rem)] w-auto no-print"
                >
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs sm:text-sm font-semibold text-gray-200 whitespace-nowrap">
                        Alterações não salvas
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                        {formData.nome ? formData.nome : 'Nova Congregação'} {formData.numero ? `• Nº ${formData.numero}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedCong) {
                          setFormData(JSON.parse(initialFormData));
                        } else {
                          setIsEditing(false);
                        }
                      }}
                      disabled={isSaving}
                      className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {selectedCong ? 'Descartar' : 'Cancelar'}
                    </button>
                    <button
                      type="submit"
                      form="congregation-form"
                      disabled={isSaving}
                      className="px-3.5 sm:px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 size={15} className="animate-spin shrink-0" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <>
                          <Save size={15} className="shrink-0" />
                          <span>Salvar</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                    <p className="text-xs text-white/80">Importe dados de congregações com Coordenador, Secretário e Reuniões</p>
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
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 space-y-2">
                  <h4 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                    <ClipboardPaste size={16} /> Suporta formatos JW.org / Hub:
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Extrai automaticamente: <strong>Nome, Número, Parte, Circuito, Reuniões, Endereço, Cidade, UF, CEP, Coordenador (Nome, Tel, Email) e Secretário (Nome, Tel, Email)</strong>.<br />
                    Se a congregação já existir no banco de dados (pelo número ou nome), ela será <strong>atualizada automaticamente</strong>, preservando dados anteriores (como coordenadas GPS e grupos).
                  </p>
                </div>

                <textarea 
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Cole aqui os dados das congregações..."
                  className="w-full h-64 p-4 text-xs bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all font-mono"
                />

                {importError && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                    {importError}
                  </div>
                )}

                {importSuccess && (
                  <div className="p-4 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm font-bold flex items-center gap-3 animate-in zoom-in">
                    <div className="w-7 h-7 bg-green-500 text-white rounded-full flex items-center justify-center shrink-0 shadow-sm">✓</div>
                    <div>
                      <p>{importSuccess.total} congregação(ões) processada(s) com sucesso!</p>
                      <p className="text-xs font-normal text-green-800">
                        {importSuccess.updated > 0 && `${importSuccess.updated} atualizada(s)`}
                        {importSuccess.updated > 0 && importSuccess.created > 0 && ' • '}
                        {importSuccess.created > 0 && `${importSuccess.created} nova(s) cadastrada(s)`}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 pt-2">
                  <button 
                    onClick={() => setIsImportModalOpen(false)}
                    className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all text-sm"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleBulkImport}
                    disabled={isImporting || !importText.trim()}
                    className="flex-3 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 text-sm"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
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
