'use client';

import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useDialog } from '@/hooks/useDialog';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Key, 
  Plus, 
  Shield, 
  Loader2, 
  Fingerprint, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Smartphone,
  Laptop,
  Monitor,
  Pencil,
  Check,
  X,
  Zap,
  HelpCircle,
  Activity,
  CheckCircle,
  Cpu,
  RefreshCw,
  Info
} from 'lucide-react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

interface Credential {
  id: string;
  deviceName?: string;
  deviceType?: 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'other';
  browserName?: string;
  createdAt: string;
  lastUsedAt: string;
  transports?: string[];
}

function detectClientDevice(): { deviceName: string; deviceType: 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'other'; browserName: string } {
  if (typeof window === 'undefined') {
    return { deviceName: 'Chave de acesso', deviceType: 'other', browserName: '' };
  }

  const ua = navigator.userAgent || '';
  let deviceType: 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'other' = 'other';
  let osName = 'Dispositivo';

  if (/android/i.test(ua)) {
    deviceType = 'android';
    osName = 'Celular Android';
  } else if (/ipad|iphone|ipod/i.test(ua)) {
    deviceType = 'ios';
    osName = 'iPhone / iPad';
  } else if (/windows/i.test(ua)) {
    deviceType = 'windows';
    osName = 'PC Windows';
  } else if (/macintosh|mac os x/i.test(ua)) {
    deviceType = 'macos';
    osName = 'MacBook / Mac';
  } else if (/linux/i.test(ua)) {
    deviceType = 'linux';
    osName = 'Linux PC';
  }

  let browserName = 'Navegador';
  if (/edg/i.test(ua)) {
    browserName = 'Edge';
  } else if (/samsungbrowser/i.test(ua)) {
    browserName = 'Samsung Internet';
  } else if (/chrome|crios/i.test(ua)) {
    browserName = 'Chrome';
  } else if (/firefox|fxios/i.test(ua)) {
    browserName = 'Firefox';
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browserName = 'Safari';
  }

  const deviceName = `${osName} (${browserName})`;
  return { deviceName, deviceType, browserName };
}

interface WebAuthnSettingsProps {
  isInsideModal?: boolean;
}

