'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Trash2, 
  Upload, 
  Sparkles, 
  Loader2, 
  User, 
  Mail, 
  Save 
} from 'lucide-react';
import Image from 'next/image';
import SignatureCanvas from 'react-signature-canvas';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

export default function PersonalDataView() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    signatureImage: null as string | null
  });
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const sigPad = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const removeImageBackground = () => {
    if (!formData.signatureImage) return;
    
    setIsProcessing(true);
    
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = formData.signatureImage;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsProcessing(false);
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      const threshold = 230; 
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        if (r > threshold && g > threshold && b > threshold) {
          data[i + 3] = 0;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      const processedImage = canvas.toDataURL('image/png');
      setFormData({ ...formData, signatureImage: processedImage });
      setIsProcessing(false);
    };
    
    img.onerror = () => {
      console.error("Error loading image for background removal");
      setIsProcessing(false);
    };
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, signatureImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSignature = () => {
    setFormData({ ...formData, signatureImage: null });
  };

  const saveSignature = () => {
    if (sigPad.current) {
      const dataUrl = sigPad.current.getTrimmedCanvas().toDataURL('image/png');
      setFormData({ ...formData, signatureImage: dataUrl });
    }
  };

  const handleSave = async () => {
    // Basic local save simulation if firebase is not setup
    console.log('Saving data...', formData);
    alert('Dados salvos localmente (Firebase mocked)');
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-md space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <User className="text-indigo-600" /> Dados Pessoais
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
          <div className="mt-1 relative">
            <input 
              type="text" 
              value={formData.nome}
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Seu nome"
            />
          </div>
        </div>

        <div>
           <label className="block text-sm font-medium text-gray-700">Assinatura</label>
           <div className="mt-2 border-2 border-dashed border-gray-200 rounded-lg p-4 relative group">
             {formData.signatureImage ? (
               <div className="relative h-32 w-full flex items-center justify-center">
                 <Image 
                   src={formData.signatureImage} 
                   alt="Assinatura" 
                   fill 
                   className="object-contain"
                 />
                 
                 <div className="absolute -top-2 -right-2 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={removeSignature}
                      className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 shadow-sm"
                      title="Remover Assinatura"
                    >
                      <Trash2 size={16} />
                    </button>
                    
                    <button 
                      onClick={removeImageBackground}
                      disabled={isProcessing}
                      className="p-2 bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200 shadow-sm disabled:opacity-50"
                      title="Remover Fundo Branco"
                    >
                      {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    </button>

                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 shadow-sm"
                      title="Trocar Imagem"
                    >
                      <Upload size={16} />
                    </button>
                 </div>
               </div>
             ) : (
               <div className="space-y-4">
                  <div className="bg-gray-50 rounded border h-40">
                    <SignatureCanvas 
                      ref={sigPad}
                      penColor="black"
                      canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <button 
                      onClick={() => sigPad.current?.clear()}
                      className="text-sm text-gray-500 hover:text-red-500"
                    >
                      Limpar
                    </button>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                      >
                        <Upload size={14} /> Fazer Upload
                      </button>
                      <button 
                        onClick={saveSignature}
                        className="px-4 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                      >
                        Usar Assinatura
                      </button>
                    </div>
                  </div>
               </div>
             )}
             <input 
               ref={fileInputRef}
               type="file" 
               className="hidden" 
               accept="image/*"
               onChange={handleImageUpload}
             />
           </div>
        </div>
      </div>

      <button 
        onClick={handleSave}
        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 overflow-hidden"
      >
        <Save size={20} /> Salvar Dados
      </button>
    </div>
  );
}
