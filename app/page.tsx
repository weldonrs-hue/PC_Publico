'use client';
// Force rebuild
import { useState, useEffect } from 'react';
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

import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit,
  getDoc,
  setDoc,
  doc,
  onSnapshot
} from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

const STORAGE_KEY = 'progcir_personal_data';
const CONG_STORAGE_KEY = 'progcir_congregations';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'congregations' | 'personal_data' | 'substitutes' | 'itineraries' | 'settings'>('dashboard');
  const [personalData, setPersonalData] = useState<any>(null);
  const [congStats, setCongStats] = useState({ congregations: 0, groups: 0, substitutes: 0 });

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Ensure user document exists in Firestore and listen for changes
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        const unsubUser = onSnapshot(userDocRef, async (userDoc) => {
          let role = 'user';
          let photoURL = null;
          
          if (!userDoc.exists()) {
            const isAdminEmail = 
              firebaseUser.email === 'weldonrs@gmail.com' || 
              firebaseUser.email === '2283701@progcir.app' ||
              firebaseUser.email === '2283701@progcir.com';
            role = isAdminEmail ? 'admin' : 'user';
            await setDoc(userDocRef, {
              email: firebaseUser.email,
              role: role,
              photoURL: null
            });
          } else {
            const data = userDoc.data();
            role = data.role || 'user';
            photoURL = data.photoURL || null;
          }

          const userData = {
            id: firebaseUser.uid,
            usuario: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
            email: firebaseUser.email,
            role: role,
            photoURL: photoURL
          };
          setUser(userData);
        }, (error) => {
          console.error('Error listening to user profile:', error);
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        });

        return () => unsubUser();
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Wait for auth.currentUser to be available (up to 5 seconds)
      let attempts = 0;
      while (!auth.currentUser && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!auth.currentUser) {
        console.error('fetchData: auth.currentUser is null after waiting. User state:', user);
        return;
      }

      const activeUid = auth.currentUser.uid;
      const activeEmail = auth.currentUser.email;
      console.log(`fetchData: Iniciando busca para UID: ${activeUid}, Email: ${activeEmail}`);

      // Test permissions with a simple query before proceeding
      try {
        console.log('fetchData: Testando permissões de leitura...');
        const testQuery = query(collection(db, 'personal_data'), where('userId', '==', activeUid), limit(1));
        await getDocs(testQuery);
        console.log('fetchData: Teste de permissões OK');
      } catch (error) {
        console.error('fetchData: Falha no teste de permissões:', error);
        handleFirestoreError(error, OperationType.GET, 'permission_test');
        return;
      }

      try {
        // Fetch Personal Data - Try by activeUid as doc ID first
        let pdData = null;
        try {
          const pdDocRef = doc(db, 'personal_data', activeUid);
          const pdDoc = await getDoc(pdDocRef);
          if (pdDoc.exists()) {
            pdData = pdDoc.data();
            console.log('fetchData: Personal data found by UID doc ID');
          } else {
            console.log('fetchData: Personal data NOT found by UID doc ID, searching by userId field...');
            // Fallback: search by userId field
            const pdQuery = query(collection(db, 'personal_data'), where('userId', '==', activeUid), limit(1));
            const pdSnapshot = await getDocs(pdQuery);
            if (!pdSnapshot.empty) {
              pdData = pdSnapshot.docs[0].data();
              console.log('fetchData: Personal data found by userId field. Migrating...');
              // Migrate this doc to use activeUid as ID
              await setDoc(doc(db, 'personal_data', activeUid), { ...pdData, userId: activeUid });
            }
          }
        } catch (error) {
          console.error('Erro ao buscar personal_data:', error);
          handleFirestoreError(error, OperationType.GET, 'personal_data_fetch');
          return;
        }
        
        if (pdData) {
          setPersonalData(pdData);
          if (pdData.numeroPessoal) {
            setUser((prev: any) => ({ ...prev, usuario: pdData.numeroPessoal }));
          }
        } else {
          // MIGRATION LOGIC: Check if there's data for this username/number under a different UID
          const username = user.usuario;
          if (username && /^\d+$/.test(username)) {
            console.log('fetchData: Iniciando busca por dados antigos para:', username);
            
            // 1. Try to find by numeroPessoal first
            let migrationSnapshot;
            try {
              let migrationQuery = query(collection(db, 'personal_data'), where('numeroPessoal', '==', username), limit(1));
              migrationSnapshot = await getDocs(migrationQuery);
            } catch (error) {
              console.warn('fetchData: Erro na busca de migração por numeroPessoal:', error);
              // Don't fail the whole thing, just continue
            }

            let oldUserId = null;
            let oldData = null;

            if (migrationSnapshot && !migrationSnapshot.empty) {
              const docSnap = migrationSnapshot.docs[0];
              oldData = docSnap.data();
              oldUserId = oldData.userId;
              console.log('fetchData: Dados antigos encontrados por numeroPessoal. Old UID:', oldUserId);
            } else {
              // 2. Try to find by old email domain (@progcir.com) in users collection
              const oldEmail = `${username}@progcir.com`;
              let userSnapshot;
              try {
                const userQuery = query(collection(db, 'users'), where('email', '==', oldEmail), limit(1));
                userSnapshot = await getDocs(userQuery);
              } catch (error) {
                console.warn('fetchData: Erro na busca de migração por email antigo:', error);
              }
              
              if (userSnapshot && !userSnapshot.empty) {
                oldUserId = userSnapshot.docs[0].id;
                console.log('fetchData: Old UID found in users collection:', oldUserId);
                // Now find the personal_data for this oldUserId
                try {
                  const pdOldQuery = query(collection(db, 'personal_data'), where('userId', '==', oldUserId), limit(1));
                  const pdOldSnapshot = await getDocs(pdOldQuery);
                  if (!pdOldSnapshot.empty) {
                    const docSnap = pdOldSnapshot.docs[0];
                    oldData = docSnap.data();
                  }
                } catch (error) {
                  console.warn('fetchData: Erro ao buscar personal_data antigo:', error);
                }
              }
            }
            
            if (oldUserId && oldUserId !== activeUid) {
              console.log('fetchData: Migrando dados do UID antigo:', oldUserId, 'para o novo:', activeUid);
              
              if (oldData) {
                const migratedData = {
                  ...oldData,
                  userId: activeUid,
                  numeroPessoal: username
                };
                await setDoc(doc(db, 'personal_data', activeUid), migratedData);
                setPersonalData(migratedData);
              }
              
              // Migrate other collections
              const collectionsToMigrate = ['congregations', 'substitutes', 'itineraries'];
              for (const collName of collectionsToMigrate) {
                try {
                  const q = query(collection(db, collName), where('userId', '==', oldUserId));
                  const snapshot = await getDocs(q);
                  if (!snapshot.empty) {
                    console.log(`fetchData: Migrando ${snapshot.size} documentos de ${collName}`);
                    for (const d of snapshot.docs) {
                      await setDoc(doc(db, collName, d.id), {
                        ...d.data(),
                        userId: activeUid
                      });
                    }
                  }
                } catch (error) {
                  console.error(`fetchData: Erro ao migrar coleção ${collName}:`, error);
                }
              }
              
              console.log('fetchData: Migração concluída');
              // Re-fetch everything to be sure
              fetchData(); 
              return;
            }
          }
        }

        // Fetch Congregations for stats
        let congSnapshot;
        try {
          const congQuery = query(collection(db, 'congregations'), where('userId', '==', activeUid));
          congSnapshot = await getDocs(congQuery);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'congregations_fetch');
          return;
        }
        let congregations = congSnapshot.size;
        let groups = 0;
        congSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.grupos && Array.isArray(data.grupos)) {
            groups += data.grupos.length;
          }
        });

        // Fetch Substitutes for stats
        let subSnapshot;
        try {
          const subQuery = query(collection(db, 'substitutes'), where('userId', '==', activeUid));
          subSnapshot = await getDocs(subQuery);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'substitutes_fetch');
          return;
        }
        let substitutes = subSnapshot.size;

        setCongStats({ congregations, groups, substitutes });
      } catch (error) {
        console.error('Error in fetchData overall:', error);
      }
    };

    fetchData();
  }, [user, currentView]);

  const handlePersonalDataSave = () => {
    // Trigger re-fetch
    setCurrentView('dashboard');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
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
    } else if (title === 'Ajustes') {
      setCurrentView('settings');
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] transition-all duration-500 ease-in-out portrait:flex-col landscape:flex-row">
      <Sidebar 
        onLogout={handleLogout} 
        user={user}
        personalData={personalData}
        currentView={currentView}
        onBack={() => setCurrentView('dashboard')}
        onViewChange={(view) => {
          if (['dashboard', 'congregations', 'personal_data', 'substitutes', 'itineraries', 'settings'].includes(view)) {
            setCurrentView(view);
          }
        }}
      />
      
      <main className="flex-1 min-h-screen flex flex-col transition-all duration-500 landscape:ml-20 landscape:lg:ml-56 portrait:mb-16">
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto w-full">
          {currentView === 'dashboard' && (
            <>
              {/* Welcome Section */}
              <div className="flex justify-between items-center gap-4">
                <div className="border-2 border-blue-400 p-3 md:p-4 rounded-sm flex-1 md:flex-initial bg-white/50 flex items-center gap-4">
                  {user?.photoURL && (
                    <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
                      <Image 
                        src={user.photoURL} 
                        alt="Profile" 
                        fill 
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">Olá, {personalData?.nome || user.usuario}!</h2>
                    <p className="text-[10px] md:text-sm text-gray-500 mt-0.5">Bem-vindo ao painel de programações do circuito</p>
                  </div>
                </div>
              </div>

              {/* Dashboard Cards Grid */}
              <DashboardCards 
                onCardClick={handleCardClick} 
                congregationCount={congStats.congregations}
                groupCount={congStats.groups}
                substituteCount={congStats.substitutes}
              />

              {/* Statistics Summary Bar */}
              <div className="bg-[#e0d8eb] p-2 md:p-4 rounded-xl md:rounded-full flex flex-wrap items-center justify-center md:justify-between px-4 md:px-10 text-[10px] md:text-xs font-bold text-[#3a264b] shadow-inner gap-2 md:gap-4">
                <div className="flex gap-1">Publicadores Ativos: <span className="font-normal underline decoration-dotted">1.240</span></div>
                <div className="flex gap-1">Pioneiros Regulares: <span className="font-normal underline decoration-dotted">85</span></div>
                <div className="flex gap-1">Pioneiros Especiais: <span className="font-normal underline decoration-dotted">12</span></div>
                <div className="flex gap-1">Anciãos: <span className="font-normal underline decoration-dotted">156</span></div>
                <div className="flex gap-1">Servos: <span className="font-normal underline decoration-dotted">210</span></div>
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
              onBack={() => setCurrentView('dashboard')} 
            />
          )}

          {currentView === 'settings' && (
            <SettingsView 
              userId={user.id}
            />
          )}
        </div>


        {/* Footer */}
        <footer className="mt-auto p-8 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
          <p>© 2024 ProgCir Web - Gestão de Circuitos</p>
          <div className="flex gap-6">
            <a className="hover:text-[#6c40bd] transition-colors" href="#">Termos de Uso</a>
            <a className="hover:text-[#6c40bd] transition-colors" href="#">Privacidade</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
