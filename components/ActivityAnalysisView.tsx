'use client';

import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  Save, 
  Plus, 
  Minus, 
  Loader2,
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  BarChart3,
  Calculator,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface ActivityAnalysisViewProps {
  userId: string;
  congregationName: string;
  visitDate: string;
  onBack: () => void;
}

interface MinistryActivity {
  relatando: string;
  estudos: string;
}

interface AnalysisData {
  congregacao: string;
  dataVisita: string;
  pubAtivos: string;
  ministério: {
    publicadores: MinistryActivity;
    pioneirosAuxiliares: MinistryActivity;
    pioneirosRegulares: MinistryActivity;
    pioneirosEspeciais: MinistryActivity;
  };
  estatisticas: {
    mediaEstudos: number;
    dirigemEstudos: number;
    irregulares: number;
    novosPublicadores: number;
    reativados: number;
    readmitidos: number;
    inativos: number;
    removidos: number;
    batizados: number;
    anciaos: number;
    servos: number;
  };
  donativos: {
    congregacao: string[];
    obraMundial: string[];
  };
  reunioes: {
    meioSemana: string[];
    fimSemana: string[];
  };
}

const defaultData: AnalysisData = {
  congregacao: '',
  dataVisita: '',
  pubAtivos: '',
  ministério: {
    publicadores: { relatando: '', estudos: '' },
    pioneirosAuxiliares: { relatando: '', estudos: '' },
    pioneirosRegulares: { relatando: '', estudos: '' },
    pioneirosEspeciais: { relatando: '', estudos: '' },
  },
  estatisticas: {
    mediaEstudos: 0,
    dirigemEstudos: 0,
    irregulares: 0,
    novosPublicadores: 0,
    reativados: 0,
    readmitidos: 0,
    inativos: 0,
    removidos: 0,
    batizados: 0,
    anciaos: 0,
    servos: 0,
  },
  donativos: {
    congregacao: ['', '', '', ''],
    obraMundial: ['', '', '', ''],
  },
  reunioes: {
    meioSemana: ['', '', '', '', ''],
    fimSemana: ['', '', '', '', ''],
  },
};

