'use client';
// Force rebuild - 2026-04-28
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';

const DashboardCards = dynamic(() => import('@/components/DashboardCards'), { ssr: false });
const SecondarySection = dynamic(() => import('@/components/SecondarySection'), { ssr: false });
const AuthForm = dynamic(() => import('@/components/AuthForm'), { ssr: false });
const PersonalDataView = dynamic(() => import('@/components/PersonalDataView'), { ssr: false });
const CongregationsView = dynamic(() => import('@/components/CongregationsView'), { ssr: false });
const SubstitutesView = dynamic(() => import('@/components/SubstitutesView'), { ssr: false });
const ItinerariesView = dynamic(() => import('@/components/ItinerariesView'), { ssr: false });
const SettingsView = dynamic(() => import('@/components/SettingsView'), { ssr: false });
const UsersView = dynamic(() => import('@/components/UsersView'), { ssr: false });
const CircuitStatisticsView = dynamic(() => import('@/components/CircuitStatisticsView'), { ssr: false });
const SchoolsView = dynamic(() => import('@/components/SchoolsView'), { ssr: false });
const PioneerSchoolView = dynamic(() => import('@/components/PioneerSchoolView'), { ssr: false });
const CongregationStatisticsView = dynamic(() => import('@/components/CongregationStatisticsView'), { ssr: false });
const EventsView = dynamic(() => import('@/components/EventsView'), { ssr: false });
const RegionalConventionView = dynamic(() => import('@/components/RegionalConventionView'), { ssr: false });
const MiscView = dynamic(() => import('@/components/MiscView'), { 
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
      <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Módulo Diversos...</p>
    </div>
  )
});
const TextEditor = dynamic(() => import('@/components/TextEditor'), { ssr: false });
const FieldServiceReportView = dynamic(() => import('@/components/FieldServiceReportView'), { ssr: false });
const DocxToPdfDemo = dynamic(() => import('@/components/DocxToPdfDemo'), { ssr: false });
const CartasDashboard = dynamic(() => import('@/components/CartasDashboard'), { ssr: false });
const CartasESPView = dynamic(() => import('@/components/CartasESPView'), { ssr: false });
const CartasCongressoView = dynamic(() => import('@/components/CartasCongressoView'), { ssr: false });
const CartasSeletorView = dynamic(() => import('@/components/CartasSeletorView'), { ssr: false });
const GlobalS302View = dynamic(() => import('@/components/S302GlobalView'), { ssr: false });
const RoleSelectionModal = dynamic(() => import('@/components/RoleSelectionModal'), { ssr: false });
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
import { handleFirestoreError, OperationType, isQuotaExceeded, setQuotaExceededGlobal } from '@/utils/firestore';
import { Camera, User, ArrowLeft } from 'lucide-react';

