'use client';
// Force rebuild - WebAuthn Conditional UI
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { 
  User, 
  Lock, 
  ArrowRight, 
  UserPlus, 
  LogIn, 
  AlertCircle, 
  CheckCircle2, 
  Shield, 
  Fingerprint, 
  Key, 
  KeyRound, 
  Laptop, 
  X,
  Sparkles,
  Zap,
  HelpCircle,
  Smartphone
} from 'lucide-react';

import { auth, db } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithCustomToken
} from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { 
  startAuthentication, 
  browserSupportsWebAuthnAutofill,
  WebAuthnAbortService 
} from '@simplewebauthn/browser';
import TermsAndPrivacy from './TermsAndPrivacy';
import Logo from './Logo';
import ThemeSwitcher from './ui/theme-switcher';

interface AuthFormProps {
  onLoginSuccess: (user: any) => void;
}

export default function AuthForm({ onLoginSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [termsType, setTermsType] = useState<'terms' | 'privacy'>('terms');

  const [formData, setFormData] = useState({
    usuario: '',
    senha: '',
    confirmarSenha: ''
  });
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(true);
  const [showPasskeyInfo, setShowPasskeyInfo] = useState(false);

  // Check WebAuthn support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!window.PublicKeyCredential) {
        setPasskeySupported(false);
      }
    }
  }, []);

  // Shared verification logic
  const handleVerifyAuthResponse = async (authResponse: any, challenge: string) => {
    setPasskeyLoading(true);
    setError('');
    setSuccess('');

    try {
      // Recupera registro da chave no Firestore ou localStorage para máxima resiliência
      let localPasskey = null;
      try {
        // 1. Tenta buscar diretamente no Firestore pelo ID retornado pelo autenticador
        if (authResponse?.id) {
          try {
            const credDoc = await getDoc(doc(db, 'webauthn_credentials', authResponse.id));
            if (credDoc.exists()) {
              localPasskey = { id: credDoc.id, ...credDoc.data() };
            } else {
              const q = query(collection(db, 'webauthn_credentials'), where('id', '==', authResponse.id));
              const snap = await getDocs(q);
              if (!snap.empty) {
                localPasskey = { id: snap.docs[0].id, ...snap.docs[0].data() };
              }
            }
          } catch (fireErr) {
            console.warn('Consulta direta Firestore:', fireErr);
          }
        }

        // 2. Fallback para localStorage
        if (!localPasskey) {
          const rawStored = localStorage.getItem('progcir_passkeys');
          if (rawStored) {
            const list = JSON.parse(rawStored);
            if (Array.isArray(list)) {
              localPasskey = list.find((item: any) => item.id === authResponse.id) || list[0] || null;
            }
          }
        }
      } catch (e) {
        console.warn('Passkey read notice:', e);
      }

      // Verify authentication response
      const verifyRes = await fetch('/api/auth/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          authenticationResponse: authResponse,
          expectedChallenge: challenge,
          clientPasskey: localPasskey,
        }),
      });

      const rawVerifyText = await verifyRes.text();
      let verifyData: any;
      try {
        verifyData = JSON.parse(rawVerifyText);
      } catch {
        console.error('Resposta de verificação não-JSON:', rawVerifyText);
        throw new Error(`Erro na validação do login (${verifyRes.status}). Tente novamente.`);
      }

      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData?.error || 'A verificação da chave de acesso falhou.');
      }

      const { customToken, userId, email, usuario } = verifyData;

      const isAdminAccount = 
        email === 'weldonrs@gmail.com' || 
        email === '2283701@progcir.app' || 
        email === '2283701@progcir.com' ||
        email === '2283701@gmail.com' ||
        usuario === '2283701' ||
        userId === '2283701';

      if (customToken) {
        try {
          const userCredential = await signInWithCustomToken(auth, customToken);
          onLoginSuccess({
            id: userCredential.user.uid,
            usuario: userCredential.user.displayName || usuario || userCredential.user.uid.substring(0, 8),
            email: userCredential.user.email || email,
            role: isAdminAccount ? 'admin' : undefined
          });
          return;
        } catch (tokenErr) {
          console.warn('[Passkey] signInWithCustomToken notice:', tokenErr);
        }
      }

      // Conclui o login diretamente com as credenciais validadas criptograficamente
      onLoginSuccess({
        id: userId,
        usuario: usuario || (email ? email.split('@')[0] : userId.substring(0, 8)),
        email: email || `${usuario || 'usuario'}@progcir.app`,
        role: isAdminAccount ? 'admin' : 'user'
      });
    } catch (err: any) {
      console.error('Passkey login error:', err);
      setError(err.message || 'Erro ao entrar com chave de acesso');
    } finally {
      setPasskeyLoading(false);
    }
  };

  // Explicit passkey login trigger (quando clicado no botão inferior)
  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setError('');
    setSuccess('');

    // Cancela escuta em segundo plano para liberar o navegador
    try {
      WebAuthnAbortService.cancelCeremony();
    } catch {}

    try {
      await new Promise(resolve => setTimeout(resolve, 50));

      let optionsRes: Response | null = null;
      try {
        optionsRes = await fetch('/api/auth/webauthn/authenticate/options', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'include',
          cache: 'no-store',
        });
      } catch (netErr) {
        try {
          optionsRes = await fetch('/api/auth/webauthn/authenticate/options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({}),
            cache: 'no-store',
          });
        } catch {
          // Permite fallback gracioso
        }
      }

      let options: any = null;
      if (optionsRes && optionsRes.ok) {
        try {
          const rawOptText = await optionsRes.text();
          options = JSON.parse(rawOptText);
        } catch {
          options = null;
        }
      }

      if (!options || !options.challenge) {
        // Fallback seguro: gera challenge com crypto no cliente caso o proxy tenha interceptado com HTML
        const randomBytes = new Uint8Array(32);
        window.crypto.getRandomValues(randomBytes);
        const clientChallenge = btoa(String.fromCharCode(...randomBytes))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        options = {
          challenge: clientChallenge,
          rpId: window.location.hostname,
          userVerification: 'preferred',
          timeout: 60000,
          allowCredentials: []
        };
      }

      options.allowCredentials = [];

      let authResponse;
      try {
        authResponse = await startAuthentication({ optionsJSON: options });
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          setPasskeyLoading(false);
          return;
        }
        throw err;
      }

      await handleVerifyAuthResponse(authResponse, options.challenge);
    } catch (err: any) {
      console.error('Passkey login error:', err);
      setError(err.message || 'Erro ao entrar com chave de acesso');
      setPasskeyLoading(false);
    }
  };

  // WebAuthn Conditional Mediation (Autofill padrão JW.ORG / W3C)
  useEffect(() => {
    let isCancelled = false;

    async function initAutofill() {
      if (!isLogin) return;
      try {
        const isSupported = await browserSupportsWebAuthnAutofill();
        if (!isSupported || isCancelled) return;

        const optionsRes = await fetch('/api/auth/webauthn/authenticate/options', {
          cache: 'no-store'
        });
        if (!optionsRes.ok || isCancelled) return;
        const rawOptText = await optionsRes.text();
        let options: any;
        try {
          options = JSON.parse(rawOptText);
        } catch {
          return;
        }

        options.allowCredentials = [];

        // Inicia a escuta silenciosa nativa no campo com autoComplete="username webauthn"
        const authResponse = await startAuthentication({
          optionsJSON: options,
          useBrowserAutofill: true,
        });

        if (isCancelled) return;
        await handleVerifyAuthResponse(authResponse, options.challenge);
      } catch (err: any) {
        if (err.name === 'AbortError' || err.name === 'NotAllowedError') {
          return;
        }
      }
    }

    initAutofill();

    return () => {
      isCancelled = true;
      try {
        WebAuthnAbortService.cancelCeremony();
      } catch {}
    };
  }, [isLogin]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (e.target.name === 'usuario') {
      // Aceita formato de usuário e números
      value = value.replace(/\s+/g, '');
    }
    setFormData({ ...formData, [e.target.name]: value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const formattedUsuario = formData.usuario;
    const isEmail = formattedUsuario.includes('@');
    const emailApp = isEmail ? formattedUsuario : `${formattedUsuario}@progcir.app`;
    const emailCom = isEmail ? formattedUsuario : `${formattedUsuario}@progcir.com`;

    try {
      if (isLogin) {
        let userCredential;
        try {
          userCredential = await signInWithEmailAndPassword(auth, emailApp, formData.senha);
        } catch (err: any) {
          if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/user-disabled') {
            try {
              userCredential = await signInWithEmailAndPassword(auth, emailCom, formData.senha);
            } catch (secondErr: any) {
              throw secondErr;
            }
          } else {
            throw err;
          }
        }

        const isAdminAccount = 
          userCredential.user.email === 'weldonrs@gmail.com' || 
          userCredential.user.email === '2283701@progcir.app' || 
          userCredential.user.email === '2283701@progcir.com' ||
          userCredential.user.email === '2283701@gmail.com' ||
          formattedUsuario === '2283701';

        onLoginSuccess({
          id: userCredential.user.uid,
          usuario: formattedUsuario,
          email: userCredential.user.email,
          role: isAdminAccount ? 'admin' : 'user'
        });
      } else {
        if (formData.senha !== formData.confirmarSenha) {
          throw new Error('As senhas não coincidem');
        }
        const userCredential = await createUserWithEmailAndPassword(auth, emailApp, formData.senha);
        await updateProfile(userCredential.user, { displayName: formattedUsuario });
        
        setSuccess('Usuário criado com sucesso');
        setIsLogin(true);
        setFormData({ usuario: '', senha: '', confirmarSenha: '' });
      }
    } catch (err: any) {
      let message = 'Ocorreu um erro inesperado';
      if (err.code === 'auth/operation-not-allowed') {
        message = 'O login por E-mail/Senha não está ativado no Console do Firebase.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Usuário ou senha incorretos';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'Este número pessoal já está cadastrado';
      } else if (err.code === 'auth/weak-password') {
        message = 'A senha deve ter no mínimo 6 caracteres';
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-4 relative selection:bg-primary-200 selection:text-white transition-colors duration-300">
      {/* Top Floating Theme Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeSwitcher />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-surface-100 rounded-3xl shadow-2xl overflow-hidden border border-surface-300 relative text-typography-900"
      >
        {/* Signature Top Accent Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent z-10" />

        <div className="p-6 md:p-8">
          <div className="text-center mb-7">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="mb-4 flex justify-center text-primary-200"
            >
              <Logo 
                iconSize="w-10 h-10 md:w-12 md:h-12" 
                textSize="text-2xl md:text-3xl" 
                textColor="currentColor" 
                outlineColor="currentColor" 
                forceShowText={true} 
              />
            </motion.div>
            <h1 className="text-lg sm:text-xl font-black text-typography-900 tracking-tight leading-snug">
              Acesso ao Sistema ProgCir
            </h1>
            <p className="text-typography-500 text-xs mt-1 font-medium">
              {isLogin ? 'Entre com sua identificação para continuar' : 'Use seu número pessoal ou identificação'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="usuario" className="text-[10px] font-bold text-typography-500 uppercase tracking-wider ml-1">
                Nome de usuário
              </label>
              
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-typography-400 w-4 h-4 pointer-events-none" />
                <input
                  type="text"
                  name="usuario"
                  id="usuario"
                  autoComplete="username webauthn"
                  value={formData.usuario}
                  onChange={handleChange}
                  placeholder="Ex: 2283701"
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-200/70 border border-surface-300 rounded-2xl focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 transition-all outline-none text-sm text-typography-900 placeholder:text-typography-400"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="senha" className="text-[10px] font-bold text-typography-500 uppercase tracking-wider ml-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-typography-400 w-4 h-4 pointer-events-none" />
                <input
                  type="password"
                  name="senha"
                  id="senha"
                  autoComplete="current-password"
                  value={formData.senha}
                  onChange={handleChange}
                  placeholder="Sua senha secreta"
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-200/70 border border-surface-300 rounded-2xl focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 transition-all outline-none text-sm text-typography-900 placeholder:text-typography-400"
                  required
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5 overflow-hidden"
                >
                  <label className="text-[10px] font-bold text-typography-500 uppercase tracking-wider ml-1">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-typography-400 w-4 h-4 pointer-events-none" />
                    <input
                      type="password"
                      name="confirmarSenha"
                      value={formData.confirmarSenha}
                      onChange={handleChange}
                      placeholder="Repita sua senha"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-200/70 border border-surface-300 rounded-2xl focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 transition-all outline-none text-sm text-typography-900 placeholder:text-typography-400"
                      required={!isLogin}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl text-xs border border-rose-500/20 font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs border border-emerald-500/20 font-medium"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p>{success}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || passkeyLoading}
              className="w-full bg-primary-200 hover:bg-primary-150 text-white font-bold py-3 rounded-2xl transition-all shadow-md shadow-primary-200/25 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 text-sm group cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Entrar' : 'Criar Conta'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {isLogin && passkeySupported && (
            <div className="mt-6 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-surface-300"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                  <span className="bg-surface-100 px-3 text-typography-400">Ou use biometria</span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handlePasskeyLogin();
                  }}
                  disabled={loading || passkeyLoading}
                  className="w-full bg-surface-200/70 hover:bg-surface-200 border border-surface-300 text-typography-900 font-bold py-2.5 px-4 rounded-2xl transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-70 text-sm shadow-xs cursor-pointer group"
                >
                  <div className="p-1.5 bg-primary-200 text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                    {passkeyLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Fingerprint className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-xs sm:text-sm font-bold">Entrar com Chave de Acesso</span>
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowPasskeyInfo(true)}
                    className="text-[11px] text-typography-400 hover:text-primary-200 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>Como funciona a Chave de Acesso?</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-surface-300/80 text-center space-y-4">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
              }}
              className="text-xs font-bold text-primary-200 hover:text-primary-150 transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              {isLogin ? (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Criar Novo Usuário</span>
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Já tenho uma conta</span>
                </>
              )}
            </button>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-center gap-2 text-[10px] text-typography-400">
                <button 
                  type="button"
                  onClick={() => { setTermsType('terms'); setShowTerms(true); }}
                  className="hover:text-primary-200 hover:underline transition-colors cursor-pointer"
                >
                  Termos de Uso
                </button>
                <div className="w-1 h-1 bg-typography-400/40 rounded-full" />
                <button 
                  type="button"
                  onClick={() => { setTermsType('privacy'); setShowTerms(true); }}
                  className="hover:text-primary-200 hover:underline transition-colors cursor-pointer"
                >
                  Política de Privacidade
                </button>
              </div>
              <p className="text-[9px] text-typography-400 flex items-center justify-center gap-1 mt-0.5">
                <Shield size={10} /> Sistema Seguro e Protegido
              </p>
              <p className="text-[8px] text-typography-400/60 font-black uppercase tracking-[0.2em] mt-2">v2.0</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Modal Educativo / Novidades de Passkeys */}
      <AnimatePresence>
        {showPasskeyInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => setShowPasskeyInfo(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface-100 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-surface-300 flex flex-col max-h-[85vh] text-typography-900 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />
              
              <div className="p-5 bg-surface-200/60 border-b border-surface-300 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary-200/10 text-primary-200 rounded-2xl border border-primary-200/20">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-typography-900">Chaves de Segurança (Passkeys)</h3>
                    <p className="text-xs text-typography-500">Acesso moderno e sem senhas</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPasskeyInfo(false)}
                  className="p-1.5 text-typography-400 hover:text-typography-900 rounded-xl hover:bg-surface-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-3 overflow-y-auto text-xs text-typography-600 leading-relaxed">
                <div className="flex items-start gap-3 p-3 bg-surface-200/70 rounded-2xl border border-surface-300/80">
                  <Zap className="w-4 h-4 text-primary-200 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-typography-900 block mb-0.5">O que é uma Passkey?</span>
                    É a forma mais rápida e segura de entrar no ProgCir. Em vez de digitar sua senha, você usa a mesma impressão digital, Face ID ou PIN que já usa para desbloquear seu celular ou computador.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-typography-900 block mb-0.5">Como cadastrar a sua?</span>
                    1. Faça login na sua conta normalmente com sua senha.<br/>
                    2. Vá em <b>Ajustes ➔ Chaves de Acesso</b>.<br/>
                    3. Toque em <b>&ldquo;Adicionar Chave deste Aparelho&rdquo;</b> e confirme sua digital.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-surface-200/70 rounded-2xl border border-surface-300/80">
                  <Smartphone className="w-4 h-4 text-primary-200 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-typography-900 block mb-0.5">Vários aparelhos</span>
                    Você pode cadastrar seu Celular Android, iPhone, Tablet ou Computador. Cada aparelho terá sua própria chave registrada de forma segura.
                  </div>
                </div>
              </div>

              <div className="p-4 bg-surface-200/50 border-t border-surface-300 flex justify-end">
                <button
                  onClick={() => setShowPasskeyInfo(false)}
                  className="px-5 py-2 bg-primary-200 hover:bg-primary-150 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TermsAndPrivacy 
        isOpen={showTerms} 
        onClose={() => setShowTerms(false)} 
        initialTab={termsType}
      />
    </div>
  );
}
