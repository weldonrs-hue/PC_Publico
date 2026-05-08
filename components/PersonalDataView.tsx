'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Contact, 
  ChevronLeft,
  Save,
  User,
  Mail,
  Phone,
  Calendar,
  Search,
  Map,
  Hash,
  Users,
  MapPin,
  Globe,
  Loader2,
  Upload,
  Trash2,
  PenTool,
  Eraser,
  Check,
  X,
  Sparkles,
  Crop
} from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import SignatureCanvas from 'react-signature-canvas';
import ImageCropper from './ImageCropper';

import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  limit,
  getDoc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType, isQuotaExceeded, setQuotaExceededGlobal } from '@/utils/firestore';
import { formatBRPhone, formatCEP, formatCircuito } from '@/utils/formatters';

interface PersonalDataViewProps {
  userId: string;
  onBack: () => void;
  onSave: () => void;
}

const defaultData = {
  numeroPessoal: '',
  nome: '',
  nomeEsposa: '',
  endereco: '',
  cidade: '',
  cep: '',
  uf: '',
  circuito: '',
  emailJwpub: '',
  telefoneCircuito: '',
  emailPessoal: '',
  telefonePessoal: '',
  signatureImage: null as string | null,
  signatureOffset: 0,
  role: '' as 'viajante' | 'pioneiro_especial' | 'pioneiro_regular' | ''
};

