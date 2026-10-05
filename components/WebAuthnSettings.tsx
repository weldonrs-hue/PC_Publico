'use client';

import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
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
  Sparkles
} from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';

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

export default function WebAuthnSettings() {
  const { showAlert, showConfirm } = useDialog();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingRename, setSavingRename] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentLocalId, setCurrentLocalId] = useState<string | null>(null);

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

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sessão expirada. Por favor, faça login novamente.');

      const token = await user.getIdToken();
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
        throw new Error('Falha de conexão com o servidor. Verifique sua internet e tente novamente.');
      }

      let options: any;
      try {
        options = await optionsRes.json();
      } catch {
        throw new Error('Resposta inválida do servidor ao preparar cadastro da chave.');
      }

      if (!optionsRes.ok || options.error) {
        throw new Error(options.error || 'Erro ao obter opções de registro');
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
      try {
        verifyData = await verifyRes.json();
      } catch {
        throw new Error('Resposta inválida do servidor ao confirmar a chave.');
      }

      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || 'A verificação da chave de acesso falhou.');
      }

      if (verifyData.credential) {
        setCurrentLocalId(verifyData.credential.id);
        try {
          const rawStored = localStorage.getItem('progcir_passkeys');
          const storedList = rawStored ? JSON.parse(rawStored) : [];
          const filtered = Array.isArray(storedList) ? storedList.filter((c: any) => c.id !== verifyData.credential.id) : [];
          filtered.push({
            ...verifyData.credential,
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
      const res = await fetch('/api/auth/webauthn/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          credentialId: credId,
          newName: editingName.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
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
      const res = await fetch('/api/auth/webauthn/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ credentialId: cred.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao excluir chave de acesso');
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
      return <Smartphone className="w-5 h-5 text-emerald-600" />;
    }
    if (type === 'ios' || name.includes('iphone') || name.includes('ipad') || name.includes('ios')) {
      return <Smartphone className="w-5 h-5 text-indigo-600" />;
    }
    if (type === 'windows' || name.includes('windows') || name.includes('pc') || name.includes('computador') || name.includes('desktop')) {
      return <Monitor className="w-5 h-5 text-blue-600" />;
    }
    if (type === 'macos' || name.includes('mac') || name.includes('macbook')) {
      return <Laptop className="w-5 h-5 text-purple-600" />;
    }
    return <Key className="w-5 h-5 text-indigo-600" />;
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
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Carregando chaves...</span>
      </div>
    );
  }

  return (
    <div className="bg-white/50 backdrop-blur-sm border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl">
            <Fingerprint className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Chaves de acesso cadastradas</h3>
            <p className="text-xs text-gray-500">Identifique e gerencie seus aparelhos</p>
          </div>
        </div>
        
        <button
          onClick={handleAddPasskey}
          disabled={registering}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-100"
        >
          {registering ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Adicionar chave deste aparelho
        </button>
      </div>

      <p className="text-sm text-gray-600 leading-relaxed">
        Você pode cadastrar múltiplos dispositivos (como seu <b>Celular Android</b>, <b>iPhone</b> ou <b>PC Windows</b>) para entrar sem senha usando a biometria/PIN de cada um.
      </p>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 text-xs"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </motion.div>
      )}

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {credentials.length > 0 ? (
            credentials.map((cred) => {
              const isCurrentDevice = currentLocalId === cred.id;
              const isEditing = editingId === cred.id;

              return (
                <motion.div
                  key={cred.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`flex items-center justify-between p-4 bg-white border rounded-2xl transition-all ${
                    isCurrentDevice ? 'border-emerald-200 shadow-sm ring-1 ring-emerald-100' : 'border-gray-100 hover:border-indigo-100'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-3">
                    <div className="w-11 h-11 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center shrink-0">
                      {getDeviceIcon(cred.deviceType, cred.deviceName)}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-2 my-0.5">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenamePasskey(cred.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                            placeholder="Ex: Meu Samsung S24"
                            className="text-sm font-bold text-gray-900 px-2 py-1 border border-indigo-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 w-full max-w-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRenamePasskey(cred.id)}
                            disabled={savingRename}
                            className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                            title="Salvar nome"
                          >
                            {savingRename ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900 truncate">
                            {cred.deviceName || 'Chave de acesso'}
                          </span>
                          
                          {isCurrentDevice && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full">
                              <Sparkles className="w-2.5 h-2.5" />
                              Este aparelho
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(cred.id);
                              setEditingName(cred.deviceName || '');
                            }}
                            className="text-gray-400 hover:text-indigo-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
                            title="Renomear aparelho"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Cadastrada em: {formatDate(cred.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDeletePasskey(cred)}
                      disabled={deletingId === cred.id}
                      title={`Excluir chave de ${cred.deviceName || 'este aparelho'}`}
                      className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                    >
                      {deletingId === cred.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })
          ) : !registering && (
            <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-2xl">
              <Key className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">
                Nenhuma chave cadastrada
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="pt-4 border-t border-gray-50 flex items-start gap-2">
        <Shield className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
        <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
          <b>Privacidade & Segurança:</b> Apenas a identificação do modelo/navegador e a chave pública são armazenadas para que você possa identificar facilmente seus aparelhos. Seus dados biométricos nunca saem do seu dispositivo físico.
        </p>
      </div>
    </div>
  );
}