export default function ActivityAnalysisView({ userId, congregationName, visitDate, onBack }: ActivityAnalysisViewProps) {
  const [data, setData] = useState<AnalysisData>({
    ...defaultData,
    congregacao: congregationName,
    dataVisita: visitDate
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calcModal, setCalcModal] = useState<{
    type: keyof AnalysisData['ministério'];
    field: keyof MinistryActivity;
    label: string;
  } | null>(null);
  const [calcValues, setCalcValues] = useState<string[]>(['', '', '', '', '', '']);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docId = `${userId}_${congregationName}_${visitDate.replace(/\//g, '-')}`;
        const docRef = doc(db, 'activity_analysis', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setData(docSnap.data() as AnalysisData);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'activity_analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, congregationName, visitDate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const docId = `${userId}_${congregationName}_${visitDate.replace(/\//g, '-')}`;
      await setDoc(doc(db, 'activity_analysis', docId), {
        ...data,
        userId,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'activity_analysis');
    } finally {
      setSaving(false);
    }
  };

  const updateEstatistica = (field: keyof AnalysisData['estatisticas'], delta: number) => {
    setData(prev => ({
      ...prev,
      estatisticas: {
        ...prev.estatisticas,
        [field]: Math.max(0, prev.estatisticas[field] + delta)
      }
    }));
  };

  const updateMinistry = (type: keyof AnalysisData['ministério'], field: keyof MinistryActivity, value: string) => {
    setData(prev => ({
      ...prev,
      ministério: {
        ...prev.ministério,
        [type]: {
          ...prev.ministério[type],
          [field]: value
        }
      }
    }));
  };

  const updateTable = (section: 'donativos' | 'reunioes', field: string, index: number, value: string) => {
    setData(prev => {
      const sectionData = { ...prev[section] };
      if (field in sectionData) {
        const list = [...(sectionData as any)[field]];
        list[index] = value;
        return {
          ...prev,
          [section]: {
            ...sectionData,
            [field]: list
          }
        };
      }
      return prev;
    });
  };

  const calculateTotalDonativos = (list: string[]) => {
    return list.reduce((acc, curr) => acc + (parseFloat(curr.replace(',', '.')) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  };

  const calculateAverageAttendance = () => {
    const all = [...data.reunioes.meioSemana, ...data.reunioes.fimSemana].filter(v => v !== '');
    if (all.length === 0) return 0;
    const sum = all.reduce((acc, curr) => acc + (parseInt(curr) || 0), 0);
    return Math.round(sum / all.length);
  };

  const averageAttendance = calculateAverageAttendance();
  const pubAtivosNum = parseInt(data.pubAtivos) || 0;
  const difference = averageAttendance - pubAtivosNum;
  const percentage = pubAtivosNum > 0 ? Math.round((averageAttendance / pubAtivosNum) * 100) : 0;

  const openCalculator = (type: keyof AnalysisData['ministério'], field: keyof MinistryActivity, label: string) => {
    setCalcModal({ type, field, label });
    setCalcValues(['', '', '', '', '', '']);
  };

  const applyAverage = () => {
    if (!calcModal) return;
    const validValues = calcValues.map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (validValues.length > 0) {
      const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
      updateMinistry(calcModal.type, calcModal.field, Math.round(avg).toString());
    }
    setCalcModal(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-[#512da8]" size={48} />
        <p className="text-gray-500 font-medium">Carregando análise...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8]"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">Análise das atividades</h2>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-[#512da8] text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-[#4527a0] transition-all disabled:opacity-50 shadow-lg shadow-indigo-100"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          Salvar Análise
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top Info */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Congregação</label>
              <div className="p-3 bg-gray-50 rounded-xl font-bold text-gray-800 border border-gray-200">
                {data.congregacao}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Pub. Ativos</label>
              <input 
                type="number"
                value={data.pubAtivos}
                onChange={(e) => setData({...data, pubAtivos: e.target.value})}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#512da8] outline-none transition-all font-bold text-center"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Data da visita</label>
              <div className="p-3 bg-gray-50 rounded-xl font-bold text-gray-800 border border-gray-200 text-center">
                {data.dataVisita}
              </div>
            </div>
          </div>

          {/* Ministry Activities */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-[#4a7c74] p-3 text-white flex items-center gap-2">
              <Users size={18} />
              <h3 className="font-bold text-sm uppercase tracking-wider">Atividades Gerais do Ministério (média mensal)</h3>
            </div>
            <div className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-3 text-left font-bold text-gray-600">CATEGORIA</th>
                    <th className="p-3 text-center font-bold text-gray-600 w-32">Nº RELATANDO</th>
                    <th className="p-3 text-center font-bold text-gray-600 w-32">Nº DE ESTUDOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { id: 'publicadores', label: 'PUBLICADORES' },
                    { id: 'pioneirosAuxiliares', label: 'PIONEIROS AUXILIARES' },
                    { id: 'pioneirosRegulares', label: 'PIONEIROS REGULARES' },
                    { id: 'pioneirosEspeciais', label: 'PIONEIROS ESPECIAIS' }
                  ].map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 font-medium text-gray-700">{item.label}</td>
                      <td className="p-2">
                        <div className="relative flex items-center">
                          <input 
                            type="number"
                            value={data.ministério[item.id as keyof AnalysisData['ministério']].relatando}
                            onChange={(e) => updateMinistry(item.id as keyof AnalysisData['ministério'], 'relatando', e.target.value)}
                            className="w-full p-2 bg-transparent text-center font-bold outline-none focus:bg-white focus:ring-1 focus:ring-[#512da8] rounded-lg pr-8"
                          />
                          <button 
                            onClick={() => openCalculator(item.id as keyof AnalysisData['ministério'], 'relatando', `${item.label} - Relatando`)}
                            className="absolute right-1 p-1 text-gray-400 hover:text-[#512da8] transition-colors"
                            title="Calcular média"
                          >
                            <Calculator size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="relative flex items-center">
                          <input 
                            type="number"
                            value={data.ministério[item.id as keyof AnalysisData['ministério']].estudos}
                            onChange={(e) => updateMinistry(item.id as keyof AnalysisData['ministério'], 'estudos', e.target.value)}
                            className="w-full p-2 bg-transparent text-center font-bold outline-none focus:bg-white focus:ring-1 focus:ring-[#512da8] rounded-lg pr-8"
                          />
                          <button 
                            onClick={() => openCalculator(item.id as keyof AnalysisData['ministério'], 'estudos', `${item.label} - Estudos`)}
                            className="absolute right-1 p-1 text-gray-400 hover:text-[#512da8] transition-colors"
                            title="Calcular média"
                          >
                            <Calculator size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Congregation Stats */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-[#4a7c74] p-3 text-white flex items-center gap-2">
              <BarChart3 size={18} />
              <h3 className="font-bold text-sm uppercase tracking-wider">Estatísticas da Congregação</h3>
            </div>
            <div className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-3 text-left font-bold text-gray-600">DESCRIÇÃO</th>
                    <th className="p-3 text-center font-bold text-gray-600 w-40">QUANTIDADE</th>
                    <th className="p-3 text-center font-bold text-gray-600 w-32">PORCENTAGEM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { id: 'mediaEstudos', label: 'Média mensal de Estudos Bíblicos' },
                    { id: 'dirigemEstudos', label: 'Quantos DIRIGEM Estudos Bíblicos' },
                    { id: 'irregulares', label: 'Número de PUBLICADORES IRREGULARES desde a última visita' },
                    { id: 'novosPublicadores', label: 'Número de NOVOS PUBLICADORES desde a última visita' },
                    { id: 'reativados', label: 'Quantos foram REATIVADOS desde a última visita' },
                    { id: 'readmitidos', label: 'Quantos foram READMITIDOS desde a última visita' },
                    { id: 'inativos', label: 'Quantos ficaram INATIVOS desde a última visita' },
                    { id: 'removidos', label: 'Quantos ficaram REMOVIDOS desde a última visita' },
                    { id: 'batizados', label: 'Quantos foram BATIZADOS desde a última visita' },
                    { id: 'anciaos', label: 'Número de ANCIÃOS' },
                    { id: 'servos', label: 'Números de SERVOS MINISTERIAIS' }
                  ].map((item) => {
                    const val = data.estatisticas[item.id as keyof AnalysisData['estatisticas']];
                    const perc = pubAtivosNum > 0 ? Math.round((val / pubAtivosNum) * 100) : 0;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 font-medium text-gray-700">{item.label}</td>
                        <td className="p-2">
                          <div className="flex items-center justify-center gap-3">
                            <button 
                              onClick={() => updateEstatistica(item.id as keyof AnalysisData['estatisticas'], -1)}
                              className="p-1 rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors"
                            >
                              <Minus size={16} />
                            </button>
                            <span className="font-bold text-lg min-w-[30px] text-center">{val}</span>
                            <button 
                              onClick={() => updateEstatistica(item.id as keyof AnalysisData['estatisticas'], 1)}
                              className="p-1 rounded-full bg-teal-100 text-teal-600 hover:bg-teal-200 transition-colors"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-center font-bold text-gray-400">
                          {perc}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Donations */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-[#4a7c74] p-3 text-white flex items-center gap-2">
              <DollarSign size={18} />
              <h3 className="font-bold text-sm uppercase tracking-wider">Donativos</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase text-center block">Congregação</label>
                  {data.donativos.congregacao.map((v, i) => (
                    <input 
                      key={i}
                      value={v}
                      onChange={(e) => updateTable('donativos', 'congregacao', i, e.target.value)}
                      className="w-full p-2 bg-gray-50 rounded-lg border border-gray-100 text-center text-sm outline-none focus:border-[#512da8]"
                      placeholder="0,00"
                    />
                  ))}
                  <div className="pt-2 border-t border-gray-100 flex justify-between items-center px-1">
                    <span className="text-[10px] font-bold text-gray-400">TOTAL</span>
                    <span className="font-bold text-sm text-gray-700">R$ {calculateTotalDonativos(data.donativos.congregacao)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase text-center block">Obra Mundial</label>
                  {data.donativos.obraMundial.map((v, i) => (
                    <input 
                      key={i}
                      value={v}
                      onChange={(e) => updateTable('donativos', 'obraMundial', i, e.target.value)}
                      className="w-full p-2 bg-gray-50 rounded-lg border border-gray-100 text-center text-sm outline-none focus:border-[#512da8]"
                      placeholder="0,00"
                    />
                  ))}
                  <div className="pt-2 border-t border-gray-100 flex justify-between items-center px-1">
                    <span className="text-[10px] font-bold text-gray-400">TOTAL</span>
                    <span className="font-bold text-sm text-gray-700">R$ {calculateTotalDonativos(data.donativos.obraMundial)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Meetings */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-[#4a7c74] p-3 text-white flex items-center gap-2">
              <Users size={18} />
              <h3 className="font-bold text-sm uppercase tracking-wider">Reuniões</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase text-center block">Meio de Semana</label>
                  {data.reunioes.meioSemana.map((v, i) => (
                    <input 
                      key={i}
                      type="number"
                      value={v}
                      onChange={(e) => updateTable('reunioes', 'meioSemana', i, e.target.value)}
                      className="w-full p-2 bg-gray-50 rounded-lg border border-gray-100 text-center text-sm outline-none focus:border-[#512da8]"
                    />
                  ))}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase text-center block">Fim de Semana</label>
                  {data.reunioes.fimSemana.map((v, i) => (
                    <input 
                      key={i}
                      type="number"
                      value={v}
                      onChange={(e) => updateTable('reunioes', 'fimSemana', i, e.target.value)}
                      className="w-full p-2 bg-gray-50 rounded-lg border border-gray-100 text-center text-sm outline-none focus:border-[#512da8]"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Diferença entre publicadores e assistência</label>
              <div className={`text-3xl font-black ${difference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {difference > 0 ? `+${difference}` : difference}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Porcentagem sobre nº de publicadores</label>
              <div className="text-3xl font-black text-[#512da8]">
                {percentage}%
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="bg-gray-100 p-4 rounded-2xl text-[11px] text-gray-500 leading-relaxed italic">
            Os dados registrados aqui somam as estatísticas do circuito que pode ser acessada na página inicial. Esses dados podem ser úteis para reunião Especial com os Pioneiros ou outras necessidades do circuito.
          </div>
        </div>
      </div>

      {/* Average Calculator Modal */}
      <AnimatePresence>
        {calcModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="bg-[#512da8] p-4 text-white flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                  <Calculator size={18} /> Calcular Média
                </h3>
                <button onClick={() => setCalcModal(null)} className="hover:bg-white/20 p-1 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="text-center">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Categoria</p>
                  <p className="font-bold text-gray-800">{calcModal.label}</p>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {calcValues.map((val, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 block text-center">Mês {idx + 1}</label>
                      <input 
                        type="number"
                        value={val}
                        onChange={(e) => {
                          const newVals = [...calcValues];
                          newVals[idx] = e.target.value;
                          setCalcValues(newVals);
                        }}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:border-[#512da8] outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setCalcModal(null)}
                    className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={applyAverage}
                    className="flex-1 py-3 rounded-xl font-bold bg-[#512da8] text-white hover:bg-[#4527a0] transition-all shadow-lg shadow-indigo-100"
                  >
                    Aplicar Média
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