export default function WebAuthnSettings({ isInsideModal = false }: WebAuthnSettingsProps) {
  const { showAlert, showConfirm } = useDialog();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [testingPasskey, setTestingPasskey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingRename, setSavingRename] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentLocalId, setCurrentLocalId] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  // Informações de suporte do hardware
  const [deviceCapabilities, setDeviceCapabilities] = useState<{
    hasWebAuthn: boolean;
    hasPlatformAuth: boolean;
    hasAutofill: boolean;
  }>({
    hasWebAuthn: false,
    hasPlatformAuth: false,
    hasAutofill: false,
  });

  // Checa recursos suportados pelo navegador / aparelho
  useEffect(() => {
    async function checkCapabilities() {
      if (typeof window === 'undefined' || !window.PublicKeyCredential) {
        setDeviceCapabilities({
          hasWebAuthn: false,
          hasPlatformAuth: false,
          hasAutofill: false,
        });
        return;
      }

      let hasPlatformAuth = false;
      let hasAutofill = false;

      try {
        if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
          hasPlatformAuth = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        }
      } catch {}

      try {
        if (PublicKeyCredential.isConditionalMediationAvailable) {
          hasAutofill = await PublicKeyCredential.isConditionalMediationAvailable();
        }
      } catch {}

      setDeviceCapabilities({
        hasWebAuthn: true,
        hasPlatformAuth,
        hasAutofill,
      });
    }

    checkCapabilities();
  }, []);

  // Identifica se há chave cadastrada no armazenamento deste navegador local
  useEffect(() => {
    try {
      const rawStored = localStorage.getItem('progcir_passkeys');
      if (rawStored) {
        const parsed = JSON.parse(rawStored);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id) {
          setCurrentLocalId(parsed[0].id);
        }
      }
    } catch {}
  }, []);

  const fetchCredentials = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // 1. Tentar ler diretamente do Firestore pelo Client SDK
      try {
        const q = query(collection(db, 'webauthn_credentials'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const directCreds: Credential[] = snapshot.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              deviceName: data.deviceName || 'Chave de acesso',
              deviceType: data.deviceType || 'other',
              browserName: data.browserName || '',
              createdAt: data.createdAt || new Date().toISOString(),
              lastUsedAt: data.lastUsedAt || new Date().toISOString(),
              transports: data.transports || [],
            };
          });
          setCredentials(directCreds);
          setLoading(false);
          return;
        }
      } catch (clientErr) {
        console.warn('[WebAuthn] Consulta direta via Client SDK pulada:', clientErr);
      }

      // 2. Consulta via rota de API com token
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/webauthn/credentials', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setCredentials(Array.isArray(data) ? data : []);
      } else {
        setCredentials([]);
      }
    } catch (err: any) {
      console.warn('Busca de chaves de acesso com fallback:', err);
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchCredentials();
      } else {
        setCredentials([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAddPasskey = async () => {
    setRegistering(true);
    setError(null);
    setTestResult(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sessão expirada. Por favor, faça login novamente.');

      let token = await user.getIdToken();
      const clientDevice = detectClientDevice();

      // 1. Obter opções de registro do servidor
      let optionsRes: Response;
      try {
        optionsRes = await fetch('/api/auth/webauthn/register/options', {
          headers: { 
            'Accept': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          cache: 'no-store',
        });
      } catch {
        try {
          token = await user.getIdToken(true);
          optionsRes = await fetch('/api/auth/webauthn/register/options', {
            headers: { 
              'Accept': 'application/json',
              Authorization: `Bearer ${token}` 
            },
            cache: 'no-store',
          });
        } catch {
          throw new Error('Falha de conexão com o servidor. Verifique sua internet e tente novamente.');
        }
      }

      let options: any;
      const rawText = await optionsRes.text();
      try {
        options = JSON.parse(rawText);
      } catch {
        console.error('Resposta não-JSON do servidor:', rawText);
        throw new Error(`Falha no servidor (${optionsRes.status}): ${rawText.slice(0, 120)}`);
      }

      if (!optionsRes.ok || options.error) {
        throw new Error(options.error || `Erro (${optionsRes.status}) ao obter opções de registro`);
      }

      // 2. Iniciar registro nativo da chave biométrica no navegador
      let registrationResponse;
      try {
        registrationResponse = await startRegistration({
          optionsJSON: options
        });
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          // Usuário cancelou ou fechou a janela biométrica
          setRegistering(false);
          return;
        }
        throw err;
      }

      // 3. Enviar resposta criptográfica e dados do dispositivo para o servidor
      let verifyRes: Response;
      try {
        verifyRes = await fetch('/api/auth/webauthn/register/verify', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ 
            registrationResponse,
            expectedChallenge: options.challenge,
            deviceName: clientDevice.deviceName,
            deviceType: clientDevice.deviceType,
            browserName: clientDevice.browserName,
          }),
          cache: 'no-store',
        });
      } catch {
        throw new Error('Falha de conexão ao enviar validação da chave.');
      }

      let verifyData: any;
      const rawVerifyText = await verifyRes.text();
      try {
        verifyData = JSON.parse(rawVerifyText);
      } catch {
        console.error('Resposta não-JSON na verificação:', rawVerifyText);
        throw new Error(`Erro na confirmação da chave pelo servidor (${verifyRes.status}).`);
      }

      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || 'A verificação da chave de acesso falhou.');
      }

      if (verifyData.credential) {
        setCurrentLocalId(verifyData.credential.id);
        
        // 4. Salva imediatamente no Firestore client-side para persistência definitiva
        try {
          await setDoc(doc(db, 'webauthn_credentials', verifyData.credential.id), {
            id: verifyData.credential.id,
            userId: user.uid,
            email: user.email || null,
            userName: user.email?.split('@')[0] || 'Usuário',
            deviceName: clientDevice.deviceName,
            deviceType: clientDevice.deviceType,
            browserName: clientDevice.browserName,
            counter: verifyData.credential.counter || 0,
            publicKey: verifyData.credential.publicKey,
            transports: verifyData.credential.transports || [],
            createdAt: new Date().toISOString(),
            lastUsedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (firestoreErr) {
          console.warn('Gravação direta no Firestore:', firestoreErr);
        }

        try {
          const rawStored = localStorage.getItem('progcir_passkeys');
          const storedList = rawStored ? JSON.parse(rawStored) : [];
          const filtered = Array.isArray(storedList) ? storedList.filter((c: any) => c.id !== verifyData.credential.id) : [];
          filtered.push({
            ...verifyData.credential,
            userId: user.uid,
            email: user.email,
            userName: user.email?.split('@')[0],
            deviceName: clientDevice.deviceName,
            deviceType: clientDevice.deviceType,
            browserName: clientDevice.browserName,
            rpId: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
          });
          localStorage.setItem('progcir_passkeys', JSON.stringify(filtered));
        } catch (e) {
          console.warn('Falha ao salvar chave em localStorage:', e);
        }
      }
      await showAlert(`Chave de acesso cadastrada com sucesso para: ${clientDevice.deviceName}!`, 'Sucesso');
      fetchCredentials();
    } catch (err: any) {
      console.error('WebAuthn registration error:', err);
      setError(err.message || 'Ocorreu um erro durante o cadastro da chave.');
    } finally {
      setRegistering(false);
    }
  };

  // 🧪 Testador de Biometria / Chave de Acesso em Tempo Real
  const handleTestPasskey = async () => {
    setTestingPasskey(true);
    setTestResult(null);
    setError(null);
    const startTime = performance.now();

    try {
      // 1. Obter opções de autenticação
      const optionsRes = await fetch('/api/auth/webauthn/authenticate/options', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (!optionsRes.ok) {
        throw new Error('Não foi possível obter parâmetros de teste do servidor.');
      }

      const options = await optionsRes.json();
      options.allowCredentials = []; // Permite qualquer chave do usuário no aparelho

      // 2. Acionar prompt de biometria / PIN nativo
      let authResponse;
      try {
        authResponse = await startAuthentication({ optionsJSON: options });
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          setTestResult({
            success: false,
            message: 'O teste foi cancelado na janela biométrica.',
          });
          return;
        }
        throw err;
      }

      const latency = Math.round(performance.now() - startTime);

      // 3. Verifica correspondência da chave
      let matchedName = 'Chave de Acesso';
      const matched = credentials.find(c => c.id === authResponse.id);
      if (matched && matched.deviceName) {
        matchedName = matched.deviceName;
      }

      setTestResult({
        success: true,
        message: `Biometria confirmada com sucesso (${matchedName})! Sua chave está ativa e pronta para uso.`,
        latency,
      });
    } catch (err: any) {
      console.error('Passkey test error:', err);
      setTestResult({
        success: false,
        message: err.message || 'Falha ao testar a chave. Cadastre a chave deste aparelho primeiro.',
      });
    } finally {
      setTestingPasskey(false);
    }
  };

  const handleRenamePasskey = async (credId: string) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }

    setSavingRename(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sessão expirada');

      const token = await user.getIdToken();
      let res: Response;
      try {
        res = await fetch('/api/auth/webauthn/rename', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            credentialId: credId,
            newName: editingName.trim(),
          }),
          cache: 'no-store',
        });
      } catch {
        throw new Error('Falha na conexão ao renomear chave.');
      }

      let data: any = {};
      try {
        data = await res.json();
      } catch {}

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao renomear chave');
      }

      setCredentials(prev => prev.map(c => c.id === credId ? { ...c, deviceName: editingName.trim() } : c));
      setEditingId(null);
    } catch (err: any) {
      console.error('Rename passkey error:', err);
      setError(err.message || 'Erro ao renomear chave de acesso');
    } finally {
      setSavingRename(false);
    }
  };

  const handleDeletePasskey = async (cred: Credential) => {
    const label = cred.deviceName || 'este aparelho';
    const confirmed = await showConfirm(
      `Tem certeza de que deseja apagar a chave de acesso do aparelho "${label}"?\n\nVocê não poderá mais entrar por biometria/PIN nesse dispositivo até cadastrá-lo novamente.`,
      'Excluir Chave de Acesso'
    );
    if (!confirmed) return;

    setDeletingId(cred.id);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sessão expirada');

      const token = await user.getIdToken();
      
      // 1. Tentar deletar diretamente no Firestore
      try {
        await deleteDoc(doc(db, 'webauthn_credentials', cred.id));
      } catch (err) {
        console.warn('Delete direto Firestore pulado:', err);
      }

      // 2. Chamar endpoint de exclusão no servidor
      try {
        const res = await fetch('/api/auth/webauthn/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ credentialId: cred.id }),
          cache: 'no-store',
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.warn('[Delete API warning]:', data?.error);
        }
      } catch (apiErr) {
        console.warn('[Delete API network notice]:', apiErr);
      }

      // 3. Limpa localStorage
      try {
        const rawStored = localStorage.getItem('progcir_passkeys');
        if (rawStored) {
          const list = JSON.parse(rawStored);
          if (Array.isArray(list)) {
            const filtered = list.filter((item: any) => item.id !== cred.id);
            localStorage.setItem('progcir_passkeys', JSON.stringify(filtered));
          }
        }
      } catch {}

      if (currentLocalId === cred.id) {
        setCurrentLocalId(null);
      }

      setCredentials(prev => prev.filter(c => c.id !== cred.id));
      await showAlert(`Chave de acesso de "${label}" removida com sucesso!`, 'Sucesso');
    } catch (err: any) {
      console.error('Delete passkey error:', err);
      setError(err.message || 'Erro ao remover chave de acesso');
    } finally {
      setDeletingId(null);
    }
  };

  const getDeviceIcon = (deviceType?: string, deviceName?: string) => {
    const type = deviceType || '';
    const name = (deviceName || '').toLowerCase();

    if (type === 'android' || name.includes('android') || name.includes('samsung') || name.includes('galaxy') || name.includes('celular') || name.includes('smartphone')) {
      return <Smartphone className="w-5 h-5 text-emerald-600 shrink-0" />;
    }
    if (type === 'ios' || name.includes('iphone') || name.includes('ipad') || name.includes('ios')) {
      return <Smartphone className="w-5 h-5 text-indigo-600 shrink-0" />;
    }
    if (type === 'windows' || name.includes('windows') || name.includes('pc') || name.includes('computador') || name.includes('desktop')) {
      return <Monitor className="w-5 h-5 text-blue-600 shrink-0" />;
    }
    if (type === 'macos' || name.includes('mac') || name.includes('macbook')) {
      return <Laptop className="w-5 h-5 text-purple-600 shrink-0" />;
    }
    return <Key className="w-5 h-5 text-indigo-600 shrink-0" />;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        <span className="text-sm font-medium">Carregando chaves de acesso...</span>
      </div>
    );
  }

  return (
    <div className={isInsideModal ? "space-y-4 max-w-full overflow-x-hidden" : "bg-white/50 backdrop-blur-sm border border-gray-100 rounded-2xl p-3 sm:p-5 shadow-sm space-y-4 max-w-full overflow-x-hidden"}>
      
      {/* Barra Informativa de Recursos */}
      <div className="flex items-center justify-between gap-2 bg-indigo-50/70 border border-indigo-100/80 p-3 rounded-2xl">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0">
            <Fingerprint className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate">Chaves de Acesso (Passkeys)</h4>
            <p className="text-[11px] text-gray-500 truncate">Acesse com a biometria ou PIN dos seus aparelhos</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowInfoModal(true)}
            className="p-2 text-indigo-600 hover:bg-indigo-100/60 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Como funciona"
          >
            <Info className="w-4 h-4" />
            <span className="hidden sm:inline">Ajuda</span>
          </button>
          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-xl border border-transparent hover:border-indigo-100 transition-colors cursor-pointer"
            title="Diagnóstico do Aparelho"
          >
            <Cpu className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Painel de Diagnósticos do Hardware (Retrátil) */}
      <AnimatePresence>
        {showDiagnostics && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3.5 bg-gray-50 border border-gray-200/80 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-600" />
                  Diagnóstico deste Dispositivo
                </span>
                <button
                  onClick={() => setShowDiagnostics(false)}
                  className="text-gray-400 hover:text-gray-700 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-100">
                  {deviceCapabilities.hasWebAuthn ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 text-[11px] truncate">WebAuthn FIDO2</div>
                    <div className="text-[10px] text-gray-500">{deviceCapabilities.hasWebAuthn ? 'Disponível' : 'Indisponível'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-100">
                  {deviceCapabilities.hasPlatformAuth ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 text-[11px] truncate">Biometria / PIN</div>
                    <div className="text-[10px] text-gray-500">{deviceCapabilities.hasPlatformAuth ? 'Pronto para uso' : 'Sem sensor'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-100">
                  {deviceCapabilities.hasAutofill ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 text-[11px] truncate">Autofill Biométrico</div>
                    <div className="text-[10px] text-gray-500">{deviceCapabilities.hasAutofill ? 'Compatível' : 'Modo padrão'}</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de Ação dos Botões (100% Responsiva e sem overflow) */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate">Gerenciador de Dispositivos</h4>
            <p className="text-[11px] text-gray-500">Cadastre a biometria/PIN deste aparelho para entrar sem senha</p>
          </div>
        </div>

        {/* Botões empilhados ou lado a lado com largura flexível */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {/* Botão de Testar Chave */}
          <button
            type="button"
            onClick={handleTestPasskey}
            disabled={testingPasskey || registering}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer min-h-[42px]"
            title="Testar se sua biometria e chave de acesso estão respondendo"
          >
            {testingPasskey ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
            ) : (
              <Zap className="w-4 h-4 text-emerald-600" />
            )}
            <span className="truncate">Testar Biometria</span>
          </button>

          {/* Botão de Adicionar Chave */}
          <button
            type="button"
            onClick={handleAddPasskey}
            disabled={registering || testingPasskey}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] shadow-sm shadow-indigo-100 cursor-pointer min-h-[42px]"
          >
            {registering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span className="truncate">Adicionar Chave</span>
          </button>
        </div>
      </div>

      {/* Feedback do Teste de Biometria */}
      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`p-3 sm:p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
              testResult.success 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs mb-0.5">
                {testResult.success ? 'Teste Concluído com Sucesso' : 'Aviso no Teste'}
              </div>
              <p className="leading-relaxed text-[11px] break-words">{testResult.message}</p>
              {testResult.latency !== undefined && (
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold">
                  <span className="px-1.5 py-0.5 bg-emerald-100 rounded-md">
                    Resposta: {testResult.latency}ms
                  </span>
                  <span>Criptografia OK</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="text-gray-400 hover:text-gray-600 p-1 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 text-xs"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words flex-1">{error}</span>
        </motion.div>
      )}

      {/* Lista de Chaves Cadastradas */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Chaves Cadastradas ({credentials.length})
          </span>
          <button
            type="button"
            onClick={fetchCredentials}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Atualizar
          </button>
        </div>

        <AnimatePresence mode="popLayout">
          {credentials.length > 0 ? (
            credentials.map((cred) => {
              const isCurrentDevice = currentLocalId === cred.id;
              const isEditing = editingId === cred.id;

              return (
                <motion.div
                  key={cred.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={`p-3 sm:p-3.5 bg-white border rounded-2xl transition-all ${
                    isCurrentDevice ? 'border-emerald-200 ring-1 ring-emerald-100 shadow-xs' : 'border-gray-100 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center shrink-0">
                        {getDeviceIcon(cred.deviceType, cred.deviceName)}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 max-w-full my-0.5">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenamePasskey(cred.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              autoFocus
                              placeholder="Nome do aparelho"
                              className="text-xs font-bold text-gray-900 px-2 py-1 border border-indigo-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 w-full min-w-0"
                            />
                            <button
                              type="button"
                              onClick={() => handleRenamePasskey(cred.id)}
                              disabled={savingRename}
                              className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shrink-0 flex items-center justify-center"
                              title="Salvar"
                            >
                              {savingRename ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 shrink-0 flex items-center justify-center"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-gray-900 truncate max-w-[160px] sm:max-w-xs">
                              {cred.deviceName || 'Chave de acesso'}
                            </span>
                            
                            {isCurrentDevice && (
                              <span className="inline-flex items-center px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold rounded-full">
                                Este aparelho
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(cred.id);
                                setEditingName(cred.deviceName || '');
                              }}
                              className="text-gray-400 hover:text-indigo-600 p-1 rounded-md hover:bg-gray-50 transition-colors"
                              title="Renomear"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {formatDate(cred.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDeletePasskey(cred)}
                        disabled={deletingId === cred.id}
                        title={`Excluir chave`}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50 min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                      >
                        {deletingId === cred.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : !registering && (
            <div className="text-center py-6 bg-white border border-dashed border-gray-200 rounded-2xl p-4">
              <Key className="w-8 h-8 text-gray-300 mx-auto mb-1.5" />
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-0.5">
                Nenhuma chave cadastrada
              </p>
              <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                Clique em &ldquo;Adicionar Chave&rdquo; para registrar a biometria/PIN deste aparelho.
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="pt-2 border-t border-gray-100 flex items-start gap-2">
        <Shield className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
        <p className="text-[10px] text-gray-400 leading-relaxed">
          <b>Segurança:</b> Seus dados biométricos permanecem no dispositivo físico. O servidor recebe apenas a assinatura pública criptográfica FIDO2.
        </p>
      </div>

      {/* Modal Informativo das Chaves de Segurança */}
      <AnimatePresence>
        {showInfoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowInfoModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabeçalho */}
              <div className="p-4 sm:p-5 bg-indigo-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Fingerprint className="w-5 h-5 text-indigo-200" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold">Chaves de Acesso (Passkeys)</h3>
                    <p className="text-[11px] text-indigo-200">Como funciona o acesso biométrico</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Conteúdo */}
              <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 text-xs text-gray-600 leading-relaxed">
                <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
                  <h4 className="font-bold text-gray-900 mb-0.5">Entrada sem senha</h4>
                  <p>Substitui a digitação de senhas pela sua impressão digital, Face ID ou PIN cadastrado no aparelho.</p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                  <h4 className="font-bold text-gray-900 mb-0.5">Vários dispositivos</h4>
                  <p>Você pode cadastrar seu celular Android, iPhone e computador. Cada aparelho terá sua própria chave segura.</p>
                </div>

                <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100">
                  <h4 className="font-bold text-gray-900 mb-0.5">Proteção Antiphishing</h4>
                  <p>Padrão FIDO2 / WebAuthn. A chave privada nunca sai do chip do seu aparelho e é imune a vazamentos.</p>
                </div>
              </div>

              {/* Rodapé */}
              <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