const STORAGE_KEY = 'progcir_personal_data';
const CONG_STORAGE_KEY = 'progcir_congregations';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [guestPioneerData, setGuestPioneerData] = useState<{ ownerId: string; turma: string } | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'congregations' | 'personal_data' | 'substitutes' | 'itineraries' | 'settings' | 'users' | 'statistics' | 'congregation_statistics' | 'schools' | 'pioneer_school' | 'events' | 'regional_convention_program' | 'misc' | 'text_editor' | 'field_service_report' | 'aviso_de_visitas' | 'docx_demo' | 'cartas_dashboard' | 'cartas_esp' | 'cartas' | 'cartas_emr' | 'cartas_congresso' | 'cartas_assembleias' | 'cartas_programacoes' | string>('dashboard');
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const quotaExceededRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsType, setTermsType] = useState<'terms' | 'privacy'>('terms');

  // Initialize client-side state
  useEffect(() => {
    const isQuota = isQuotaExceeded();
    setQuotaExceeded(isQuota);
    quotaExceededRef.current = isQuota;
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
    } else {
      setGuestPioneerData(null);
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
  const [currentEvent, setCurrentEvent] = useState<string>('');
  const [congregations, setCongregations] = useState<any[]>([]);
  const [selectedCongregation, setSelectedCongregation] = useState<any>(null);
  const [appConfig, setAppConfig] = useState<{ 
    reportEnabledForAll: boolean;
    textEditorEnabledForAll: boolean;
    congregationImportEnabledForAll: boolean;
  }>({ reportEnabledForAll: false, textEditorEnabledForAll: false, congregationImportEnabledForAll: false });
  const [hasGuestInvites, setHasGuestInvites] = useState(false);

  const [espInitialMode, setEspInitialMode] = useState<'geracao' | 'manager'>('geracao');

  // Monitorar convites de instrutor convidado
  useEffect(() => {
    if (!user?.id || quotaExceeded) return;
    
    // Check invitations by number OR by ID
    const numeroPessoal = personalData?.numeroPessoal;
    if (!numeroPessoal && !user?.id) return;

    // We check both because some might be saved by number, some by ID
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
    
    const unsubByNumber = onSnapshot(qByNumber, (snap) => {
      if (!snap.empty) setHasGuestInvites(true);
    });

    const unsubById = onSnapshot(qById, (snap) => {
      if (!snap.empty) setHasGuestInvites(true);
    });

    return () => {
      unsubByNumber();
      unsubById();
    };
  }, [user?.id, personalData?.numeroPessoal, quotaExceeded]);

  // Track last sub-views for navigation persistence
  useEffect(() => {
    if (['dashboard', 'congregations', 'personal_data', 'substitutes', 'itineraries', 'statistics'].includes(currentView)) {
      setLastSubViews(prev => ({ ...prev, dashboard: currentView }));
    } else if (['events', 'regional_convention_program'].includes(currentView)) {
      setLastSubViews(prev => ({ ...prev, events: currentView }));
    } else if (['settings', 'users'].includes(currentView)) {
      setLastSubViews(prev => ({ ...prev, settings: currentView }));
    } else if (['schools', 'pioneer_school'].includes(currentView)) {
      setLastSubViews(prev => ({ ...prev, schools: currentView }));
    } else if (['misc', 'text_editor', 'field_service_report'].includes(currentView)) {
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
        // Set a basic user state immediately so we don't stay on the login screen if authenticated
        const basicUserData = {
          id: firebaseUser.uid,
          usuario: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
          email: firebaseUser.email,
          role: 'user', // Default role
          photoURL: firebaseUser.photoURL || null,
          migrationCompleted: true, // Assume true to avoid migration loops if quota is hit
          itinerariesInitialized: true
        };
        setUser(basicUserData);

        const userDocRef = doc(db, 'users', firebaseUser.uid);

        // Update last login once per session/auth change
        try {
          // Check if quota is already exceeded before doing anything
          if (isQuotaExceeded()) {
            setQuotaExceeded(true);
            return;
          }

          const userDoc = await getDoc(userDocRef);
          const isAdminEmail = 
            firebaseUser.email === 'weldonrs@gmail.com' || 
            firebaseUser.email === '2283701@progcir.app' ||
            firebaseUser.email === '2283701@progcir.com';
          const role = isAdminEmail ? 'admin' : 'user';

          if (!userDoc.exists()) {
            // Only attempt setDoc if quota not already known to be exceeded
            if (!quotaExceededRef.current) {
              await setDoc(userDocRef, {
                email: firebaseUser.email,
                role: role,
                photoURL: null,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                migrationCompleted: false
              });
              localStorage.setItem(`lastLoginUpdate_${firebaseUser.uid}`, new Date().getTime().toString());
            }
          } else {
            const data = userDoc.data();
            const updates: any = {};
            
            // Ensure admin role is set for admin emails
            if (isAdminEmail && data.role !== 'admin') {
              updates.role = 'admin';
            }

            // Update lastLogin only once per day to save quota (changed from 1 hour to 24 hours)
            const lastUpdate = localStorage.getItem(`lastLoginUpdate_${firebaseUser.uid}`);
            const now = new Date().getTime();
            if (!lastUpdate || (now - parseInt(lastUpdate)) > 86400000) { // 24 hours
              updates.lastLogin = new Date().toISOString();
              localStorage.setItem(`lastLoginUpdate_${firebaseUser.uid}`, now.toString());
            }

            if (Object.keys(updates).length > 0 && !quotaExceededRef.current) {
              await updateDoc(userDocRef, updates);
            }
          }
        } catch (error: any) {
          console.error('Error updating user login info:', error);
          if (error.message?.includes('quota') || error.message?.includes('resource-exhausted')) {
            setQuotaExceeded(true);
            setQuotaExceededGlobal();
          }
        }
        
        // Listen for changes without updating back (no loop)
        unsubUser = onSnapshot(userDocRef, (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data();
            const userData = {
              id: firebaseUser.uid,
              usuario: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
              email: firebaseUser.email,
              role: data.role || 'user',
              photoURL: data.photoURL || null,
              migrationCompleted: data.migrationCompleted || false,
              itinerariesInitialized: data.itinerariesInitialized || false
            };
            setUser(userData);
          }
        }, (error) => {
          // Don't throw here to avoid crashing the app if quota is hit
          if (auth.currentUser) {
            console.error('Error listening to user profile (likely quota exceeded):', error);
            if (error.message?.includes('quota') || error.message?.includes('resource-exhausted')) {
              setQuotaExceeded(true);
              setQuotaExceededGlobal();
            }
          }
        });
      } else {
        if (unsubUser) {
          unsubUser();
          unsubUser = null;
        }
        setUser(null);
        setPersonalData(null);
        setLoadingPersonalData(false);
        setCongStats({ 
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
          textEditorEnabledForAll: !!data.textEditorEnabledForAll,
          congregationImportEnabledForAll: !!data.congregationImportEnabledForAll
        });
      } else {
        console.log('Home: App settings doc not found.');
        if (user?.role === 'admin') {
          console.log('Home: Initializing app settings for admin...');
          setDoc(configRef, { 
            reportEnabledForAll: false,
            textEditorEnabledForAll: false,
            congregationImportEnabledForAll: false
          }).catch(err => {
            console.error('Home: Failed to init app settings:', err);
          });
        }
        setAppConfig({ 
          reportEnabledForAll: false, 
          textEditorEnabledForAll: false, 
          congregationImportEnabledForAll: false 
        });
      }
    }, (err) => {
      console.warn('Home: Error listening to app settings (likely permissions):', err);
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
    }, (error) => {
      console.error('Error listening to congregations:', error);
    });

    return () => unsubscribe();
  }, [user?.id, quotaExceeded]);

  useEffect(() => {
    if (!user?.id) return;

    const isDashboard = currentView === 'dashboard';
    
    const fetchData = async () => {
      // Use user.id as the primary source of truth for the UID
      const activeUid = user?.id;
      if (!activeUid) {
        console.log('fetchData: No activeUid, skipping.');
        return;
      }

      // Ensure auth.currentUser is available and matches user.id
      // This prevents permission errors due to race conditions during auth state changes
      if (!auth.currentUser || auth.currentUser.uid !== activeUid) {
        console.log(`fetchData: Waiting for auth.currentUser for UID ${activeUid}...`);
        let attempts = 0;
        while ((!auth.currentUser || auth.currentUser.uid !== activeUid) && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!auth.currentUser || auth.currentUser.uid !== activeUid) {
          console.warn(`fetchData: auth.currentUser not ready or UID mismatch after waiting. Auth UID: ${auth.currentUser?.uid}, activeUid: ${activeUid}`);
          return;
        }
      }
      
      // fetchData: Starting logic removed slowgetIdTokenResult call
      try {
        setLoadingPersonalData(true);
        // Fetch Personal Data if not already loaded or if it's been a while
        if (!personalData || isDashboard) {
          const pdDocRef = doc(db, 'personal_data', activeUid);
          console.log(`fetchData: Attempting getDoc(personal_data/${activeUid})`);
          let pdDoc = null;
          try {
            pdDoc = await getDoc(pdDocRef);
            console.log(`fetchData: Personal data doc exists: ${pdDoc.exists()}`);
          } catch (error) {
            // Log but don't throw yet, as we have a fallback query
            console.warn(`fetchData: Initial getDoc(personal_data/${activeUid}) failed:`, error);
          }
          
          if (pdDoc && pdDoc.exists()) {
            const pdData = pdDoc.data();
            setPersonalData(pdData);
            // Only update user state if the username is different to avoid loops
            if (pdData.numeroPessoal && pdData.numeroPessoal !== user.usuario) {
              setUser((prev: any) => prev ? ({ ...prev, usuario: pdData.numeroPessoal }) : null);
            }
          } else {
            // Fallback: search by userId field
            const hasMigratedFallback = localStorage.getItem(`pdMigrationFallbackAttempted_${activeUid}`);
            if (!hasMigratedFallback && !quotaExceeded) {
              console.log(`fetchData: Falling back to query for personal_data where userId == ${activeUid}`);
              // Use auth.currentUser.uid directly to be absolutely sure we are using the authenticated UID
              const currentUid = auth.currentUser?.uid;
              if (!currentUid) {
                console.warn('fetchData: auth.currentUser disappeared during query setup');
                return;
              }
              const pdQuery = query(collection(db, 'personal_data'), where('userId', '==', currentUid), limit(1));
              let pdSnapshot;
              try {
                pdSnapshot = await getDocs(pdQuery);
                console.log(`fetchData: Fallback query by userId result empty: ${pdSnapshot.empty}`);
              } catch (error) {
                console.error('fetchData: Fallback query failed:', error);
                handleFirestoreError(error, OperationType.LIST, 'personal_data (query by userId)');
              }
              
              if (pdSnapshot && !pdSnapshot.empty) {
                localStorage.setItem(`pdMigrationFallbackAttempted_${activeUid}`, 'true');
                const pdData = pdSnapshot.docs[0].data();
                setPersonalData(pdData);
                // Migrate this doc to use activeUid as ID
                try {
                  await setDoc(doc(db, 'personal_data', activeUid), { ...pdData, userId: activeUid });
                } catch (error) {
                  console.error('fetchData: Failed to migrate personal_data doc:', error);
                  handleFirestoreError(error, OperationType.WRITE, `personal_data/${activeUid}`);
                }
              } else {
                console.log('fetchData: No personal data found in fallback query.');
              }
            }
          }
        }
        
        // MIGRATION LOGIC (only if not already completed)
        if (!user.migrationCompleted && !personalData) {
          const username = user.usuario;
          const hasMigrated = localStorage.getItem(`migrationAttempted_${activeUid}`);
          
          if (username && !hasMigrated && !quotaExceeded) {
            localStorage.setItem(`migrationAttempted_${activeUid}`, 'true');
            let migrationSnapshot;
            try {
              let migrationQuery = query(collection(db, 'personal_data'), where('numeroPessoal', '==', username), limit(1));
              migrationSnapshot = await getDocs(migrationQuery);
              
              // If not found by username, try by email
              if ((!migrationSnapshot || migrationSnapshot.empty) && auth.currentUser?.email) {
                const emailQuery = query(collection(db, 'personal_data'), where('emailPessoal', '==', auth.currentUser.email), limit(1));
                migrationSnapshot = await getDocs(emailQuery);
                
                if (!migrationSnapshot || migrationSnapshot.empty) {
                  const jwpubQuery = query(collection(db, 'personal_data'), where('emailJwpub', '==', auth.currentUser.email), limit(1));
                  migrationSnapshot = await getDocs(jwpubQuery);
                }
              }
            } catch (error) {
              // Migration query might fail if rules are strict, but we catch it
              console.warn('Migration query failed (likely permissions):', error);
            }

            if (!auth.currentUser) return;

            let oldUserId = null;
            let oldData = null;

            if (migrationSnapshot && !migrationSnapshot.empty) {
              const docSnap = migrationSnapshot.docs[0];
              oldData = docSnap.data();
              oldUserId = oldData.userId;
            }
            
            if (oldUserId && oldUserId !== activeUid && oldData) {
              const migratedData = {
                ...oldData,
                userId: activeUid,
                numeroPessoal: username
              };
              try {
                await setDoc(doc(db, 'personal_data', activeUid), migratedData);
                setPersonalData(migratedData);
                
                // Migrate other collections
                const collectionsToMigrate = ['congregations', 'substitutes', 'itineraries', 'activity_analysis', 's303_reports'];
                const batch = writeBatch(db);
                let batchCount = 0;
                
                // Track documents to delete from old user
                const docsToDelete: { collection: string; id: string }[] = [];
                
                for (const collName of collectionsToMigrate) {
                  try {
                    const q = query(collection(db, collName), where('userId', '==', oldUserId));
                    const snapshot = await getDocs(q);
                    for (const d of snapshot.docs) {
                      const docData = d.data();
                      let newDocRef;
                      
                      if (collName === 'activity_analysis' || collName === 's303_reports') {
                        const congregacao = docData.congregacao || '';
                        const dataVisita = docData.dataVisita || '';
                        const newId = `${activeUid}_${congregacao}_${dataVisita.replace(/\//g, '-')}`;
                        newDocRef = doc(db, collName, newId);
                      } else {
                        // Create a new document with a new ID to avoid modifying the original
                        newDocRef = doc(collection(db, collName));
                      }
                      
                      batch.set(newDocRef, { ...docData, userId: activeUid });
                      docsToDelete.push({ collection: collName, id: d.id });
                      batchCount++;
                      if (batchCount >= 400) break; // Leave room for deletions
                    }
                  } catch (error) {
                    console.warn(`Migration of ${collName} failed:`, error);
                  }
                  if (batchCount >= 400) break;
                }

                if (batchCount > 0) {
                  await batch.commit();
                }

                // Delete old documents to prevent duplication in the system
                const deleteBatch = writeBatch(db);
                let deleteCount = 0;
                
                // Delete old personal_data and old user profile
                deleteBatch.delete(doc(db, 'personal_data', oldUserId));
                deleteBatch.delete(doc(db, 'users', oldUserId));
                deleteCount += 2;

                for (const docInfo of docsToDelete) {
                  deleteBatch.delete(doc(db, docInfo.collection, docInfo.id));
                  deleteCount++;
                  if (deleteCount >= 450) break;
                }
                
                if (deleteCount > 0) {
                  await deleteBatch.commit();
                }

                // Mark migration as completed in current user doc
                await updateDoc(doc(db, 'users', activeUid), { 
                  migrationCompleted: true,
                  migrationV2Completed: true
                });
              } catch (error) {
                console.error('Migration process failed:', error);
              }
            }
          } else if (user.migrationCompleted && !user.migrationV2Completed && !quotaExceeded) {
            // V2 Migration for users who already migrated but missed analysis/reports
            const username = user.usuario;
            const hasMigratedV2 = localStorage.getItem(`migrationV2Attempted_${activeUid}`);
            
            if (username && !hasMigratedV2) {
              localStorage.setItem(`migrationV2Attempted_${activeUid}`, 'true');
              try {
                let migrationQuery = query(collection(db, 'personal_data'), where('numeroPessoal', '==', username), limit(1));
                let migrationSnapshot = await getDocs(migrationQuery);
                
                // If not found by username, try by email
                if (migrationSnapshot.empty && auth.currentUser?.email) {
                  const emailQuery = query(collection(db, 'personal_data'), where('emailPessoal', '==', auth.currentUser.email), limit(1));
                  migrationSnapshot = await getDocs(emailQuery);
                  
                  if (migrationSnapshot.empty) {
                    const jwpubQuery = query(collection(db, 'personal_data'), where('emailJwpub', '==', auth.currentUser.email), limit(1));
                    migrationSnapshot = await getDocs(jwpubQuery);
                  }
                }
                
                if (!migrationSnapshot.empty) {
                  const oldData = migrationSnapshot.docs[0].data();
                  const oldUserId = oldData.userId;
                  
                  if (oldUserId && oldUserId !== activeUid) {
                    const collectionsToMigrate = ['activity_analysis', 's303_reports'];
                    const batch = writeBatch(db);
                    let batchCount = 0;
                    const docsToDelete: { collection: string; id: string }[] = [];
                    
                    for (const collName of collectionsToMigrate) {
                      const q = query(collection(db, collName), where('userId', '==', oldUserId));
                      const snapshot = await getDocs(q);
                      for (const d of snapshot.docs) {
                        const docData = d.data();
                        const congregacao = docData.congregacao || '';
                        const dataVisita = docData.dataVisita || '';
                        const newId = `${activeUid}_${congregacao}_${dataVisita.replace(/\//g, '-')}`;
                        const newDocRef = doc(db, collName, newId);
                        
                        batch.set(newDocRef, { ...docData, userId: activeUid });
                        docsToDelete.push({ collection: collName, id: d.id });
                        batchCount++;
                        if (batchCount >= 450) break;
                      }
                      if (batchCount >= 450) break;
                    }
                    
                    if (batchCount > 0) {
                      await batch.commit();
                      
                      // Delete old docs for V2 migration too
                      const deleteBatch = writeBatch(db);
                      for (const docInfo of docsToDelete) {
                        deleteBatch.delete(doc(db, docInfo.collection, docInfo.id));
                      }
                      await deleteBatch.commit();
                    }
                    
                    await updateDoc(doc(db, 'users', activeUid), { migrationV2Completed: true });
                    setUser((prev: any) => prev ? { ...prev, migrationV2Completed: true } : null);
                  }
                }
              } catch (error) {
                console.warn('V2 Migration failed:', error);
              }
            }
          }
        }

        // Fetch Stats (only if on dashboard or cache expired)
        const cachedStatsStr = sessionStorage.getItem(`dashboardStats_${activeUid}`);
        const now = new Date().getTime();
        let shouldFetchStats = isDashboard;
        
        if (cachedStatsStr) {
          const cached = JSON.parse(cachedStatsStr);
          setCongStats(cached.stats);
          // If cache is less than 10 minutes old, don't fetch unless explicitly on dashboard and cache is > 2 min
          if (now - cached.timestamp < 600000) {
            if (!isDashboard || (now - cached.timestamp < 120000)) {
              shouldFetchStats = false;
            }
          }
        }

        if (shouldFetchStats && !quotaExceeded) {
          let congSnap: any, subSnap: any, itinSnap: any, analysisSnap: any;
          try {
            console.log(`fetchData: Fetching stats for ${activeUid}...`);
            const results = await Promise.all([
              getDocs(query(collection(db, 'congregations'), where('userId', '==', activeUid))).catch(e => { console.error('Congregations fetch failed:', e); throw e; }),
              getDocs(query(collection(db, 'substitutes'), where('userId', '==', activeUid))).catch(e => { console.error('Substitutes fetch failed:', e); throw e; }),
              getDocs(query(collection(db, 'itineraries'), where('userId', '==', activeUid))).catch(e => { console.error('Itineraries fetch failed:', e); throw e; }),
              getDocs(query(collection(db, 'activity_analysis'), where('userId', '==', activeUid))).catch(e => { console.error('Analysis fetch failed:', e); throw e; })
            ]);
            [congSnap, subSnap, itinSnap, analysisSnap] = results;
            console.log('fetchData: Stats fetched successfully');
          } catch (error) {
            console.error('fetchData: Promise.all for stats failed:', error);
            handleFirestoreError(error, OperationType.GET, 'dashboard_stats');
            return;
          }

          let groups = 0;
          congSnap.docs.forEach((doc: any) => {
            const data = doc.data();
            if (data.grupos && Array.isArray(data.grupos)) {
              groups += data.grupos.length;
            }
          });

          // Count unique congregations with analysis
          const analyzedCongs = new Set();
          analysisSnap.docs.forEach((doc: any) => {
            const data = doc.data();
            if (data.congregacao) {
              analyzedCongs.add(data.congregacao);
            }
          });

          const analysesByCong: { [key: string]: any } = {};
          analysisSnap.docs.forEach((doc: any) => {
            const data = doc.data();
            const cong = data.congregacao;
            if (!analysesByCong[cong]) {
              analysesByCong[cong] = data;
            } else {
              const currentLatest = analysesByCong[cong];
              const [d1, m1, y1] = currentLatest.dataVisita.split('/').map(Number);
              const [d2, m2, y2] = data.dataVisita.split('/').map(Number);
              const date1 = new Date(y1, m1 - 1, d1);
              const date2 = new Date(y2, m2 - 1, d2);
              if (date2 > date1) {
                analysesByCong[cong] = data;
              }
            }
          });

          const latestAnalyses = Object.values(analysesByCong);
          let totalPubs = 0;
          let totalPioReg = 0;
          let totalPioEsp = 0;
          let totalAnciaos = 0;
          let totalServos = 0;

          latestAnalyses.forEach((analysis: any) => {
            totalPubs += parseInt(analysis.pubAtivos) || 0;
            totalPioReg += parseInt(analysis.ministério?.pioneirosRegulares?.relatando) || 0;
            totalPioEsp += parseInt(analysis.ministério?.pioneirosEspeciais?.relatando) || 0;
            totalAnciaos += analysis.estatisticas?.anciaos || 0;
            totalServos += analysis.estatisticas?.servos || 0;
          });

          // Find current event
          let foundEvent = '';
          itinSnap.docs.forEach((doc: any) => {
            const data = doc.data();
            if (isCurrentWeek(data.semana)) {
              foundEvent = data.evento || '';
            }
          });
          setCurrentEvent(foundEvent);

          const newStats = { 
            congregations: congSnap.size, 
            groups, 
            substitutes: subSnap.size,
            analyzedCongregations: analyzedCongs.size,
            publicadoresAtivos: totalPubs,
            pioneirosRegulares: totalPioReg,
            pioneirosEspeciais: totalPioEsp,
            anciaos: totalAnciaos,
            servos: totalServos
          };
          setCongStats(newStats);
          sessionStorage.setItem(`dashboardStats_${activeUid}`, JSON.stringify({
            stats: newStats,
            currentEvent: foundEvent,
            timestamp: now
          }));
        } else if (cachedStatsStr) {
          const cached = JSON.parse(cachedStatsStr);
          if (cached.currentEvent !== undefined) {
            setCurrentEvent(cached.currentEvent);
          }
        }
      } catch (error: any) {
        console.error('Error in fetchData:', error);
        if (error.message?.includes('quota') || error.message?.includes('resource-exhausted')) {
          setQuotaExceeded(true);
        }
      } finally {
        setLoadingPersonalData(false);
      }
    };

    fetchData();
  }, [user?.id, user?.usuario, user?.migrationCompleted, user?.migrationV2Completed, currentView, quotaExceeded]); // Removed personalData to avoid potential loops

  // Logic to force Role Selection for new users or missing roles
  useEffect(() => {
    // We no longer force redirect to personal_data. 
    // The RoleSelectionModal is rendered conditionally if the role is missing.
  }, [user, personalData, loadingPersonalData, currentView, quotaExceeded]);

  const handlePersonalDataSave = () => {
    // Trigger re-fetch
    changeView('dashboard');
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
      <div className="print:hidden">
        <Sidebar 
          onLogout={handleLogout} 
          user={user}
          personalData={personalData}
          currentView={currentView}
          espInitialMode={espInitialMode}
          hasGuestInvites={hasGuestInvites}
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
              if (['events', 'regional_convention_program'].includes(currentView)) {
                changeView('events');
              } else {
                // Restore last visited sub-view in Events
                changeView(lastSubViews.events || 'events');
              }
            } else if (view === 'settings') {
              // If already in a Settings sub-view, reset to main settings
              if (['settings', 'users'].includes(currentView)) {
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
              if (['misc', 'text_editor', 'field_service_report'].includes(currentView)) {
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
        landscape:ml-20 landscape:lg:ml-56 
        portrait:md:ml-20 portrait:lg:ml-56 
        portrait:mb-20 portrait:md:mb-0 
        print:ml-0 print:mb-0 print:p-0">
        {quotaExceeded && (
          <div className="bg-orange-500 text-white p-2 text-center text-xs font-bold animate-pulse">
            ⚠️ Limite de cota do Firestore excedido. Alguns dados podem não carregar corretamente. Tente novamente mais tarde.
          </div>
        )}
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto w-full">
          {currentView === 'dashboard' && (
            <>
              {/* Welcome Section */}
              <div className="flex justify-between items-center gap-4">
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

          {currentView === 'pioneer_school' && (personalData?.role === 'viajante' || user?.role === 'admin') && (
            <PioneerSchoolView 
              userId={user.id}
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

          {currentView === 'events' && (personalData?.role === 'viajante' || user?.role === 'admin') && (
            <EventsView 
              userId={user.id}
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

          {currentView === 'misc' && (
            <MiscView 
              isAdmin={user?.role === 'admin'}
              appConfig={appConfig}
              onViewChange={(view) => changeView(view as any)}
            />
          )}

          {currentView === 'text_editor' && (
            <TextEditor 
              userId={user?.id}
              onBack={() => changeView('misc')}
            />
          )}

          {currentView === 'field_service_report' && (
            <FieldServiceReportView 
              userId={user?.id}
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
              initialMode={espInitialMode}
              onBack={() => changeView(espInitialMode === 'manager' ? 'cartas_dashboard' : 'cartas')}
            />
          )}

          {currentView === 'cartas' && (personalData?.role === 'viajante' || user?.role === 'admin') && (
            <CartasSeletorView 
              onViewChange={(view) => {
                if (view === 'cartas_esp') setEspInitialMode('geracao');
                changeView(view as any);
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
              onBack={() => changeView('cartas_dashboard')}
            />
          )}

          {currentView === 'cartas_assembleias' && (
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden min-h-[80vh] flex flex-col items-center justify-center space-y-6 p-10 text-center">
              <div className="bg-amber-100 p-6 rounded-full text-amber-600 shadow-inner">
                <Mail size={64} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tight">Cartas Assembleias</h2>
                <p className="text-gray-500 font-medium uppercase tracking-widest text-sm">Esta funcionalidade será implementada em breve.</p>
              </div>
              <button 
                onClick={() => changeView('cartas')}
                className="px-8 py-3 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 uppercase tracking-widest text-xs"
              >
                Voltar para Cartas
              </button>
            </div>
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

          {currentView === 'docx_demo' && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden min-h-[80vh]">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => changeView('cartas_dashboard')}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-600 hover:text-blue-600"
                    title="Voltar ao Painel de Cartas"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <h2 className="font-bold text-gray-800">Gerador de Documentos</h2>
                </div>
              </div>
              <DocxToPdfDemo />
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
        />
      )}
      <TermsAndPrivacy 
        isOpen={showTerms} 
        onClose={() => setShowTerms(false)} 
        initialTab={termsType}
      />
    </div>
  );
}
