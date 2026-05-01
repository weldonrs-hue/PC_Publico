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
  FileDown,
  Mail
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface PioneerSchoolLettersProps {
  userId: string;
  selectedTurma: '1' | '2' | '3';
  schoolInfo: {
    dataTurma: string;
    instrutorA: string;
    instrutorB: string;
    localEscola: string;
    enderecoEscola: string;
    entregaLivroEndereco: string;
    entregaLivroDataHora: string;
    confirmacaoDataLimite: string;
    confirmacaoEmail: string;
    confirmacaoWhatsapp: string;
  };
}

const ESP_TEMPLATES = [
  { id: 'esp_anfitria', name: 'Carta à anfitriã' },
  { id: 'esp_refeicoes', name: 'Carta convites refeições' },
  { id: 'esp_pioneiros', name: 'Carta convite pioneiros' },
];

export default function PioneerSchoolLetters({ 
  userId, 
  selectedTurma, 
  schoolInfo
}: PioneerSchoolLettersProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(ESP_TEMPLATES[0].id);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string }>>({});
  const [personalData, setPersonalData] = useState<any>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [processedDocBuffer, setProcessedDocBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);

  const [needsProcessing, setNeedsProcessing] = useState(true);

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTemplates();
    fetchPersonalData();
  }, [userId]);

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

  const fetchPersonalData = async () => {
    try {
      const docRef = doc(db, 'personal_data', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPersonalData(docSnap.data());
      } else {
        const q = query(collection(db, 'personal_data'), where('userId', '==', userId), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setPersonalData(querySnapshot.docs[0].data());
        }
      }
    } catch (error) {
      console.error('Error fetching personal data:', error);
    }
  };

  // Prevent infinite loops by stringifying objects for dependency array
  const schoolInfoKey = JSON.stringify(schoolInfo);
  const personalDataKey = JSON.stringify(personalData);

  // Automatically process when template or data changes
  useEffect(() => {
    if (templates[selectedTemplate]) {
      setNeedsProcessing(true);
      processAndPreview();
    } else {
      setPreviewHtml('<div class="h-full flex flex-col items-center justify-center text-red-400 py-20 px-10 text-center text-xs uppercase font-black tracking-widest leading-relaxed">Template não encontrado no banco de dados.<br/>Carregue o arquivo .docx no Gerenciador de Uploads primeiro.</div>');
      setProcessedDocBuffer(null);
      setStatus('idle');
    }
  }, [selectedTemplate, templates, schoolInfoKey, personalDataKey]);

  const getReplacements = () => {
    const now = new Date();
    let hoje = now.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    // Capitalize the first letter of the weekday
    hoje = hoje.charAt(0).toUpperCase() + hoje.slice(1);

    const turma = `Turma ${selectedTurma}`;
    const dataValue = schoolInfo.dataTurma || '________________';
    const instrutores = `${schoolInfo.instrutorA || '________________'} e ${schoolInfo.instrutorB || '________________'}`;
    const local = schoolInfo.localEscola || '________________';
    const endereco = schoolInfo.enderecoEscola || '________________';
    const enderecoEntrega = schoolInfo.entregaLivroEndereco || '________________';
    const dataEntrega = schoolInfo.entregaLivroDataHora || '________________';
    const dataConfirmacao = schoolInfo.confirmacaoDataLimite || '________________';
    const email = schoolInfo.confirmacaoEmail || '________________';
    const contato = schoolInfo.confirmacaoWhatsapp || '________________';
    
    const assinatura = personalData?.signatureImage || '';
    const viajante = personalData?.nome || '________________';
    const circuito = personalData?.circuito || '________________';
    const telefoneCircuito = personalData?.telefoneCircuito || '________________';

    return {
      'TURMA': turma,
      'DATA': dataValue,
      'INSTRUTORES': instrutores,
      'LOCAL': local,
      'ENDEREÇO': endereco,
      'ENDERECOENTREGA': enderecoEntrega,
      'ENDEREÇOENTREGA': enderecoEntrega,
      'DATAENTREGA': dataEntrega,
      'DATACONFIRMAÇÃO': dataConfirmacao,
      'EMAIL': email,
      'CONTATO': contato,
      'ASSINATURA': assinatura,
      '%ASSINATURA': assinatura,
      'VIAJANTE': viajante,
      'CIRCUITO': circuito,
      'TELEFONE': telefoneCircuito,
      'HOJE': hoje
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
      
      // Pre-process XML to convert @TAG to [TAG] for Docxtemplater compatibility
      let xmlContent = zip.file('word/document.xml').asText();
      
      // Join broken text nodes (Common Word issue where tags like @DATA are split into multiple nodes)
      // This handles cases like <w:t>@</w:t><w:t>DATA</w:t>
      // We only merge if it's safe (doesn't cross paragraph or structural boundaries)
      // We also check for space preservation
      xmlContent = xmlContent.replace(/<\/w:t>(?:<w:rPr>.*?<\/w:rPr>|<w:proofErr[^>]*>|<w:noProof[^>]*>|<\/w:r><w:r[^>]*>)*?<w:t[^>]*>/g, '');
      
      // Special handle for signature image tagging (using % prefix for ImageModule)
      // We convert it to uppercase for consistency with the normalization below
      xmlContent = xmlContent.replace(/@Assinatura/gi, '[%ASSINATURA]');
      
      // Map other @tags to [tags]
      // We normalize all @tags to [UPPERCASE] during pre-processing to avoid Case Sensitivity issues
      // Range À-ÿ covers Portuguese accented characters
      xmlContent = xmlContent.replace(/@([A-Za-z0-9À-ÿ\u00C0-\u00FF]+)/g, (match, p1) => {
        return `[${p1.toUpperCase()}]`;
      });
      
      zip.file('word/document.xml', xmlContent);

      // Setup Image Module
      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      const opts: any = {
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
        getSize: () => [150, 60], // Standard signature size
      };

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' },
        modules: [new ImageModule(opts)]
      });

      const replacements = getReplacements();
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
      setNeedsProcessing(false);
    } catch (err: any) {
      console.error('Error processing DOCX:', err);
      setStatus('error');
      setPreviewHtml(`<div class="text-red-500 p-8 font-black bg-red-50 rounded-xl border border-red-100 uppercase text-xs">Erro ao processar: ${err.message}</div>`);
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
    const templateName = ESP_TEMPLATES.find(t => t.id === selectedTemplate)?.name || selectedTemplate;
    link.download = `${templateName}_Turma${selectedTurma}.docx`;
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
      const templateName = ESP_TEMPLATES.find(t => t.id === selectedTemplate)?.name || selectedTemplate;
      
      const opt = {
        margin: 0.5,
        filename: `${templateName}_Turma${selectedTurma}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: false,
          onclone: (clonedDoc: Document) => {
            // Find and remove specifically the Tailwind styles that contain oklch
            // We look for style tags that contain 'oklch' which is known to break html2canvas
            const styleTags = clonedDoc.querySelectorAll('style');
            styleTags.forEach(style => {
              if (style.innerHTML.includes('oklch')) {
                style.remove();
              }
            });

            // We do NOT remove all styles anymore to preserve docx-preview layout
            const style = clonedDoc.createElement('style');
            style.innerHTML = `
              .docx-preview-container {
                background-color: #ffffff !important;
                color: #000000 !important;
              }
              /* Force non-oklch colors for basic elements if Tailwind was removed */
              * {
                box-shadow: none !important;
                filter: none !important;
              }
            `;
            clonedDoc.head.appendChild(style);

            const el = clonedDoc.querySelector('.docx-preview-container') as HTMLElement;
            if (el) {
              // We do NOT clear classes or force styles on all children anymore
              // This was breaking the Word layout generated by docx-preview
              el.style.backgroundColor = '#ffffff';
              el.style.color = '#000000';
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
        <RefreshCw size={32} className="text-emerald-500 animate-spin" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Uploads...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-xs uppercase tracking-widest">
              <Mail size={18} className="text-emerald-600" />
              Selecione a Carta ESP
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ESP_TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`text-left px-4 py-3 rounded-xl text-[11px] font-black transition-all uppercase tracking-tight border-2 ${
                  selectedTemplate === template.id 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                    : 'bg-white text-gray-600 border-gray-50 hover:border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{template.name}</span>
                  {templates[template.id] && <CheckCircle2 size={14} className={selectedTemplate === template.id ? 'text-white' : 'text-emerald-500'} />}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="w-full space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-lg">
                <FileText className="text-emerald-600" size={20} />
              </div>
              <div>
                <h3 className="font-black text-gray-800 text-xs uppercase tracking-widest">Pré-visualização</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase truncate max-w-[200px]">
                  {ESP_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={processAndPreview}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md ${
                  needsProcessing 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                    : 'bg-gray-100 text-gray-500 cursor-default'
                }`}
              >
                {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                <span>{needsProcessing ? 'Gerar PDF/Prévia' : 'Atualizado'}</span>
              </button>

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
              className="w-full aspect-[1/1.414] bg-white border border-gray-200 rounded-3xl shadow-inner-lg overflow-hidden p-4 md:p-12"
              style={{ overflowY: 'auto' }}
            >
              <div 
                ref={previewRef}
                className="docx-preview-container mx-auto"
                style={{ width: '100%' }}
              >
                {!processedDocBuffer && !isProcessing && (
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                )}
              </div>
            </div>
            {isProcessing && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-3xl pointer-events-none">
                <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
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
            * As substituições são baseadas nas Informações da Escola e Dados Pessoais. Use marcadores @DATA, @LOCAL, @INSTRUTORES, @HOJE, etc. no Word.
          </p>
        </div>
      </div>

      <style jsx global>{`
        .docx-preview-container {
          background-color: #ffffff !important;
        }
        .docx-preview-container .docx-preview {
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          width: 100% !important;
        }
        .docx-preview-container section.docx {
          padding: 0 !important;
          margin: 0 !important;
          background: white !important;
          box-shadow: none !important;
        }
      `}</style>
    </div>
  );
}