export default function PersonalDataView({ userId, onBack, onSave }: PersonalDataViewProps) {
  const [initialData, setInitialData] = useState(defaultData);
  const [formData, setFormData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const sigPad = useRef<SignatureCanvas>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const removeImageBackground = () => {
    if (!formData.signatureImage) return;
    
    setIsProcessing(true);
    
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = formData.signatureImage;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsProcessing(false);
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Higher threshold for "near white" to be safe but effective
      const threshold = 230; 
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // If the pixel is very bright (near white), make it transparent
        if (r > threshold && g > threshold && b > threshold) {
          data[i + 3] = 0; // Alpha channel
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      const processedImage = canvas.toDataURL('image/png');
      setFormData({ ...formData, signatureImage: processedImage });
      setIsProcessing(false);
    };
    
    img.onerror = () => {
      console.error("Error loading image for background removal");
      setIsProcessing(false);
    };
  };

  useEffect(() => {
    const fetchPersonalData = async () => {
      try {
        // Try to get by userId as doc ID first
        const docRef = doc(db, 'personal_data', userId);
        let docSnap = null;
        try {
          docSnap = await getDoc(docRef);
        } catch (error) {
          console.warn('Initial getDoc(personal_data) failed, trying fallback query:', error);
        }
        
        if (docSnap && docSnap.exists()) {
          const docData = docSnap.data() as any;
          const mergedData = { ...defaultData, ...docData };
          setInitialData(mergedData);
          setFormData(mergedData);
        } else {
          // Fallback: search by userId field
          const hasMigrated = sessionStorage.getItem(`pdMigrationAttempted_${userId}`);
          if (hasMigrated) {
            setLoading(false);
            return;
          }

          // Use auth.currentUser.uid directly to be absolutely sure we are using the authenticated UID
          const currentUid = auth.currentUser?.uid;
          if (!currentUid) {
            console.warn('fetchPersonalData: auth.currentUser disappeared during query setup');
            setLoading(false);
            return;
          }

          const q = query(collection(db, 'personal_data'), where('userId', '==', currentUid), limit(1));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            sessionStorage.setItem(`pdMigrationAttempted_${userId}`, 'true');
            const docData = querySnapshot.docs[0].data() as any;
            const mergedData = { ...defaultData, ...docData };
            setInitialData(mergedData);
            setFormData(mergedData);
            // Migrate to use userId as doc ID for future efficiency
            if (!isQuotaExceeded()) {
              try {
                await setDoc(doc(db, 'personal_data', userId), { ...mergedData, userId });
              } catch (error) {
                console.warn('Failed to migrate personal_data doc:', error);
              }
            }
          }
        }
      } catch (error) {
        if (auth.currentUser) {
          console.error('Error fetching personal data:', error);
          handleFirestoreError(error, OperationType.LIST, 'personal_data (query by userId)');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPersonalData();
  }, [userId]);

  const [showConfirmBack, setShowConfirmBack] = useState(false);

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialData);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleCropComplete = (croppedImage: string) => {
    setFormData({ ...formData, signatureImage: croppedImage });
    setImageToCrop(null);
  };

  const removeSignature = () => {
    setFormData({ ...formData, signatureImage: null });
  };

  const clearSignatureCanvas = () => {
    sigPad.current?.clear();
  };

  const saveDrawnSignature = () => {
    if (sigPad.current?.isEmpty()) return;
    
    // Get the base64 image from canvas
    const dataUrl = sigPad.current?.getTrimmedCanvas().toDataURL('image/png');
    if (dataUrl) {
      setFormData({ ...formData, signatureImage: dataUrl });
      setIsDrawing(false);
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      setShowConfirmBack(true);
    } else {
      onBack();
    }
  };

  const handleCepSearch = async () => {
    const cep = formData.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData({
          ...formData,
          endereco: `${data.logradouro}${data.bairro ? `, ${data.bairro}` : ''}`,
          cidade: data.localidade.toUpperCase(),
          uf: data.uf.toUpperCase(),
          cep: formatCEP(data.cep)
        });
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    try {
      if (isQuotaExceeded()) {
        throw new Error('quota/limit-exceeded');
      }
      // Use userId as document ID
      const docRef = doc(db, 'personal_data', userId);
      await setDoc(docRef, { ...formData, userId });
      setInitialData(formData);
      onSave();
    } catch (error: any) {
      if (error.message?.includes('quota') || error.message?.includes('resource-exhausted')) {
        setQuotaExceededGlobal();
      }
      handleFirestoreError(error, OperationType.WRITE, 'personal_data');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-all text-emerald-600 bg-white shadow-md border border-gray-200"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={28} strokeWidth={3} />
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          {(formData.role === 'viajante' || !formData.role) ? 'Dados Pessoais do Superintendente' : 'Meus Dados Pessoais'}
        </h2>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <div className="bg-emerald-600 p-4 text-white">
          <h3 className="font-bold flex items-center gap-2">
            Perfil e Acesso
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-emerald-600" size={48} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
            {/* Role Selection */}
            <div className="space-y-4 mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-200">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
                Selecione sua categoria de conta
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'viajante', label: 'Viajante no Circuito', icon: Globe },
                  { id: 'pioneiro_especial', label: 'Pioneiro Especial', icon: Sparkles },
                  { id: 'pioneiro_regular', label: 'Pioneiro Regular', icon: User }
                ].map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, role: role.id as any })}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      formData.role === role.id 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md scale-[1.02]' 
                        : 'border-gray-100 bg-white text-gray-500 hover:border-emerald-200'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${formData.role === role.id ? 'bg-emerald-500 text-white' : 'bg-gray-100'}`}>
                      <role.icon size={20} />
                    </div>
                    <span className="font-bold text-sm">{role.label}</span>
                    {formData.role === role.id && <Check size={18} className="ml-auto" />}
                  </button>
                ))}
              </div>
              {!formData.role && (
                <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-2 ml-1">
                  * Você precisa selecionar uma categoria para continuar
                </p>
              )}
            </div>

            {/* Row 1: Names and ID */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Número Pessoal (ID)
                </label>
                <input 
                  value={formData.numeroPessoal}
                  onChange={(e) => setFormData({...formData, numeroPessoal: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all font-mono"
                  placeholder="Ex: 2283701"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Nome Completo
                </label>
                <input 
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                  placeholder="Seu nome completo"
                />
              </div>
              <div className="md:col-span-1 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Nome da Esposa
                </label>
                <input 
                  value={formData.nomeEsposa}
                  onChange={(e) => setFormData({...formData, nomeEsposa: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                  placeholder="Nome da esposa (se houver)"
                />
              </div>
            </div>

            {/* Row 2: Address */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Endereço
              </label>
              <input 
                value={formData.endereco}
                onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                placeholder="Rua, número, bairro..."
              />
            </div>

            {/* Row 3: City, CEP, UF, Circuit */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Cidade
                </label>
                <input 
                  value={formData.cidade}
                  onChange={(e) => setFormData({...formData, cidade: e.target.value.toUpperCase()})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                  placeholder="CIDADE"
                />
              </div>
              <div className="w-full md:w-[180px] space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  CEP
                </label>
                <div className="relative">
                  <input 
                    value={formData.cep}
                    onChange={(e) => setFormData({...formData, cep: formatCEP(e.target.value)})}
                    onBlur={handleCepSearch}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all pr-10"
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  <button 
                    type="button"
                    onClick={handleCepSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500"
                  >
                    <Search size={18} />
                  </button>
                </div>
              </div>
              <div className="w-full md:w-[80px] space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  UF
                </label>
                <input 
                  value={formData.uf}
                  onChange={(e) => setFormData({...formData, uf: e.target.value.toUpperCase().replace(/[^A-Z]/g, '')})}
                  maxLength={2}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all text-center"
                  placeholder="UF"
                />
              </div>
              <div className="w-full md:w-[120px] space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">
                  Circuito
                </label>
                <input 
                  value={formData.circuito}
                  onChange={(e) => setFormData({...formData, circuito: formatCircuito(e.target.value)})}
                  maxLength={6}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all text-center"
                  placeholder="AB-123"
                />
              </div>
            </div>

            {/* Row 4: Emails and Phones */}
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    E-mail JWPUB
                  </label>
                  <input 
                    type="email"
                    value={formData.emailJwpub}
                    onChange={(e) => setFormData({...formData, emailJwpub: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                    placeholder="usuario@jwpub.org"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    E-mail Pessoal
                  </label>
                  <input 
                    type="email"
                    value={formData.emailPessoal}
                    onChange={(e) => setFormData({...formData, emailPessoal: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                    placeholder="exemplo@email.com"
                  />
                </div>
              </div>

              <div className="w-full md:w-[240px] space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    Telefone Circuito
                  </label>
                  <input 
                    value={formData.telefoneCircuito}
                    onChange={(e) => setFormData({...formData, telefoneCircuito: formatBRPhone(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    Telefone Pessoal
                  </label>
                  <input 
                    value={formData.telefonePessoal}
                    onChange={(e) => setFormData({...formData, telefonePessoal: formatBRPhone(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
              </div>
            </div>

            {/* Signature Section */}
            <div className="bg-gray-50/50 p-6 rounded-2xl border border-dashed border-gray-200">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                Assinatura Global
              </h3>
              <p className="text-xs text-gray-500 mb-6 italic">
                Esta assinatura será utilizada automaticamente em todos os documentos (S-302, Uploads, etc). 
                Se você remover aqui, ela será removida de todos os formulários.
              </p>

              <div className="flex flex-col items-center justify-center p-8 bg-white border border-gray-100 rounded-2xl shadow-sm relative group overflow-hidden">
                {formData.signatureImage ? (
                  <div className="relative w-full max-w-[300px] mx-auto">
                    <div 
                      className="h-20 flex items-end justify-center relative w-full overflow-visible transition-transform duration-200"
                      style={{ 
                        transform: `translateY(${formData.signatureOffset}px)`
                      }}
                    >
                      <Image 
                        src={formData.signatureImage} 
                        alt="Assinatura Digital" 
                        fill 
                        className="object-contain object-bottom"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="border-t border-black w-full mt-1 relative z-10" />
                    <p className="text-center font-bold text-[11px] mt-1 uppercase tracking-tight text-gray-900">
                      {formData.nome || 'SEU NOME'}
                    </p>
                    
                    {/* Offset Control Slider overlay */}
                    <div className="absolute -left-12 top-0 bottom-0 flex flex-col items-center justify-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all pointer-events-auto lg:pointer-events-none lg:group-hover:pointer-events-auto">
                      <span className="text-[10px] font-black text-emerald-600 vertical-text">POSIÇÃO</span>
                      <input 
                        type="range"
                        min="-40"
                        max="40"
                        value={formData.signatureOffset}
                        onChange={(e) => setFormData({ ...formData, signatureOffset: parseInt(e.target.value) })}
                        className="h-32 appearance-none bg-gray-200 rounded-full w-1.5 cursor-pointer accent-emerald-600"
                        style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
                      />
                    </div>

                    <button 
                      type="button"
                      onClick={removeSignature}
                      className="absolute -top-4 -right-4 p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-all shadow-sm opacity-100 lg:opacity-0 lg:group-hover:opacity-100 z-10"
                      title="Remover Assinatura"
                    >
                      <Trash2 size={16} />
                    </button>

                    <button 
                      type="button"
                      onClick={() => setImageToCrop(formData.signatureImage)}
                      className="absolute -top-4 right-20 p-2 bg-emerald-100 text-emerald-600 rounded-full hover:bg-emerald-200 transition-all shadow-sm opacity-100 lg:opacity-0 lg:group-hover:opacity-100 z-10"
                      title="Recortar Assinatura"
                    >
                      <Crop size={16} />
                    </button>

                    <button 
                      type="button"
                      onClick={removeImageBackground}
                      disabled={isProcessing}
                      className="absolute -top-4 right-8 p-2 bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200 transition-all shadow-sm opacity-100 lg:opacity-0 lg:group-hover:opacity-100 z-10 disabled:opacity-50"
                      title="Remover Fundo Branco"
                    >
                      {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                      <Upload className="text-emerald-600" size={24} />
                    </div>
                    <p className="text-sm font-medium text-gray-700">Nenhuma assinatura cadastrada</p>
                    <p className="text-xs text-gray-400 mt-1 mb-6">Escolha uma imagem ou desenhe na tela</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <label className="cursor-pointer bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all shadow-md inline-flex items-center gap-2">
                        <Upload size={14} />
                        Fazer Upload
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleImageUpload}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsDrawing(true)}
                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
                      >
                        <PenTool size={14} />
                        Desenhar na Tela
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-100">
              <button 
                type="submit"
                disabled={!hasChanges || !formData.role}
                className={`px-10 py-3 font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 ${
                  hasChanges && formData.role
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                <Save size={20} />
                Salvar Alterações
              </button>
            </div>
          </form>
        )}
      </motion.div>

      {/* Confirmation Modal */}
      {showConfirmBack && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
          >
            <h3 className="text-xl font-bold text-gray-800">Alterações Pendentes</h3>
            <p className="text-gray-600">Você possui alterações que não foram salvas. Deseja salvar antes de sair?</p>
            <div className="flex flex-col gap-2 pt-2">
              <button 
                onClick={() => {
                  handleSubmit();
                  onBack();
                }}
                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors"
              >
                Salvar e Sair
              </button>
              <button 
                onClick={onBack}
                className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Sair sem Salvar
              </button>
              <button 
                onClick={() => setShowConfirmBack(false)}
                className="w-full py-3 text-gray-500 font-medium hover:underline"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}
      <AnimatePresence>
        {isDrawing && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[3000] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Assinatura Digital</h3>
                  <p className="text-sm text-gray-500">Desenhe sua assinatura no espaço abaixo</p>
                </div>
                <button 
                  onClick={() => setIsDrawing(false)}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden relative min-h-[300px]">
                <SignatureCanvas 
                  ref={sigPad}
                  penColor="#004aad"
                  canvasProps={{
                    className: "w-full h-full min-h-[300px] cursor-crosshair"
                  }}
                />
                
                {/* Visual guideline line */}
                <div className="absolute left-10 right-10 bottom-24 border-t border-gray-300 pointer-events-none" />
                <p className="absolute left-0 right-0 bottom-16 text-center text-[10px] text-gray-400 uppercase tracking-widest pointer-events-none">
                  Assine sobre a linha
                </p>
              </div>

              <div className="flex items-center justify-between mt-6">
                <button 
                  onClick={clearSignatureCanvas}
                  className="flex items-center gap-2 text-red-600 font-bold hover:bg-red-50 px-4 py-2 rounded-xl transition-all"
                >
                  <Eraser size={18} />
                  Limpar
                </button>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsDrawing(false)}
                    className="px-6 py-2.5 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={saveDrawnSignature}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-2.5 font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg"
                  >
                    <Check size={18} />
                    Confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Cropper for Signature */}
      {imageToCrop && (
        <ImageCropper 
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => setImageToCrop(null)}
          aspect={6}
          cropShape="rect"
          lockAspect={false}
        />
      )}
    </div>
  );
}
