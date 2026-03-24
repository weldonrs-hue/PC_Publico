'use client';

import { FileText, Map as MapIcon } from 'lucide-react';
import Image from 'next/image';

export default function SecondarySection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Activity Feed */}
      <div className="lg:col-span-2 bg-white/50 rounded-2xl p-4 md:p-6 space-y-4 border border-white/20">
        <div className="flex justify-between items-center">
          <h5 className="font-headline font-bold text-lg">Atividade Recente</h5>
          <button 
            disabled
            className="text-gray-400 font-bold text-xs cursor-not-allowed"
          >
            Ver Todos
          </button>
        </div>
        <div className="space-y-2">
          <div className="bg-white p-2 md:p-3 rounded-xl flex items-center gap-2 md:gap-3 group hover:shadow-sm transition-all border border-gray-100">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-purple-100 flex items-center justify-center text-[#6c40bd] flex-shrink-0">
              <FileText size={14} className="md:w-4 md:h-4" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] md:text-xs font-bold">Relatório Congregação Central</p>
              <p className="text-[9px] md:text-[10px] text-gray-500">Atualizado há 2 horas</p>
            </div>
            <div className="text-[9px] font-bold px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Concluído</div>
          </div>
          <div className="bg-white p-2 md:p-3 rounded-xl flex items-center gap-2 md:gap-3 group hover:shadow-sm transition-all border border-gray-100">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
              <MapIcon size={14} className="md:w-4 md:h-4" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] md:text-xs font-bold">Novo Itinerário Gerado</p>
              <p className="text-[9px] md:text-[10px] text-gray-500">Ciclo Set/Out</p>
            </div>
            <div className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Agendado</div>
          </div>
        </div>
      </div>

      {/* Map View */}
      <div className="bg-white rounded-2xl p-1 overflow-hidden shadow-sm relative group border-2 border-blue-400">
        <div className="h-full min-h-[200px] w-full rounded-[1.2rem] bg-[#5ba381] overflow-hidden relative">
          <Image
            src="https://picsum.photos/seed/map/800/600"
            alt="Visão Geográfica"
            fill
            className="object-cover opacity-80"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 flex flex-col justify-end p-4 text-white bg-black/20">
            <h5 className="font-headline font-bold text-base">Visão Geográfica</h5>
            <p className="text-[10px] font-bold">12 congregações mapeadas</p>
          </div>
        </div>
      </div>
    </div>
  );
}
