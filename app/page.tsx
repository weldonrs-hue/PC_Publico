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

import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit 
} from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

const STORAGE_KEY = 'progcir_personal_data';
const CONG_STORAGE_KEY = 'progcir_congregations';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'congregations' | 'personal_data' | 'substitutes'>('dashboard');
  const [personalData, setPersonalData] = useState<any>(null);
  const [congStats, setCongStats] = useState({ congregations: 0, groups: 0, substitutes: 0 });

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          usuario: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
          email: firebaseUser.email
        });
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
          setPersonalData(pdSnapshot.docs[0].data());
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
          if (['dashboard', 'congregations', 'personal_data', 'substitutes'].includes(view)) {
            setCurrentView(view);
          }
        }}
      />
      
      <main className="flex-1 min-h-screen flex flex-col transition-all duration-500 landscape:ml-20 landscape:lg:ml-64 portrait:mb-16">
        <div className="p-4 md:p-8 space-y-4 md:space-y-8 max-w-7xl mx-auto w-full">
          {currentView === 'dashboard' && (
            <>
              {/* Welcome Section */}
              <div className="flex justify-between items-end">
                <div className="border-2 border-blue-400 p-4 md:p-6 rounded-sm w-full md:w-fit bg-white/50">
                  <h2 className="text-2xl md:text-4xl font-bold text-gray-900">Olá, {personalData?.nome || user.usuario}!</h2>
                  <p className="text-xs md:text-base text-gray-500 mt-1">Bem-vindo ao painel de programações do circuito</p>
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
