'use client';
// Force rebuild
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Lock, ArrowRight, UserPlus, LogIn, AlertCircle, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

import { auth } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';

interface AuthFormProps {
  onLoginSuccess: (user: any) => void;
}

export default function AuthForm({ onLoginSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    usuario: '',
    senha: '',
    confirmarSenha: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (e.target.name === 'usuario') {
      // Only allow numbers
      value = value.replace(/\D/g, '');
    }
    setFormData({ ...formData, [e.target.name]: value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validate username format: numeric personal number (7 digits)
    const usernameRegex = /^\d{7}$/;
    if (!usernameRegex.test(formData.usuario)) {
      setError('Formato inválido. Use seu número pessoal de 7 dígitos (ex: 2283701)');
      setLoading(false);
      return;
    }

    const formattedUsuario = formData.usuario;
    const emailApp = `${formattedUsuario}@progcir.app`;
    const emailCom = `${formattedUsuario}@progcir.com`;

    try {
      if (isLogin) {
        let userCredential;
        try {
          // Try with the new domain first
          userCredential = await signInWithEmailAndPassword(auth, emailApp, formData.senha);
        } catch (err: any) {
          // If it fails with user not found or invalid credential, try the old domain
          if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/user-disabled') {
            try {
              userCredential = await signInWithEmailAndPassword(auth, emailCom, formData.senha);
            } catch (secondErr: any) {
              // If both fail, throw the second error (or the first one)
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
        // Always create new accounts with the .app domain
        const userCredential = await createUserWithEmailAndPassword(auth, emailApp, formData.senha);
        await updateProfile(userCredential.user, { displayName: formattedUsuario });
        
        setSuccess('Usuário criado com sucesso');
        setIsLogin(true);
        setFormData({ usuario: '', senha: '', confirmarSenha: '' });
      }
    } catch (err: any) {
      let message = 'Ocorreu um erro inesperado';
      if (err.code === 'auth/operation-not-allowed') {
        message = 'O login por E-mail/Senha não está ativado no Console do Firebase. Por favor, ative-o em Authentication > Sign-in method.';
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
              className="w-16 h-16 bg-gradient-to-br from-white via-white to-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-100 overflow-hidden"
            >
              <Image src="/ICO_7.png" alt="Logo" width={64} height={64} className="w-full h-full object-contain p-1" />
            </motion.div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Acesso ao Sistema ProgCir</h1>
            <p className="text-gray-500 text-xs mt-1.5">
              {isLogin ? 'Entre com sua identificação para continuar' : 'Use seu número pessoal de 7 dígitos'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider ml-1">Identificação (Usuário)</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  name="usuario"
                  value={formData.usuario}
                  onChange={handleChange}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Ex: 2283701"
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#6c40bd] focus:border-transparent transition-all outline-none text-sm text-gray-700"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="password"
                  name="senha"
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
              disabled={loading}
              className="w-full bg-[#6c40bd] hover:bg-[#5a35a0] text-white font-bold py-3 rounded-2xl shadow-lg shadow-purple-100 transition-all flex items-center justify-center gap-2 disabled:opacity-70 group text-sm"
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

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
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
          </div>
        </div>
      </motion.div>
    </div>
  );
}
