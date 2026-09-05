'use client';
// Force rebuild - 2026-04-28
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import Logo from '@/components/Logo';
import EventsView from '@/components/EventsView';
import RegionalConventionView from '@/components/RegionalConventionView';
import CircuitAssemblyView from '@/components/CircuitAssemblyView';
import SpecialPioneerMeetingView from '@/components/SpecialPioneerMeetingView';

const DashboardCards = dynamic(() => import('@/components/DashboardCards'), { ssr: false });
const SecondarySection = dynamic(() => import('@/components/SecondarySection'), { ssr: false });
const AuthForm = dynamic(() => import('@/components/AuthForm'), { ssr: false });
const PersonalDataView = dynamic(() => import('@/components/PersonalDataView'), { ssr: false });
const CongregationsView = dynamic(() => import('@/components/CongregationsView'), { ssr: false });
const SubstitutesView = dynamic(() => import('@/components/SubstitutesView'), { ssr: false });
const ItinerariesView = dynamic(() => import('@/components/ItinerariesView'), { ssr: false });
const SettingsView = dynamic(() => import('@/components/SettingsView'), { ssr: false });
const UsersView = dynamic(() => import('@/components/UsersView'), { ssr: false });
const TjSecAccountsView = dynamic(() => import('@/components/TjSecAccountsView'), { ssr: false });
const CircuitStatisticsView = dynamic(() => import('@/components/CircuitStatisticsView'), { ssr: false });
const SchoolsView = dynamic(() => import('@/components/SchoolsView'), { ssr: false });
const PioneerSchoolView = dynamic(() => import('@/components/PioneerSchoolView'), { ssr: false });
const CongregationStatisticsView = dynamic(() => import('@/components/CongregationStatisticsView'), { ssr: false });
const MiscView = dynamic(() => import('@/components/MiscView'), { 
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
      <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Módulo Diversos...</p>
    </div>
  )
});
const FieldServiceReportView = dynamic(() => import('@/components/FieldServiceReportView'), { ssr: false });
const WeeklyExpensesReceipt = dynamic(() => import('@/components/WeeklyExpensesReceipt'), { ssr: false });
const FileViewer = dynamic(() => import('@/components/FileViewer'), { ssr: false });
const CartasDashboard = dynamic(() => import('@/components/CartasDashboard'), { ssr: false });
const CartasESPView = dynamic(() => import('@/components/CartasESPView'), { ssr: false });
const CartasCongressoView = dynamic(() => import('@/components/CartasCongressoView'), { ssr: false });
const CartasAssembleiasView = dynamic(() => import('@/components/CartasAssembleiasView'), { ssr: false });
const CartasSeletorView = dynamic(() => import('@/components/CartasSeletorView'), { ssr: false });
const GlobalS302View = dynamic(() => import('@/components/S302GlobalView'), { ssr: false });
const RoleSelectionModal = dynamic(() => import('@/components/RoleSelectionModal'), { ssr: false });
const FloatingStopwatch = dynamic(() => import('@/components/FloatingStopwatch'), { ssr: false });
const DonationView = dynamic(() => import('@/components/DonationView'), { ssr: false });
import ImageCropper from '@/components/ImageCropper';
import TermsAndPrivacy from '@/components/TermsAndPrivacy';

import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit,
  getDoc,
  setDoc, 
  updateDoc, 
  doc, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType, isQuotaExceeded, setQuotaExceededGlobal, clearQuotaExceeded } from '@/utils/firestore';
import { Camera, User, ArrowLeft, AlertCircle, X, Coffee, Send, FileText } from 'lucide-react';

