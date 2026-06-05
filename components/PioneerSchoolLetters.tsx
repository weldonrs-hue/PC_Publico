'use client';

import React, { useState, useEffect, useRef } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { 
  FileText, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  List,
  AlertCircle,
  FileDown,
  Mail,
  PenTool,
  Sparkles,
  Trash2,
  Settings2,
  FileUp,
  Save,
  Printer
} from 'lucide-react';
import { extractTagsFromDocx, getMissingTags, cleanPSSMetadata } from '@/lib/docxUtils';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where, limit, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface PioneerSchoolLettersProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
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
  isAdmin,
  canManage,
  selectedTurma, 
  schoolInfo
}: PioneerSchoolLettersProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(ESP_TEMPLATES[0].id);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string, isPrivate?: boolean }>>({});
  const [personalData, setPersonalData] = useState<any>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [processedDocBuffer, setProcessedDocBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Management state
  const [isManaging, setIsManaging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [localFileBuffer, setLocalFileBuffer] = useState<ArrayBuffer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [missingTags, setMissingTags] = useState<string[]>([]);
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);

  const [needsProcessing, setNeedsProcessing] = useState(true);

  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const viewerRef = useRef<any>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);

  // Initialize viewer once
  useEffect(() => {
    let destroyed = false;

    const initViewer = async () => {
      // Small delays to ensure container is fully loaded and attached to DOM
      for (let i = 0; i < 15; i++) {
        if (previewRef.current) break;
        await new Promise(r => setTimeout(r, 50));
      }

      if (!previewRef.current || destroyed) return;

      try {
        const { getUDocClient } = await import('@/lib/udoc');
        const client = await getUDocClient();
        
        if (destroyed) return;

        const viewer = await client.createViewer({
          container: previewRef.current,
          theme: 'light',
          toolbar: true,
          sidebar: false,
        });

        if (!destroyed) {
          viewerRef.current = viewer;
          // Add a generous delay before marking as ready to ensure internal setup is complete
          setTimeout(() => {
            if (!destroyed && viewerRef.current) {
               setIsViewerReady(true);
            }
          }, 1500);
        }
      } catch (err: any) {
        console.error('UDoc Viewer Init Error inside PioneerSchoolLetters:', err);
      }
    };

    if (!viewerRef.current) {
      initViewer();
    }

    return () => {
      destroyed = true;
      setIsViewerReady(false);
      if (viewerRef.current) {
        try { 
          const v = viewerRef.current;
          viewerRef.current = null;
          v.destroy(); 
        } catch (e) {}
      }
    };
  }, []);

  // Handle document updates
  useEffect(() => {
    let active = true;
    const updateDoc = async () => {
      if (isViewerReady && viewerRef.current && processedDocBuffer) {
        // Ensure processedDocBuffer is an ArrayBuffer and has content
        const buffer = processedDocBuffer instanceof ArrayBuffer ? processedDocBuffer : 
                      (processedDocBuffer as any).buffer instanceof ArrayBuffer ? (processedDocBuffer as any).buffer : null;
        
        if (!buffer || buffer.byteLength === 0 || !active) return;

        setIsProcessing(true);
        try {
          if (!viewerRef.current || typeof viewerRef.current.load !== 'function') {
            throw new Error('Viewer not ready');
          }
          const loadData = new Uint8Array(buffer);
          await viewerRef.current.load(loadData);
        } catch (err: any) {
          if (!active) return;
          console.error('UDoc Viewer Load Error (ESP):', err);
          // Retry logic if it's the "length" error which might mean internal state wasn't ready
          if (String(err).includes('length') || String(err).includes('null')) {
            console.log('UDoc load failed, retrying in 2000ms...');
            setTimeout(async () => {
              if (active && viewerRef.current && processedDocBuffer) {
                try {
                   const retryBuffer = processedDocBuffer instanceof ArrayBuffer ? processedDocBuffer : 
                                      (processedDocBuffer as any).buffer instanceof ArrayBuffer ? (processedDocBuffer as any).buffer : null;
                   if (retryBuffer && viewerRef.current?.load) {
                     await viewerRef.current.load(new Uint8Array(retryBuffer));
                   }
                } catch (e) {
                   console.error('Retry load failed:', e);
                }
              }
            }, 2000);
          }
        } finally {
          if (active) setIsProcessing(false);
        }
      }
    };

    updateDoc();
    return () => { active = false; };
  }, [processedDocBuffer, isViewerReady]);

  // Real-time templates listener
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'document_templates'), where('category', '==', 'esp'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTemplates: Record<string, any> = {};
      snapshot.forEach((doc) => {
        fetchedTemplates[doc.id] = doc.data();
      });

      const consolidated: Record<string, any> = {};
      ESP_TEMPLATES.forEach(t => {
        const privateId = `${userId}_${t.id}`;
        const globalId = t.id;
        
        if (fetchedTemplates[privateId]) {
          consolidated[t.id] = { ...fetchedTemplates[privateId], isPrivate: true };
        } else if (fetchedTemplates[globalId]) {
          consolidated[t.id] = { ...fetchedTemplates[globalId], isPrivate: false };
        }
      });

      setTemplates(consolidated);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to templates:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    fetchPersonalData();
  }, [userId]);

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
    if (localFileBuffer) {
      console.log('Using local file buffer for preview (ESP)');
      processAndPreview(localFileBuffer);
    } else if (templates[selectedTemplate]) {
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
    const formatter = new Intl.DateTimeFormat('pt-BR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    const hoje = formatter.format(now);

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
    
    const signatureName = personalData?.nome || '________________';
    const circuito = personalData?.circuito || '________________';
    const signatureText = `${signatureName} (${circuito})`;
    const signatureImage = personalData?.signatureImage || null;
    const signatureValue = signatureImage || signatureText;
    const telefoneCircuito = personalData?.telefoneCircuito || '________________';

    return {
      'TURMA': turma,
      'DATA': schoolInfo.dataTurma || hoje,
      'TURMA_DATA': schoolInfo.dataTurma || hoje,
      'DATA_TURMA': schoolInfo.dataTurma || hoje,
      'DATATURMA': schoolInfo.dataTurma || hoje,
      'INSTRUTORES': instrutores,
      'INSTRUTOR1': schoolInfo.instrutorA || '________________',
      'INSTRUTOR2': schoolInfo.instrutorB || '________________',
      'INSTRUTORA': schoolInfo.instrutorA || '________________',
      'INSTRUTORB': schoolInfo.instrutorB || '________________',
      'LOCAL': local,
      'LOCALESCOLA': local,
      'LOCAL_ESCOLA': local,
      'ENDEREÇO': endereco,
      'ENDERECO': endereco,
      'ENDEREÇOESCOLA': endereco,
      'ENDERECOESCOLA': endereco,
      'ENDEREÇO_ESCOLA': endereco,
      'ENDERECOENTREGA': enderecoEntrega,
      'ENDEREÇOENTREGA': enderecoEntrega,
      'DATAENTREGA': dataEntrega,
      'DATACONFIRMAÇÃO': dataConfirmacao,
      'DATACONFIRMACAO': dataConfirmacao,
      'EMAIL': email,
      'CONTATO': contato,
      'WHATSAPP': contato,
      'DATAHORA': schoolInfo.entregaLivroDataHora || '________________',
      'DATATREINO': schoolInfo.entregaLivroDataHora || '________________',
      'LOCALTREINO': schoolInfo.entregaLivroEndereco || '________________',
      'LOCAL_TREINO': schoolInfo.entregaLivroEndereco || '________________',
      'nome do instrutor': signatureText,
      'NOME DO INSTRUTOR': signatureText,
      'instrutor': signatureText,
      'INSTRUTOR': signatureText,
      'ASSINATURA': signatureValue,
      'assinatura': signatureValue,
      '%ASSINATURA': signatureValue,
      'ASSINATURA_GLOBAL': signatureValue,
      'VIAJANTE': signatureName,
      'viajante': signatureName,
      'NOME_VIAJANTE': signatureName,
      'NOME': signatureName,
      'nome': signatureName,
      'CIRCUITO': circuito,
      'NOME_CIRCUITO': circuito,
      'TELEFONE': telefoneCircuito,
      'FONE': telefoneCircuito,
      'TELEFONE_CIRCUITO': telefoneCircuito,
      'TELEFONECIRCUITO': telefoneCircuito,
      'HOJE': hoje,
      'DATA_ATUAL': hoje
    };
  };

  const processAndPreview = async (overrideBuffer?: ArrayBuffer) => {
    const template = templates[selectedTemplate];
    if (!template && !overrideBuffer) return;

    setIsProcessing(true);
    setStatus('idle');

    try {
      let sourceBuffer: ArrayBuffer;
      if (overrideBuffer) {
        sourceBuffer = overrideBuffer;
      } else {
        const binaryString = window.atob(template.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        sourceBuffer = bytes.buffer;
      }
      
      // Clean metadata
      const cleanedBuffer = cleanPSSMetadata(sourceBuffer);
      const zip = new PizZip(cleanedBuffer);
      
      // Pre-process all XML files in the zip (document, headers, footers)
      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      
      xmlFiles.forEach(file => {
        let xmlContent = file.asText();
        
        // 1. Clean up common Word junk
        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
        
        // 2. Join split tags - MUCH safer version
        // Supports [TAG] and @TAG with spaces and special characters
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/([\[@][^<\]]*)(<\/w:t>(?:<w:proofErr[^>]*\/>)*?<w:t[^>]*>)([^<\]]+)/g, "$1$3$2");
        }
        
        // Ensure namespaces present for images
        if (!xmlContent.includes('xmlns:wp=')) {
          xmlContent = xmlContent.replace(/(<w:(?:document|hdr|ftr)[^>]*)/, (match) => {
            if (match.includes('xmlns:wp=')) return match;
            return `${match} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;
          });
        }
        
        // 3. Surgical replacement of @TAG to [TAG]
        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match, opening, text, closing) => {
          let newText = text;
          // Handle Signature
          newText = newText.replace(/@Assinatura([A-Za-z0-9À-ÿ\_]*\s*Global|_Global)?/gi, '[%ASSINATURA]');
          newText = newText.replace(/(^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g, (m, p1, p2) => {
            return `${p1}[${p2.toUpperCase()}]`;
          });
          return `${opening}${newText}${closing}`;
        });

        zip.file(file.name, xmlContent);
      });
      
      const replacements = getReplacements();
      
      // For preview, we want to show the signature text as well
      const previewReplacements = { ...replacements };

      // Setup Image Module
      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      
      // Calculate signature dimensions to avoid "squeezing"
      const signatureScale = personalData?.signatureSize || 60;
      let sigHeight = signatureScale;
      let sigWidth = sigHeight * 2.5; // Default aspect ratio
      
      if (replacements.ASSINATURA && replacements.ASSINATURA.startsWith('data:image')) {
        try {
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = replacements.ASSINATURA;
          });
          
          const aspectRatio = img.width / img.height;
          sigHeight = signatureScale;
          sigWidth = sigHeight * aspectRatio;
          
          // Maximum width constraint
          if (sigWidth > 350) {
            sigWidth = 350;
            sigHeight = sigWidth / aspectRatio;
          }
        } catch (e) {
          console.warn('Could not determine signature dimensions:', e);
        }
      }

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
        getSize: () => [sigWidth, sigHeight],
      };

      // Also generate the "real" buffer with signed content for download & preview
      const docReal = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' },
        modules: ImageModule ? [new ImageModule(opts)] : []
      });
      docReal.render(replacements);
      const outReal = docReal.getZip().generate({
        type: 'arraybuffer'
      });
      setProcessedDocBuffer(outReal);

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

  const downloadAsPdf = () => {
    alert('Dica: Para obter a máxima qualidade e fidelidade visual do seu PDF, utilize o botão de Download (seta para baixo) ou a Impressora integrados diretamente no topo do próprio Visualizador de Documentos abaixo!');
  };

  const handlePrint = () => {
    if (viewerRef.current?.print) {
      viewerRef.current.print();
    } else {
      try {
        const udocIframe = previewRef.current?.querySelector('iframe');
        if (udocIframe && udocIframe.contentWindow) {
          udocIframe.contentWindow.print();
        } else {
          window.print();
        }
      } catch (e) {
        window.print();
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.docx')) {
        console.log('File selected (ESP):', selectedFile.name);
        setFile(selectedFile);
        try {
          const rawBuffer = await selectedFile.arrayBuffer();
          const cleanedBuffer = cleanPSSMetadata(rawBuffer);
          setLocalFileBuffer(cleanedBuffer);

          // Validate tags
          const tags = await extractTagsFromDocx(cleanedBuffer);
          const required = [
            ['DATA', 'TURMA_DATA', 'DATATURMA'],
            ['ASSINATURA', '%ASSINATURA', 'ASSINATURA_GLOBAL'],
            ['VIAJANTE', 'NOME_VIAJANTE'],
            ['CIRCUITO', 'NOME_CIRCUITO']
          ];
          const missing = getMissingTags(tags, required);
          setMissingTags(missing);
          setErrorMessage('');
          setSaveStatus('idle');
        } catch (err: any) {
          console.error('Error validating uploaded docx:', err);
          setErrorMessage('Erro ao ler arquivo: ' + err.message);
        }
      } else {
        setErrorMessage('Por favor, selecione um arquivo .docx');
        setSaveStatus('error');
      }
    }
  };

  const saveTemplate = async () => {
    if (!file || !localFileBuffer) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const blob = new Blob([localFileBuffer]);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const isGlobal = isAdmin && saveAsGlobal;
      const docId = isGlobal ? selectedTemplate : `${userId}_${selectedTemplate}`;
      await setDoc(doc(db, 'document_templates', docId), {
        name: selectedTemplate,
        content: base64,
        updatedAt: new Date().toISOString(),
        category: 'esp',
        isGlobal: isGlobal,
        ownerId: isGlobal ? 'admin' : userId
      });

      // Cleanup user private version if saving global
      if (isGlobal) {
        const privateId = `${userId}_${selectedTemplate}`;
        try {
          const privateSnap = await getDoc(doc(db, 'document_templates', privateId));
          if (privateSnap.exists()) {
            await deleteDoc(doc(db, 'document_templates', privateId));
          }
        } catch (e) {
          console.warn('Silent error removing private version during global save:', e);
        }
      }

      alert(isGlobal ? 'Modelo substituído com sucesso para TODOS os usuários.' : 'Seu modelo personalizado foi atualizado com sucesso.');
      setSaveStatus('success');
      setFile(null);
      setLocalFileBuffer(null);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Error saving template:', error);
      setErrorMessage(error.message || 'Erro ao salvar');
      setSaveStatus('error');
      alert('Erro ao salvar template: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const deletePrivateTemplate = async () => {
    const templateData = templates[selectedTemplate];
    if (!templateData?.isPrivate) return;
    if (!confirm('Tem certeza que deseja excluir sua versão personalizada deste modelo? O sistema voltará a usar o modelo padrão.')) return;
    
    setIsSaving(true);
    try {
      const docId = `${userId}_${selectedTemplate}`;
      await deleteDoc(doc(db, 'document_templates', docId));
      
      console.log('Template private version deleted:', docId);
      
      setSaveStatus('success');
      
      alert('Sua versão personalizada foi excluída. O sistema voltará a usar o modelo padrão.');
      
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Error deleting template:', error);
      setErrorMessage(error.message || 'Erro ao excluir');
      setSaveStatus('error');
      alert('Erro ao excluir versão personalizada: ' + error.message);
    } finally {
      setIsSaving(false);
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
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-extrabold text-gray-900 flex items-center gap-3 text-sm uppercase tracking-widest bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100">
              <Mail size={20} />
              Selecione o Modelo de Carta
            </h3>
            
            {canManage && (
              <button
                onClick={() => setIsManaging(!isManaging)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm ${
                  isManaging 
                    ? 'bg-amber-500 text-white border-amber-400' 
                    : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50'
                }`}
              >
                <Settings2 size={14} />
                {isManaging ? 'Fechar Gerenciador' : 'Gerenciar Templates'}
              </button>
            )}
          </div>
          
          <div className="flex overflow-x-auto md:grid md:grid-cols-3 gap-4 pb-2 md:pb-0 custom-scrollbar">
            {ESP_TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`w-full text-left px-5 py-4 rounded-2xl text-[16px] font-black transition-all uppercase tracking-tight border-2 flex flex-col gap-2 relative group h-full justify-between ${
                  selectedTemplate === template.id 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xl scale-[1.02]' 
                    : 'bg-white text-gray-600 border-gray-100 hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="truncate">{template.name}</span>
                  {templates[template.id] && (
                    <CheckCircle2 size={18} className={selectedTemplate === template.id ? 'text-white' : 'text-emerald-500'} />
                  )}
                </div>
                {templates[template.id] ? (
                  <div className="flex items-center gap-1.5 mt-auto">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm ${
                      templates[template.id].isPrivate 
                        ? (selectedTemplate === template.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700')
                        : (selectedTemplate === template.id ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700')
                    }`}>
                      {templates[template.id].isPrivate ? 'SEU MODELO' : 'GLOBAL PROGCIR'}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-red-400 mt-auto flex items-center gap-1">
                    <AlertCircle size={10} /> NÃO CONFIGURADO
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {isManaging && canManage && (
          <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
                <FileUp size={16} />
                Gerenciar Modelo: {ESP_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
              </h4>
              <button onClick={() => setIsManaging(false)} className="text-amber-400 hover:text-amber-600 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                {isAdmin && (
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-100">
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Salvar para todos?</span>
                    <button
                      onClick={() => setSaveAsGlobal(!saveAsGlobal)}
                      className={`w-10 h-5 rounded-full transition-all relative ${saveAsGlobal ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${saveAsGlobal ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}

                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".docx" className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex flex-col items-center justify-center p-6 rounded-xl text-[10px] font-black uppercase tracking-tighter border-2 border-dashed transition-all ${
                    file ? 'bg-white text-emerald-700 border-emerald-300 shadow-inner' : 'bg-white text-gray-400 border-gray-200 hover:border-amber-300 hover:text-amber-600'
                  }`}
                >
                  <FileUp size={24} className={file ? 'text-emerald-500' : 'text-gray-300'} />
                  <span className="mt-2 truncate max-w-full">{file ? file.name : 'CARREGAR NOVO MODELO DOCX'}</span>
                </button>
              </div>

              <div className="space-y-3">
                {file && (
                  <div className="space-y-3">
                    {missingTags.length > 0 ? (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-1">
                        <p className="text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1">
                          <AlertCircle size={12} /> Marcadores Faltantes
                        </p>
                        <p className="text-[8px] font-bold text-red-500 leading-tight">
                          Recomendado: {missingTags.join(', ')}
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                          <CheckCircle2 size={12} /> Status: OK
                        </p>
                        <p className="text-[8px] font-bold text-emerald-500 leading-tight">Documento validado!</p>
                      </div>
                    )}

                    <button
                      onClick={saveTemplate}
                      disabled={isSaving}
                      className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg ${
                        saveStatus === 'success' ? 'bg-green-600 text-white' : saveStatus === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      } disabled:opacity-50`}
                    >
                      {isSaving ? <RefreshCw className="animate-spin" size={14} /> : saveStatus === 'success' ? <CheckCircle2 size={14} /> : <Save size={14} />}
                      {isSaving ? 'SALVANDO...' : saveStatus === 'success' ? 'SALVO!' : 'SALVAR MODELO'}
                    </button>
                    
                    {!file && templates[selectedTemplate]?.isPrivate && (
                      <button
                        onClick={deletePrivateTemplate}
                        disabled={isSaving}
                        className="w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        {isSaving ? <RefreshCw className="animate-spin" size={14} /> : <Trash2 size={14} />}
                        {isSaving ? 'EXCLUINDO...' : 'EXCLUIR MINHA VERSÃO'}
                      </button>
                    )}
                    
                    {saveStatus === 'error' && (
                      <p className="text-[9px] text-red-500 font-bold text-center uppercase">{errorMessage || 'Erro ao salvar'}</p>
                    )}
                  </div>
                )}
                {!file && (
                  <div className="h-full flex flex-col items-center justify-center p-4 bg-white/50 rounded-xl border border-amber-50">
                    <p className="text-[9px] text-amber-600 font-black text-center uppercase tracking-widest leading-relaxed">
                      Selecione um arquivo .docx para atualizar o modelo <br/> deste documento no servidor.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="w-full space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-200 text-white">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-sm uppercase tracking-widest leading-none mb-1">Carga e Prévia</h3>
                <p className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-tight bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 w-fit">
                  {ESP_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {needsProcessing && (
                <button
                  onClick={processAndPreview}
                  disabled={isProcessing}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                  title="Gerar PDF/Prévia"
                >
                  {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  GERAR DOCUMENTO
                </button>
              )}

              <div className="flex items-center bg-gray-100 p-1 rounded-2xl gap-1">
                <button
                  onClick={handlePrint}
                  disabled={status !== 'success' || isProcessing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-blue-50 transition-all disabled:opacity-50 border border-transparent hover:border-blue-200"
                  title="Imprimir"
                >
                  <Printer size={14} />
                  IMPRIMIR
                </button>

                <button
                  onClick={downloadAsDocx}
                  disabled={status !== 'success' || isProcessing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:text-black transition-all disabled:opacity-50 border border-transparent hover:border-gray-300"
                  title="Baixar Word"
                >
                  <FileDown size={14} />
                  WORD
                </button>

                <button
                  onClick={downloadAsPdf}
                  disabled={status !== 'success' || isProcessing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-red-50 transition-all disabled:opacity-50 border border-transparent hover:border-red-200"
                  title="Baixar PDF"
                >
                  <Download size={14} />
                  PDF
                </button>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div 
              className="w-full h-[750px] bg-[#1A1B1E] border border-[#2c2e33] rounded-3xl shadow-inner-lg overflow-hidden relative"
            >
              <div 
                ref={previewRef} 
                className="w-full h-full"
                style={{ display: processedDocBuffer ? 'block' : 'block', visibility: processedDocBuffer ? 'visible' : 'hidden', position: processedDocBuffer ? 'relative' : 'absolute' }}
              />

              {!processedDocBuffer && !isProcessing && (
                <div 
                  className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center p-8 text-gray-500 font-bold uppercase tracking-widest text-xs"
                  dangerouslySetInnerHTML={{ __html: previewHtml || 'Selecione um template para visualizar' }}
                />
              )}
            </div>
            {isProcessing && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center rounded-3xl pointer-events-none">
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
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1A1B1E;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2c2e33;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
