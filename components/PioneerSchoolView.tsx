'use client';

import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Save, 
  X,
  Loader2,
  UserPlus,
  ClipboardPaste,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface Student {
  id: string;
  nome: string;
  congregacao: string;
  circuito: string;
  userId: string;
  createdAt: any;
}

interface PioneerSchoolViewProps {
  userId: string;
  onBack: () => void;
  congregations: any[];
  defaultCircuit: string;
}

export default function PioneerSchoolView({ userId, onBack, congregations, defaultCircuit }: PioneerSchoolViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Student | 'index'; direction: 'asc' | 'desc' }>({
    key: 'nome',
    direction: 'asc',
  });
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    congregacao: '',
    circuito: defaultCircuit || ''
  });

  const getCongregationLabel = (c: any) => {
    const { numero, nome, cidade, estado } = c;
    
    // Clean up name if it already contains the state at the end (e.g. "Nome - PB")
    let cleanNome = nome || '';
    if (estado && cleanNome.endsWith(` - ${estado}`)) {
      cleanNome = cleanNome.substring(0, cleanNome.length - (estado.length + 3));
    } else if (estado && cleanNome.endsWith(` ${estado}`)) {
      cleanNome = cleanNome.substring(0, cleanNome.length - (estado.length + 1));
    }

    let label = cleanNome;
    
    // Add city if different from name
    if (cidade && cleanNome.toLowerCase() !== cidade.toLowerCase()) {
      label += ` - ${cidade}`;
    }
    
    return `(${numero}) ${label} ${estado}`;
  };

  useEffect(() => {
    const q = query(
      collection(db, 'pioneer_school_students'), 
      where('userId', '==', userId),
      orderBy('nome', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Student[];
      setStudents(studentsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'pioneer_school_students');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleOpenModal = (student: Student | null = null) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        nome: student.nome,
        congregacao: student.congregacao,
        circuito: student.circuito
      });
    } else {
      setEditingStudent(null);
      setFormData({
        nome: '',
        congregacao: '',
        circuito: defaultCircuit || ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.congregacao || !formData.circuito) return;

    try {
      if (editingStudent) {
        await updateDoc(doc(db, 'pioneer_school_students', editingStudent.id), {
          ...formData,
          updatedAt: new Date()
        });
      } else {
        await addDoc(collection(db, 'pioneer_school_students'), {
          ...formData,
          userId,
          createdAt: new Date()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingStudent ? OperationType.UPDATE : OperationType.CREATE, 'pioneer_school_students');
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    console.log('Iniciando importação...');

    try {
      let parsedStudents: any[] = [];

      // TENTATIVA 1: Formato Excel/TSV (Linha por linha, separado por TAB ou múltiplos espaços)
      const lines = importText.split(/[\r\n]+/);
      console.log(`Tentando formato Excel/TSV com ${lines.length} linhas...`);
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Divide por TAB ou por 2 ou mais espaços
        const parts = line.split(/\t|\s{2,}/).map(p => p.trim()).filter(p => p.length > 0);
        
        // O formato esperado é: [Nº] [Nome] [Congregação] [Circuito]
        // Aceitamos se tiver pelo menos 3 partes (Nº, Nome, Congregação)
        if (parts.length >= 3 && /^\d+$/.test(parts[0])) {
          const nome = parts[1];
          const congregacao = parts[2];
          const circuito = parts[3] || defaultCircuit || '';
          
          if (nome && congregacao) {
            parsedStudents.push({
              nome,
              congregacao,
              circuito,
              userId,
              createdAt: new Date()
            });
          }
        }
      }

      // TENTATIVA 2: Formato PDF (ID de 7-8 dígitos e Data no final)
      // Se a primeira tentativa não encontrou nada, tentamos o modo robusto de PDF
      if (parsedStudents.length === 0) {
        console.log('Formato Excel não detectado, tentando formato PDF robusto...');
        const normalizedText = importText.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
        const recordStarts = [...normalizedText.matchAll(/(\d+)\s+(\d{7,8})\b/g)];
        
        for (let i = 0; i < recordStarts.length; i++) {
          const currentMatch = recordStarts[i];
          const nextMatch = recordStarts[i + 1];
          const startIdx = currentMatch.index!;
          const endIdx = nextMatch ? nextMatch.index : normalizedText.length;
          const recordText = normalizedText.substring(startIdx, endIdx).trim();
          
          const idMatch = recordText.match(/^(\d+)\s+(\d{7,8})\b/);
          if (!idMatch) continue;
          
          const afterId = recordText.substring(idMatch[0].length).trim();
          const dateMatch = afterId.match(/(\d{2}\/\d{2}\/\d{4})/);
          if (!dateMatch) continue;
          
          const dateIdx = dateMatch.index!;
          const nameAndCong = afterId.substring(0, dateIdx).trim();
          const lastParenIdx = nameAndCong.lastIndexOf('(');
          if (lastParenIdx === -1) continue;
          
          const congregation = nameAndCong.substring(lastParenIdx).trim();
          const nome = nameAndCong.substring(0, lastParenIdx).trim();
          
          if (nome && congregation) {
            parsedStudents.push({
              nome,
              congregacao: congregation,
              circuito: defaultCircuit || '',
              userId,
              createdAt: new Date()
            });
          }
        }
      }

      console.log('Total de alunos extraídos:', parsedStudents.length);

      if (parsedStudents.length === 0) {
        setImportError('Não foi possível identificar o formato dos dados. Certifique-se de copiar a lista completa do PDF ou as colunas do Excel.');
        setIsImporting(false);
        return;
      }

      // Salvar no Firestore
      for (const student of parsedStudents) {
        await addDoc(collection(db, 'pioneer_school_students'), student);
      }
      
      setImportSuccess(parsedStudents.length);
      setImportText('');
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportSuccess(null);
      }, 2000);

    } catch (error) {
      console.error('Erro ao importar:', error);
      setImportError('Ocorreu um erro ao salvar no banco de dados. Tente novamente.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setStudentToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!studentToDelete) return;
    try {
      await deleteDoc(doc(db, 'pioneer_school_students', studentToDelete));
      setIsDeleteModalOpen(false);
      setStudentToDelete(null);
      setSelectedStudents(prev => prev.filter(id => id !== studentToDelete));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'pioneer_school_students');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStudents.length === 0) return;
    try {
      const batch = writeBatch(db);
      selectedStudents.forEach(id => {
        batch.delete(doc(db, 'pioneer_school_students', id));
      });
      await batch.commit();
      setSelectedStudents([]);
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'pioneer_school_students');
    }
  };

  const toggleSelectStudent = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedStudents.length === sortedStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(sortedStudents.map(s => s.id));
    }
  };

  const filteredStudents = students.filter(s => 
    s.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.congregacao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortConfig.key === 'index') {
      // Sort by original creation order if 'index' is selected
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
    }

    const valA = (a[sortConfig.key] || '').toString().toLowerCase();
    const valB = (b[sortConfig.key] || '').toString().toLowerCase();

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: keyof Student | 'index') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }: { column: keyof Student | 'index' }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={14} className="ml-1 opacity-50" />;
    return sortConfig.direction === 'asc' ? 
      <ArrowUp size={14} className="ml-1 text-white" /> : 
      <ArrowDown size={14} className="ml-1 text-white" />;
  };

  return (
    <div className="space-y-6 relative">
      <AnimatePresence>
        {selectedStudents.length > 0 && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white shadow-2xl border border-gray-200 rounded-2xl px-6 py-4 flex items-center gap-6"
          >
            <div className="flex items-center gap-2">
              <span className="bg-[#4CAF50] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                {selectedStudents.length}
              </span>
              <span className="text-sm font-medium text-gray-600">selecionados</span>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedStudents([])}
                className="text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all font-bold"
              >
                <Trash2 size={18} />
                Excluir Selecionados
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#4CAF50] bg-white shadow-md border border-gray-200"
          >
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Escola do Serviço de Pioneiro</h2>
            <p className="text-sm text-gray-500">Lista de alunos convidados</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar aluno..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent outline-none transition-all"
            />
          </div>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-sm font-bold whitespace-nowrap"
            title="Importar da Área de Transferência"
          >
            <Plus size={20} className="text-gray-400" />
            <span className="hidden sm:inline">Importar</span>
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-[#4CAF50] text-white rounded-xl hover:bg-[#43a047] transition-all shadow-md font-bold whitespace-nowrap"
          >
            <UserPlus size={20} />
            <span className="hidden sm:inline">Adicionar Aluno</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#37616b] text-white">
                <th className="px-4 py-2 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 text-[#4CAF50] focus:ring-[#4CAF50] cursor-pointer"
                    checked={selectedStudents.length === sortedStudents.length && sortedStudents.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-2 font-bold text-sm uppercase tracking-wider w-14">
                  Nº
                </th>
                <th 
                  className="px-6 py-2 font-bold text-sm uppercase tracking-wider cursor-pointer hover:bg-[#2c4d55] transition-colors"
                  onClick={() => handleSort('nome')}
                >
                  <div className="flex items-center">
                    Nome do Aluno
                    <SortIcon column="nome" />
                  </div>
                </th>
                <th 
                  className="px-6 py-2 font-bold text-sm uppercase tracking-wider cursor-pointer hover:bg-[#2c4d55] transition-colors"
                  onClick={() => handleSort('congregacao')}
                >
                  <div className="flex items-center">
                    Congregação
                    <SortIcon column="congregacao" />
                  </div>
                </th>
                <th 
                  className="px-6 py-2 font-bold text-sm uppercase tracking-wider cursor-pointer hover:bg-[#2c4d55] transition-colors"
                  onClick={() => handleSort('circuito')}
                >
                  <div className="flex items-center">
                    Circuito
                    <SortIcon column="circuito" />
                  </div>
                </th>
                <th className="px-6 py-2 font-bold text-sm uppercase tracking-wider w-24 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-[#4CAF50]" size={32} />
                    <p className="mt-2 text-gray-500">Carregando alunos...</p>
                  </td>
                </tr>
              ) : sortedStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Nenhum aluno encontrado.
                  </td>
                </tr>
              ) : (
                sortedStudents.map((student, index) => (
                  <tr 
                    key={student.id} 
                    className={`hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${selectedStudents.includes(student.id) ? 'bg-green-50/50' : ''}`}
                  >
                    <td className="px-4 py-2">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-[#4CAF50] focus:ring-[#4CAF50] cursor-pointer"
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => toggleSelectStudent(student.id)}
                      />
                    </td>
                    <td className="px-4 py-2 text-sm font-medium text-gray-600">{index + 1}</td>
                    <td className="px-6 py-2 text-sm font-bold text-gray-900">{student.nome}</td>
                    <td className="px-6 py-2 text-sm text-gray-600">{student.congregacao}</td>
                    <td className="px-6 py-2 text-sm text-gray-600">{student.circuito}</td>
                    <td className="px-6 py-2 text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleOpenModal(student)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(student.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Adicionar/Editar */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800">
                  {editingStudent ? 'Editar Aluno' : 'Novo Aluno'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Aluno</label>
                  <input
                    required
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4CAF50] outline-none"
                    placeholder="Nome completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Congregação</label>
                  <select
                    required
                    value={formData.congregacao}
                    onChange={(e) => setFormData({ ...formData, congregacao: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4CAF50] outline-none bg-white"
                  >
                    <option value="">Selecione a congregação</option>
                    {congregations.map(c => {
                      const label = getCongregationLabel(c);
                      return (
                        <option key={c.id} value={label}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Circuito</label>
                  <input
                    required
                    type="text"
                    value={formData.circuito}
                    onChange={(e) => setFormData({ ...formData, circuito: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4CAF50] outline-none"
                    placeholder="Ex: PB-003"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[#4CAF50] text-white rounded-xl hover:bg-[#43a047] font-bold transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirmar Exclusão em Massa */}
      <AnimatePresence>
        {isBulkDeleteModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Excluir {selectedStudents.length} Alunos?</h3>
                <p className="text-gray-600 mb-6">
                  Tem certeza que deseja excluir os {selectedStudents.length} alunos selecionados? Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsBulkDeleteModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold transition-all"
                  >
                    Não
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold transition-all shadow-md"
                  >
                    Sim, Excluir Todos
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirmar Exclusão */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Excluir Aluno?</h3>
                <p className="text-gray-600 mb-6">
                  Tem certeza que deseja excluir este aluno? Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setStudentToDelete(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold transition-all"
                  >
                    Não
                  </button>
                  <button
                    onClick={executeDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold transition-all shadow-md"
                  >
                    Sim, Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Importar */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <ClipboardPaste className="text-[#4CAF50]" size={24} />
                  <h3 className="text-lg font-bold text-gray-800">
                    Importar da Área de Transferência
                  </h3>
                </div>
                <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Cole abaixo o texto copiado da sua lista (PDF ou Excel). O sistema irá identificar automaticamente o nome do aluno, a congregação e o circuito.
                </p>

                {importError && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium">
                    {importError}
                  </div>
                )}

                {importSuccess && (
                  <div className="p-3 bg-green-50 border border-green-100 text-green-600 text-sm rounded-xl font-medium flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Sucesso! {importSuccess} alunos foram importados.
                  </div>
                )}
                
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Exemplo: 1 2435076 Cláudia Barbosa Andrade (51508) Boqueirão - PB 30/01/1999..."
                  className="w-full h-64 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4CAF50] outline-none font-mono text-sm resize-none"
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={isImporting || !importText.trim()}
                    className="flex-[2] px-4 py-2 bg-[#4CAF50] text-white rounded-xl hover:bg-[#43a047] disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    {isImporting ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Plus size={20} />
                    )}
                    {isImporting ? 'Importando...' : 'Processar e Importar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
