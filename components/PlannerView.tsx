'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  CheckSquare, 
  Clock, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Pencil, 
  Trash2, 
  Sparkles, 
  FileText, 
  Flag,
  CalendarCheck,
  Check,
  X,
  Layers,
  ArrowUpDown,
  Bell,
  LayoutGrid,
  List
} from 'lucide-react';
import { PlannerItem, PlannerItemType, PriorityLevel, TaskStatus } from '@/types/planner';
import { 
  subscribePlannerItems, 
  createPlannerItem, 
  updatePlannerItem, 
  toggleCompleteTask, 
  deletePlannerItem 
} from '@/services/plannerService';
import { 
  getPlannerItemUrgency, 
  sortPlannerItems, 
  formatDisplayDate, 
  formatDisplayDateTime,
  getTodayDateString 
} from '@/utils/planner';
import { useDialog } from '@/hooks/useDialog';
import { cn } from '@/lib/utils';
import PlannerItemModal from './PlannerItemModal';
import CustomSelect from '@/components/CustomSelect';

interface PlannerViewProps {
  userId?: string;
  onBack: () => void;
}

type FilterView = 'all' | 'pending_urgent' | 'tasks' | 'events' | 'completed';

export default function PlannerView({ userId, onBack }: PlannerViewProps) {
  const { showAlert, showConfirm } = useDialog();
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterView>('pending_urgent');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<PlannerItem | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('planner_layout_mode');
      if (saved === 'grid' || saved === 'list') {
        setLayoutMode(saved);
      }
    }
  }, []);

  const handleSetLayoutMode = (mode: 'grid' | 'list') => {
    setLayoutMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('planner_layout_mode', mode);
    }
  };

  // Inscrição em tempo real aos itens do usuário no Firestore
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribePlannerItems(
      userId,
      (fetchedItems) => {
        setItems(fetchedItems);
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao escutar itens do planner:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Contadores analíticos para o topo da página
  const metrics = useMemo(() => {
    const today = getTodayDateString();
    let overdueCount = 0;
    let urgentCount = 0;
    let attentionCount = 0;
    let upcomingEventsCount = 0;
    let completedCount = 0;

    for (const item of items) {
      const urgency = getPlannerItemUrgency(item, today);

      if (item.type === 'task') {
        if (item.status === 'completed') {
          completedCount++;
        } else if (urgency.situation === 'overdue') {
          overdueCount++;
        } else if (urgency.situation === 'urgent') {
          urgentCount++;
        } else if (urgency.situation === 'attention' || urgency.situation === 'approaching') {
          attentionCount++;
        }
      } else if (item.type === 'event') {
        if (urgency.situation === 'event_today' || urgency.situation === 'event_upcoming') {
          upcomingEventsCount++;
        }
      }
    }

    return {
      overdueCount,
      urgentCount,
      attentionCount,
      upcomingEventsCount,
      completedCount,
    };
  }, [items]);

  // Filtragem e ordenação dos itens
  const filteredAndSortedItems = useMemo(() => {
    const today = getTodayDateString();
    const searchLower = searchTerm.toLowerCase().trim();

    const filtered = items.filter((item) => {
      // 1. Busca textual
      if (searchLower) {
        const matchTitle = (item.title || '').toLowerCase().includes(searchLower);
        const matchDesc = (item.description || '').toLowerCase().includes(searchLower);
        const matchLoc = (item.location || '').toLowerCase().includes(searchLower);
        const matchNotes = (item.notes || '').toLowerCase().includes(searchLower);
        if (!matchTitle && !matchDesc && !matchLoc && !matchNotes) return false;
      }

      // 2. Filtro de Prioridade
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
        return false;
      }

      // 3. Filtro de Visão
      const urgency = getPlannerItemUrgency(item, today);

      if (activeFilter === 'completed') {
        return item.type === 'task' && item.status === 'completed';
      }

      if (activeFilter === 'pending_urgent') {
        if (item.type === 'task' && item.status === 'completed') return false;
        // Mostra pendências ativas, atrasadas, urgentes, eventos de hoje/próximos e tarefas em atenção
        return true;
      }

      if (activeFilter === 'tasks') {
        return item.type === 'task';
      }

      if (activeFilter === 'events') {
        return item.type === 'event';
      }

      // 'all'
      return true;
    });

    return sortPlannerItems(filtered, today);
  }, [items, searchTerm, activeFilter, priorityFilter]);

  // Ações de criação e edição
  const handleSaveItem = async (data: Omit<PlannerItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!userId) {
      await showAlert('Sessão expirada. Faça login novamente.', 'Erro');
      return;
    }

    if (itemToEdit) {
      await updatePlannerItem(itemToEdit.id, data);
    } else {
      await createPlannerItem(userId, data);
    }
  };

  // Alternar conclusão de tarefa (Concluir ou Reabrir)
  const handleToggleComplete = async (item: PlannerItem) => {
    if (item.type !== 'task') return;
    setActionLoadingId(item.id);

    try {
      const isNowCompleted = await toggleCompleteTask(item);
      // Se concluiu uma tarefa com prazo antes do tempo, podemos exibir feedback breve
      if (isNowCompleted && item.hasDeadline && item.dueDate) {
        const today = getTodayDateString();
        const urgency = getPlannerItemUrgency({ ...item, status: 'completed', completedAt: new Date().toISOString() }, today);
        if (urgency.daysCompletedEarly && urgency.daysCompletedEarly > 0) {
          // Concluída antecipadamente
          console.info(`Tarefa concluída ${urgency.daysCompletedEarly} dias antes do prazo!`);
        }
      }
    } catch (err: any) {
      console.error('Erro ao alternar conclusão:', err);
      await showAlert('Não foi possível atualizar a tarefa. Verifique a conexão.', 'Erro');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Excluir item
  const handleDeleteItem = async (item: PlannerItem) => {
    const isTask = item.type === 'task';
    const confirmed = await showConfirm(
      `Tem certeza que deseja excluir ${isTask ? 'a tarefa' : 'o evento'} "${item.title}"? Esta ação não pode ser desfeita.`,
      `Excluir ${isTask ? 'Tarefa' : 'Evento'}`
    );

    if (!confirmed) return;

    setActionLoadingId(item.id);
    try {
      await deletePlannerItem(item.id);
    } catch (err: any) {
      console.error('Erro ao excluir item:', err);
      await showAlert('Erro ao excluir item do planejamento.', 'Erro');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Abrir modal para edição
  const handleEditClick = (item: PlannerItem) => {
    setItemToEdit(item);
    setIsModalOpen(true);
  };

  // Abrir modal para novo item
  const handleNewClick = () => {
    setItemToEdit(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho Principal */}
      <div className="bg-surface-100 border border-surface-300 rounded-3xl p-4 sm:p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-surface-100 border border-surface-300 flex items-center justify-center text-typography-600 hover:text-typography-900 hover:bg-surface-200 transition-all cursor-pointer shadow-xs shrink-0"
              title="Voltar"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="w-10 h-10 rounded-2xl bg-primary-200/10 border border-primary-200/20 text-primary-200 flex items-center justify-center shrink-0">
              <CalendarCheck size={20} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-typography-900 tracking-tight leading-tight">
                Organização de Eventos e Tarefas
              </h2>
              <p className="text-xs text-typography-500 font-medium">
                Central pessoal de planejamento para tarefas, compromissos e prazos do ano
              </p>
            </div>
          </div>

          <button
            onClick={handleNewClick}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-primary-200 hover:opacity-90 text-white font-bold rounded-2xl text-xs shadow-lg shadow-primary-200/20 transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <Plus size={16} />
            <span>Novo Item</span>
          </button>
        </div>

        {/* Barra de Busca e Botão Novo no Mobile */}
        <div className="flex items-center gap-2 pt-1 border-t border-surface-300/60">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-typography-400" size={16} />
            <input
              type="text"
              placeholder="Buscar tarefas, eventos, locais ou observações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-200 border border-surface-300 rounded-2xl text-xs sm:text-sm text-typography-900 placeholder:text-typography-400 focus:outline-none focus:border-primary-200 transition-all font-medium"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-typography-400 hover:text-typography-900 p-1 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={handleNewClick}
            className="flex sm:hidden items-center justify-center p-2.5 bg-primary-200 hover:opacity-90 text-white rounded-2xl shadow-lg shadow-primary-200/20 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Novo Item"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Cards de Métricas / Resumo Rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-4">
        {/* Atrasadas */}
        <button
          onClick={() => setActiveFilter('pending_urgent')}
          className={cn(
            "p-3.5 sm:p-4 rounded-3xl border transition-all text-left flex flex-col justify-between shadow-xs cursor-pointer",
            metrics.overdueCount > 0 
              ? "bg-rose-500/10 border-rose-500/30 hover:border-rose-500 text-rose-600 dark:text-rose-400"
              : "bg-surface-100 border-surface-300 hover:border-primary-200/50"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-typography-500">Atrasadas</span>
            <AlertTriangle size={15} className={metrics.overdueCount > 0 ? "text-rose-500 animate-pulse" : "text-typography-400"} />
          </div>
          <span className="text-xl sm:text-2xl font-black mt-2 text-typography-900">
            {metrics.overdueCount}
          </span>
        </button>

        {/* Urgentes */}
        <button
          onClick={() => setActiveFilter('pending_urgent')}
          className={cn(
            "p-3.5 sm:p-4 rounded-3xl border transition-all text-left flex flex-col justify-between shadow-xs cursor-pointer",
            metrics.urgentCount > 0 
              ? "bg-red-500/10 border-red-500/30 hover:border-red-500 text-red-600 dark:text-red-400"
              : "bg-surface-100 border-surface-300 hover:border-primary-200/50"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-typography-500">Urgentes</span>
            <Clock size={15} className={metrics.urgentCount > 0 ? "text-red-500" : "text-typography-400"} />
          </div>
          <span className="text-xl sm:text-2xl font-black mt-2 text-typography-900">
            {metrics.urgentCount}
          </span>
        </button>

        {/* Em Atenção */}
        <button
          onClick={() => setActiveFilter('pending_urgent')}
          className={cn(
            "p-3.5 sm:p-4 rounded-3xl border transition-all text-left flex flex-col justify-between shadow-xs cursor-pointer",
            metrics.attentionCount > 0 
              ? "bg-amber-500/10 border-amber-500/30 hover:border-amber-500 text-amber-600 dark:text-amber-400"
              : "bg-surface-100 border-surface-300 hover:border-primary-200/50"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-typography-500">Em Atenção</span>
            <Bell size={15} className={metrics.attentionCount > 0 ? "text-amber-500" : "text-typography-400"} />
          </div>
          <span className="text-xl sm:text-2xl font-black mt-2 text-typography-900">
            {metrics.attentionCount}
          </span>
        </button>

        {/* Próximos Eventos */}
        <button
          onClick={() => setActiveFilter('events')}
          className="p-3.5 sm:p-4 rounded-3xl bg-surface-100 border border-surface-300 hover:border-primary-200/50 transition-all text-left flex flex-col justify-between shadow-xs cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-typography-500">Eventos</span>
            <Calendar size={15} className="text-blue-500" />
          </div>
          <span className="text-xl sm:text-2xl font-black mt-2 text-typography-900">
            {metrics.upcomingEventsCount}
          </span>
        </button>

        {/* Concluídas (Histórico) */}
        <button
          onClick={() => setActiveFilter('completed')}
          className={cn(
            "col-span-2 sm:col-span-1 p-3.5 sm:p-4 rounded-3xl border transition-all text-left flex flex-col justify-between shadow-xs cursor-pointer",
            activeFilter === 'completed'
              ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300"
              : "bg-surface-100 border-surface-300 hover:border-primary-200/50"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-typography-500">Concluídas</span>
            <CheckCircle2 size={15} className="text-emerald-500" />
          </div>
          <span className="text-xl sm:text-2xl font-black mt-2 text-typography-900">
            {metrics.completedCount}
          </span>
        </button>
      </div>

      {/* Abas e Filtros de Visualização */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-100 p-2 sm:p-2.5 rounded-2xl border border-surface-300 shadow-xs">
        {/* Pílulas de filtro de visualização */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
          {[
            { id: 'pending_urgent', label: 'Pendências & Foco' },
            { id: 'all', label: 'Todos os Itens' },
            { id: 'tasks', label: 'Tarefas' },
            { id: 'events', label: 'Eventos' },
            { id: 'completed', label: 'Histórico Concluídas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as FilterView)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0",
                activeFilter === tab.id
                  ? "bg-primary-200 text-white shadow-xs"
                  : "text-typography-600 hover:text-typography-900 hover:bg-surface-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filtro secundário por prioridade e Alternador de Layout */}
        <div className="flex items-center gap-2.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-surface-300/60 justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-typography-400">Prioridade:</span>
            <CustomSelect
              value={priorityFilter}
              onChange={setPriorityFilter}
              size="sm"
              align="right"
              className="w-32 sm:w-36"
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'high', label: 'Alta (🔴)' },
                { value: 'medium', label: 'Média (🟡)' },
                { value: 'low', label: 'Baixa (🟢)' },
              ]}
            />
          </div>

          {/* Alternador de Layout: Grade (agrupada) vs Lista */}
          <div className="flex items-center bg-surface-200 border border-surface-300 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => handleSetLayoutMode('grid')}
              className={cn(
                "p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                layoutMode === 'grid'
                  ? "bg-surface-100 text-typography-900 shadow-xs"
                  : "text-typography-400 hover:text-typography-800"
              )}
              title="Visualização em Grade (Cards agrupados e compactos)"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleSetLayoutMode('list')}
              className={cn(
                "p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                layoutMode === 'list'
                  ? "bg-surface-100 text-typography-900 shadow-xs"
                  : "text-typography-400 hover:text-typography-800"
              )}
              title="Visualização em Linhas (Lista contínua)"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Itens */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary-200/20 border-t-primary-200 rounded-full animate-spin" />
          <p className="text-xs font-bold text-typography-500 uppercase tracking-widest">Carregando planejamento...</p>
        </div>
      ) : filteredAndSortedItems.length > 0 ? (
        <div className={cn(
          layoutMode === 'grid'
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5 sm:gap-4"
            : "space-y-3"
        )}>
          {filteredAndSortedItems.map((item, index) => {
            const urgency = getPlannerItemUrgency(item);
            const isCompleted = item.type === 'task' && item.status === 'completed';
            const isActionLoading = actionLoadingId === item.id;

            if (layoutMode === 'grid') {
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.25) }}
                  className={cn(
                    "group relative p-3.5 sm:p-4 rounded-2xl bg-surface-100 border shadow-xs overflow-hidden transition-all duration-300 flex flex-col justify-between gap-3 min-h-[175px]",
                    isCompleted 
                      ? "border-surface-300/70 bg-surface-100/60 opacity-80" 
                      : "border-surface-300 hover:border-primary-200/60 hover:shadow-md hover:-translate-y-0.5"
                  )}
                >
                  {/* Brilho decorativo no canto */}
                  <div 
                    className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-25 transition-opacity pointer-events-none"
                    style={{ backgroundColor: urgency.glowColor }}
                  />

                  {/* Barra superior em gradiente correspondente à situação */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundImage: `linear-gradient(to right, ${urgency.borderColor}, transparent)` }}
                  />

                  {/* Topo do Card: Checkbox/Ícone + Badges + Ações Rápidas */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      {item.type === 'task' ? (
                        <button
                          type="button"
                          onClick={() => !isActionLoading && handleToggleComplete(item)}
                          disabled={isActionLoading}
                          className={cn(
                            "w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer shrink-0",
                            isCompleted
                              ? "bg-emerald-500 border-emerald-500 text-white shadow-xs"
                              : "border-surface-300 bg-surface-200/60 hover:border-emerald-500 hover:bg-emerald-500/10 text-transparent hover:text-emerald-600"
                          )}
                          title={isCompleted ? "Reabrir tarefa" : "Marcar como concluída"}
                        >
                          <Check size={14} strokeWidth={3} className={cn(!isCompleted && "opacity-0 hover:opacity-100")} />
                        </button>
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Calendar size={13} />
                        </div>
                      )}

                      {/* Badge da Situação de Urgência */}
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border truncate max-w-[170px]",
                        urgency.badgeClass
                      )}>
                        {urgency.badgeText}
                      </span>

                      {/* Badge de Prioridade para Tarefas */}
                      {item.type === 'task' && !isCompleted && (
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border",
                          item.priority === 'high' && "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
                          item.priority === 'medium' && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                          item.priority === 'low' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        )}>
                          {item.priority === 'high' ? 'Alta' : item.priority === 'medium' ? 'Média' : 'Baixa'}
                        </span>
                      )}

                      {/* Status Em Andamento */}
                      {item.type === 'task' && item.status === 'in_progress' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          Andamento
                        </span>
                      )}
                    </div>

                    {/* Ações Rápidas: Editar e Excluir */}
                    <div className="flex items-center gap-0.5 shrink-0 -mr-1">
                      <button
                        type="button"
                        onClick={() => handleEditClick(item)}
                        className="p-1.5 text-typography-400 hover:text-primary-200 hover:bg-surface-200 rounded-lg transition-all cursor-pointer"
                        title="Editar item"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="p-1.5 text-typography-400 hover:text-red-500 hover:bg-surface-200 rounded-lg transition-all cursor-pointer"
                        title="Excluir item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Conteúdo Central: Título e Descrição */}
                  <div className="space-y-1 my-auto">
                    <h3 className={cn(
                      "text-sm sm:text-base font-bold text-typography-900 transition-colors leading-snug line-clamp-2",
                      isCompleted ? "line-through text-typography-500 font-medium" : "group-hover:text-primary-200"
                    )}>
                      {item.title}
                    </h3>

                    {item.description && (
                      <p className="text-xs text-typography-600 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Rodapé: Metadados e Botão Reabrir */}
                  <div className="pt-2 border-t border-surface-300/60 flex items-center justify-between gap-2 text-[11px] text-typography-500 font-medium">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      {/* Para Evento: Data, Horário, Local */}
                      {item.type === 'event' && (
                        <>
                          {item.date && (
                            <span className="flex items-center gap-1 text-typography-700">
                              <Calendar size={12} className="text-blue-500 shrink-0" />
                              {formatDisplayDateTime(item.date, item.time)}
                            </span>
                          )}
                          {item.location && (
                            <span className="flex items-center gap-1 truncate max-w-[140px]">
                              <MapPin size={12} className="text-typography-400 shrink-0" />
                              {item.location}
                            </span>
                          )}
                        </>
                      )}

                      {/* Para Tarefa com Prazo: Prazo final */}
                      {item.type === 'task' && item.hasDeadline && item.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-typography-400 shrink-0" />
                          Prazo: <span className="font-bold text-typography-700">{formatDisplayDate(item.dueDate)}</span>
                        </span>
                      )}

                      {/* Data de início de atenção */}
                      {item.type === 'task' && item.hasDeadline && item.attentionDate && !isCompleted && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Bell size={12} className="shrink-0" />
                          Atenção: {formatDisplayDate(item.attentionDate)}
                        </span>
                      )}

                      {/* Informações de Histórico de Conclusão */}
                      {isCompleted && item.completedAt && (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 size={12} className="shrink-0" />
                          {formatDisplayDate(item.completedAt.substring(0, 10))}
                        </span>
                      )}
                    </div>

                    {/* Botão de Reabrir para tarefas concluídas */}
                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(item)}
                        disabled={isActionLoading}
                        className="px-2.5 py-1 bg-surface-200 hover:bg-surface-300 text-typography-700 text-xs font-bold rounded-xl border border-surface-300 flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-xs shrink-0"
                        title="Reabrir tarefa e voltar para pendências"
                      >
                        <RotateCcw size={12} />
                        <span>Reabrir</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            }

            // Modo Lista (Linhas)
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
                className={cn(
                  "group relative p-3.5 sm:p-4 rounded-2xl bg-surface-100 border shadow-xs overflow-hidden transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                  isCompleted 
                    ? "border-surface-300/70 bg-surface-100/60 opacity-80" 
                    : "border-surface-300 hover:border-primary-200/60 hover:shadow-md"
                )}
              >
                {/* Brilho decorativo no canto */}
                <div 
                  className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-25 transition-opacity pointer-events-none"
                  style={{ backgroundColor: urgency.glowColor }}
                />

                {/* Barra superior em gradiente correspondente à situação */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundImage: `linear-gradient(to right, ${urgency.borderColor}, transparent)` }}
                />

                {/* Lado Esquerdo: Checkbox/Ícone + Dados Principais */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Botão de Checkbox para Tarefas OU Ícone de Calendário para Eventos */}
                  {item.type === 'task' ? (
                    <button
                      type="button"
                      onClick={() => !isActionLoading && handleToggleComplete(item)}
                      disabled={isActionLoading}
                      className={cn(
                        "w-7 h-7 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 mt-0.5",
                        isCompleted
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-xs"
                          : "border-surface-300 bg-surface-200/60 hover:border-emerald-500 hover:bg-emerald-500/10 text-transparent hover:text-emerald-600"
                      )}
                      title={isCompleted ? "Reabrir tarefa" : "Marcar como concluída"}
                    >
                      <Check size={16} strokeWidth={3} className={cn(!isCompleted && "opacity-0 hover:opacity-100")} />
                    </button>
                  ) : (
                    <div className="w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar size={16} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Linha superior: Tags / Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                        item.type === 'task'
                          ? "bg-surface-200 text-typography-600 border-surface-300"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                      )}>
                        {item.type === 'task' ? 'Tarefa' : 'Evento'}
                      </span>

                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                        urgency.badgeClass
                      )}>
                        {urgency.badgeText}
                      </span>

                      {item.type === 'task' && !isCompleted && (
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border",
                          item.priority === 'high' && "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
                          item.priority === 'medium' && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                          item.priority === 'low' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        )}>
                          {item.priority === 'high' ? 'Alta' : item.priority === 'medium' ? 'Média' : 'Baixa'}
                        </span>
                      )}

                      {item.type === 'task' && item.status === 'in_progress' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          Em Andamento
                        </span>
                      )}
                    </div>

                    {/* Título */}
                    <h3 className={cn(
                      "text-sm sm:text-base font-bold text-typography-900 transition-colors leading-tight",
                      isCompleted ? "line-through text-typography-500 font-medium" : "group-hover:text-primary-200"
                    )}>
                      {item.title}
                    </h3>

                    {/* Descrição */}
                    {item.description && (
                      <p className="text-xs text-typography-600 line-clamp-1 leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    {/* Metadados adicionais */}
                    <div className="flex items-center gap-3 flex-wrap text-[11px] text-typography-500 font-medium pt-0.5">
                      {item.type === 'event' && (
                        <>
                          {item.date && (
                            <span className="flex items-center gap-1 text-typography-700">
                              <Calendar size={13} className="text-blue-500" />
                              {formatDisplayDateTime(item.date, item.time)}
                            </span>
                          )}
                          {item.location && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <MapPin size={13} className="text-typography-400 shrink-0" />
                              {item.location}
                            </span>
                          )}
                        </>
                      )}

                      {item.type === 'task' && item.hasDeadline && item.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock size={13} className="text-typography-400" />
                          Prazo: <span className="font-bold text-typography-700">{formatDisplayDate(item.dueDate)}</span>
                        </span>
                      )}

                      {item.type === 'task' && item.hasDeadline && item.attentionDate && !isCompleted && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Bell size={13} />
                          Atenção desde: {formatDisplayDate(item.attentionDate)}
                        </span>
                      )}

                      {isCompleted && item.completedAt && (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 size={13} />
                          Concluída em {formatDisplayDate(item.completedAt.substring(0, 10))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Ações */}
                <div className="flex items-center justify-end gap-1.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-surface-300/60">
                  {isCompleted && (
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(item)}
                      disabled={isActionLoading}
                      className="px-3 py-1.5 bg-surface-200 hover:bg-surface-300 text-typography-700 text-xs font-bold rounded-xl border border-surface-300 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="Reabrir tarefa e voltar para pendências"
                    >
                      <RotateCcw size={14} />
                      <span>Reabrir</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleEditClick(item)}
                    className="p-2 text-typography-400 hover:text-primary-200 hover:bg-surface-200 rounded-xl transition-all cursor-pointer"
                    title="Editar item"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item)}
                    className="p-2 text-typography-400 hover:text-red-500 hover:bg-surface-200 rounded-xl transition-all cursor-pointer"
                    title="Excluir item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Estado Vazio */
        <div className="bg-surface-100 border border-surface-300 rounded-3xl p-12 sm:p-16 text-center shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-200 border border-surface-300 flex items-center justify-center text-typography-400 mx-auto">
            <CalendarCheck size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-typography-900">
              {activeFilter === 'completed' 
                ? 'Nenhuma tarefa concluída no histórico' 
                : 'Nenhum item encontrado'}
            </h3>
            <p className="text-xs text-typography-500 max-w-sm mx-auto">
              {searchTerm 
                ? 'Tente ajustar sua busca ou limpar os filtros para encontrar itens.'
                : activeFilter === 'completed'
                ? 'As tarefas que você marcar como concluídas aparecerão aqui com data e antecedência.'
                : 'Crie tarefas com ou sem prazo e compromissos para acompanhar o seu ano.'}
            </p>
          </div>
          {activeFilter !== 'completed' && (
            <button
              onClick={handleNewClick}
              className="px-5 py-2.5 bg-primary-200 hover:opacity-90 text-white font-bold rounded-2xl text-xs shadow-lg shadow-primary-200/20 transition-all inline-flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus size={16} />
              <span>Criar Primeiro Item</span>
            </button>
          )}
        </div>
      )}

      {/* Modal de Criação / Edição */}
      <PlannerItemModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setItemToEdit(null);
        }}
        onSave={handleSaveItem}
        itemToEdit={itemToEdit}
      />
    </div>
  );
}

