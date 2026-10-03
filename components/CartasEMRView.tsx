'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  GraduationCap, 
  PenTool, 
  CheckCircle2, 
  UserCheck, 
  Sparkles,
  ShieldCheck,
  RefreshCw,
  FileText
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
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 bg-white min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2.5 md:p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-500 hover:text-blue-600 hover:scale-105 active:scale-95 border border-gray-200/60"
            title="Voltar"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tight">
                Cartas EMR
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                Anciãos & Servos
              </span>
            </div>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[11px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100 w-fit mt-1 flex items-center gap-1.5">
              <GraduationCap size={13} />
              Gerador de Documentos para Escola do Ministério do Reino
            </p>
          </div>
        </div>

        {/* Dynamic Signature & Logged User Badge */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-blue-50/80 p-2.5 rounded-2xl border border-blue-100 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-2xs border border-blue-100 shrink-0">
            {hasDigitalSignature ? (
              <PenTool size={18} className="text-blue-600" />
            ) : (
              <UserCheck size={18} className="text-indigo-600" />
            )}
          </div>
          <div className="min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black text-gray-900 truncate max-w-[200px]">
                {userName}
              </span>
              <span className="text-[9px] font-bold text-gray-400">
                • {userCircuit}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[9px] font-bold">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={10} strokeWidth={2.5} />
                Assinatura Ancião: {hasDigitalSignature ? 'Digital' : 'Texto'}
              </span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1 text-indigo-600">
                <CheckCircle2 size={10} strokeWidth={2.5} />
                Assinatura Servo: {hasDigitalSignature ? 'Digital' : 'Texto'}
              </span>
            </div>
          </div>
          {hasDigitalSignature && (
            <div className="hidden sm:flex items-center justify-center p-1 bg-white rounded-lg border border-blue-200/80 shadow-2xs shrink-0" title="Assinatura Digital Carregada">
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
        initialTurma={initialTurma}
        initialPartId={initialPartId}
        personalData={personalData}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1A1B1E;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2c2e33;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