const STORAGE_KEY = 'progcir_personal_data';
const CONG_STORAGE_KEY = 'progcir_congregations';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [guestPioneerData, setGuestPioneerData] = useState<{ ownerId: string; turma: string } | null>(null);
  const [guestCongressData, setGuestCongressData] = useState<{ ownerId: string } | null>(null);
  const [guestCacoData, setGuestCacoData] = useState<{ ownerId: string } | null>(null);
  const [guestCabrData, setGuestCabrData] = useState<{ ownerId: string } | null>(null);
  const [acceptedCongressInvites, setAcceptedCongressInvites] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'congregations' | 'personal_data' | 'substitutes' | 'itineraries' | 'settings' | 'users' | 'tjsec_accounts' | 'statistics' | 'congregation_statistics' | 'schools' | 'pioneer_school' | 'events' | 'regional_convention_program' | 'misc' | 'field_service_report' | 'aviso_de_visitas' | 'docx_demo' | 'cartas_dashboard' | 'cartas_esp' | 'cartas' | 'cartas_emr' | 'cartas_congresso' | 'cartas_assembleias' | 'cartas_programacoes' | string>('dashboard');
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const quotaExceededRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsType, setTermsType] = useState<'terms' | 'privacy'>('terms');

  const isAdminUser = user?.role === 'admin' || user?.email === 'weldonrs@gmail.com' || user?.usuario === '2283701' || user?.email === '2283701@progcir.app' || user?.email === '2283701@progcir.com';

  // Initialize client-side state and listen for quota events
  useEffect(() => {
    const isQuota = isQuotaExceeded();
    setQuotaExceeded(isQuota);
    quotaExceededRef.current = isQuota;

    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
      quotaExceededRef.current = true;
    };

    const handleQuotaCleared = () => {
      setQuotaExceeded(false);
      quotaExceededRef.current = false;
    };

    window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    window.addEventListener('firestore-quota-cleared', handleQuotaCleared);

    return () => {
      window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
      window.removeEventListener('firestore-quota-cleared', handleQuotaCleared);
    };
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageToCrop(reader.result as string);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCropComplete = async (croppedImage: string) => {
    if (!user?.id) return;
    
    setIsUploading(true);
    try {
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        photoURL: croppedImage
      });
      // Update local user state
      setUser((prev: any) => ({ ...prev, photoURL: croppedImage }));
      setImageToCrop(null);
    } catch (error) {
      console.error('Error updating profile photo:', error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Sync ref with state and check global quota
  useEffect(() => {
    quotaExceededRef.current = quotaExceeded;
    if (quotaExceeded) {
      setQuotaExceededGlobal();
    }
  }, [quotaExceeded]);


  // Browser back button support
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        setCurrentView(event.state.view);
      } else {
        setCurrentView('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Set initial state if not already set
    if (!window.history.state) {
      window.history.replaceState({ view: 'dashboard' }, '', '');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const changeView = (view: any, pushState = true) => {
    if (view === currentView) return;
    
    if (typeof view === 'string' && view.startsWith('pioneer_school_guest:')) {
      const [, ownerId, turma] = view.split(':');
      setGuestPioneerData({ ownerId, turma });
    } else if (typeof view === 'string' && view.startsWith('regional_convention_guest:')) {
      const [, ownerId] = view.split(':');
      setGuestCongressData({ ownerId });
    } else if (typeof view === 'string' && view.startsWith('circuit_assembly_supt_guest:')) {
      const [, ownerId] = view.split(':');
      setGuestCacoData({ ownerId });
    } else if (typeof view === 'string' && view.startsWith('circuit_assembly_branch_guest:')) {
      const [, ownerId] = view.split(':');
      setGuestCabrData({ ownerId });
    } else {
      setGuestPioneerData(null);
      setGuestCongressData(null);
      setGuestCacoData(null);
      setGuestCabrData(null);
    }

    setCurrentView(view);
    if (pushState) {
      window.history.pushState({ view }, '', '');
    }
  };

  const [lastSubViews, setLastSubViews] = useState<{ [key: string]: string }>({
    dashboard: 'dashboard',
    settings: 'settings',
    schools: 'schools'
  });
  const [personalData, setPersonalData] = useState<any>(null);
  const [loadingPersonalData, setLoadingPersonalData] = useState(true);
  const [congregations, setCongregations] = useState<any[]>([]);
  const [currentEvent, setCurrentEvent] = useState<string>('');
  const [selectedCongregation, setSelectedCongregation] = useState<any>(null);
  const [congStats, setCongStats] = useState({ 
    congregations: 0, 
    groups: 0, 
    substitutes: 0, 
    analyzedCongregations: 0,
    publicadoresAtivos: 0,
    pioneirosRegulares: 0,
    pioneirosEspeciais: 0,
    anciaos: 0,
    servos: 0
  });

  // Update congStats whenever congregations change
  useEffect(() => {
    let groups = 0;
    congregations.forEach(cong => {
      if (cong.grupos && Array.isArray(cong.grupos)) {
        groups += cong.grupos.length;
      }
    });
    setCongStats(prev => ({
      ...prev,
      congregations: congregations.length,
      groups: groups
    }));
  }, [congregations]);
  const [appConfig, setAppConfig] = useState<{ 
    reportEnabledForAll: boolean;
    congregationImportEnabledForAll: boolean;
    allowESPUploadForAll: boolean;
    allowEMRUploadForAll: boolean;
    allowCongressoUploadForAll: boolean;
    allowAssembleiasUploadForAll: boolean;
    allowProgramacoesUploadForAll: boolean;
    allowPSSUploadForAll: boolean;
  }>({ 
    reportEnabledForAll: false, 
    congregationImportEnabledForAll: false,
    allowESPUploadForAll: false,
    allowEMRUploadForAll: false,
    allowCongressoUploadForAll: false,
    allowAssembleiasUploadForAll: false,
    allowProgramacoesUploadForAll: false,
    allowPSSUploadForAll: false
  });
  const [hasGuestInvites, setHasGuestInvites] = useState(false);
  const [hasPendingInvites, setHasPendingInvites] = useState(false);

  const [espInitialMode, setEspInitialMode] = useState<'geracao' | 'manager'>('geracao');
  const [congressoInitialMode, setCongressoInitialMode] = useState<'geracao' | 'manager'>('geracao');
  const [emrInitialMode, setEmrInitialMode] = useState<'geracao' | 'manager'>('geracao');
  const [assembleiasInitialMode, setAssembleiasInitialMode] = useState<'geracao' | 'manager'>('geracao');
  const [programacoesInitialMode, setProgramacoesInitialMode] = useState<'geracao' | 'manager'>('geracao');

  // Monitorar convites de instrutor convidado - Otimizado com cleanup e quota check
  useEffect(() => {
    if (!user?.id || quotaExceeded) return;
    
    // Check invitations by number OR by ID
    const numeroPessoal = personalData?.numeroPessoal;
    if (!numeroPessoal && !user?.id) return;

    let unsubByNumber: () => void = () => {};
    let unsubById: () => void = () => {};

    try {
      const qByNumber = query(
        collection(db, 'pioneer_school_invitations'), 
        where('collaboratorNumber', '==', numeroPessoal || 'NONE'),
        where('status', '==', 'accepted')
      );

      const qById = query(
        collection(db, 'pioneer_school_invitations'), 
        where('collaboratorId', '==', user.id),
        where('status', '==', 'accepted')
      );

      const qPendingPioneer = query(
        collection(db, 'pioneer_school_invitations'),
        where('collaboratorId', '==', user.id),
        where('status', '==', 'pending')
      );

      const qPendingCongress = query(
        collection(db, 'regional_convention_invitations'),
        where('collaboratorId', '==', user.id),
        where('status', '==', 'pending')
      );

      const qAcceptedCongress = query(
        collection(db, 'regional_convention_invitations'),
        where('collaboratorId', '==', user.id),
        where('status', '==', 'accepted')
      );
      
      unsubByNumber = onSnapshot(qByNumber, (snap) => {
        if (!snap.empty) setHasGuestInvites(true);
      }, (error) => {
        console.warn('Home: Error listening to pioneer invites by number:', error);
        if (error.message?.includes('quota')) setQuotaExceededGlobal();
      });

      unsubById = onSnapshot(qById, (snap) => {
        if (!snap.empty) setHasGuestInvites(true);
      }, (error) => {
        console.warn('Home: Error listening to pioneer invites by ID:', error);
        if (error.message?.includes('quota')) setQuotaExceededGlobal();
      });

      const unsubPendingPioneer = onSnapshot(qPendingPioneer, (snap) => {
        setHasPendingInvites(prev => !snap.empty || prev);
      }, (error) => {
        console.warn('Home: Error listening to pending pioneer invites:', error);
      });

      const unsubPendingCongress = onSnapshot(qPendingCongress, (snap) => {
        setHasPendingInvites(prev => !snap.empty || prev);
      }, (error) => {
        console.warn('Home: Error listening to pending congress invites:', error);
      });

      const unsubAcceptedCongress = onSnapshot(qAcceptedCongress, (snap) => {
        setAcceptedCongressInvites(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.warn('Home: Error listening to accepted congress invites:', error);
      });

      return () => {
        unsubByNumber();
        unsubById();
        unsubPendingPioneer();
        unsubAcceptedCongress();
      };
    } catch (e) {
      console.error('Error setting up invites listener:', e);
    }
  }, [user?.id, personalData?.numeroPessoal, quotaExceeded]);

  // Track last sub-views for navigation persistence
  useEffect(() => {
    if (['dashboard', 'congregations', 'personal_data', 'substitutes', 'itineraries', 'statistics'].includes(currentView)) {
      setLastSubViews(prev => ({ ...prev, dashboard: currentView }));
    } else if (['events', 'regional_convention_program', 'circuit_assembly_supt_program', 'circuit_assembly_branch_program'].includes(currentView)) {
      setLastSubViews(prev => ({ ...prev, events: currentView }));
    } else if (['settings', 'users', 'tjsec_accounts'].includes(currentView)) {
      setLastSubViews(prev => ({ ...prev, settings: currentView }));
    } else if (['schools', 'pioneer_school'].includes(currentView)) {
      setLastSubViews(prev => ({ ...prev, schools: currentView }));
    } else if (['misc', 'field_service_report', 'file_viewer', 'weekly_expenses'].includes(currentView)) {
      setLastSubViews(prev => ({ ...prev, misc: currentView }));
    } else if (['cartas', 'cartas_esp', 'cartas_emr', 'cartas_congresso', 'cartas_assembleias', 'cartas_programacoes'].includes(currentView)) {
      setLastSubViews(prev => ({ ...prev, cartas: currentView }));
    }
  }, [currentView]);

  const isCurrentWeek = (semanaStr: string) => {
    if (!semanaStr) return false;
    const [day, month, year] = semanaStr.split('/').map(Number);
    if (!day || !month || !year) return false;
    const mondayDate = new Date(year, month - 1, day);
    const nextMonday = new Date(mondayDate);
    nextMonday.setDate(nextMonday.getDate() + 7);
    
    const now = new Date();
    return now >= mondayDate && now < nextMonday;
  };

  useEffect(() => {
    let unsubUser: (() => void) | null = null;

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const isAdminEmail = 
          firebaseUser.email === 'weldonrs@gmail.com' || 
          firebaseUser.email === '2283701@progcir.app' ||
          firebaseUser.email === '2283701@progcir.com';

        // Set a basic user state immediately
        const basicUserData = {
          id: firebaseUser.uid,
          usuario: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
          email: firebaseUser.email,
          role: isAdminEmail ? 'admin' : 'user',
          photoURL: firebaseUser.photoURL || null,
          migrationCompleted: true,
          itinerariesInitialized: true
        };
        setUser(basicUserData);

        if (isQuotaExceeded()) {
          setQuotaExceeded(true);
          console.log('Home: Quota exceeded flag active, skipping secondary fetches but allowing basic UI.');
          // Don't return here, let the UI render with what it has
        }

        const userDocRef = doc(db, 'users', firebaseUser.uid);

        // Otimizar atualizações de perfil - Throttle por 1 hora
        try {
          const lastUpdate = localStorage.getItem(`lastProfileSync_${firebaseUser.uid}`);
          const now = new Date().getTime();
          
          if (!lastUpdate || (now - parseInt(lastUpdate)) > 3600000) { 
             const userDoc = await getDoc(userDocRef);
             
             if (!userDoc.exists()) {
               await setDoc(userDocRef, {
                 email: firebaseUser.email,
                 role: isAdminEmail ? 'admin' : 'user',
                 photoURL: firebaseUser.photoURL || null,
                 createdAt: new Date().toISOString(),
                 lastLogin: new Date().toISOString(),
                 migrationCompleted: true
               });
             } else {
               const data = userDoc.data();
               const updates: any = {};
               if (isAdminEmail && data.role !== 'admin') updates.role = 'admin';
               updates.lastLogin = new Date().toISOString();
               if (Object.keys(updates).length > 0) {
                 await updateDoc(userDocRef, updates);
               }
             }
             localStorage.setItem(`lastProfileSync_${firebaseUser.uid}`, now.toString());
          }
        } catch (error: any) {
          console.warn('Silent sync error (likely quota):', error);
          if (error.message?.includes('quota')) setQuotaExceededGlobal();
        }
        
    unsubUser = onSnapshot(userDocRef, (userDoc) => {
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUser((prev: any) => ({
          ...prev,
          role: isAdminEmail ? 'admin' : (data.role || 'user'),
          photoURL: data.photoURL || null,
          migrationCompleted: data.migrationCompleted || false
        }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
      setQuotaExceeded(isQuotaExceeded());
    });
      } else {
        if (unsubUser) { unsubUser(); unsubUser = null; }
        setUser(null);
        setPersonalData(null);
        setCongStats({ 
          congregations: 0, groups: 0, substitutes: 0, analyzedCongregations: 0,
          publicadoresAtivos: 0, pioneirosRegulares: 0, pioneirosEspeciais: 0,
          anciaos: 0, servos: 0
        });
        setQuotaExceeded(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUser) unsubUser();
    };
  }, []);

  // Monitorar configuração global do app
  useEffect(() => {
    if (!user?.id || quotaExceeded) return;
    
    console.log('Home: Setting up app_settings listener...');
    const configRef = doc(db, 'config', 'app_settings');
    const unsubConfig = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        console.log('Home: App settings updated:', data);
        setAppConfig({ 
          reportEnabledForAll: !!data.reportEnabledForAll,
          congregationImportEnabledForAll: !!data.congregationImportEnabledForAll,
          allowESPUploadForAll: !!data.allowESPUploadForAll,
          allowEMRUploadForAll: !!data.allowEMRUploadForAll,
          allowCongressoUploadForAll: !!data.allowCongressoUploadForAll,
          allowAssembleiasUploadForAll: !!data.allowAssembleiasUploadForAll,
          allowProgramacoesUploadForAll: !!data.allowProgramacoesUploadForAll,
          allowPSSUploadForAll: !!data.allowPSSUploadForAll
        });
      } else {
        console.log('Home: App settings doc not found.');
        if (user?.role === 'admin') {
          console.log('Home: Initializing app settings for admin...');
          setDoc(configRef, { 
            reportEnabledForAll: false,
            congregationImportEnabledForAll: false,
            allowESPUploadForAll: false,
            allowEMRUploadForAll: false,
            allowCongressoUploadForAll: false,
            allowAssembleiasUploadForAll: false,
            allowProgramacoesUploadForAll: false,
            allowPSSUploadForAll: false
          }).catch(err => {
            handleFirestoreError(err, OperationType.WRITE, 'config/app_settings');
          });
        }
        setAppConfig({ 
          reportEnabledForAll: false, 
          congregationImportEnabledForAll: false,
          allowESPUploadForAll: false,
          allowEMRUploadForAll: false,
          allowCongressoUploadForAll: false,
          allowAssembleiasUploadForAll: false,
          allowProgramacoesUploadForAll: false,
          allowPSSUploadForAll: false
        });
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'config/app_settings');
      setQuotaExceeded(isQuotaExceeded());
    });

    return () => unsubConfig();
  }, [user?.id, user?.role, quotaExceeded]);

  useEffect(() => {
    const activeUid = user?.id || auth.currentUser?.uid;
    if (!activeUid || quotaExceeded) return;

    const q = query(collection(db, 'congregations'), where('userId', '==', activeUid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const congs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCongregations(congs);
      
      // Update congStats immediately
      let groups = 0;
      congs.forEach((cong: any) => {
        if (cong.grupos && Array.isArray(cong.grupos)) groups += cong.grupos.length;
      });
      setCongStats(prev => ({
        ...prev,
        congregations: congs.length,
        groups: groups
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'congregations');
      setQuotaExceeded(isQuotaExceeded());
    });

    return () => unsubscribe();
  }, [user?.id, quotaExceeded]);

  useEffect(() => {
    if (!user?.id || quotaExceeded) return;

    const isDashboard = currentView === 'dashboard';
    const isStats = currentView === 'statistics' || currentView === 'congregation_statistics';
    
    // Only load if needed
    if (!isDashboard && !isStats && personalData) return;

    const fetchData = async () => {
      const activeUid = user?.id;
      if (!activeUid) return;

      try {
        setLoadingPersonalData(true);
        
        // 1. Personal Data - Aggressive session cache
        const cachedPD = sessionStorage.getItem(`pd_${activeUid}`);
        if (cachedPD) {
          setPersonalData(JSON.parse(cachedPD));
          setLoadingPersonalData(false);
        }

        // Fetch if no cache OR is dashboard (to ensure fresh data)
        if (!cachedPD || isDashboard) {
          const pdDocRef = doc(db, 'personal_data', activeUid);
          const pdDoc = await getDoc(pdDocRef);
          
          if (pdDoc.exists()) {
            const data = pdDoc.data();
            setPersonalData(data);
            sessionStorage.setItem(`pd_${activeUid}`, JSON.stringify(data));
          } else {
            // Fallback query (only once per session)
            const fallbackKey = `fallbackDone_${activeUid}`;
            if (!sessionStorage.getItem(fallbackKey)) {
              const q = query(collection(db, 'personal_data'), where('userId', '==', activeUid), limit(1));
              const snap = await getDocs(q);
              if (!snap.empty) {
                const data = snap.docs[0].data();
                setPersonalData(data);
                sessionStorage.setItem(`pd_${activeUid}`, JSON.stringify(data));
                sessionStorage.setItem(fallbackKey, 'true');
              }
            }
          }
        }

        // 2. Statistics - Improved fetching and caching
        const cachedStats = sessionStorage.getItem(`stats_${activeUid}`);
        const now = new Date().getTime();
        const cacheDuration = 10 * 60 * 1000; // 10 minutes (shorter cache for better UX)
        let needsUpdate = !cachedStats;
        
        if (cachedStats) {
          try {
            const parsed = JSON.parse(cachedStats);
            setCongStats(prev => ({ ...prev, ...parsed.stats }));
            setCurrentEvent(parsed.currentEvent || '');
            if (now - parsed.timestamp > cacheDuration) {
              needsUpdate = true;
            }
          } catch (e) {
            needsUpdate = true;
          }
        }

        // Force update if we are on dashboard and stats look empty (except if it's really empty)
        if (isDashboard && !quotaExceeded && (needsUpdate || congStats.analyzedCongregations === 0)) {
          console.log(`🚀 [Firestore Fetch] Buscando novas estatísticas para ${activeUid}...`);
          
          // Use separate try-catches to avoid one failing the rest
          const fetchPromise = async () => {
            try {
              const [congSnap, subSnap, itinSnap, analysisSnap] = await Promise.all([
                getDocs(query(collection(db, 'congregations'), where('userId', '==', activeUid))),
                getDocs(query(collection(db, 'substitutes'), where('userId', '==', activeUid))),
                getDocs(query(collection(db, 'itineraries'), where('userId', '==', activeUid))),
                getDocs(query(collection(db, 'activity_analysis'), where('userId', '==', activeUid)))
              ]);

              let groups = 0;
              congSnap.docs.forEach((doc: any) => {
                const data = doc.data();
                if (data.grupos && Array.isArray(data.grupos)) groups += data.grupos.length;
              });

              const analyzedCongs = new Set(analysisSnap.docs.map(d => d.data().congregacao).filter(Boolean));
              
              const latestAnalyses: any = {};
              analysisSnap.docs.forEach(d => {
                const data = d.data();
                const cong = data.congregacao;
                if (!latestAnalyses[cong]) {
                  latestAnalyses[cong] = data;
                } else {
                  const parseDate = (s: string) => {
                    if (!s) return 0;
                    const [d,m,y] = s.split('/').map(Number);
                    return new Date(y, m-1, d).getTime();
                  };
                  if (parseDate(data.dataVisita) > parseDate(latestAnalyses[cong].dataVisita)) {
                    latestAnalyses[cong] = data;
                  }
                }
              });

              const statsArr = Object.values(latestAnalyses);
              const stats = {
                congregations: congSnap.size,
                groups,
                substitutes: subSnap.size,
                analyzedCongregations: analyzedCongs.size,
                publicadoresAtivos: statsArr.reduce((acc: number, a: any) => acc + (parseInt(a.pubAtivos) || 0), 0),
                pioneirosRegulares: statsArr.reduce((acc: number, a: any) => acc + (parseInt(a.ministério?.pioneirosRegulares?.relatando) || 0), 0),
                pioneirosEspeciais: statsArr.reduce((acc: number, a: any) => acc + (parseInt(a.ministério?.pioneirosEspeciais?.relatando) || 0), 0),
                anciaos: statsArr.reduce((acc: number, a: any) => acc + (a.estatisticas?.anciaos || 0), 0),
                servos: statsArr.reduce((acc: number, a: any) => acc + (a.estatisticas?.servos || 0), 0),
              };

              const foundEvent = itinSnap.docs.find(d => isCurrentWeek(d.data().semana))?.data().evento || '';
              
              setCongStats(stats);
              setCurrentEvent(foundEvent);
              sessionStorage.setItem(`stats_${activeUid}`, JSON.stringify({ stats, currentEvent: foundEvent, timestamp: now }));
            } catch (err) {
              console.error('Error fetching dashboard stats:', err);
              // Don't throw, just allow the UI to stay with what it has
            }
          };
          
          fetchPromise();
        }

      } catch (error: any) {
        handleFirestoreError(error, OperationType.GET, null);
        setQuotaExceeded(isQuotaExceeded());
      } finally {
        setLoadingPersonalData(false);
      }
    };

    fetchData();
  }, [user?.id, currentView, quotaExceeded]);

  // Logic to force Role Selection for new users or missing roles
  useEffect(() => {
    // We no longer force redirect to personal_data. 
    // The RoleSelectionModal is rendered conditionally if the role is missing.
  }, [user, personalData, loadingPersonalData, currentView, quotaExceeded]);

  const handlePersonalDataSave = () => {
    // Trigger re-fetch
    changeView('dashboard');
  };

  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [newsContent, setNewsContent] = useState<any>(null);

  // Fetch News and Config
  useEffect(() => {
    if (!user?.id) return;

    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'config', 'app_settings'));
        if (configDoc.exists()) {
          const configData = configDoc.data();
          if (configData.whatsNew?.active) {
            const seenVersion = localStorage.getItem(`seen_news_${configData.whatsNew.version}`);
            if (!seenVersion) {
              setNewsContent(configData.whatsNew);
              setShowWhatsNew(true);
            }
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'config/app_settings');
        setQuotaExceeded(isQuotaExceeded());
      }
    };

    fetchConfig();
  }, [user?.id]);

  const closeNews = () => {
    if (newsContent?.version) {
      localStorage.setItem(`seen_news_${newsContent.version}`, 'true');
    }
    setShowWhatsNew(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setQuotaExceeded(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user) {
    return <AuthForm onLoginSuccess={(userData) => setUser(userData)} />;
  }

  const showRoleSelection = user && !loadingPersonalData && (!personalData || !personalData.role) && !quotaExceeded;

  const handleCardClick = (title: string) => {
    if (title === 'Dados Pessoais') {
      changeView('personal_data');
    } else if (title === 'Congregações') {
      changeView('congregations');
    } else if (title === 'Substitutos') {
      changeView('substitutes');
    } else if (title === 'Itinerários') {
      changeView('itineraries');
    } else if (title === 'Aviso de Visitas') {
      changeView('aviso_de_visitas');
    } else if (title === 'Estatísticas') {
      changeView('statistics');
    } else if (title === 'Estatísticas Cong.') {
      changeView('congregation_statistics');
    } else if (title === 'Ajustes') {
      changeView('settings');
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] transition-all duration-500 ease-in-out portrait:flex-col landscape:flex-row print:block print:bg-white">
      {/* Novidades Modal */}
      <AnimatePresence>
        {showWhatsNew && newsContent && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden border border-amber-100"
            >
              <div className="bg-amber-600 p-8 text-white relative">
                <div className="absolute top-0 right-0 p-4">
                  <button 
                    onClick={closeNews}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                    <AlertCircle size={32} />
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-widest leading-none">
                    Novidades!
                  </h2>
                </div>
                <p className="text-amber-100 font-bold uppercase tracking-widest text-[10px]">Confira o que há de novo no app</p>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                    {newsContent.title}
                  </h3>
                  <div className="w-12 h-1.5 bg-amber-500 rounded-full" />
                </div>
                
                <p className="text-gray-600 font-bold text-sm leading-relaxed whitespace-pre-wrap">
                  {newsContent.content}
                </p>

                <button
                  onClick={closeNews}
                  className="w-full py-4 bg-amber-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg hover:bg-amber-700 transition-all active:scale-95"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="print:hidden">
        <Sidebar 
          onLogout={handleLogout} 
          user={user}
          personalData={personalData}
          currentView={currentView}
          espInitialMode={espInitialMode}
          hasGuestInvites={hasGuestInvites}
          hasPendingInvites={hasPendingInvites}
          onBack={() => changeView('dashboard')}
          onViewChange={(view) => {
            if (view === 'dashboard') {
              // If already in a Circuito sub-view, reset to main dashboard
              if (['dashboard', 'congregations', 'personal_data', 'substitutes', 'itineraries', 'statistics'].includes(currentView)) {
                changeView('dashboard');
              } else {
                // Restore last visited sub-view in Circuito
                changeView(lastSubViews.dashboard as any);
              }
            } else if (view === 'events') {
              // If already in an Events sub-view, reset to main events
              if (['events', 'regional_convention_program', 'circuit_assembly_supt_program', 'circuit_assembly_branch_program'].includes(currentView)) {
                changeView('events');
              } else {
                // Restore last visited sub-view in Events
                changeView(lastSubViews.events || 'events');
              }
            } else if (view === 'settings') {
              // If already in a Settings sub-view, reset to main settings
              if (['settings', 'users', 'tjsec_accounts'].includes(currentView)) {
                changeView('settings');
              } else {
                // Restore last visited sub-view in Settings
                changeView(lastSubViews.settings as any);
              }
            } else if (view === 'schools') {
              // If already in a Schools sub-view, reset to main schools
              if (['schools', 'pioneer_school'].includes(currentView)) {
                changeView('schools');
              } else {
                // Restore last visited sub-view in Schools
                changeView(lastSubViews.schools as any);
              }
            } else if (view === 'misc') {
              // If already in a Misc sub-view, reset to main misc
              if (['misc', 'field_service_report', 'file_viewer'].includes(currentView)) {
                changeView('misc');
              } else {
                // Restore last visited sub-view in Misc
                changeView(lastSubViews.misc || 'misc');
              }
            } else if (view === 'cartas') {
              // If already in a Cartas sub-view, reset to main selector
              if (['cartas', 'cartas_esp', 'cartas_emr', 'cartas_congresso', 'cartas_assembleias', 'cartas_programacoes'].includes(currentView)) {
                changeView('cartas');
              } else {
                // Restore last visited sub-view in Cartas
                changeView(lastSubViews.cartas || 'cartas');
              }
            } else {
              changeView(view as any);
            }
          }}
        />
      </div>
      
      <main className="flex-1 min-h-screen flex flex-col transition-all duration-500 
        landscape:ml-20 landscape:sm:ml-28 landscape:lg:ml-64
        portrait:md:ml-20 portrait:lg:ml-64 
        portrait:mb-16 portrait:md:mb-0 
        print:ml-0 print:mb-0 print:p-0">
        
        {/* Mobile Header (Hidden in portrait mode as requested) */}
        {/* <div className="md:hidden portrait:flex fixed top-0 left-0 right-0 h-14 bg-gradient-to-r from-[#2E1065] to-[#4C1D95] z-[1000] items-center px-4 border-b border-white/10 shadow-lg landscape:hidden">
          <Logo iconSize="w-8 h-8" textSize="text-xl" />
        </div> */}

        {/* Adjust spacing for mobile header - removed portrait padding */}
        <div className="landscape:pt-0 md:pt-0" />

        {quotaExceeded && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 md:mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-4 text-amber-800 shadow-sm"
          >
            <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
              <AlertCircle size={20} strokeWidth={3} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">Acesso Limitado (Aguardando Google)</p>
              <p className="text-[10px] font-bold text-amber-900/60 leading-tight">
                Seu projeto está no plano Blaze, mas o Google pode demorar alguns minutos para restabelecer o acesso após o limite ter sido atingido. 
                Clique no botão abaixo para limpar os alertas locais e tentar recarregar todos os dados.
              </p>
              <button 
                onClick={() => {
                  clearQuotaExceeded();
                  setQuotaExceeded(false);
                  window.location.reload();
                }}
                className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shadow-md active:scale-95"
              >
                Limpar e Recarregar Agora
              </button>
            </div>
            <button 
              onClick={() => setQuotaExceeded(false)}
              className="p-2 hover:bg-amber-100 rounded-full transition-all text-amber-400 hover:text-amber-600"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto w-full print:p-0 print:m-0 print:max-w-none print:space-y-0">
          {currentView === 'dashboard' && (
            <>
              {/* Welcome Section */}
              <div className="flex justify-between items-center gap-4 relative">
                <div className="border-2 border-blue-400 p-2 md:p-4 rounded-sm flex-1 md:flex-initial bg-white/50 flex items-center gap-3 md:gap-4">
                  <div 
                    className="relative w-12 h-12 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shadow-inner cursor-pointer group/avatar overflow-hidden flex-shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {user?.photoURL && user.photoURL.length > 5 && (user.photoURL.startsWith('http') || user.photoURL.startsWith('data:')) ? (
                      <Image 
                        src={user.photoURL} 
                        alt="Profile" 
                        fill 
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User size={24} className="md:w-8 md:h-8" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                      <Camera size={16} className="text-white md:w-5 md:h-5" />
                    </div>
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageSelect} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <div>
                    <h1 className="text-base md:text-xl font-bold text-blue-600 uppercase tracking-tight">Olá, {personalData?.nome || personalData?.numeroPessoal || user?.usuario || ''}</h1>
                    <p className="text-blue-400 font-medium uppercase tracking-widest text-[8px] md:text-xs">Seja bem-vindo ao ProgCir Web</p>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => changeView('donations')}
                  className="p-2.5 text-violet-500 hover:text-violet-600 transition-all group flex items-center gap-2 bg-white/40 backdrop-blur-sm rounded-xl hover:bg-white/80 shadow-sm border border-violet-100/50 hover:border-violet-200"
                >
                  <Coffee size={18} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all max-w-0 group-hover:max-w-[100px] overflow-hidden whitespace-nowrap">
                    Apoiar
                  </span>
                </motion.button>
              </div>

              {/* Dashboard Cards Grid */}
              <DashboardCards 
                onCardClick={handleCardClick} 
                congregationCount={congStats.congregations}
                groupCount={congStats.groups}
                substituteCount={congStats.substitutes}
                analyzedCongregationsCount={congStats.analyzedCongregations}
                currentEvent={currentEvent}
                user={user}
                personalData={personalData}
                hasGuestInvites={hasGuestInvites}
                hasPendingInvites={hasPendingInvites}
              />

              {/* Statistics Summary Bar */}
              <div className="bg-[#e0d8eb] p-2 md:p-4 rounded-xl md:rounded-full flex flex-wrap items-center justify-center landscape:justify-between md:justify-between px-4 md:px-10 text-[10px] md:text-xs font-bold text-[#3a264b] shadow-inner gap-2 md:gap-4">
                <div className="flex gap-1">Publicadores Ativos: <span className="font-normal underline decoration-dotted">{congStats.publicadoresAtivos.toLocaleString('pt-BR')}</span></div>
                <div className="flex gap-1">Pioneiros Regulares: <span className="font-normal underline decoration-dotted">{congStats.pioneirosRegulares.toLocaleString('pt-BR')}</span></div>
                <div className="flex gap-1">Pioneiros Especiais: <span className="font-normal underline decoration-dotted">{congStats.pioneirosEspeciais.toLocaleString('pt-BR')}</span></div>
                <div className="flex gap-1">Anciãos: <span className="font-normal underline decoration-dotted">{congStats.anciaos.toLocaleString('pt-BR')}</span></div>
                <div className="flex gap-1">Servos: <span className="font-normal underline decoration-dotted">{congStats.servos.toLocaleString('pt-BR')}</span></div>
              </div>

              {/* Activity and Map Section */}
              <SecondarySection 
                congregations={congregations} 
                onEdit={(cong) => {
                  setSelectedCongregation(cong);
                  changeView('congregations');
                }}
              />
            </>
          )}

          {currentView === 'donations' && (
            <DonationView 
              onBack={() => changeView('dashboard')} 
            />
          )}

          {currentView === 'congregations' && (
            <CongregationsView 
              userId={user.id} 
              isAdmin={user.role === 'admin'}
              importEnabledForAll={appConfig.congregationImportEnabledForAll}
              userRole={personalData?.role || 'viajante'}
              onBack={() => {
                changeView('dashboard');
                setSelectedCongregation(null);
              }} 
              initialCongregation={selectedCongregation}
            />
          )}

          {currentView === 'personal_data' && (
            <PersonalDataView 
              userId={user.id}
              onBack={() => changeView('dashboard')} 
              onSave={handlePersonalDataSave}
            />
          )}

          {currentView === 'substitutes' && (personalData?.role === 'viajante' || user?.role === 'admin') && (
            <SubstitutesView 
              userId={user.id}
              onBack={() => changeView('dashboard')} 
            />
          )}

          {currentView === 'itineraries' && (personalData?.role === 'viajante' || user?.role === 'admin') && (
            <ItinerariesView 
              userId={user.id}
              user={user}
              onBack={() => changeView('dashboard')} 
            />
          )}

          {currentView === 'settings' && (
            <SettingsView 
              userId={user.id}
              isAdmin={user.role === 'admin'}
              appConfig={appConfig}
              onBack={() => changeView('dashboard')} 
              onViewChange={(view) => changeView(view as any)}
            />
          )}

          {currentView === 'users' && (
            <UsersView 
              onBack={() => changeView('settings')} 
            />
          )}

          {currentView === 'tjsec_accounts' && (
            <TjSecAccountsView 
              onBack={() => changeView('settings')} 
            />
          )}

          {currentView === 'aviso_de_visitas' && (
            <GlobalS302View 
              userId={user.id}
              isAdmin={user.role === 'admin'}
              onBack={() => changeView('dashboard')} 
            />
          )}

          {currentView === 'statistics' && (personalData?.role === 'viajante' || user?.role === 'admin') && (
            <CircuitStatisticsView 
              userId={user.id}
              personalData={personalData}
              onBack={() => changeView('dashboard')} 
            />
          )}

          {currentView === 'congregation_statistics' && (personalData?.role === 'viajante' || user?.role === 'admin') && (
            <CongregationStatisticsView 
              userId={user.id} 
              onBack={() => changeView('dashboard')}
              initialCongregation={currentEvent}
            />
          )}

          {currentView === 'schools' && ((personalData?.role === 'viajante' || user?.role === 'admin') || hasGuestInvites) && (
            <SchoolsView 
              userId={user.id}
              congregations={congregations}
              personalData={personalData}
              onBack={() => changeView('dashboard')} 
              onViewChange={(view) => changeView(view as any)}
            />
          )}

          {currentView === 'pioneer_school' && (personalData?.role === 'viajante' || isAdminUser) && (
            <PioneerSchoolView 
              userId={user.id}
              isAdmin={isAdminUser}
              onBack={() => changeView('schools')}
              congregations={congregations}
              defaultCircuit={personalData?.circuito || ''}
            />
          )}

          {typeof currentView === 'string' && currentView.startsWith('pioneer_school_guest') && guestPioneerData && (
             <PioneerSchoolView 
               userId={guestPioneerData.ownerId}
               isGuest={true}
               guestTurma={guestPioneerData.turma}
               onBack={() => changeView('schools')}
               congregations={congregations} // We use the guest's congregations if needed, but the view might fetch them
               defaultCircuit=""
             />
          )}

          {currentView === 'events' && (personalData?.role === 'viajante' || user?.role === 'admin' || acceptedCongressInvites.length > 0) && (
            <EventsView 
              userId={user.id}
              acceptedCongressInvites={acceptedCongressInvites}
              onBack={() => changeView('dashboard')}
              onViewChange={changeView}
            />
          )}

          {currentView === 'regional_convention_program' && (
            <RegionalConventionView 
              userId={user.id}
              onBack={() => changeView('events')}
            />
          )}

          {currentView === 'circuit_assembly_supt_program' && (
            <CircuitAssemblyView 
              userId={user.id}
              onBack={() => changeView('events')}
              type="supt"
            />
          )}

          {currentView === 'circuit_assembly_branch_program' && (
            <CircuitAssemblyView 
              userId={user.id}
              onBack={() => changeView('events')}
              type="branch"
            />
          )}

          {currentView === 'special_pioneer_meeting_program' && (
            <SpecialPioneerMeetingView 
              userId={user.id}
              onBack={() => changeView('events')}
            />
          )}

          {typeof currentView === 'string' && currentView.startsWith('regional_convention_guest') && guestCongressData && (
            <RegionalConventionView 
              userId={guestCongressData.ownerId}
              isGuest={true}
              onBack={() => changeView('settings')}
            />
          )}

          {typeof currentView === 'string' && currentView.startsWith('circuit_assembly_supt_guest') && guestCacoData && (
            <CircuitAssemblyView 
              userId={guestCacoData.ownerId}
              isGuest={true}
              onBack={() => changeView('settings')}
              type="supt"
            />
          )}

          {typeof currentView === 'string' && currentView.startsWith('circuit_assembly_branch_guest') && guestCabrData && (
            <CircuitAssemblyView 
              userId={guestCabrData.ownerId}
              isGuest={true}
              onBack={() => changeView('settings')}
              type="branch"
            />
          )}

          {currentView === 'misc' && (
            <MiscView 
              isAdmin={user?.role === 'admin'}
              appConfig={appConfig}
              onViewChange={(view) => changeView(view as any)}
            />
          )}

          {currentView === 'field_service_report' && (
            <FieldServiceReportView 
              userId={user?.id}
              wifeNameProp={personalData?.nomeEsposa}
              onBack={() => changeView('misc')}
            />
          )}

          {currentView === 'file_viewer' && (
            <FileViewer 
              onBack={() => changeView('misc')}
            />
          )}

          {currentView === 'weekly_expenses' && (
            <WeeklyExpensesReceipt 
              onBack={() => changeView('misc')}
            />
          )}

          {currentView === 'cartas_dashboard' && (
            <CartasDashboard 
              onViewChange={(view) => {
                if (view === 'cartas_esp') setEspInitialMode('manager');
                changeView(view as any);
              }}
            />
          )}

          {currentView === 'cartas_esp' && (
            <CartasESPView 
              userId={user.id}
              isAdmin={user.role === 'admin'}
              canManage={true}
              initialMode={espInitialMode}
              onBack={() => changeView('cartas')}
            />
          )}

          {currentView === 'cartas' && (personalData?.role === 'viajante' || isAdminUser) && (
            <CartasSeletorView 
              isAdmin={isAdminUser}
              appConfig={appConfig}
              onViewChange={(view) => {
                if (view.endsWith(':manager')) {
                  const baseView = view.split(':')[0];
                  if (baseView === 'cartas_esp') setEspInitialMode('manager');
                  if (baseView === 'cartas_congresso') setCongressoInitialMode('manager');
                  if (baseView === 'cartas_emr') setEmrInitialMode('manager');
                  if (baseView === 'cartas_assembleias') setAssembleiasInitialMode('manager');
                  if (baseView === 'cartas_programacoes') setProgramacoesInitialMode('manager');
                  changeView(baseView as any);
                } else {
                  if (view === 'cartas_esp') setEspInitialMode('geracao');
                  if (view === 'cartas_congresso') setCongressoInitialMode('geracao');
                  if (view === 'cartas_emr') setEmrInitialMode('geracao');
                  if (view === 'cartas_assembleias') setAssembleiasInitialMode('geracao');
                  if (view === 'cartas_programacoes') setProgramacoesInitialMode('geracao');
                  changeView(view as any);
                }
              }}
            />
          )}

          {currentView === 'cartas_emr' && (
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden min-h-[80vh] flex flex-col items-center justify-center space-y-6 p-10 text-center">
              <div className="bg-blue-100 p-6 rounded-full text-blue-600 shadow-inner">
                <Send size={64} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tight">Cartas EMR</h2>
                <p className="text-gray-500 font-medium uppercase tracking-widest text-sm">Esta funcionalidade será implementada em breve.</p>
              </div>
              <button 
                onClick={() => changeView('cartas')}
                className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 uppercase tracking-widest text-xs"
              >
                Voltar para Cartas
              </button>
            </div>
          )}

          {currentView === 'cartas_congresso' && (
            <CartasCongressoView 
              userId={user.id}
              isAdmin={user.role === 'admin'}
              canManage={true}
              initialMode={congressoInitialMode}
              onBack={() => changeView('cartas')}
            />
          )}

          {currentView === 'cartas_assembleias' && (
            <CartasAssembleiasView 
              userId={user.id}
              isAdmin={user.role === 'admin'}
              canManage={true}
              initialMode={assembleiasInitialMode}
              onBack={() => changeView('cartas')}
            />
          )}

          {currentView === 'cartas_programacoes' && (
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden min-h-[80vh] flex flex-col items-center justify-center space-y-6 p-10 text-center">
              <div className="bg-pink-100 p-6 rounded-full text-pink-600 shadow-inner">
                <FileText size={64} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tight">Programações</h2>
                <p className="text-gray-500 font-medium uppercase tracking-widest text-sm">Esta funcionalidade será implementada em breve.</p>
              </div>
              <button 
                onClick={() => changeView('cartas')}
                className="px-8 py-3 bg-pink-600 text-white rounded-2xl font-bold hover:bg-pink-700 transition-all shadow-lg shadow-pink-200 uppercase tracking-widest text-xs"
              >
                Voltar para Cartas
              </button>
            </div>
          )}

          {showRoleSelection && (
            <RoleSelectionModal 
              userId={user.id} 
              onRoleSelected={(role) => {
                setPersonalData((prev: any) => ({ ...prev, role }));
              }} 
            />
          )}
        </div>


        {/* Footer */}
        <footer className="mt-auto p-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center text-xs text-gray-400 print:hidden gap-4">
          <p>© 2024 ProgCir Web - Gestão de Circuitos</p>
          <div className="flex gap-6">
            <button 
              onClick={() => { setTermsType('terms'); setShowTerms(true); }}
              className="hover:text-[#6c40bd] transition-colors"
            >
              Termos de Uso
            </button>
            <button 
              onClick={() => { setTermsType('privacy'); setShowTerms(true); }}
              className="hover:text-[#6c40bd] transition-colors"
            >
              Privacidade
            </button>
          </div>
        </footer>
      </main>
      {imageToCrop && (
        <ImageCropper 
          image={imageToCrop} 
          onCropComplete={handleCropComplete} 
          onCancel={() => setImageToCrop(null)} 
          isProfileMode={true}
        />
      )}
      <TermsAndPrivacy 
        isOpen={showTerms} 
        onClose={() => setShowTerms(false)} 
        initialTab={termsType}
      />
      <FloatingStopwatch />
    </div>
  );
}
