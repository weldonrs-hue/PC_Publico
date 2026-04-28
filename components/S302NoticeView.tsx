'use client';

import React, { useState } from 'react';
import { 
  Trash2, 
  FileText,
  Download
} from 'lucide-react';
import Image from 'next/image';

export default function S302NoticeView() {
  const [signatureImage, setSignatureImage] = useState<string | null>(null);

  const handleRemoveSignature = () => {
    setSignatureImage(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 bg-gray-100 min-h-screen">
      <div className="bg-white shadow-2xl mx-auto p-12 min-h-[297mm] w-[210mm] relative">
        <h1 className="text-3xl font-bold text-center border-b pb-4 mb-8">AVISO (S-302)</h1>
        
        <div className="space-y-4 text-justify">
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
          <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
        </div>

        <div className="absolute bottom-32 right-32 flex flex-col items-center group">
          <p className="mb-4">Seu irmão,</p>
          
          <div className="relative w-48 h-16 border-b border-gray-300 flex items-center justify-center">
            {signatureImage ? (
              <div className="relative w-full h-full">
                <Image 
                  src={signatureImage} 
                  alt="Assinatura" 
                  fill 
                  className="object-contain"
                />
                <button 
                  onClick={handleRemoveSignature}
                  className="absolute -top-4 -right-4 p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remover Assinatura deste documento"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <span className="text-gray-400 italic text-sm">(Sem assinatura)</span>
            )}
          </div>
          <p className="mt-2 font-bold">NOME DO SECRETÁRIO</p>
        </div>
      </div>
    </div>
  );
}
