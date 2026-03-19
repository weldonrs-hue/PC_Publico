'use client';
// Force rebuild
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import DashboardCards from '@/components/DashboardCards';
import SecondarySection from '@/components/SecondarySection';
import AuthForm from '@/components/AuthForm';
import PersonalDataView from '@/components/PersonalDataView';
import CongregationsView from '@/components/CongregationsView';
import SubstitutesView from '@/components/SubstitutesView';
import ItinerariesView from '@/components/ItinerariesView';

import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit,
  getDoc,
  setDoc,
  doc
} from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

const STORAGE_KEY = 'progcir_personal_data';
const CONG_STORAGE_KEY = 'progcir_congregations';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'congregations' | 'personal_data' | 'substitutes' | 'itineraries'>('dashboard');
  const [personalData, setPersonalData] = useState<any>(null);
  const [congStats, setCongStats] = useState({ congregations: 0, groups: 0, substitutes: 0 });

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Ensure user document exists in Firestore
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          let role = 'user';
          
          if (!userDoc.exists()) {
            const isAdminEmail = firebaseUser.email === 'weldonrs@gmail.com' || firebaseUser.email === '2283701@progcir.app';
            role = isAdminEmail ? 'admin' : 'user';
            await setDoc(userDocRef, {
              email: firebaseUser.email,
              role: role
            });
          } else {
            role = userDoc.data().role || 'user';
          }

          const userData = {
            id: firebaseUser.uid,
            usuario: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
            email: firebaseUser.email,
            role: role
          };
          setUser(userData);
        } catch (error) {
          console.error('Error ensuring user profile:', error);
          const userData = {
            id: firebaseUser.uid,
            usuario: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
            email: firebaseUser.email,
            role: 'user'
          };
          setUser(userData);
        }
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Fetch Personal Data
        const pdQuery = query(collection(db, 'personal_data'), where('userId', '==', user.id), limit(1));
        const pdSnapshot = await getDocs(pdQuery);
        
        if (!pdSnapshot.empty) {
          const pdData = pdSnapshot.docs[0].data();
          setPersonalData(pdData);
          if (pdData.numeroPessoal) {
            setUser((prev: any) => ({ ...prev, usuario: pdData.numeroPessoal }));
          }
        } else {
          // MIGRATION LOGIC: Check if there's data for this username/number under a different UID
          const username = user.usuario;
          if (username && /^\d+$/.test(username)) {
            console.log('Iniciando busca por dados antigos para:', username);
            
            // 1. Try to find by numeroPessoal first
            let migrationQuery = query(collection(db, 'personal_data'), where('numeroPessoal', '==', username), limit(1));
            let migrationSnapshot = await getDocs(migrationQuery);
            let oldUserId = null;
            let oldData = null;
            let oldDocId = null;

            if (!migrationSnapshot.empty) {
              const doc = migrationSnapshot.docs[0];
              oldData = doc.data();
              oldUserId = oldData.userId;
              oldDocId = doc.id;
            } else {
              // 2. Try to find by old email domain (@progcir.com) in users collection
              const oldEmail = `${username}@progcir.com`;
              const userQuery = query(collection(db, 'users'), where('email', '==', oldEmail), limit(1));
              const userSnapshot = await getDocs(userQuery);
              
              if (!userSnapshot.empty) {
                oldUserId = userSnapshot.docs[0].id;
                // Now find the personal_data for this oldUserId
                const pdOldQuery = query(collection(db, 'personal_data'), where('userId', '==', oldUserId), limit(1));
                const pdOldSnapshot = await getDocs(pdOldQuery);
                if (!pdOldSnapshot.empty) {
                  const doc = pdOldSnapshot.docs[0];
                  oldData = doc.data();
                  oldDocId = doc.id;
                }
              }
            }
            
            if (oldUserId && oldUserId !== user.id) {
              console.log('Dados antigos encontrados para o UID:', oldUserId);
              
              // Update personal_data if found
              if (oldDocId && oldData) {
                await setDoc(doc(db, 'personal_data', oldDocId), {
                  ...oldData,
                  userId: user.id,
                  numeroPessoal: username // Ensure this is set for future lookups
                });
                setPersonalData({ ...oldData, userId: user.id, numeroPessoal: username });
              }
              
              // Migrate other collections
              const collectionsToMigrate = ['congregations', 'substitutes', 'itineraries'];
              for (const collName of collectionsToMigrate) {
                const q = query(collection(db, collName), where('userId', '==', oldUserId));
                const snapshot = await getDocs(q);
                console.log(`Migrando ${snapshot.size} documentos de ${collName}`);
                for (const d of snapshot.docs) {
                  await setDoc(doc(db, collName, d.id), {
                    ...d.data(),
                    userId: user.id
                  });
                }
              }
              
              // Optional: Update the old user record to prevent re-migration or just leave it
              console.log('Migração concluída com sucesso');
              
              // Refresh stats after migration
              fetchData(); 
              return;
            }
          }
        }

        // Fetch Congregations for stats
        const congQuery = query(collection(db, 'congregations'), where('userId', '==', user.id));
        const congSnapshot = await getDocs(congQuery);
        let congregations = congSnapshot.size;
        let groups = 0;
        congSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.grupos && Array.isArray(data.grupos)) {
            groups += data.grupos.length;
          }
        });

        // Fetch Substitutes for stats
        const subQuery = query(collection(db, 'substitutes'), where('userId', '==', user.id));
        const subSnapshot = await getDocs(subQuery);
        let substitutes = subSnapshot.size;

        setCongStats({ congregations, groups, substitutes });
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'dashboard_data');
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
          if (['dashboard', 'congregations', 'personal_data', 'substitutes', 'itineraries'].includes(view)) {
            setCurrentView(view);
          }
        }}
      />
      
      <main className="flex-1 min-h-screen flex flex-col transition-all duration-500 landscape:ml-20 landscape:lg:ml-56 portrait:mb-16">
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto w-full">
          {currentView === 'dashboard' && (
            <>
              {/* Welcome Section */}
              <div className="flex justify-between items-end">
                <div className="border-2 border-blue-400 p-3 md:p-4 rounded-sm w-full md:w-fit bg-white/50">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">Olá, {personalData?.nome || user.usuario}!</h2>
                  <p className="text-[10px] md:text-sm text-gray-500 mt-0.5">Bem-vindo ao painel de programações do circuito</p>
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
