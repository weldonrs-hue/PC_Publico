'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Link as LinkIcon, Unlink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function MicrosoftConnectionSettings() {
  const [status, setStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();
      const res = await fetch('/api/microsoft/status', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Error fetching Microsoft connection status:', err);
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

  const handleConnect = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const token = await user.getIdToken();
      const res = await fetch('/api/microsoft/connect', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.url) {
        // Redirect to Microsoft
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to get connection URL');
      }
    } catch (err: any) {
      setError(err.message);
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar sua conta Microsoft/JW? Isso impedirá o envio automático de relatórios.')) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const token = await user.getIdToken();
      const res = await fetch('/api/microsoft/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setStatus({ connected: false });
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to disconnect');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Verificando conexões...</span>
      </div>
    );
  }

  return (
    <div className="bg-white/50 backdrop-blur-sm border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-xl">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Conta Microsoft / JW</h3>
            <p className="text-xs text-gray-500">Para envio de relatórios S-302</p>
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          {status?.connected ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-100"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Conectada
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-xs font-medium border border-gray-100"
            >
              Não conectada
            </motion.div>
          )
          }
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        {status?.connected ? (
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-xs text-gray-500 block mb-1">E-mail conectado</span>
              <span className="text-sm font-medium text-gray-900">{status.email}</span>
            </div>
            
            <button
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-red-100 disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              Desconectar conta
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Conecte sua conta JW (Microsoft) para permitir que o ProgCir envie relatórios automaticamente através do seu e-mail institucional.
            </p>
            
            <button
              onClick={handleConnect}
              disabled={actionLoading}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
              Conectar minha conta JW
            </button>
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-100 text-xs"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </div>

      <p className="mt-6 text-[10px] text-gray-400 text-center uppercase tracking-wider font-medium">
        Segurança JW: O ProgCir não tem acesso à sua senha.
      </p>
    </div>
  );
}
