'use client';

import React, { useState, useEffect, useRef } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import * as docxPreview from 'docx-preview';
import { 
  FileText, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  List,
  AlertCircle,
  FileDown
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

interface PSSAssignmentLettersProps {
  userId: string;
  selectedTurma: '1' | '2' | '3';
  schoolInfo: {
    dataTurma: string;
    instrutorA: string;
    confirmacaoEmail: string;
    confirmacaoWhatsapp: string;
  };
  workshopAssignments: Record<number, { id: string, participants: string }>;
}

const TEMPLATE_NAMES = Array.from({ length: 18 }, (_, i) => `PSS assignment letter_T_${(i + 1).toString().padStart(2, '0')}`);

export default function PSSAssignmentLetters({ 
  userId, 
  selectedTurma, 
  schoolInfo, 
  workshopAssignments 
}: PSSAssignmentLettersProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(TEMPLATE_NAMES[0]);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string }>>({});
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [processedDocBuffer, setProcessedDocBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'document_templates'));
      const fetchedTemplates: Record<string, any> = {};
      querySnapshot.forEach((doc) => {
        fetchedTemplates[doc.id] = doc.data();
      });
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load template when selectedTemplate or templates changes
  useEffect(() => {
    if (templates[selectedTemplate]) {
      processAndPreview();
    } else {
      setPreviewHtml('<div class="h-full flex flex-col items-center justify-center text-gray-300 italic py-20 px-10 text-center text-sm uppercase font-bold tracking-widest">Template não encontrado no banco de dados. Carregue-o na aba Gerador de Documentos primeiro.</div>');
      setProcessedDocBuffer(null);
      setStatus('idle');
    }
  }, [selectedTemplate, templates, schoolInfo, workshopAssignments]);

  const getReplacements = (templateName: string) => {
    // Extract number from "PSS assignment letter_T_XX"
    const match = templateName.match(/_T_(\d+)/);
    const scenarioId = match ? parseInt(match[1]) : 0;
    
    const assignment = workshopAssignments[scenarioId];
    const participantsList = assignment?.participants ? assignment.participants.split('|').filter(p => p.trim()) : [];
    let nomes = '________________';
    if (participantsList.length > 0) {
      nomes = participantsList.join('\n');
    }

    const dataValue = schoolInfo.dataTurma || '____/____/____';
    const emailValue = schoolInfo.confirmacaoEmail || '________________';
    const telefoneValue = schoolInfo.confirmacaoWhatsapp || '________________';
    const instrutorValue = schoolInfo.instrutorA || '________________';
    const signatureBlock = `__________________________\n${instrutorValue}`;

    return {
      'data': dataValue,
      'DATA': dataValue,
      'nomes': nomes,
      'NOMES': nomes,
      'e mail': emailValue,
      'E MAIL': emailValue,
      'e-mail': emailValue,
      'E-mail': emailValue,
      'E-MAIL': emailValue,
      'email': emailValue,
      'EMAIL': emailValue,
      'telefone': telefoneValue,
      'TELEFONE': telefoneValue,
      'whatsapp': telefoneValue,
      'WHATSAPP': telefoneValue,
      'nome do instrutor': signatureBlock,
      'NOME DO INSTRUTOR': signatureBlock,
      'instrutor': signatureBlock,
      'INSTRUTOR': signatureBlock,
      'assinatura': signatureBlock,
      'ASSINATURA': signatureBlock,
    };
  };

  const processAndPreview = async () => {
    const template = templates[selectedTemplate];
    if (!template) return;

    setIsProcessing(true);
    setStatus('idle');

    try {
      const binaryString = window.atob(template.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const content = bytes.buffer;

      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' }
      });

      const replacements = getReplacements(selectedTemplate);
      doc.render(replacements);

      const out = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const processedArrayBuffer = await out.arrayBuffer();
      setProcessedDocBuffer(processedArrayBuffer);
      
      if (previewRef.current) {
        previewRef.current.innerHTML = '';
        await docxPreview.renderAsync(processedArrayBuffer, previewRef.current, undefined, {
          className: "docx-preview",
          inWrapper: false,
          ignoreWidth: true,
          ignoreHeight: true,
          breakPages: false,
          useBase64URL: true,
        });
      }
      
      setStatus('success');
    } catch (err: any) {
      console.error('Error processing DOCX:', err);
      setStatus('error');
      setPreviewHtml(`<div class="text-red-500 p-4 font-bold">Erro ao processar template: ${err.message}</div>`);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAsDocx = () => {
    if (!processedDocBuffer) return;
    const blob = new Blob([processedDocBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedTemplate}_Turma${selectedTurma}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAsPdf = async () => {
    if (!processedDocBuffer) return;

    setIsProcessing(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      
      // Create a hidden div specifically for PDF generation to avoid "screen capture" look
      const hiddenContainer = document.createElement('div');
      hiddenContainer.style.position = 'fixed';
      hiddenContainer.style.left = '-10000px'; // Way off-screen but "visible"
      hiddenContainer.style.top = '0';
      hiddenContainer.style.width = '210mm'; // A4 Width
      hiddenContainer.style.backgroundColor = 'white';
      hiddenContainer.style.zIndex = '-1000';
      hiddenContainer.style.opacity = '1';
      document.body.appendChild(hiddenContainer);

      // Render the DOCX into the hidden container for a clean output
      await docxPreview.renderAsync(processedDocBuffer, hiddenContainer, undefined, {
        className: "docx-pdf-rendering",
        inWrapper: false,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        useBase64URL: true,
      });

      // Give more time for all assets and styles to settle
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const opt = {
        margin: 0,
        filename: `${selectedTemplate}_Turma${selectedTurma}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: true,
          letterRendering: true,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794,
          onclone: (clonedDoc: Document) => {
            const style = clonedDoc.createElement('style');
            style.innerHTML = `
              .docx-pdf-rendering {
                background-color: #ffffff !important;
                color: #000000 !important;
                width: 794px !important; /* 210mm at 96dpi */
                position: relative !important;
                left: 0 !important;
                top: 0 !important;
              }
              .docx-pdf-rendering section.docx {
                box-shadow: none !important;
                padding: 20mm !important;
                margin: 0 !important;
                background: white !important;
              }
              /* Ensure all oklch values are replaced with simple colors if any leaked through docx styles */
              * { border-color: #e5e7eb !important; }
            `;
            clonedDoc.head.appendChild(style);
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(hiddenContainer).save();
      
      // Cleanup
      document.body.removeChild(hiddenContainer);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Erro ao gerar PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <RefreshCw size={32} className="text-blue-500 animate-spin" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Templates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        {/* Top: Lista de Templates em Grid */}
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <List size={18} />
              Selecione o Template
            </h3>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-gray-100 shadow-sm">
              {TEMPLATE_NAMES.length} Modelos Disponíveis
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {TEMPLATE_NAMES.map(name => (
              <button
                key={name}
                onClick={() => setSelectedTemplate(name)}
                className={`text-left px-3 py-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-tighter border-2 ${
                  selectedTemplate === name 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                    : 'bg-white text-gray-600 border-gray-100 hover:border-blue-200 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{name.replace('PSS assignment letter_', '')}</span>
                  {templates[name] && <CheckCircle2 size={12} className={selectedTemplate === name ? 'text-white' : 'text-green-500'} />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Lado Direito: Preview e Ações */}
        <div className="w-full space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileText className="text-blue-600" size={20} />
              </div>
              <div>
                <h3 className="font-black text-gray-800 text-xs uppercase tracking-widest">Visualização</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase truncate max-w-[200px]">
                  {selectedTemplate.replace('PSS assignment letter_', '')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadAsDocx}
                disabled={status !== 'success' || isProcessing}
                className="px-4 py-2 bg-gray-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <FileDown size={14} />
                <span>Baixar Word</span>
              </button>

              <button
                onClick={downloadAsPdf}
                disabled={status !== 'success' || isProcessing}
                className="px-4 py-2 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Download size={14} />
                <span>Baixar PDF</span>
              </button>
            </div>
          </div>

          <div className="relative group">
            <div 
              className="w-full aspect-[1/1.414] bg-white border border-gray-200 rounded-2xl shadow-inner-lg overflow-hidden p-12"
              style={{ overflowY: 'auto' }}
            >
              <div 
                ref={previewRef}
                className="docx-preview-container mx-auto"
                style={{ width: '100%', maxWidth: '800px' }}
              >
                {!processedDocBuffer && !isProcessing && (
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                )}
              </div>
            </div>
            {isProcessing && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-2xl pointer-events-none">
                <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
              </div>
            )}
            {status === 'error' && (
              <div className="absolute top-4 right-4 bg-red-50 p-3 rounded-xl border border-red-100 flex items-center space-x-2 text-red-700 shadow-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-[10px] font-bold uppercase">Erro no documento</span>
              </div>
            )}
          </div>

          <p className="text-[9px] text-gray-400 text-center italic">
            * As substituições são automáticas. Use marcadores no formato [TAG] nos arquivos Word. Por exemplo: [NOME], [DATA], [ASSINATURA]. Para negrito, formate o marcador como negrito no Word.
          </p>
        </div>
      </div>

      <style jsx global>{`
        .docx-preview-container {
          color: #374151 !important;
          background-color: #ffffff !important;
        }
        .docx-preview-container * {
          border-color: #e5e7eb !important;
          outline-color: transparent !important;
          text-decoration-color: transparent !important;
          box-shadow: none !important;
        }
        .docx-preview-container h1 { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.75rem; color: #111827 !important; }
        .docx-preview-container p { margin-bottom: 0.5rem; line-height: 1.4; color: #374151 !important; font-size: 0.85rem; }
        .docx-preview-container strong, .docx-preview-container b { color: #111827 !important; font-weight: bold; }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
