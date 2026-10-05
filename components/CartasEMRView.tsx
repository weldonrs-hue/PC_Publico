'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  PenTool, 
  CheckCircle2, 
  UserCheck, 
  Mail
} from 'lucide-react';
import EMRLetters from './EMRLetters';
import { auth, db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  limit, 
  getDocs, 
  onSnapshot 
} from 'firebase/firestore';

interface CartasEMRViewProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  initialMode?: 'geracao' | 'manager';
  initialSchoolType?: 'ancians' | 'servants';
  initialTurma?: string;
  initialPartId?: string;
  personalData?: any;
  onBack: () => void;
}

export default function CartasEMRView({ 
  userId, 
  isAdmin, 
  canManage, 
  initialMode = 'geracao', 
  initialSchoolType,
  initialTurma,
  initialPartId,
  personalData: initialPersonalData,
  onBack 
}: CartasEMRViewProps) {
  const [personalData, setPersonalData] = useState<any>(initialPersonalData || null);
  const [loadingUser, setLoadingUser] = useState(!initialPersonalData);

  // Dynamic loader for logged-in user profile & signature
  useEffect(() => {
    let isMounted = true;
    const activeUid = userId || auth.currentUser?.uid;
    if (!activeUid) {
      setLoadingUser(false);
      return;
    }

    // 1. Immediate cache lookup from sessionStorage
    try {
      const cached = sessionStorage.getItem(`pd_${activeUid}`) || sessionStorage.getItem('progcir_personal_data');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.nome || parsed.signatureImage || parsed.signature)) {
          if (isMounted) setPersonalData(parsed);
        }
      }
    } catch (e) {
      console.warn('CartasEMRView: Error reading sessionStorage:', e);
    }

    // 2. Realtime listener on personal_data/{activeUid}
    const unsub = onSnapshot(doc(db, 'personal_data', activeUid), async (snap) => {
      if (snap.exists() && isMounted) {
        const data = snap.data();
        setPersonalData(data);
        setLoadingUser(false);
        try {
          sessionStorage.setItem(`pd_${activeUid}`, JSON.stringify(data));
        } catch (e) {}
      } else if (isMounted) {
        // 3. Fallback query by userId field
        try {
          const q = query(collection(db, 'personal_data'), where('userId', '==', activeUid), limit(1));
          const querySnap = await getDocs(q);
          if (!querySnap.empty && isMounted) {
            const data = querySnap.docs[0].data();
            setPersonalData(data);
            try {
              sessionStorage.setItem(`pd_${activeUid}`, JSON.stringify(data));
            } catch (e) {}
          } else {
            // 4. Fallback to users collection
            const userSnap = await getDoc(doc(db, 'users', activeUid));
            if (userSnap.exists() && isMounted) {
              const uData = userSnap.data();
              setPersonalData((prev: any) => ({
                ...prev,
                nome: prev?.nome || uData.name || uData.displayName || '',
                circuito: prev?.circuito || uData.circuito || '',
                email: prev?.email || uData.email || '',
                signatureImage: prev?.signatureImage || uData.signatureImage || null
              }));
            }
          }
        } catch (err) {
          console.warn('CartasEMRView: fallback lookup error:', err);
        } finally {
          if (isMounted) setLoadingUser(false);
        }
      }
    }, (error) => {
      console.warn('CartasEMRView: snapshot error:', error);
      if (isMounted) setLoadingUser(false);
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [userId]);

  const userName = personalData?.nome || auth.currentUser?.displayName || 'Superintendente de Circuito';
  const userCircuit = personalData?.circuito || 'Circuito';
  const signatureImage = personalData?.signatureImage || personalData?.signature || null;
  const hasDigitalSignature = Boolean(signatureImage && typeof signatureImage === 'string' && signatureImage.startsWith('data:image'));

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-300 pb-5">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 sm:p-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 text-typography-600 hover:text-typography-900 transition-colors shrink-0"
            title="Voltar para Cartas"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="w-10 h-10 rounded-xl bg-transparent border border-blue-500/40 dark:border-blue-400/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Mail size={20} strokeWidth={1.8} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">
                Cartas EMR
              </h1>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Anciãos & Servos
              </span>
            </div>
            <p className="text-xs text-typography-500 mt-0.5">
              Escola do Ministério do Reino • Designações e Convites
            </p>
          </div>
        </div>

        {/* Dynamic Signature & Logged User Badge */}
        <div className="flex items-center gap-3 bg-surface-100 border border-surface-300 rounded-2xl p-2.5 shadow-2xs self-start md:self-auto">
          <div className="w-9 h-9 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            {hasDigitalSignature ? (
              <PenTool size={18} />
            ) : (
              <UserCheck size={18} />
            )}
          </div>
          <div className="min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black text-typography-900 truncate max-w-[200px]">
                {userName}
              </span>
              <span className="text-[9px] font-bold text-typography-400">
                • {userCircuit}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[9px] font-bold">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={10} strokeWidth={2.5} />
                Assinatura: {hasDigitalSignature ? 'Digital' : 'Texto'}
              </span>
            </div>
          </div>
          {hasDigitalSignature && (
            <div className="hidden sm:flex items-center justify-center p-1 bg-white rounded-lg border border-surface-300 shadow-2xs shrink-0" title="Assinatura Digital Carregada">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={signatureImage} 
                alt="Assinatura" 
                className="h-5 max-w-[50px] object-contain" 
              />
            </div>
          )}
        </div>
      </div>

      {/* Main EMR Letters Component */}
      <EMRLetters 
        userId={userId}
        isAdmin={isAdmin}
        canManage={canManage}
        initialMode={initialMode}
        initialSchoolType={initialSchoolType}
        initialTurma={initialTurma as any}
        initialPartId={initialPartId}
      />
    </div>
  );
}
