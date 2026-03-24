'use client';
// Force rebuild
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import DashboardCards from '@/components/DashboardCards';
import SecondarySection from '@/components/SecondarySection';
import AuthForm from '@/components/AuthForm';
import PersonalDataView from '@/components/PersonalDataView';
import CongregationsView from '@/components/CongregationsView';
import SubstitutesView from '@/components/SubstitutesView';
import ItinerariesView from '@/components/ItinerariesView';
import SettingsView from '@/components/SettingsView';
import UsersView from '@/components/UsersView';
import CircuitStatisticsView from '@/components/CircuitStatisticsView';

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
import { Camera, User } from 'lucide-react';
import ImageCropper from '@/components/ImageCropper';

const STORAGE_KEY = 'progcir_personal_data';
const CONG_STORAGE_KEY = 'progcir_congregations';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(isQuotaExceeded());
  const quotaExceededRef = useRef(isQuotaExceeded());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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

  const [currentView, setCurrentView] = useState<'dashboard' | 'congregations' | 'personal_data' | 'substitutes' | 'itineraries' | 'settings' | 'users' | 'statistics'>('dashboard');
  const [personalData, setPersonalData] = useState<any>(null);
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

  useEffect(() => {
    if (!user?.id) return;

    const isDashboard = currentView === 'dashboard';
    
    const fetchData = async () => {
      // Wait for auth.currentUser to be available
      if (!auth.currentUser) return;

      const activeUid = auth.currentUser.uid;
      
      // Double check we are still logged in as the same user
      if (activeUid !== user.id) return;

      try {
        // Fetch Personal Data if not already loaded or if it's been a while
        if (!personalData || isDashboard) {
          const pdDocRef = doc(db, 'personal_data', activeUid);
          let pdDoc;
          try {
            pdDoc = await getDoc(pdDocRef);
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `personal_data/${activeUid}`);
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
              const pdQuery = query(collection(db, 'personal_data'), where('userId', '==', activeUid), limit(1));
              let pdSnapshot;
              try {
                pdSnapshot = await getDocs(pdQuery);
              } catch (error) {
                handleFirestoreError(error, OperationType.GET, 'personal_data (query by userId)');
              }
              
              if (pdSnapshot && !pdSnapshot.empty) {
                localStorage.setItem(`pdMigrationFallbackAttempted_${activeUid}`, 'true');
                const pdData = pdSnapshot.docs[0].data();
                setPersonalData(pdData);
                // Migrate this doc to use activeUid as ID
                try {
                  await setDoc(doc(db, 'personal_data', activeUid), { ...pdData, userId: activeUid });
                } catch (error) {
                  handleFirestoreError(error, OperationType.WRITE, `personal_data/${activeUid}`);
                }
              }
            }
          }
        }
        
        // MIGRATION LOGIC (only if not already completed)
        if (!user.migrationCompleted && !personalData) {
          const username = user.usuario;
          const hasMigrated = localStorage.getItem(`migrationAttempted_${activeUid}`);
          
          if (username && /^\d+$/.test(username) && !hasMigrated && !quotaExceeded) {
            localStorage.setItem(`migrationAttempted_${activeUid}`, 'true');
            let migrationSnapshot;
            try {
              let migrationQuery = query(collection(db, 'personal_data'), where('numeroPessoal', '==', username), limit(1));
              migrationSnapshot = await getDocs(migrationQuery);
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
                const collectionsToMigrate = ['congregations', 'substitutes', 'itineraries'];
                const batch = writeBatch(db);
                let batchCount = 0;
                
                for (const collName of collectionsToMigrate) {
                  try {
                    const q = query(collection(db, collName), where('userId', '==', oldUserId));
                    const snapshot = await getDocs(q);
                    for (const d of snapshot.docs) {
                      batch.set(doc(db, collName, d.id), { ...d.data(), userId: activeUid });
                      batchCount++;
                      // Firestore batch limit is 500
                      if (batchCount >= 450) break; 
                    }
                  } catch (error) {
                    console.warn(`Migration of ${collName} failed:`, error);
                  }
                  if (batchCount >= 450) break;
                }

                if (batchCount > 0) {
                  await batch.commit();
                }

                // Mark migration as completed in user doc
                await updateDoc(doc(db, 'users', activeUid), { migrationCompleted: true });
              } catch (error) {
                console.error('Migration process failed:', error);
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
          let congSnap, subSnap, itinSnap, analysisSnap;
          try {
            [congSnap, subSnap, itinSnap, analysisSnap] = await Promise.all([
              getDocs(query(collection(db, 'congregations'), where('userId', '==', activeUid))),
              getDocs(query(collection(db, 'substitutes'), where('userId', '==', activeUid))),
              getDocs(query(collection(db, 'itineraries'), where('userId', '==', activeUid))),
              getDocs(query(collection(db, 'activity_analysis'), where('userId', '==', activeUid)))
            ]);
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, 'dashboard_stats');
            return;
          }

          let groups = 0;
          congSnap.docs.forEach((doc) => {
            const data = doc.data();
            if (data.grupos && Array.isArray(data.grupos)) {
              groups += data.grupos.length;
            }
          });

          // Count unique congregations with analysis
          const analyzedCongs = new Set();
          analysisSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.congregacao) {
              analyzedCongs.add(data.congregacao);
            }
          });

          const analysesByCong: { [key: string]: any } = {};
          analysisSnap.docs.forEach((doc) => {
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
            totalPubs += parseInt(analysis.ministério?.publicadores?.relatando) || 0;
            totalPioReg += parseInt(analysis.ministério?.pioneirosRegulares?.relatando) || 0;
            totalPioEsp += parseInt(analysis.ministério?.pioneirosEspeciais?.relatando) || 0;
            totalAnciaos += analysis.estatisticas?.anciaos || 0;
            totalServos += analysis.estatisticas?.servos || 0;
          });

          // Find current event
          let foundEvent = '';
          itinSnap.docs.forEach((doc) => {
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
      }
    };

    fetchData();
  }, [user?.id, user?.usuario, user?.migrationCompleted, currentView, personalData, quotaExceeded]); // Only re-run when entering dashboard or user changes

  const handlePersonalDataSave = () => {
    // Trigger re-fetch
    setCurrentView('dashboard');
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

  const handleCardClick = (title: string) => {
    if (title === 'Dados Pessoais') {
      setCurrentView('personal_data');
    } else if (title === 'Congregações') {
      setCurrentView('congregations');
    } else if (title === 'Substitutos') {
      setCurrentView('substitutes');
    } else if (title === 'Itinerários') {
      setCurrentView('itineraries');
    } else if (title === 'Estatísticas') {
      setCurrentView('statistics');
    } else if (title === 'Ajustes') {
      setCurrentView('settings');
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
          onBack={() => setCurrentView('dashboard')}
          onViewChange={(view) => {
            if (['dashboard', 'congregations', 'personal_data', 'substitutes', 'itineraries', 'settings', 'users'].includes(view)) {
              setCurrentView(view as any);
            }
          }}
        />
      </div>
      
      <main className="flex-1 min-h-screen flex flex-col transition-all duration-500 landscape:ml-20 landscape:lg:ml-56 portrait:mb-16 print:ml-0 print:mb-0 print:p-0">
        {quotaExceeded && (
          <div className="bg-orange-500 text-white p-2 text-center text-xs font-bold animate-pulse">
            ⚠️ Limite de cota do Firestore excedido. Alguns dados podem não carregar corretamente. Tente novamente mais tarde.
          </div>
        )}
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto w-full">
          {currentView === 'dashboard' && (
            <>
              {/* Welcome Section */}
              <div className="flex justify-between items-center gap-4">
                <div className="border-2 border-blue-400 p-3 md:p-4 rounded-sm flex-1 md:flex-initial bg-white/50 flex items-center gap-4">
                  <div 
                    className="relative w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shadow-inner cursor-pointer group/avatar overflow-hidden flex-shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {user?.photoURL ? (
                      <Image 
                        src={user.photoURL} 
                        alt="Profile" 
                        fill 
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User size={32} />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                      <Camera size={20} className="text-white" />
                    </div>
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                    <h1 className="text-2xl md:text-3xl font-black text-blue-600 uppercase tracking-tighter">Olá,</h1>
                    <p className="text-blue-400 font-bold uppercase tracking-widest text-xs md:text-sm">Seja bem-vindo ao ProgCir Web</p>
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
              />

              {/* Statistics Summary Bar */}
              <div className="bg-[#e0d8eb] p-2 md:p-4 rounded-xl md:rounded-full flex flex-wrap items-center justify-center md:justify-between px-4 md:px-10 text-[10px] md:text-xs font-bold text-[#3a264b] shadow-inner gap-2 md:gap-4">
                <div className="flex gap-1">Publicadores Ativos: <span className="font-normal underline decoration-dotted">{congStats.publicadoresAtivos.toLocaleString('pt-BR')}</span></div>
                <div className="flex gap-1">Pioneiros Regulares: <span className="font-normal underline decoration-dotted">{congStats.pioneirosRegulares.toLocaleString('pt-BR')}</span></div>
                <div className="flex gap-1">Pioneiros Especiais: <span className="font-normal underline decoration-dotted">{congStats.pioneirosEspeciais.toLocaleString('pt-BR')}</span></div>
                <div className="flex gap-1">Anciãos: <span className="font-normal underline decoration-dotted">{congStats.anciaos.toLocaleString('pt-BR')}</span></div>
                <div className="flex gap-1">Servos: <span className="font-normal underline decoration-dotted">{congStats.servos.toLocaleString('pt-BR')}</span></div>
              </div>

              {/* Activity and Map Section */}
              <SecondarySection />
            </>
          )}

          {currentView === 'congregations' && (
            <CongregationsView 
              userId={user.id} 
              onBack={() => setCurrentView('dashboard')} 
            />
          )}

          {currentView === 'personal_data' && (
            <PersonalDataView 
              userId={user.id}
              onBack={() => setCurrentView('dashboard')} 
              onSave={handlePersonalDataSave}
            />
          )}

          {currentView === 'substitutes' && (
            <SubstitutesView 
              userId={user.id}
              onBack={() => setCurrentView('dashboard')} 
            />
          )}

          {currentView === 'itineraries' && (
            <ItinerariesView 
              userId={user.id}
              user={user}
              onBack={() => setCurrentView('dashboard')} 
            />
          )}

          {currentView === 'settings' && (
            <SettingsView 
              userId={user.id}
              onBack={() => setCurrentView('dashboard')} 
              onViewChange={(view) => setCurrentView(view as any)}
            />
          )}

          {currentView === 'users' && (
            <UsersView 
              onBack={() => setCurrentView('dashboard')} 
            />
          )}

          {currentView === 'statistics' && (
            <CircuitStatisticsView 
              userId={user.id}
              personalData={personalData}
              onBack={() => setCurrentView('dashboard')} 
            />
          )}
        </div>


        {/* Footer */}
        <footer className="mt-auto p-8 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500 print:hidden">
          <p>© 2024 ProgCir Web - Gestão de Circuitos</p>
          <div className="flex gap-6">
            <a className="hover:text-[#6c40bd] transition-colors" href="#">Termos de Uso</a>
            <a className="hover:text-[#6c40bd] transition-colors" href="#">Privacidade</a>
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
    </div>
  );
}
