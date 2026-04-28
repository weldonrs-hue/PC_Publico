'use client';

import React, { useState } from 'react';
import { Trash2, FileText } from 'lucide-react';
import Image from 'next/image';

export default function AppointmentLetterView() {
  const [signatureImage, setSignatureImage] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto p-8 bg-gray-100 min-h-screen">
      <div className="bg-white shadow-2xl mx-auto p-12 min-h-[297mm] w-[210mm] relative">
        <h1 className="text-2xl font-bold text-center mb-8">CARTA DE DESIGNAÇÃO</h1>
        
        <div className="space-y-6">
          <p>Prezado irmão,</p>
          <p>Temos o prazer de informar que você foi designado para servir como...</p>
        </div>

        <div className="mt-20 flex flex-col items-center group">
          <div className="relative w-48 h-12 border-b border-gray-300 flex items-center justify-center">
            {signatureImage ? (
              <div className="relative w-full h-full">
                <Image 
                  src={signatureImage} 
                  alt="Assinatura" 
                  fill 
                  className="object-contain"
                />
                <button 
                  onClick={() => setSignatureImage(null)}
                  className="absolute -top-4 -right-4 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
               <span className="text-gray-300 italic text-sm">Assinatura</span>
            )}
          </div>
          <p className="mt-2">Superintendente de Circuito</p>
        </div>
      </div>
    </div>
  );
}
