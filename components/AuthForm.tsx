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

      // Ativa imediatamente a sessão no navegador para que a aplicação reconheça o acesso
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('progcir_session_active', 'true');
      }

      // Busca dados completos do perfil do usuário no Firestore (papel/role, foto, usuario, email)
      let userRole = 'user';
      let userPhotoURL: string | null = null;
      let realUsuario = usuario;
      let realEmail = email;

      try {
        if (userId) {
          const userDocRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const uData = userSnap.data();
            if (uData.role) userRole = uData.role;
            if (uData.photoURL) userPhotoURL = uData.photoURL;
            if (uData.usuario) realUsuario = uData.usuario;
            if (uData.email) realEmail = uData.email;
          }
        }
      } catch (errProfile) {
        console.warn('Erro ao consultar perfil do usuário no Firestore:', errProfile);
      }

      // Validação explícita de administrador
      const isAdminEmail = 
        realEmail === 'weldonrs@gmail.com' || 
        realEmail === '2283701@progcir.app' || 
        realEmail === '2283701@progcir.com' ||
        realEmail === '2283701@gmail.com' ||
        realUsuario === '2283701' ||
        userRole === 'admin';

      if (isAdminEmail) {
        userRole = 'admin';
        if (!realEmail) realEmail = 'weldonrs@gmail.com';
        if (!realUsuario) realUsuario = '2283701';
      }

      // Atualiza / sincroniza o documento do usuário no Firestore para garantir persistência definitiva
      try {
        if (userId) {
          const userDocRef = doc(db, 'users', userId);
          await setDoc(userDocRef, {
            email: realEmail,
            usuario: realUsuario,
            role: userRole,
            photoURL: userPhotoURL,
            lastLogin: new Date().toISOString(),
            migrationCompleted: true
          }, { merge: true });
        }
      } catch (errSync) {
        console.warn('Sync user profile notice:', errSync);
      }

      if (customToken) {
        try {
          const userCredential = await signInWithCustomToken(auth, customToken);
          onLoginSuccess({
            id: userCredential.user.uid,
            usuario: realUsuario || userCredential.user.displayName || userCredential.user.uid.substring(0, 8),
            email: realEmail || userCredential.user.email,
            role: userRole,
            photoURL: userPhotoURL,
            migrationCompleted: true,
            itinerariesInitialized: true
          });
          return;
        } catch (tokenErr) {
          console.warn('[Passkey] signInWithCustomToken notice:', tokenErr);
        }
      }

      // Conclui o login diretamente com as credenciais validadas e o papel (role) real do usuário
      onLoginSuccess({
        id: userId,
        usuario: realUsuario || (realEmail ? realEmail.split('@')[0] : userId.substring(0, 8)),
        email: realEmail || `${realUsuario || 'usuario'}@progcir.app`,
        role: userRole,
        photoURL: userPhotoURL,
        migrationCompleted: true,
        itinerariesInitialized: true
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
          cache: 'no-store',
        });
      } catch (netErr) {
        try {
          optionsRes = await fetch('/api/auth/webauthn/authenticate/options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({}),
            cache: 'no-store',
          });
        } catch {
          throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
        }
      }

      if (!optionsRes || !optionsRes.ok) {
        throw new Error(`Falha ao obter opções do servidor (${optionsRes?.status || 500})`);
      }
      
      const rawOptText = await optionsRes.text();
      let options: any;
      try {
        options = JSON.parse(rawOptText);
      } catch {
        throw new Error(`Resposta do servidor inválida (${optionsRes.status})`);
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

        onLoginSuccess({
          id: userCredential.user.uid,
          usuario: formattedUsuario,
          email: userCredential.user.email
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
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100"
      >
        <div className="p-6 md:p-8">
          <div className="text-center mb-8">
            <motion.div 
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="mb-4 flex justify-center"
            >
              <Logo 
                iconSize="w-10 h-10 md:w-12 md:h-12" 
                textSize="text-2xl md:text-3xl" 
                textColor="#4C1D95" 
                outlineColor="#4C1D95" 
                forceShowText={true} 
              />
            </motion.div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Acesso ao Sistema ProgCir</h1>
            <p className="text-gray-500 text-xs mt-1.5">
              {isLogin ? 'Entre com sua identificação para continuar' : 'Use seu número pessoal ou identificação'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="usuario" className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider ml-1">
                Nome de usuário
              </label>
              
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  type="text"
                  name="usuario"
                  id="usuario"
                  autoComplete="username webauthn"
                  value={formData.usuario}
                  onChange={handleChange}
                  placeholder="Ex: 2283701"
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#6c40bd] focus:border-transparent transition-all outline-none text-sm text-gray-700"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="senha" className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="password"
                  name="senha"
                  id="senha"
                  autoComplete="current-password"
                  value={formData.senha}
                  onChange={handleChange}
                  placeholder="Sua senha secreta"
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#6c40bd] focus:border-transparent transition-all outline-none text-sm text-gray-700"
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
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider ml-1">Confirmar Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="password"
                      name="confirmarSenha"
                      value={formData.confirmarSenha}
                      onChange={handleChange}
                      placeholder="Repita sua senha"
                      className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#6c40bd] focus:border-transparent transition-all outline-none text-sm text-gray-700"
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
                className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-2xl text-[11px] border border-red-100"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-600 rounded-2xl text-[11px] border border-emerald-100"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <p>{success}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || passkeyLoading}
              className="w-full bg-[#6c40bd] hover:bg-[#5a35a0] text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 text-sm group"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Entrar' : 'Criar Conta'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {isLogin && passkeySupported && (
            <div className="mt-6 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                  <span className="bg-white px-3 text-gray-400">Ou use biometria</span>
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
                  className="w-full bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border border-indigo-200/80 text-indigo-950 font-bold py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-70 text-sm shadow-sm cursor-pointer group"
                >
                  <div className="p-1.5 bg-indigo-600 text-white rounded-xl shadow-xs">
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
                    className="text-[11px] text-gray-400 hover:text-indigo-600 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-3 h-3" />
                    Como funciona a Chave de Acesso?
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100 text-center space-y-4">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
              }}
              className="text-xs font-semibold text-[#6c40bd] hover:text-[#5a35a0] transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              {isLogin ? (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  Criar Novo Usuário
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  Já tenho uma conta
                </>
              )}
            </button>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400">
                <button 
                  type="button"
                  onClick={() => { setTermsType('terms'); setShowTerms(true); }}
                  className="hover:text-[#6c40bd] hover:underline transition-colors"
                >
                  Termos de Uso
                </button>
                <div className="w-1 h-1 bg-gray-300 rounded-full" />
                <button 
                  type="button"
                  onClick={() => { setTermsType('privacy'); setShowTerms(true); }}
                  className="hover:text-[#6c40bd] hover:underline transition-colors"
                >
                  Política de Privacidade
                </button>
              </div>
              <p className="text-[9px] text-gray-400/80 flex items-center justify-center gap-1">
                <Shield size={10} /> Sistema Seguro e Protegido
              </p>
              <p className="text-[8px] text-gray-300 font-black uppercase tracking-[0.2em] mt-2">v1.5.0</p>
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
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPasskeyInfo(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Chaves de Segurança (Passkeys)</h3>
                    <p className="text-xs text-indigo-200">Acesso moderno e sem senhas</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPasskeyInfo(false)}
                  className="p-1.5 text-white/70 hover:text-white rounded-full hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-3.5 overflow-y-auto text-xs text-gray-600 leading-relaxed">
                <div className="flex items-start gap-3 p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100">
                  <Zap className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-gray-900 block mb-0.5">O que é uma Passkey?</span>
                    É a forma mais rápida e segura de entrar no ProgCir. Em vez de digitar sua senha, você usa a mesma impressão digital, Face ID ou PIN que já usa para desbloquear seu celular ou computador.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-emerald-50/70 rounded-2xl border border-emerald-100">
                  <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-gray-900 block mb-0.5">Como cadastrar a sua?</span>
                    1. Faça login na sua conta normalmente com sua senha.<br/>
                    2. Vá em <b>Ajustes ➔ Chaves de Acesso</b>.<br/>
                    3. Toque em <b>&ldquo;Adicionar Chave deste Aparelho&rdquo;</b> e confirme sua digital.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-purple-50/70 rounded-2xl border border-purple-100">
                  <Smartphone className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-gray-900 block mb-0.5">Vários aparelhos</span>
                    Você pode cadastrar seu Celular Android, iPhone, Tablet ou Computador. Cada aparelho terá sua própria chave registrada de forma segura.
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setShowPasskeyInfo(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
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
