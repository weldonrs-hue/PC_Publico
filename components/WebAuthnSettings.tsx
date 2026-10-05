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
  Smartphone
} from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';

interface Credential {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  transports?: string[];
}

export default function WebAuthnSettings() {
  const { showAlert, showConfirm } = useDialog();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredentials = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // 1. Tentar ler diretamente do Firestore pelo Client SDK
      try {
        const q = query(collection(db, 'webauthn_credentials'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const directCreds = snapshot.docs.map(d => ({
            id: d.id,
            createdAt: d.data().createdAt || new Date().toISOString(),
            lastUsedAt: d.data().lastUsedAt || new Date().toISOString(),
            transports: d.data().transports || [],
          }));
          setCredentials(directCreds);
          try {
            const rawStored = localStorage.getItem('progcir_passkeys');
            const stored = rawStored ? JSON.parse(rawStored) : [];
            const updated = directCreds.map(dc => {
              const match = Array.isArray(stored) ? stored.find((s: any) => s.id === dc.id) : null;
              return {
                id: dc.id,
                userId: user.uid,
                userName: user.displayName || user.email?.split('@')[0] || 'Usuário',
                createdAt: dc.createdAt,
                ...(match || {})
              };
            });
            localStorage.setItem('progcir_passkeys', JSON.stringify(updated));
          } catch {}
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

      // 1. Get registration options from server
      const optionsRes = await fetch('/api/auth/webauthn/register/options', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!optionsRes.ok) {
        const errData = await optionsRes.json();
        throw new Error(errData.error || 'Erro ao obter opções de registro');
      }

      const options = await optionsRes.json();

      // 2. Start WebAuthn registration in the browser
      let registrationResponse;
      try {
        registrationResponse = await startRegistration({
          optionsJSON: options
        });
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          // User canceled
          setRegistering(false);
          return;
        }
        throw err;
      }

      // 3. Send verification response to server
      const verifyRes = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          registrationResponse,
          expectedChallenge: options.challenge,
        }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json();
        throw new Error(errData.error || 'Falha ao verificar registro');
      }

      const verifyData = await verifyRes.json();

      if (verifyData.verified) {
        if (verifyData.credential) {
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
        await showAlert('Sua chave de acesso foi cadastrada com sucesso!', 'Sucesso');
        fetchCredentials();
      } else {
        throw new Error('A verificação da chave de acesso falhou.');
      }
    } catch (err: any) {
      console.error('WebAuthn registration error:', err);
      setError(err.message || 'Ocorreu um erro durante o cadastro da chave.');
    } finally {
      setRegistering(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeletePasskey = async (credId: string) => {
    const confirmed = await showConfirm(
      'Tem certeza de que deseja apagar esta chave de acesso? Você não poderá mais usá-la para entrar neste aparelho sem cadastrar novamente.',
      'Excluir Chave de Acesso'
    );
    if (!confirmed) return;

    setDeletingId(credId);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sessão expirada');

      const token = await user.getIdToken();
      
      // 1. Tentar deletar diretamente no Firestore
      try {
        await deleteDoc(doc(db, 'webauthn_credentials', credId));
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
        body: JSON.stringify({ credentialId: credId }),
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
            const filtered = list.filter((item: any) => item.id !== credId);
            localStorage.setItem('progcir_passkeys', JSON.stringify(filtered));
          }
        }
      } catch {}

      setCredentials(prev => prev.filter(c => c.id !== credId));
      await showAlert('Chave de acesso removida com sucesso!', 'Sucesso');
    } catch (err: any) {
      console.error('Delete passkey error:', err);
      setError(err.message || 'Erro ao remover chave de acesso');
    } finally {
      setDeletingId(null);
    }
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
            <h3 className="font-semibold text-gray-900">Chaves de acesso</h3>
            <p className="text-xs text-gray-500">Acesse sua conta sem senha</p>
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
          Adicionar chave
        </button>
      </div>

      <p className="text-sm text-gray-600 leading-relaxed">
        Use uma chave de acesso para entrar no ProgCir usando Windows Hello, 
        impressão digital, reconhecimento facial ou PIN do dispositivo.
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
            credentials.map((cred) => (
              <motion.div
                key={cred.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-indigo-200 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      Chave de acesso
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                      <Calendar className="w-3 h-3" />
                      Adicionada em: {formatDate(cred.createdAt)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeletePasskey(cred.id)}
                    disabled={deletingId === cred.id}
                    title="Excluir chave de acesso"
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                  >
                    {deletingId === cred.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            ))
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
          <b>Privacidade:</b> Seus dados biométricos nunca saem do seu dispositivo. 
          O ProgCir recebe apenas uma chave pública para validar sua entrada.
        </p>
      </div>
    </div>
  );
}
