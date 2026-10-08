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
  loading: () => <div className="h-[600px] w-full bg-surface-200 animate-pulse rounded-2xl flex items-center justify-center text-typography-400">Carregando Mapa...</div>
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
import { useDialog } from '@/hooks/useDialog';

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
  emailJWPub?: string;
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
  emailJWPub: '',
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
  const { showAlert, showConfirm, showDeleteConfirm } = useDialog();
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
          emailJWPub: data.emailJWPub || '',
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
      showAlert('Congregação excluída com sucesso.', 'Sucesso');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'congregations');
    }
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
    let emailJWPub = '';
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

    // 10. E-mail da Congregação (Geral)
    const allEmails = block.match(/[a-zA-Z0-9._%+-]+@jwpub\.org/g);
    if (allEmails) {
      // Pega o primeiro e-mail jwpub que não seja do coordenador ou secretário
      const congEmail = allEmails.find(email => 
        email !== coordenadorEmail && email !== secretarioEmail
      );
      if (congEmail) emailJWPub = congEmail;
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
      emailJWPub: emailJWPub || '',
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
      showAlert('Por favor, preencha ao menos o Nome e o Número da congregação.', 'Campos Obrigatórios');
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
          className="p-2 hover:bg-surface-200 rounded-xl transition-all text-typography-700 bg-surface-100 shadow-xs border border-surface-300"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <h2 className="text-xl font-bold text-typography-900 tracking-tight">
          {isPioneer ? 'Dados da Congregação' : 'Gestão de Congregações'}
        </h2>
      </div>

      <AnimatePresence mode="wait">
        {!isEditing ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="space-y-4"
          >
            {/* Search and Add Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-surface-100 p-3 sm:p-4 rounded-2xl shadow-xs border border-surface-300 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-transparent opacity-85" />
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-typography-400" size={16} />
                  <input 
                    type="text"
                    placeholder="Buscar congregação ou número..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-surface-200 border border-surface-300 rounded-xl text-xs text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors"
                  />
                </div>
                <div className="flex bg-surface-200 p-1 rounded-xl border border-surface-300/50">
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-surface-100 text-primary-200 shadow-xs font-semibold' : 'text-typography-500 hover:text-typography-800'}`}
                    title="Ver Lista"
                  >
                    <List size={18} />
                  </button>
                  <button 
                    onClick={() => setViewMode('map')}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === 'map' ? 'bg-surface-100 text-primary-200 shadow-xs font-semibold' : 'text-typography-500 hover:text-typography-800'}`}
                    title="Ver Mapa"
                  >
                    <MapIcon size={18} />
                  </button>
                </div>
              </div>
              <div className="flex flex-row gap-2 w-full md:w-auto items-center overflow-x-auto pb-1 sm:pb-0">
                <a 
                  href="https://hub.jw.org/meetings/pt?q=%7B%22meetingType%22:%22meetings%22,%22location%22:%22Sua%20localiza%C3%A7%C3%A3o%22%7D"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-surface-100 text-typography-700 hover:text-primary-200 hover:bg-surface-200 border border-surface-300 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs whitespace-nowrap shrink-0"
                >
                  <ExternalLink size={15} className="shrink-0" />
                  <span>JW.ORG</span>
                </a>
                {(isAdmin || importEnabledForAll) && !isPioneer && (
                  <button 
                    onClick={() => setIsImportModalOpen(true)}
                    className="bg-surface-100 text-typography-700 hover:text-primary-200 hover:bg-surface-200 border border-surface-300 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ClipboardPaste size={15} className="shrink-0" />
                    <span>Importar</span>
                  </button>
                )}
                <button 
                  onClick={handleAddNew}
                  disabled={isPioneer && congregations.length > 0}
                  className="bg-primary-200 hover:bg-primary-150 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus size={16} className="shrink-0" />
                  <span>{isPioneer ? 'Confirmar' : 'Nova'}</span>
                </button>
              </div>
            </div>

            {/* List or Map Grid */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-primary-200" size={40} />
              </div>
            ) : viewMode === 'map' ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="bg-surface-100 p-2 rounded-2xl shadow-xs border border-surface-300 h-[600px] overflow-hidden">
                  <CongregationsMap 
                    congregations={filteredCongregations} 
                    onEdit={(cong) => handleEdit(cong)}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-typography-500 bg-surface-200/60 p-3 rounded-xl border border-surface-300/50">
                  <MapPin size={14} className="text-primary-200 shrink-0" />
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
                      className="bg-surface-100 p-4 sm:p-5 rounded-2xl shadow-xs border border-surface-300 hover:border-amber-500/40 hover:shadow-md transition-all group flex flex-col justify-between relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-transparent opacity-85 group-hover:opacity-100 transition-opacity" />
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 group-hover:scale-105 transition-transform duration-200 shrink-0">
                              <Store size={19} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base text-typography-900 leading-snug group-hover:text-primary-200 transition-colors truncate">
                                {cong.nome}
                              </h3>
                              <p className="text-xs text-typography-500 font-mono">
                                Nº {cong.numero} • Parte {cong.parte}
                                {cong.circuito ? ` • ${cong.circuito}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                            <button 
                              onClick={() => {
                                setSelectedCong(cong);
                                setShowLetter(true);
                              }}
                              className="p-1.5 text-typography-400 hover:text-primary-200 hover:bg-surface-200 rounded-lg transition-colors"
                              title="Carta de Designação"
                            >
                              <FileText size={16} />
                            </button>
                            <button 
                              onClick={async () => {
                                const confirmed = await showDeleteConfirm('Tem certeza que deseja excluir esta congregação? Esta ação não pode ser desfeita.', 'Excluir Congregação');
                                if (confirmed) {
                                  handleDelete(cong.id);
                                }
                              }}
                              className="p-1.5 text-typography-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-xs text-typography-600 border-t border-surface-300/80 pt-3">
                          <div className="flex items-center gap-2">
                            <MapPin size={13} className="text-typography-400 shrink-0" />
                            <span className="truncate">{cong.cidade || 'Cidade não informada'}{cong.estado ? ` - ${cong.estado}` : ''}</span>
                          </div>

                          {cong.emailJWPub && (
                            <div className="flex items-center gap-2 text-primary-200 font-medium">
                              <Mail size={13} className="shrink-0" />
                              <span className="truncate">{cong.emailJWPub}</span>
                            </div>
                          )}

                          {/* Reuniões */}
                          {(cong.reuniaoMeioSemana || cong.reuniaoFimSemana || cong.reunioes) && (
                            <div className="flex items-start gap-2 bg-surface-200/70 border border-surface-300/50 p-2.5 rounded-xl text-typography-800">
                              <Clock size={13} className="text-primary-200 shrink-0 mt-0.5" />
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
                            <User size={13} className="text-primary-200 shrink-0 mt-0.5" />
                            <div className="truncate text-[11px]">
                              <span className="font-semibold text-typography-700">CCA: </span>
                              <span>{cong.coordenador || 'Não informado'}</span>
                              {(cong.coordenadorTelefone || cong.telefone) && (
                                <span className="text-typography-400 ml-1">({cong.coordenadorTelefone || cong.telefone})</span>
                              )}
                            </div>
                          </div>

                          {/* Secretário */}
                          {cong.secretario && (
                            <div className="flex items-start gap-2">
                              <UserCheck size={13} className="text-primary-200 shrink-0 mt-0.5" />
                              <div className="truncate text-[11px]">
                                <span className="font-semibold text-typography-700">Sec: </span>
                                <span>{cong.secretario}</span>
                                {cong.secretarioTelefone && (
                                  <span className="text-typography-400 ml-1">({cong.secretarioTelefone})</span>
                                )}
                              </div>
                            </div>
                          )}

                          {cong.gps ? (
                            <div className="flex items-center gap-2">
                              <MapPin size={13} className="text-primary-200 shrink-0" />
                              <span className="text-[11px] font-mono text-typography-600 bg-surface-200 px-2 py-0.5 rounded-md border border-surface-300/50 truncate">{cong.gps}</span>
                            </div>
                          ) : null}

                          {cong.grupos && cong.grupos.length > 0 && (
                            <div className="flex items-center gap-2 text-typography-500">
                              <Users size={13} className="text-typography-400 shrink-0" />
                              <span className="text-[11px]">{cong.grupos.length} Grupo(s)</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-surface-300/80">
                        <button 
                          onClick={() => handleEdit(cong)}
                          className="py-2 px-2 text-xs font-semibold text-typography-700 bg-surface-200/70 hover:bg-surface-200 hover:text-primary-200 border border-surface-300 rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Edit2 size={13} className="shrink-0" />
                          <span>Editar</span>
                        </button>
                        <button 
                          onClick={() => handleNavigate(cong)}
                          className="py-2 px-2 text-xs font-semibold text-primary-200 bg-primary-200/10 hover:bg-primary-200 hover:text-white border border-primary-200/20 rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Navigation size={13} className="shrink-0" />
                          <span>Como Chegar</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center bg-surface-200/50 rounded-2xl border-2 border-dashed border-surface-300">
                    <Store className="mx-auto text-typography-400 mb-2" size={40} />
                    <p className="text-typography-500 font-medium">Nenhuma congregação encontrada.</p>
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
            className="bg-surface-100 rounded-2xl shadow-sm border border-surface-300 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-primary-200 to-primary-150 p-4 sm:p-5 text-white flex justify-between items-center gap-2">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 bg-white/15 hover:bg-white/25 rounded-lg transition-all text-white flex items-center justify-center cursor-pointer shrink-0"
                  title="Voltar para a lista"
                >
                  <ChevronLeft size={18} />
                </button>
                <h3 className="font-bold text-sm sm:text-lg truncate">
                  {selectedCong ? 'Editar Congregação' : 'Nova Congregação'}
                </h3>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                {!selectedCong && (
                  <button 
                    type="button"
                    onClick={() => setIsPasting(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                  >
                    <ClipboardPaste size={14} className="shrink-0" />
                    <span className="whitespace-nowrap">Colar Dados</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 bg-white/15 hover:bg-white/25 rounded-lg transition-all text-white flex items-center justify-center cursor-pointer shrink-0"
                  title="Fechar edição"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <form id="congregation-form" onSubmit={handleSave} className="p-6 space-y-6 pb-28">
              {isPasting && (
                <div className="bg-surface-200/80 p-4 rounded-xl border border-surface-300 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-primary-200 uppercase">Cole os dados da congregação</h4>
                    <button 
                      type="button"
                      onClick={() => setIsPasting(false)}
                      className="text-typography-400 hover:text-typography-700 text-[10px] font-bold"
                    >
                      Cancelar
                    </button>
                  </div>
                  <textarea 
                    autoFocus
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Cole aqui o texto da congregação (com Reuniões, Coordenador, Secretário, etc.)..."
                    className="w-full h-36 p-3 text-xs bg-surface-100 text-typography-900 border border-surface-300 rounded-lg outline-none focus:border-primary-200 font-mono"
                  />
                  <button 
                    type="button"
                    onClick={handlePasteData}
                    className="w-full py-2 bg-primary-200 text-white text-xs font-bold rounded-lg hover:bg-primary-150 transition-all shadow-sm"
                  >
                    Processar e Preencher Automaticamente
                  </button>
                </div>
              )}

              {/* Seção 1: Dados Gerais e Reuniões */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-primary-200 uppercase tracking-wider border-b border-surface-300/80 pb-2">
                  1. Informações Básicas e Circuito
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-5 space-y-1">
                    <label className="text-xs font-semibold text-typography-600 uppercase">Nome da Congregação</label>
                    <input 
                      required
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      className="w-full p-2 bg-surface-200 border border-surface-300 rounded-lg outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors text-sm text-typography-900 placeholder:text-typography-400"
                      placeholder="Ex: Alcantil"
                    />
                  </div>

                  <div className="md:col-span-3 space-y-1">
                    <label className="text-xs font-semibold text-typography-600 uppercase">Número</label>
                    <input 
                      required
                      value={formData.numero}
                      onChange={(e) => setFormData({...formData, numero: e.target.value.replace(/\D/g, '').slice(0, 7)})}
                      className="w-full p-2 bg-surface-200 border border-surface-300 rounded-lg outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors text-sm font-mono text-typography-900 placeholder:text-typography-400"
                      placeholder="170431"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-typography-600 uppercase">Parte</label>
                    <input 
                      value={formData.parte}
                      onChange={(e) => setFormData({...formData, parte: e.target.value.toUpperCase().slice(0, 1)})}
                      className="w-full p-2 bg-surface-200 border border-surface-300 rounded-lg outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors text-center font-bold text-sm text-typography-900 placeholder:text-typography-400"
                      placeholder="A"
                      maxLength={1}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-typography-600 uppercase">Circuito</label>
                    <input 
                      value={formData.circuito || ''}
                      onChange={(e) => setFormData({...formData, circuito: e.target.value.toUpperCase()})}
                      className="w-full p-2 bg-surface-200 border border-surface-300 rounded-lg outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors text-sm font-mono text-typography-900 placeholder:text-typography-400"
                      placeholder="PB-003 A"
                    />
                  </div>

                  <div className="md:col-span-12 space-y-1">
                    <label className="text-xs font-semibold text-typography-600 uppercase flex items-center gap-1.5">
                      <Mail size={14} className="text-primary-200" />
                      E-mail da Congregação (JWPub)
                    </label>
                    <input 
                      value={formData.emailJWPub || ''}
                      onChange={(e) => setFormData({...formData, emailJWPub: e.target.value.toLowerCase().trim()})}
                      className="w-full p-2 bg-surface-200 border border-surface-300 rounded-lg outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors text-sm font-mono text-typography-900 placeholder:text-typography-400"
                      placeholder="congregação@jwpub.org"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-typography-600 uppercase flex items-center gap-1.5">
                      <Clock size={14} className="text-primary-200" />
                      Reunião Meio de Semana
                    </label>
                    <input 
                      value={formData.reuniaoMeioSemana || ''}
                      onChange={(e) => setFormData({...formData, reuniaoMeioSemana: e.target.value})}
                      className="w-full p-2 bg-surface-200 border border-surface-300 rounded-lg outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors text-sm text-typography-900 placeholder:text-typography-400"
                      placeholder="Ex: Terça-feira, 19:00"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-typography-600 uppercase flex items-center gap-1.5">
                      <Clock size={14} className="text-primary-200" />
                      Reunião Fim de Semana
                    </label>
                    <input 
                      value={formData.reuniaoFimSemana || ''}
                      onChange={(e) => setFormData({...formData, reuniaoFimSemana: e.target.value})}
                      className="w-full p-2 bg-surface-200 border border-surface-300 rounded-lg outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors text-sm text-typography-900 placeholder:text-typography-400"
                      placeholder="Ex: Sábado, 17:00 ou Domingo, 09:30"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 2: Localização e Endereço */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-primary-200 uppercase tracking-wider border-b border-surface-300/80 pb-2">
                  2. Local de Reuniões e Endereço
                </h4>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-typography-600 uppercase">Endereço Completo</label>
                  <input 
                    value={formData.endereco}
                    onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                    className="w-full p-2 bg-surface-200 border border-surface-300 rounded-lg outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors text-sm text-typography-900 placeholder:text-typography-400"
                    placeholder="Rua / Avenida, Número, Bairro"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-xs font-semibold text-typography-600 uppercase">CEP</label>
                    <div className="relative">
                      <input 
                        value={formData.cep}
                        onChange={(e) => setFormData({...formData, cep: formatCEP(e.target.value)})}
                        onBlur={handleCEPSearch}
                        className="w-full p-2 bg-surface-200 border border-surface-300 rounded-lg outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors pr-8 text-sm font-mono text-typography-900 placeholder:text-typography-400"
                        placeholder="00000-000"
                        maxLength={9}
                      />
                      <button 
                        type="button"
                        onClick={handleCEPSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-200 hover:text-primary-150"
                      >
                        {isSearchingCEP ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-6 space-y-1">
                    <label className="text-xs font-semibold text-typography-600 uppercase">Cidade</label>
                    <input 
                      value={formData.cidade}
                      onChange={(e) => setFormData({...formData, cidade: e.target.value.toUpperCase()})}
                      className="w-full p-2 bg-surface-200 border border-surface-300 rounded-lg outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors text-sm uppercase text-typography-900 placeholder:text-typography-400"
                      placeholder="CIDADE"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-typography-600 uppercase">UF</label>
                    <input 
                      value={formData.estado}
                      onChange={(e) => setFormData({...formData, estado: e.target.value.toUpperCase().replace(/[^A-Z]/g, '')})}
                      className="w-full p-2 bg-surface-200 border border-surface-300 rounded-lg outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors text-center font-bold text-sm uppercase text-typography-900 placeholder:text-typography-400"
                      placeholder="PB"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="space-y-2 bg-surface-200/50 p-3.5 rounded-xl border border-surface-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-typography-700 uppercase flex items-center gap-1.5">
                      <MapPin size={14} className="text-primary-200" />
                      Coordenadas GPS (Latitude, Longitude)
                    </label>
                    
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExtractGPS}
                        disabled={isExtractingGPS}
                        className="px-3 py-1.5 bg-primary-200 hover:bg-primary-150 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                        title="Extrair latitude e longitude a partir do endereço, CEP e cidade"
                      >
                        {isExtractingGPS ? (
                          <>
                            <Loader2 size={13} className="animate-spin shrink-0" />
                            <span>Buscando GPS...</span>
                          </>
                        ) : (
                          <>
                            <Crosshair size={13} className="shrink-0" />
                            <span>Extrair GPS</span>
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
                          className="px-2.5 py-1.5 bg-surface-100 hover:bg-surface-200 text-typography-700 border border-surface-300 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          title="Abrir e conferir localização no Google Maps"
                        >
                          <ExternalLink size={12} className="shrink-0" />
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
                    className="w-full p-2 bg-surface-100 border border-surface-300 rounded-lg outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors text-sm font-mono text-typography-900 placeholder:text-typography-400"
                    placeholder="Ex: -7.743120, -35.981240"
                  />

                  {/* Alerta de Incerteza / Sucesso / Erro do GPS */}
                  {gpsStatus && (
                    <div 
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                        gpsStatus.type === 'success' 
                          ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' 
                          : gpsStatus.type === 'warning'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400 shadow-sm'
                          : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'
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
                                ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                                : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                            }`}>
                              {gpsStatus.precision === 'street' ? 'Alta Certeza' : gpsStatus.precision === 'city' ? 'Incerto (Cidade)' : 'Aproximado (Bairro/CEP)'}
                            </span>
                          )}
                        </div>
                        <p className="leading-relaxed">{gpsStatus.message}</p>
                        {gpsStatus.details && (
                          <p className="text-[11px] text-typography-500 font-mono truncate max-w-full">
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
                              className="text-xs font-bold text-amber-700 dark:text-amber-400 underline hover:opacity-80 flex items-center gap-1"
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
                        className="text-typography-400 hover:text-typography-600 p-0.5"
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
                <h4 className="text-xs font-bold text-primary-200 uppercase tracking-wider border-b border-surface-300/80 pb-2">
                  3. Anciãos de Contato
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Coordenador */}
                  <div className="bg-surface-200/50 p-4 rounded-xl border border-surface-300 space-y-3">
                    <div className="flex items-center gap-2 pb-1 border-b border-surface-300/60">
                      <User size={16} className="text-primary-200" />
                      <h5 className="text-xs font-bold text-primary-200 uppercase">
                        Coordenador do Corpo de Anciãos (CCA)
                      </h5>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-typography-500 uppercase">Nome Completo</label>
                      <input 
                        value={formData.coordenador}
                        onChange={(e) => setFormData({...formData, coordenador: e.target.value})}
                        className="w-full p-2 bg-surface-100 border border-surface-300 rounded-lg outline-none focus:border-primary-200 text-xs text-typography-900 placeholder:text-typography-400"
                        placeholder="Nome do Coordenador"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-typography-500 uppercase flex items-center gap-1">
                        <Phone size={11} className="text-typography-400" /> Telefone / WhatsApp
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
                        className="w-full p-2 bg-surface-100 border border-surface-300 rounded-lg outline-none focus:border-primary-200 text-xs font-mono text-typography-900 placeholder:text-typography-400"
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-typography-500 uppercase flex items-center gap-1">
                        <Mail size={11} className="text-typography-400" /> E-mail (JWPub)
                      </label>
                      <input 
                        value={formData.coordenadorEmail || ''}
                        onChange={(e) => setFormData({...formData, coordenadorEmail: e.target.value.trim()})}
                        className="w-full p-2 bg-surface-100 border border-surface-300 rounded-lg outline-none focus:border-primary-200 text-xs font-mono text-typography-900 placeholder:text-typography-400"
                        placeholder="nome@jwpub.org"
                      />
                    </div>
                  </div>

                  {/* Secretário */}
                  <div className="bg-surface-200/50 p-4 rounded-xl border border-surface-300 space-y-3">
                    <div className="flex items-center gap-2 pb-1 border-b border-surface-300/60">
                      <UserCheck size={16} className="text-primary-200" />
                      <h5 className="text-xs font-bold text-primary-200 uppercase">
                        Secretário
                      </h5>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-typography-500 uppercase">Nome Completo</label>
                      <input 
                        value={formData.secretario || ''}
                        onChange={(e) => setFormData({...formData, secretario: e.target.value})}
                        className="w-full p-2 bg-surface-100 border border-surface-300 rounded-lg outline-none focus:border-primary-200 text-xs text-typography-900 placeholder:text-typography-400"
                        placeholder="Nome do Secretário"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-typography-500 uppercase flex items-center gap-1">
                        <Phone size={11} className="text-typography-400" /> Telefone / WhatsApp
                      </label>
                      <input 
                        value={formData.secretarioTelefone || ''}
                        onChange={(e) => setFormData({...formData, secretarioTelefone: formatPhone(e.target.value)})}
                        className="w-full p-2 bg-surface-100 border border-surface-300 rounded-lg outline-none focus:border-primary-200 text-xs font-mono text-typography-900 placeholder:text-typography-400"
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-typography-500 uppercase flex items-center gap-1">
                        <Mail size={11} className="text-typography-400" /> E-mail (JWPub)
                      </label>
                      <input 
                        value={formData.secretarioEmail || ''}
                        onChange={(e) => setFormData({...formData, secretarioEmail: e.target.value.trim()})}
                        className="w-full p-2 bg-surface-100 border border-surface-300 rounded-lg outline-none focus:border-primary-200 text-xs font-mono text-typography-900 placeholder:text-typography-400"
                        placeholder="nome@jwpub.org"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 4: Grupos e Pré-grupos */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-surface-300/80 pb-2">
                  <h4 className="text-xs font-bold text-primary-200 uppercase tracking-wider">
                    4. Grupos e Pré-grupos
                  </h4>
                  <button 
                    type="button"
                    onClick={handleAddGroup}
                    className="flex items-center gap-1 text-xs font-bold text-primary-200 hover:bg-primary-200/10 px-3 py-1.5 rounded-xl transition-all border border-primary-200/30 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus size={14} className="shrink-0" /> 
                    <span>Adicionar Grupo</span>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {formData.grupos.map((grupo, index) => (
                    <div key={index} className="relative group">
                      <input 
                        value={grupo}
                        onChange={(e) => handleGroupChange(index, e.target.value)}
                        placeholder={`Nome do Grupo ${index + 1}`}
                        className="w-full p-2 bg-surface-200 border border-surface-300 rounded-lg outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/10 transition-colors pr-8 text-xs text-typography-900 placeholder:text-typography-400"
                      />
                      <button 
                        type="button"
                        onClick={() => handleRemoveGroup(index)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-typography-400 hover:text-red-500 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {formData.grupos.length === 0 && (
                    <p className="text-xs text-typography-400 italic col-span-full">Nenhum grupo adicionado. Clique no &quot;+&quot; para adicionar.</p>
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
                  className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1002] bg-surface-100/95 dark:bg-surface-200/95 text-typography-900 backdrop-blur-md px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-2.5 sm:gap-4 border border-surface-300 w-[calc(100vw-1.5rem)] max-w-md no-print"
                >
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <span className="relative flex h-2 sm:h-2.5 w-2 sm:w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-200 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:w-2.5 bg-primary-200"></span>
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-semibold truncate">
                        Alterações não salvas
                      </span>
                      <span className="text-[10px] text-typography-500 font-mono hidden sm:inline truncate">
                        {formData.nome ? formData.nome : 'Nova Congregação'} {formData.numero ? `• Nº ${formData.numero}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
                      className="px-2.5 py-1.5 text-xs font-medium text-typography-600 hover:text-typography-900 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {selectedCong ? 'Descartar' : 'Cancelar'}
                    </button>
                    <button
                      type="submit"
                      form="congregation-form"
                      disabled={isSaving}
                      className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-brand-primary text-brand-on-primary text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 size={14} className="animate-spin shrink-0" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <>
                          <Save size={14} className="shrink-0" />
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

      {/* Modal Importar em Massa */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface-100 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-surface-300 text-typography-900"
            >
              <div className="bg-gradient-to-r from-primary-200 to-primary-150 p-6 text-white flex justify-between items-center">
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
                <div className="bg-surface-200 p-4 rounded-xl border border-surface-300 space-y-2 text-typography-800">
                  <h4 className="text-sm font-bold text-primary-200 flex items-center gap-1.5">
                    <ClipboardPaste size={16} /> Suporta formatos JW.org / Hub:
                  </h4>
                  <p className="text-xs text-typography-600 leading-relaxed">
                    Extrai automaticamente: <strong>Nome, Número, Parte, Circuito, Reuniões, Endereço, Cidade, UF, CEP, Coordenador (Nome, Tel, Email) e Secretário (Nome, Tel, Email)</strong>.<br />
                    Se a congregação já existir no banco de dados (pelo número ou nome), ela será <strong>atualizada automaticamente</strong>, preservando dados anteriores (como coordenadas GPS e grupos).
                  </p>
                </div>

                <textarea 
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Cole aqui os dados das congregações..."
                  className="w-full h-64 p-4 text-xs bg-surface-200 text-typography-900 border border-surface-300 rounded-2xl outline-none focus:border-primary-200 focus:ring-4 focus:ring-primary-200/10 transition-all font-mono placeholder:text-typography-400"
                />

                {importError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                    {importError}
                  </div>
                )}

                {importSuccess && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-700 dark:text-green-400 text-sm font-bold flex items-center gap-3 animate-in zoom-in">
                    <div className="w-7 h-7 bg-green-500 text-white rounded-full flex items-center justify-center shrink-0 shadow-sm">✓</div>
                    <div>
                      <p>{importSuccess.total} congregação(ões) processada(s) com sucesso!</p>
                      <p className="text-xs font-normal text-typography-500">
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
                    className="flex-1 py-3 text-typography-600 font-bold hover:bg-surface-200 rounded-xl transition-all text-sm"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleBulkImport}
                    disabled={isImporting || !importText.trim()}
                    className="flex-3 py-3 bg-primary-200 text-white font-bold rounded-xl hover:bg-primary-150 transition-all shadow-md disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 text-sm whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="animate-spin shrink-0" size={18} />
                        <span>Processando...</span>
                      </>
                    ) : (
                      <>
                        <Save size={18} className="shrink-0" />
                        <span>Processar e Importar</span>
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
