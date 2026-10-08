'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { useDialog } from '@/hooks/useDialog';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Link as LinkIcon, Unlink, CheckCircle2, AlertCircle, Loader2, ExternalLink, Globe, X as CloseIcon } from 'lucide-react';

export default function MicrosoftConnectionSettings() {
  const { showAlert, showConfirm } = useDialog();
  const [status, setStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'microsoft_auth_failed') {
      setError('A sua organização (jwpub.org) exige aprovação de um administrador para este aplicativo. Por favor, solicite a aprovação na tela da Microsoft ou tente uma conta pessoal para testar.');
    }
  }, []);

  const fetchStatus = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Check status directly on client side to avoid server-side IAM issues
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      const docRef = doc(db, 'microsoft_connections', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setStatus({
          connected: true,
          email: data.email
        });
      } else {
        setStatus({ connected: false });
      }
    } catch (err) {
      console.error('Error fetching Microsoft connection status:', err);
      setError('Erro ao verificar conexão. Tente recarregar a página.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchStatus();
      } else {
        setStatus(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'microsoft_connected') {
        fetchStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnect = async () => {
    // Open standard browser tab (not a popup window) immediately to avoid popup blockers
    // Browsers require window.open to be directly in the click handler
    const win = window.open('about:blank', '_blank');
    
    if (!win) {
      setError('O bloqueador de janelas impediu a abertura. Por favor, permita abas para este site e tente novamente.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      const user = auth.currentUser;
      if (!user) {
        win.close();
        throw new Error('User not authenticated');
      }

      const token = await user.getIdToken();
      const res = await fetch('/api/microsoft/connect', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Check if the response is JSON before parsing
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('[Microsoft Connect] Non-JSON response received:', text.substring(0, 200));
        win.close();
        throw new Error(`O servidor retornou um erro inesperado (${res.status}). Verifique se as variáveis de ambiente MICROSOFT_* estão configuradas no Vercel.`);
      }

      const data = await res.json();
      if (data.url) {
        // Update the location of the already opened window
        win.location.href = data.url;

        // Monitor connection status
        const checkInterval = setInterval(async () => {
          if (win.closed) {
            clearInterval(checkInterval);
            await fetchStatus();
          }
        }, 2000);
      } else {
        win.close();
        throw new Error(data.error || 'Failed to get connection URL');
      }
    } catch (err: any) {
      setError(err.message);
      setActionLoading(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = await showConfirm('Tem certeza que deseja desconectar sua conta Microsoft/JW? Isso impedirá o envio preparado de e-mails.', 'Desconectar Conta');
    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError(null);
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Disconnect directly on client side to avoid server-side IAM issues
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      await deleteDoc(doc(db, 'microsoft_connections', user.uid));
      setStatus({ connected: false });
    } catch (err: any) {
      setError('Erro ao desconectar: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-typography-500">
        <Loader2 className="w-5 h-5 animate-spin text-primary-200" />
        <span className="text-sm font-medium">Verificando conexões...</span>
      </div>
    );
  }

  return (
    <div className="bg-surface-100 border border-surface-300 rounded-3xl p-5 sm:p-6 shadow-xs text-typography-900">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-200/10 border border-primary-200/20 text-primary-200 rounded-2xl flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-typography-900 text-sm sm:text-base">Conta Microsoft / JW</h3>
            <p className="text-xs text-typography-500 font-medium">Para envio de relatórios S-302</p>
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          {status?.connected ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Conectada
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 px-3 py-1 bg-surface-200 text-typography-500 rounded-full text-xs font-bold border border-surface-300"
            >
              Não conectada
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        {status?.connected ? (
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-surface-200/60 rounded-2xl border border-surface-300">
              <span className="text-xs text-typography-500 block mb-1 font-medium">E-mail conectado</span>
              <span className="text-sm font-bold text-typography-900">{status.email}</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="https://mail.jwpub.org/owa/?path=/mail/action/compose&to=SouzaL1@jwpub.org&subject=Aviso%20de%20visita%20do%20SC"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-200 hover:bg-surface-300 text-typography-900 border border-surface-300 text-xs sm:text-sm font-bold rounded-2xl transition-all cursor-pointer shadow-xs"
              >
                <ExternalLink className="w-4 h-4 text-primary-200" />
                Novo E-mail
              </a>
              <button
                onClick={handleDisconnect}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-2xl transition-colors border border-red-500/20 disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                Desconectar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs sm:text-sm text-typography-600 leading-relaxed">
              Escolha uma das opções abaixo para configurar seu acesso:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Versão 1: Direto para o E-mail */}
              <a
                href="https://mail.jwpub.org/owa/?path=/mail/action/compose&to=SouzaL1@jwpub.org&subject=Aviso%20de%20visita%20do%20SC"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-200 hover:bg-surface-300 text-typography-900 border border-surface-300 text-xs sm:text-sm font-bold rounded-2xl transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <ExternalLink className="w-4 h-4 text-primary-200" />
                1. Abrir Webmail
              </a>

              {/* Versão 2: Autorização Entra */}
              <button
                onClick={handleConnect}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-primary-200 hover:opacity-90 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-primary-200/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                2. Autorizar ProgCir
              </button>
            </div>

            <p className="text-[11px] text-typography-500 font-medium leading-tight">
              <b>Dica:</b> Abra o Webmail primeiro para herdar o login, depois clique em Autorizar.
            </p>
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3.5 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 text-xs font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </div>

      <p className="mt-6 text-[10px] text-typography-400 text-center uppercase tracking-wider font-bold">
        Segurança JW: O ProgCir não tem acesso à sua senha.
      </p>
    </div>
  );
}
