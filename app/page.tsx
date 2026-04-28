'use client';

import React, { useState } from 'react';
import PersonalDataView from '@/components/PersonalDataView';
import S302NoticeView from '@/components/S302NoticeView';
import AppointmentLetterView from '@/components/AppointmentLetterView';
import { User, FileText, Mail } from 'lucide-react';

export default function Page() {
  const [activeTab, setActiveTab] = useState<'personal' | 's302' | 'appointment'>('personal');

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-indigo-600 text-white p-4 shadow-md">
        <h1 className="text-xl font-bold text-center">Assinatura Global</h1>
      </header>

      <nav className="bg-white border-b flex justify-center gap-4 p-2 sticky top-0 z-10 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('personal')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'personal' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <User size={18} /> Dados Pessoais
        </button>
        <button 
          onClick={() => setActiveTab('s302')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 's302' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText size={18} /> Formulário S-302
        </button>
        <button 
          onClick={() => setActiveTab('appointment')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'appointment' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Mail size={18} /> Carta de Designação
        </button>
      </nav>

      <div className="flex-1 p-4 md:p-8">
        {activeTab === 'personal' && <PersonalDataView />}
        {activeTab === 's302' && <S302NoticeView />}
        {activeTab === 'appointment' && <AppointmentLetterView />}
      </div>
    </main>
  );
}
