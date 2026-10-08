import { 
  getPlannerItemUrgency, 
  sortPlannerItems, 
  getDaysDifference, 
  getTodayDateString, 
  formatDisplayDate, 
  formatDisplayDateTime,
  PLANNER_THRESHOLDS 
} from '../utils/planner.js';

console.log('--- INICIANDO TESTES DO SISTEMA DE PLANEJAMENTO ---');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FALHA: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ OK: ${message}`);
    passedTests++;
  }
}

// 1. TESTES DE DATAS E TIMEZONE
console.log('\n[1] Testes de Datas e Timezone:');
const today = '2027-01-10';

// Diferença em dias
assert(getDaysDifference('2027-01-10', today) === 0, 'Hoje deve ter 0 dias de diferença');
assert(getDaysDifference('2027-01-11', today) === 1, 'Amanhã deve ter 1 dia de diferença');
assert(getDaysDifference('2027-01-09', today) === -1, 'Ontem deve ter -1 dia de diferença');

// Virada de mês
assert(getDaysDifference('2027-02-01', '2027-01-31') === 1, 'Virada de mês (Jan -> Fev)');
assert(getDaysDifference('2027-03-01', '2027-02-28') === 1, 'Virada de mês (Fev -> Mar em ano comum)');

// Virada de ano
assert(getDaysDifference('2028-01-01', '2027-12-31') === 1, 'Virada de ano (31/12 -> 01/01)');

// Formatação
assert(formatDisplayDate('2027-06-30') === '30/06/2027', 'Formatação DD/MM/AAAA');
assert(formatDisplayDateTime('2027-06-30', '19:30') === '30/06/2027 às 19:30', 'Formatação com horário');

// 2. TESTES DE TAREFAS SEM PRAZO
console.log('\n[2] Testes de Tarefas sem Prazo:');
const taskNoDeadlineLow = {
  id: '1',
  userId: 'user1',
  type: 'task',
  title: 'Organizar arquivos antigos',
  hasDeadline: false,
  priority: 'low',
  status: 'pending',
  createdAt: '2027-01-01T00:00:00Z',
  updatedAt: '2027-01-01T00:00:00Z',
};

const urgencyLow = getPlannerItemUrgency(taskNoDeadlineLow, today);
assert(urgencyLow.situation === 'low_priority', 'Tarefa sem prazo baixa prioridade deve ser low_priority');
assert(urgencyLow.borderColor === '#10B981', 'Cor verde para baixa prioridade');

const taskNoDeadlineHigh = {
  ...taskNoDeadlineLow,
  priority: 'high',
};
const urgencyHigh = getPlannerItemUrgency(taskNoDeadlineHigh, today);
assert(urgencyHigh.situation === 'high_priority', 'Tarefa sem prazo alta prioridade deve ser high_priority');
assert(urgencyHigh.borderColor === '#DC2626', 'Cor vermelha para alta prioridade');

// 3. TESTES DE TAREFAS COM PRAZO
console.log('\n[3] Testes de Tarefas com Prazo:');

// 3.1. Tarefa Atrasada
const taskOverdue = {
  id: '3',
  userId: 'user1',
  type: 'task',
  title: 'Entregar relatório vencido',
  hasDeadline: true,
  dueDate: '2027-01-08', // 2 dias atrás
  priority: 'medium',
  status: 'pending',
  createdAt: '2027-01-01T00:00:00Z',
  updatedAt: '2027-01-01T00:00:00Z',
};
const urgencyOverdue = getPlannerItemUrgency(taskOverdue, today);
assert(urgencyOverdue.situation === 'overdue', 'Prazo no passado deve ser "overdue"');
assert(urgencyOverdue.daysRemaining === -2, 'Deve indicar 2 dias de atraso');

// 3.2. Tarefa Urgente (dentro do limiar <= 3 dias)
const taskUrgent = {
  id: '4',
  userId: 'user1',
  type: 'task',
  title: 'Enviar formulário',
  hasDeadline: true,
  dueDate: '2027-01-12', // 2 dias à frente
  priority: 'low', // Mesmo sendo baixa prioridade, o prazo a torna urgente!
  status: 'pending',
  createdAt: '2027-01-01T00:00:00Z',
  updatedAt: '2027-01-01T00:00:00Z',
};
const urgencyUrgent = getPlannerItemUrgency(taskUrgent, today);
assert(urgencyUrgent.situation === 'urgent', 'Prazo em 2 dias deve ser "urgent", mesmo com prioridade baixa');

// 3.3. Tarefa com data de início de atenção
const taskAttention = {
  id: '5',
  userId: 'user1',
  type: 'task',
  title: 'Preparar projeto importante',
  hasDeadline: true,
  dueDate: '2027-01-25', // 15 dias à frente
  attentionDate: '2027-01-10', // Atenção começa HOJE
  priority: 'high',
  status: 'pending',
  createdAt: '2027-01-01T00:00:00Z',
  updatedAt: '2027-01-01T00:00:00Z',
};
const urgencyAttention = getPlannerItemUrgency(taskAttention, today);
assert(urgencyAttention.situation === 'attention', 'Quando today >= attentionDate, deve entrar em "attention"');

// 3.4. Tarefa Futura (fora da janela de atenção e com prazo distante)
const taskFuture = {
  id: '6',
  userId: 'user1',
  type: 'task',
  title: 'Preparar discurso de junho',
  hasDeadline: true,
  dueDate: '2027-06-30', // meses à frente
  attentionDate: '2027-06-01',
  priority: 'high', // Muito importante, mas não urgente!
  status: 'pending',
  createdAt: '2027-01-01T00:00:00Z',
  updatedAt: '2027-01-01T00:00:00Z',
};
const urgencyFuture = getPlannerItemUrgency(taskFuture, today);
assert(urgencyFuture.situation === 'future', 'Importante com prazo distante deve ser "future", não urgente');

// 4. TESTE DE CONCLUSÃO ANTECIPADA E REABERTURA
console.log('\n[4] Conclusão Antecipada e Reabertura:');
const taskCompletedEarly = {
  ...taskUrgent,
  status: 'completed',
  completedAt: '2027-01-10T14:30:00.000Z', // Concluída 2 dias antes do prazo (12/01)
};
const urgencyCompleted = getPlannerItemUrgency(taskCompletedEarly, today);
assert(urgencyCompleted.situation === 'completed', 'Tarefa concluída deve ter situação "completed"');
assert(urgencyCompleted.daysCompletedEarly === 2, 'Deve identificar que foi concluída 2 dias antes do prazo');
assert(!urgencyCompleted.label.includes('Urgente'), 'Tarefa concluída nunca deve aparecer como urgente');

// Reabrir tarefa: status volta a pending e completedAt = null
const taskReopened = {
  ...taskCompletedEarly,
  status: 'pending',
  completedAt: null,
};
const urgencyReopened = getPlannerItemUrgency(taskReopened, today);
assert(urgencyReopened.situation === 'urgent', 'Ao reabrir, volta a ser avaliada por prazo e urgência');

// 5. TESTE DE EVENTOS
console.log('\n[5] Eventos:');
const eventToday = {
  id: '7',
  userId: 'user1',
  type: 'event',
  title: 'Reunião com os Anciãos',
  date: '2027-01-10',
  time: '19:30',
  location: 'Salão do Reino',
  priority: 'medium',
  status: 'pending',
  createdAt: '2027-01-01T00:00:00Z',
  updatedAt: '2027-01-01T00:00:00Z',
};
const urgencyEventToday = getPlannerItemUrgency(eventToday, today);
assert(urgencyEventToday.situation === 'event_today', 'Evento no dia atual deve ser event_today');

const eventUpcoming = {
  ...eventToday,
  date: '2027-01-15',
};
const urgencyEventUpcoming = getPlannerItemUrgency(eventUpcoming, today);
assert(urgencyEventUpcoming.situation === 'event_upcoming', 'Evento futuro deve ser event_upcoming');

// 6. TESTE DE ORDENAÇÃO
console.log('\n[6] Ordenação Inteligente da Lista Unificada:');
const mixedItems = [
  taskFuture,         // Futura (sortWeight ~70+)
  taskOverdue,        // Atrasada (sortWeight <=10)
  taskNoDeadlineLow,  // Baixa prioridade sem prazo (~90)
  taskUrgent,         // Urgente (~22)
  taskCompletedEarly, // Concluída (200)
  eventToday,         // Evento Hoje (25)
  taskNoDeadlineHigh, // Alta prioridade sem prazo (40)
];

const sorted = sortPlannerItems(mixedItems, today);
assert(sorted[0].id === taskOverdue.id, '1º lugar: Tarefa atrasada deve vir primeiro');
assert(sorted[1].id === taskUrgent.id, '2º lugar: Tarefa urgente deve vir em segundo');
assert(sorted[2].id === eventToday.id, '3º lugar: Evento de hoje');
assert(sorted[3].id === taskNoDeadlineHigh.id, '4º lugar: Alta prioridade sem prazo');
assert(sorted[sorted.length - 1].id === taskCompletedEarly.id, 'Último lugar: Concluída deve ir para o final');

console.log(`\n🎉 TODOS OS ${passedTests}/${totalTests} TESTES PASSARAM COM SUCESSO!`);

