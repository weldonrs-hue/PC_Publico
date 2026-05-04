'use client';

import React, { useState, useEffect, useRef } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import mammoth from 'mammoth';
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
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc 
} from 'firebase/firestore';

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
  const [personalData, setPersonalData] = useState<any>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTemplates();
    fetchPersonalData();
  }, []);

  const fetchPersonalData = async () => {
    if (!userId) return;
    try {
      const docRef = doc(db, 'personal_data', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPersonalData(docSnap.data());
      }
    } catch (error) {
      console.error('Error fetching personal data:', error);
    }
  };

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
    
    const signatureImage = personalData?.signatureImage || '';

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
      'assinatura': signatureImage || signatureBlock,
      'ASSINATURA': signatureImage || signatureBlock,
      '%ASSINATURA': signatureImage || '',
      'ASSINATURA_GLOBAL': signatureImage || '',
    };
  };

  const processAndPreview = async () => {
    const template = templates[selectedTemplate];
    if (!template) return;

    setIsProcessing(true);
    setStatus('idle');

    try {
      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      
      const signatureImage = personalData?.signatureImage || '';
      let sigWidth = 150;
      let sigHeight = 60;
      
      if (signatureImage && signatureImage.startsWith('data:image')) {
        try {
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = signatureImage;
          });
          const aspectRatio = img.width / img.height;
          sigHeight = 60;
          sigWidth = sigHeight * aspectRatio;
          if (sigWidth > 220) {
            sigWidth = 220;
            sigHeight = sigWidth / aspectRatio;
          }
        } catch (e) {
          console.warn('Could not determine signature dimensions:', e);
        }
      }

      const imgOpts: any = {
        centered: false,
        getImage: (tagValue: string) => {
          if (!tagValue || !tagValue.startsWith('data:image')) return null;
          const base64Data = tagValue.split(',')[1];
          const binaryStringArray = window.atob(base64Data);
          const len = binaryStringArray.length;
          const bytesArray = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytesArray[i] = binaryStringArray.charCodeAt(i);
          }
          return bytesArray.buffer;
        },
        getSize: () => [sigWidth, sigHeight],
      };

      const binaryString = window.atob(template.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const content = bytes.buffer;

      const zip = new PizZip(content);
      
      // Pre-process all XML files in the zip (document, headers, footers) to handle Word-specific tag splitting and @TAG to [TAG] conversion
      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      
      xmlFiles.forEach(file => {
        let xmlContent = file.asText();
        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
        
        // Join split tags
        // We include spaces in the join to handle tags like "@Assinatura Global" that Word often splits
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\u00C0-\u00FF\_\s]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_\s]+)/g, "$1$3$2");
        }
        
        // Convert @TAG to [TAG] or [%TAG]
        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match, opening, text, closing) => {
          let newText = text;
          // Handle Signature specifically (case insensitive, supporting "Assinatura Global", "Assinatura_Global", etc.)
          newText = newText.replace(/@Assinatura([A-Za-z0-9À-ÿ\_]*\s*Global|_Global)?/gi, '[%ASSINATURA]');
          newText = newText.replace(/(^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g, (m, p1, p2) => {
            return `${p1}[${p2.toUpperCase()}]`;
          });
          return `${opening}${newText}${closing}`;
        });
        
        zip.file(file.name, xmlContent);
      });

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' },
        modules: ImageModule ? [new ImageModule(imgOpts)] : []
      });

      const replacements = getReplacements(selectedTemplate);
      doc.render(replacements);

      const out = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const processedArrayBuffer = await out.arrayBuffer();
      setProcessedDocBuffer(processedArrayBuffer);
      
      const previewResult = await mammoth.convertToHtml({ arrayBuffer: processedArrayBuffer });
      setPreviewHtml(previewResult.value);
      
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
    if (!previewRef.current) return;

    setIsProcessing(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      
      const element = previewRef.current;
      const opt = {
        margin: 0.5,
        filename: `${selectedTemplate}_Turma${selectedTurma}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: false,
          onclone: (clonedDoc: Document) => {
            const style = clonedDoc.createElement('style');
            style.innerHTML = `
              :root {
                --tw-prose-body: #374151 !important;
                --tw-prose-headings: #111827 !important;
                --tw-prose-lead: #4b5563 !important;
                --tw-prose-links: #111827 !important;
                --tw-prose-bold: #111827 !important;
                --tw-prose-counters: #6b7280 !important;
                --tw-prose-bullets: #d1d5db !important;
                --tw-prose-hr: #e5e7eb !important;
                --tw-prose-quotes: #111827 !important;
                --tw-prose-quote-borders: #e5e7eb !important;
                --tw-prose-captions: #6b7280 !important;
                --tw-prose-code: #111827 !important;
                --tw-prose-pre-code: #e5e7eb !important;
                --tw-prose-pre-bg: #1f2937 !important;
                --tw-prose-th-borders: #d1d5db !important;
                --tw-prose-td-borders: #e5e7eb !important;
              }
              * {
                color: #374151 !important;
                border-color: #e5e7eb !important;
                background-color: transparent !important;
                outline-color: transparent !important;
                text-decoration-color: transparent !important;
                box-shadow: none !important;
                filter: none !important;
                -webkit-tap-highlight-color: transparent !important;
              }
              h1, h2, h3, h4, strong, b {
                color: #111827 !important;
              }
              body, html {
                background-color: #ffffff !important;
              }
            `;
            clonedDoc.head.appendChild(style);

            const el = clonedDoc.querySelector('.docx-preview-container') as HTMLElement;
            if (el) {
              el.className = 'docx-preview-container'; 
              el.style.fontFamily = 'Arial, "Helvetica Neue", Helvetica, sans-serif';
              el.style.color = '#374151';
              el.style.backgroundColor = '#ffffff';
              el.style.padding = '40px'; 
              el.style.width = '100%';
              
              const all = el.getElementsByTagName('*');
              for (let i = 0; i < all.length; i++) {
                const child = all[i] as HTMLElement;
                // Aggressively remove classes and inline styles that might use oklch
                child.classList.remove('prose', 'prose-sm', 'prose-invert', 'shadow', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl');
                
                // Clear any computed oklch values by forcing safe values
                child.style.setProperty('color', '#374151', 'important');
                if (['H1', 'H2', 'H3', 'H4', 'STRONG', 'B'].includes(child.tagName)) {
                  child.style.setProperty('color', '#111827', 'important');
                }
                child.style.setProperty('outline-color', 'transparent', 'important');
                child.style.setProperty('text-decoration-color', 'transparent', 'important');
                child.style.setProperty('box-shadow', 'none', 'important');
                child.style.setProperty('filter', 'none', 'important');
              }
            }
          }
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
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
                className="prose prose-sm max-w-none docx-preview-container mx-auto"
                style={{ width: '100%', maxWidth: '800px' }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
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
        .docx-preview-container p { margin-bottom: 0.5rem; line-height: 1.4; color: #374151 !important; font-size: 1rem; }
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
