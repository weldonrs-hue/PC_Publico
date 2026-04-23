'use client';

import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronDown,
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
  ArrowDown,
  Users,
  LayoutList,
  Printer,
  FileDown
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
  turma?: string;
  userId: string;
  createdAt: any;
}

interface WorkshopAssignment {
  id: string;
  scenarioId: number;
  participants: string;
  userId: string;
}

const WORKSHOP_DATA = [
  {
    id: 'workshop1',
    label: 'WORKSHOP 1',
    scenarios: [
      { 
        id: 1, 
        text: 'Um casal se prepara para a pregação.',
        instructions: 'Instruções para a parte\nComo parte de sua adoração em família, um casal conversa sobre seus planos para pregar. Eles analisam a formação religiosa e cultural das pessoas na região em que planejam pregar e consideram duas ou três “Verdades que amamos ensinar” do Apêndice A da brochura Ame as Pessoas — Faça Discípulos, que talvez chamem a atenção das pessoas que encontrarem. Eles relembram que não é necessário decorar uma apresentação, porque seu foco deve ser mostrar interesse pessoal. Eles conversam sobre como usar a sugestão do Apêndice A da brochura Ame as Pessoas — Faça Discípulos para falar de uma verdade bíblica simples quando apropriado. No final, eles analisam vídeos e publicações do Kit de Ferramentas de Ensino que poderiam usar caso a pessoa demonstre ter a “disposição correta”. Ambos expressam seu desejo de tocar o coração das pessoas a quem pregam. (At 13:44-48; w18.10 12 §§ 3 4)'
      },
      { 
        id: 2, 
        text: 'Primeira conversa na pregação de casa em casa',
        instructions: 'Instruções para a parte: \nDepois de mostrar interesse pessoal, um pioneiro fala sobre uma verdade bíblica que interessa à pessoa, usando uma das perguntas nas páginas 5 a 36 da Tradução do Novo Mundo ou um texto bíblico do Apêndice A da brochura Ame as Pessoas'
      },
      { 
        id: 3, 
        text: 'Primeira conversa na pregação de casa em casa',
        instructions: 'Instruções para a parte:\nDepois que o publicador se apresenta, o morador o interrompe e diz muito bravo: “Ah, não! Hoje não!” O morador volta para dentro de casa. O publicador vai para o outro lado do palco e começa o seguinte monólogo: “As pessoas aqui são mal educadas e ficam se achando. Nunca mais vou bater nessa casa.” O publicador sai do palco. A demonstração continua com o instrutor perguntando ao morador: “Por que você reagiu desse jeito?” O morador reconhece que no passado gostava de conversar com as Testemunhas de Jeová e de ler as publicações delas. O morador conta que recentemente perdeu o emprego e seu plano de saúde, e que sua esposa foi diagnosticada com uma doença grave. Ele pede desculpas por sua frustração tê-lo feito ser mal educado.'
      },
    ]
  },
  {
    id: 'workshop2',
    label: 'WORKSHOP 2',
    scenarios: [
      { 
        id: 4, 
        text: 'Dentro de um transporte público ou sentado num lugar público.',
        instructions: 'Instruções para a parte:\nAo ler uma publicação bíblica, um publicador espontaneamente comenta um ponto interessante da publicação para a pessoa que está sentada ao seu lado ou que está próxima dele. Eles começam uma conversa agradável.'
      },
      { 
        id: 5, 
        text: 'Pregação num lugar público (na rua, num parque, no ponto de ônibus, numa loja ou em outro lugar)',
        instructions: '5a: (2 min ou menos) Dois publicadores, trabalhando juntos, não escolhem bem as pessoas com quem vão tentar conversar. Eles tentam conversar com uma pessoa e depois com a outra (elas estão ocupadas atendendo algum cliente, falando no telefone, carregando sacolas pesadas ou em alguma outra atividade). Os publicadores tentam oferecer uma publicação, mas nenhuma pessoa aceita conversar.\n5b: (2 min ou menos) O primeiro publicador se aproxima de uma pessoa que não está ocupada e fala sobre o clima ou outro assunto. A pessoa responde e depois de falarem um pouco sobre esse assunto, o publicador direciona a conversa para um assunto bíblico, mas sem mencionar a Bíblia ou oferecer publicações.\n5c: (2 min ou menos) O segundo publicador se aproxima de uma pessoa e fala de forma amigável sobre o que a pessoa está fazendo. A pessoa responde de forma educada e, depois de uma conversa breve, o publicador introduz uma verdade bíblica dizendo: “Você sabia que . . . ?” ou “Já ouviu falar que . . . ?”. Daí, o publicador considera um texto bíblico relacionado do Apêndice A da brochura Ame as Pessoas. A pessoa mostra interesse, e eles combinam de se encontrar de novo.'
      },
      { 
        id: 6, 
        text: 'O aluno pode escolher uma cena comum na região.',
        instructions: 'Instruções para a parte:\nUm publicador usa apenas a Bíblia ao reagir a uma das seguintes frases que um morador disse:\n● “Deus não existe!”\n● “Um parente meu acabou de falecer . . .”\n● “A Bíblia realmente vem de Deus?”\n● “As Testemunhas de Jeová são arrogantes por acreditarem que são a única religião verdadeira.”'
      },
    ]
  },
  {
    id: 'workshop3',
    label: 'WORKSHOP 3',
    scenarios: [
      { 
        id: 7, 
        text: 'Depois que tiveram a primeira conversa com um morador, um pioneiro experiente ajuda um novo publicador a planejar a revisita.',
        instructions: 'Instruções para a parte:\nDepois de passar a manhã toda na pregação, dois publicadores fazem um intervalo e falam sobre um morador que fez uma pergunta bem difícil. O novo publicador não se sente confiante para fazer a revisita e pede para o pioneiro a faça por ele. O pioneiro diz que confia no publicador, e juntos eles pesquisam sobre a pergunta do morador usando as publicações mais adequadas do Kit de Ferramentas de Ensino, do jw.org ou da BIBLIOTECA ON LINE da Torre de Vigilância®. Depois de pesquisarem juntos sobre o assunto, o pioneiro sugere um jeito simples de começar a conversa: “Eu gostei muito da nossa conversa semana passada. Eu me lembro que você fez uma pergunta interessante. Fiz uma pesquisa sobre o assunto e gostaria de mostrar pra você a resposta.” Então eles ensaiam, com o pioneiro fazendo o papel do morador. No final do ensaio, o novo publicador já se sente preparado para fazer a revisita, agradece ao pioneiro pelas sugestões e pergunta se ele gostaria de acompanhá-lo quando ele for fazer a revisita. O pioneiro aceita.'
      },
      { 
        id: 8, 
        text: 'Pregação de casa em casa ou qualquer outra forma de testemunho público',
        instructions: '8a: (2 min ou menos) Demonstre como fazer da forma errada. Um publicador usa uma apresentação decorada. Ele(a)não se apresenta, mostra pouco interesse na pessoa, não deixa um assunto para considerar na próxima conversa e não combina uma revisita. O publicador simplesmente lê um texto bíblico, faz um breve comentário e então oferece uma publicação, mas o assunto dela não tem nada a ver com o que ele disse. A pessoa aceita a publicação e parece interessada. Mas o publicador não menciona nenhuma pergunta ou assunto para considerar na próxima conversa nem combina dia e horário específicos para conversarem de novo. Em vez disso, depois de entregar a publicação, ele rapidamente termina a conversa, desejando um bom dia para a pessoa.\n8b: (3 min ou menos) Demonstre como fazer da forma certa. Um publicador começa uma conversa mostrando interesse na pessoa. Depois que o morador responde favoravelmente e começa a participar na conversa, o publicador introduz uma verdade bíblica do Apêndice A da brochura Ame as Pessoas. Depois de ler e aplicar o(s) texto(s) bíblico(s) relacionado(s), o publicador faz uma pergunta ou menciona um tópico debaixo do mesmo assunto no Apêndice A para considerar na próxima conversa e combina dia e horário específicos para conversarem de novo. No final da demonstração, o publicador faz um pequeno monólogo sobre o que o morador disse e sobre não ver a hora de voltar e continuar a conversa no horário marcado.'
      },
      { 
        id: 9, 
        text: 'Dois publicadores se preparam para fazer as revisitas do dia.',
        instructions: 'Instruções para a parte:\nCada publicador fala para o outro alguns detalhes importantes sobre o que planeja para fazer as revisitas. Ao fazerem isso, eles conversam sobre o que pode dar certo, e cada um dá uma boa ideia para o outro usar na sua revisita. Eles também ajudam um ao outro a se preparar para possíveis desafios, como, por exemplo, se outra pessoa atender; se o morador que ele quer revisitar não estiver em casa; e se o morador disser: “Estou ocupado agora” ou “Não estou interessado.” Depois disso, os dois publicadores decidem para quem vão ligar ou mandar mensagem primeiro e em que ordem vão fazer as revisitas para usar seu tempo da melhor maneira possível.'
      },
      { 
        id: 10, 
        text: 'Revisitando pela primeira vez alguém que mostrou interesse.',
        instructions: 'Instrução para a parte:\nUm publicador começa a conversa: “Oi, [nome do morador]. Que bom que encontrei você hoje. Talvez você se lembre, meu nome é . . . Tudo bem com você?” O morador responde: “É, tô bem . . .” O publicador diz: “Que bom! Na última vez que eu estive aqui, nós conversamos sobre se Deus se importa com o sofrimento. Você disse que tem dúvidas sobre isso, principalmente depois que sua mãe sofreu um acidente de carro. Falando nisso, como ela está?” O morador responde: “Ela tem altos e baixos. Hoje ela está bem.” O publicador fala de forma bondosa: “Que bom que ela está bem. Não deve ser nada fácil para você enfrentar essa situação.” O morador admite: “Nem me fale, mas estou aguentando. Obrigado por se preocupar.” O publicador continua: “Depois que conversamos, eu fiquei pensando em vocês. Você talvez se lembre que, antes de ir embora, eu prometi voltar para responder por que Deus permite o sofrimento, mesmo tendo poder para acabar com ele. Se você quiser, eu posso mostrar a resposta da Bíblia para você.” O morador responde: “Ah sim, eu quero saber.” (w14 1/1 8)'
      },
      { 
        id: 11, 
        text: 'No final da primeira conversa, o publicador combinou com o morador o dia e a hora para a revisita, mas depois não consegue encontrar o morador em casa.',
        instructions: 'Instruções para a parte:\nUm publicador (no palco) liga para um morador (fora do palco) para fazer uma revisita, e ele atende. Depois de se cumprimentarem, o publicador menciona que foi algumas vezes até a casa do morador, mas não o encontrou. O morador agradece a ligação e diz que recentemente tem trabalhado muito. O publicador reconhece a dificuldade do morador e pergunta se ele tem alguns minutos para responder à pergunta que ele fez no final da última conversa. O morador aceita. O publicador faz um resumo rápido do que eles conversaram da última vez e então usa um texto bíblico para responder à pergunta que ele deixou. Então, o publicador faz outra pergunta para ser respondida e sugere um horário conveniente para continuarem conversando. O morador diz que estará disponível no horário de almoço (ou à noite) para conversarem mais sobre o assunto. Eles combinam um horário específico. Depois de terminar a conversa, o publicador faz um monólogo, dizendo que, apesar de esse horário ser inconveniente pare ele, está fica feliz de finalmente ter conseguido falar com o morador e combinado outra revisita.'
      },
      { 
        id: 12, 
        text: 'Um publicador faz uma revisita para mostrar ao morador uma publicação sobre um assunto pelo qual o morador se interessou.',
        instructions: 'Instruções para a parte:\nDepois de se apresentar e lembrar o morador da última conversa que tiveram, o publicador fala sobre algo numa publicação, relacionado ao assunto. A conversa continua, e o morador menciona um problema que ele está passando. Dessa vez, o publicador usa um smartphone ou \ntablet (se apropriado para a região) para mostrar para o morador o jw.org. O publicador mostra como navegar no site e mostra um artigo que fala sobre um problema específico do morador. (Se for mais apropriado para a região, o publicador pode demonstrar como usar a Tradução do Novo Mundo.) O morador agradece. O publicador então faz uma pergunta ou menciona um assunto para considerar na próxima visita. Eles marcam dia e hora para essa visita, e a demonstração termina.'
      },
      { 
        id: 13, 
        text: 'Um publicador conversa regularmente sobre a Bíblia com uma pessoa interessada sem ter deixado com ela nenhuma publicação. Desta vez, o publicador demonstra como é um estudo bíblico.',
        instructions: 'Instruções para a parte:\nDepois de uma breve conversa sobre o que conversaram da última vez, o publicador mostra a brochura Seja Feliz para Sempre! ou a Bíblia e considera um assunto apropriado para o morador. Depois disso, o publicador faz uma pergunta (para considerar na próxima conversa) e pergunta se a pessoa deseja combinar um dia e horário específicos para continuarem conversando. A pessoa concorda e diz qual dia e horário é melhor para ela. Ela diz que talvez sua família também goste de aprender essas coisas com o publicador.'
      },
      { 
        id: 14, 
        text: 'Ao fazer uma revisita, um publicador começa um estudo usando a brochura Seja Feliz para Sempre!',
        instructions: 'Instruções para a parte:\nDepois de brevemente se cumprimentarem e conversarem, o publicador dá a brochura para o morador e pede para ele dar uma olhada nas lições dela. Eles então conversam sobre a pergunta de ponto de vista na parte de trás da brochura. O publicador então explica brevemente os recursos da brochura e combina de voltar e considerar a primeira lição.'
      },
    ]
  },
  {
    id: 'workshop4',
    label: 'WORKSHOP 4',
    scenarios: [
      { 
        id: 15, 
        text: 'Um publicador usa a brochura Seja Feliz para Sempre! para iniciar um estudo bíblico.',
        instructions: 'Instruções para a parte:\nO publicador destaca a pergunta de ponto de vista da parte de trás da brochura e então conversa com o morador sobre esses pontos. Antes de terminar a conversa, ele faz uma breve revisão do que o morador aprendeu. Impressionado, o morador aceita continuar a conversa na lição 01.'
      },
      { 
        id: 16, 
        text: 'Forma correta de dirigir um estudo bíblico',
        instructions: 'Instruções para a parte:\nO publicador considera com o estudante as perguntas da lição 01, ponto 3, da brochura Seja Feliz para Sempre!. O publicador fala pouco e permite que o morador fique à vontade para se expressar. (Pr 20:5)'
      },
      { 
        id: 17, 
        text: 'Um publicador dirigindo um estudo bíblico no livro Seja Feliz para Sempre!.',
        instructions: 'Instruções para a parte:\nInstrutor e estudante conversam sobre a lição 13, ponto 4. O estudante diz que acha que têm algo de bom em todas as religiões. Sem falar muito, o instrutor usa com jeito textos bíblicos, perguntas e o vídeo (sem mostrar durante a demonstração) para ajudar o estudante a raciocinar sobre o assunto. O estudante começa a perceber que o que ele achava não está de acordo com a Bíblia.'
      },
      { 
        id: 18, 
        text: 'Um publicador dirigindo um estudo bíblico no livro Seja Feliz para Sempre!.',
        instructions: 'Instruções para a parte:\nInstrutor e estudante começam a conversar sobre a lição 22, ponto 4. O estudante diz que está preocupado se alguém ficar chateado ou irritado quando ele tentar contar o que está aprendendo da Bíblia a outros. Usando a lição 22, ponto 4, o instrutor com habilidade o deixa mais tranquilo, e o estudante agradece. O instrutor o elogia pelo seu desejo de falar sobre as boas novas a outros e o anima dizendo que ele vai conseguir fazer isso bem.'
      },
    ]
  }
];

interface PioneerSchoolViewProps {
  userId: string;
  onBack: () => void;
  congregations: any[];
  defaultCircuit: string;
}

export default function PioneerSchoolView({ userId, onBack, congregations, defaultCircuit }: PioneerSchoolViewProps) {
  const [activeTab, setActiveTab] = useState<'students' | 'workshops'>('students');
  const [selectedTurma, setSelectedTurma] = useState<'1' | '2' | '3'>('1');
  const [expandedScenario, setExpandedScenario] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [workshopAssignments, setWorkshopAssignments] = useState<Record<number, { id: string, participants: string }>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [generating, setGenerating] = useState(false);
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
    circuito: defaultCircuit || '',
    turma: ''
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

    const unsubscribeStudents = onSnapshot(q, (snapshot) => {
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

    // Fetch workshop assignments
    const qWorkshops = query(
      collection(db, 'pioneer_school_workshops'),
      where('userId', '==', userId),
      where('turma', '==', selectedTurma)
    );

    const unsubscribeWorkshops = onSnapshot(qWorkshops, (snapshot) => {
      const assignments: Record<number, { id: string, participants: string }> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        assignments[data.scenarioId] = {
          id: doc.id,
          participants: data.participants || ''
        };
      });
      setWorkshopAssignments(assignments);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'pioneer_school_workshops');
    });

    return () => {
      unsubscribeStudents();
      unsubscribeWorkshops();
    };
  }, [userId, selectedTurma]);

  const handleParticipantChange = async (scenarioId: number, index: number, value: string) => {
    try {
      const existing = workshopAssignments[scenarioId];
      let currentParticipants = existing?.participants ? existing.participants.split('|') : [];
      
      // Ensure the array has enough space
      const requiredLength = scenarioId === 5 ? 4 : 2;
      while (currentParticipants.length < requiredLength) {
        currentParticipants.push('');
      }
      
      currentParticipants[index] = value;
      const joinedParticipants = currentParticipants.join('|');

      if (existing) {
        await updateDoc(doc(db, 'pioneer_school_workshops', existing.id), {
          participants: joinedParticipants,
          updatedAt: new Date()
        });
      } else {
        await addDoc(collection(db, 'pioneer_school_workshops'), {
          scenarioId,
          participants: joinedParticipants,
          userId,
          turma: selectedTurma,
          createdAt: new Date()
        });
      }
    } catch (error) {
      handleFirestoreError(error, workshopAssignments[scenarioId] ? OperationType.UPDATE : OperationType.CREATE, 'pioneer_school_workshops');
    }
  };

  const handleOpenModal = (student: Student | null = null) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        nome: student.nome,
        congregacao: student.congregacao,
        circuito: student.circuito,
        turma: student.turma || ''
      });
    } else {
      setEditingStudent(null);
      setFormData({
        nome: '',
        congregacao: '',
        circuito: defaultCircuit || '',
        turma: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleUpdateTurma = async (studentId: string, newTurma: string) => {
    try {
      await updateDoc(doc(db, 'pioneer_school_students', studentId), {
        turma: newTurma,
        updatedAt: new Date()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'pioneer_school_students');
    }
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
          if (!currentMatch) continue;
          
          const nextMatch = recordStarts[i + 1];
          const startIdx = currentMatch.index;
          const endIdx = nextMatch?.index !== undefined ? nextMatch.index : normalizedText.length;
          const recordText = normalizedText.substring(startIdx, endIdx).trim();
          
          const idMatch = recordText.match(/^(\d+)\s+(\d{7,8})\b/);
          if (!idMatch) continue;
          
          const afterId = recordText.substring(idMatch[0].length).trim();
          const dateMatch = afterId.match(/(\d{2}\/\d{2}\/\d{4})/);
          if (!dateMatch || dateMatch.index === undefined) continue;
          
          const dateIdx = dateMatch.index;
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

  const handleDownloadPDF = async () => {
    const headerElement = document.getElementById('pdf-header');
    const contentElement = document.getElementById('pdf-content');
    if (!headerElement || !contentElement) return;

    setGenerating(true);
    try {
      const { toJpeg } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      // Capture Header
      headerElement.classList.add('pdf-capture-header', 'pdf-only-element');
      const headerDataUrl = await toJpeg(headerElement, { quality: 0.95, pixelRatio: 2, backgroundColor: '#ffffff' });
      headerElement.classList.remove('pdf-capture-header', 'pdf-only-element');

      // Capture Content
      contentElement.classList.add('pdf-capture-content');
      const contentDataUrl = await toJpeg(contentElement, { quality: 0.95, pixelRatio: 2, backgroundColor: '#ffffff' });
      contentElement.classList.remove('pdf-capture-content');

      const headerImg = new Image();
      headerImg.src = headerDataUrl;
      await new Promise((resolve) => { headerImg.onload = resolve; });

      const contentImg = new Image();
      contentImg.src = contentDataUrl;
      await new Promise((resolve) => { contentImg.onload = resolve; });

      const pdfWidth = 210;
      const pdfPageHeight = 297; 
      const bottomMargin = 12;
      const headerHeight = (headerImg.height * pdfWidth) / headerImg.width;
      const contentHeight = (contentImg.height * pdfWidth) / contentImg.width;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      let heightLeft = contentHeight;
      let contentPosition = 0;
      const maxContentHeightPerPage = pdfPageHeight - headerHeight - bottomMargin;

      // First Page
      pdf.addImage(headerDataUrl, 'JPEG', 0, 0, pdfWidth, headerHeight, undefined, 'FAST');
      pdf.addImage(contentDataUrl, 'JPEG', 0, headerHeight, pdfWidth, contentHeight, undefined, 'FAST');
      heightLeft -= maxContentHeightPerPage;

      // Additional Pages
      while (heightLeft > 0) {
        pdf.addPage();
        contentPosition = -(contentHeight - heightLeft);
        
        // Draw recurring header
        pdf.addImage(headerDataUrl, 'JPEG', 0, 0, pdfWidth, headerHeight, undefined, 'FAST');
        
        // Draw next slice of content
        // Note: jspdf's addImage with negative Y and clipping can be tricky, 
        // using the slicing logic based on the full height
        pdf.addImage(contentDataUrl, 'JPEG', 0, headerHeight + contentPosition, pdfWidth, contentHeight, undefined, 'FAST');
        
        heightLeft -= maxContentHeightPerPage;
      }
      
      const title = activeTab === 'students' ? 'Escola do Servico de Pioneiro - Lista de Alunos' : `Escola do Servico de Pioneiro - Sessao de Treino - Turma ${selectedTurma}`;
      pdf.save(`${title}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  const SortIcon = ({ column }: { column: keyof Student | 'index' }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={14} className="ml-1 opacity-50" />;
    return sortConfig.direction === 'asc' ? 
      <ArrowUp size={14} className="ml-1 text-white" /> : 
      <ArrowDown size={14} className="ml-1 text-white" />;
  };

  // Get all assigned student names for workshop prioritization
  const assignedStudentNames = new Set(
    Object.values(workshopAssignments)
      .flatMap(a => a.participants.split('|'))
      .filter(name => name !== '')
  );

  // Sort students for workshop dropdown: filter by selected class, unassigned first, then assigned
  const workshopDropdownStudents = [...students]
    .filter(s => s.turma === selectedTurma)
    .sort((a, b) => {
      const aAssigned = assignedStudentNames.has(a.nome);
      const bAssigned = assignedStudentNames.has(b.nome);
      
      if (aAssigned && !bAssigned) return 1;
      if (!aAssigned && bAssigned) return -1;
      return a.nome.localeCompare(b.nome);
    });

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
            <div className="flex items-center gap-4 mt-1">
              <button 
                onClick={() => setActiveTab('students')}
                className={`text-sm font-bold transition-all flex items-center gap-1.5 pb-1 border-b-2 whitespace-nowrap ${activeTab === 'students' ? 'text-[#4CAF50] border-[#4CAF50]' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
              >
                <Users size={16} />
                Lista de Alunos
              </button>
              <button 
                onClick={() => setActiveTab('workshops')}
                className={`text-sm font-bold transition-all flex items-center gap-1.5 pb-1 border-b-2 whitespace-nowrap ${activeTab === 'workshops' ? 'text-[#4CAF50] border-[#4CAF50]' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
              >
                <LayoutList size={16} />
                Sessão de Treino
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'students' ? (
            <>
              <div className={`relative flex items-center transition-all duration-300 ${showSearch ? 'flex-1 md:w-64' : 'w-10'}`}>
                <button 
                  onClick={() => setShowSearch(!showSearch)}
                  className={`p-2 rounded-xl transition-all flex items-center justify-center ${showSearch ? 'absolute left-1 z-10 text-[#4CAF50]' : 'hover:bg-gray-100 border border-gray-200 text-gray-600'}`}
                  title="Buscar aluno"
                >
                  <Search size={18} />
                </button>
                {showSearch && (
                  <motion.input
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: '100%', opacity: 1 }}
                    autoFocus
                    type="text"
                    placeholder="Buscar aluno..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onBlur={() => { if (!searchTerm) setShowSearch(false); }}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent outline-none transition-all"
                  />
                )}
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
                <span className="hidden sm:inline">Adicionar</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-2 py-1 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 ml-2 uppercase tracking-widest">Turma:</span>
              <div className="flex gap-1">
                {(['1', '2', '3'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTurma(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedTurma === t 
                        ? 'bg-amber-100 text-amber-700 shadow-sm' 
                        : 'text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons: PDF and Print moved to end */}
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={handleDownloadPDF}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md font-bold whitespace-nowrap disabled:opacity-50"
              title="Baixar PDF"
            >
              {generating ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
              <span className="hidden lg:inline">{generating ? 'Gerando...' : 'PDF'}</span>
            </button>
            <button
              onClick={() => window.print()}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-all shadow-md font-bold whitespace-nowrap"
              title="Imprimir"
            >
              <Printer size={18} />
              <span className="hidden lg:inline">Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { 
            margin: 5mm 12mm 12mm 12mm; 
            size: A4; 
          }
          body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            background: white !important; 
          }
          .print\:hidden { display: none !important; }
          #pioneer-school-report { 
            border: none !important; 
            box-shadow: none !important; 
            padding: 0 !important; 
            width: 100% !important; 
            margin: 0 !important; 
          }
          tr { page-break-inside: avoid !important; }
          table { width: 100% !important; border-collapse: collapse !important; border: 1px solid #eee !important; }
          th { background-color: #37616b !important; color: white !important; -webkit-print-color-adjust: exact !important; }
          thead { display: table-header-group !important; }
          
          /* Remove layout borders for clean print */
          .bg-white.rounded-2xl { 
            border: none !important; 
            box-shadow: none !important; 
            border-radius: 0 !important;
          }
          
          input[type="checkbox"], .actions-column, .select-turma-ui { display: none !important; }
          .turma-text { display: block !important; font-weight: bold !important; text-align: center !important; }
          .workshop-select-ui { display: none !important; }
          .workshop-participant-text { 
            display: block !important; 
            border-bottom: 1px dotted #999 !important; 
            min-height: 24px !important; 
            color: #333 !important;
          }
        }
        /* Specialized PDF capture overrides */
        .pdf-capture { 
          padding: 5mm 12mm 12mm 12mm !important; 
          background-color: white !important;
        }
        .pdf-capture-header {
          padding: 5mm 12mm 0 12mm !important;
          background-color: white !important;
        }
        .pdf-capture-content {
          padding: 0 12mm 12mm 12mm !important;
          background-color: white !important;
        }
        .pdf-capture .bg-white.rounded-2xl { 
          border: none !important; 
          box-shadow: none !important; 
          border-radius: 0 !important;
        }
        .pdf-capture .pdf-only-element { display: block !important; }
        .pdf-capture .print\:hidden { display: none !important; }
        .pdf-capture .pdf-only-element\:hidden { display: none !important; }
      `}</style>

      <div id="pioneer-school-report" className="space-y-6 print:space-y-0 pdf-capture:space-y-0">
        {/* Document Header - Visible only in Print/PDF */}
        {/* Document Header - Visible only in Print/PDF - Matched to Screenshot */}
        <div id="pdf-header" className="hidden print:block pdf-only-element text-center pt-2 mb-[5mm]">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">
            Escola do Serviço de Pioneiro
          </h1>
          <p className="text-gray-400 uppercase tracking-[0.3em] text-xs font-medium">
            {activeTab === 'students' ? 'LISTA DE ALUNOS' : `SESSÃO DE TREINO - TURMA ${selectedTurma}`}
          </p>
        </div>

        <div id="pdf-content">
          {activeTab === 'students' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#37616b] text-white">
                    <th className="px-4 py-2 w-10 print:hidden pdf-only-element:hidden">
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
                        <span className="print:hidden pdf-capture:hidden"><SortIcon column="nome" /></span>
                      </div>
                    </th>
                    <th 
                      className="px-6 py-2 font-bold text-sm uppercase tracking-wider cursor-pointer hover:bg-[#2c4d55] transition-colors"
                      onClick={() => handleSort('congregacao')}
                    >
                      <div className="flex items-center">
                        Congregação
                        <span className="print:hidden pdf-capture:hidden"><SortIcon column="congregacao" /></span>
                      </div>
                    </th>
                    <th 
                      className="px-6 py-2 font-bold text-sm uppercase tracking-wider cursor-pointer hover:bg-[#2c4d55] transition-colors"
                      onClick={() => handleSort('circuito')}
                    >
                      <div className="flex items-center">
                        Circuito
                        <span className="print:hidden pdf-capture:hidden"><SortIcon column="circuito" /></span>
                      </div>
                    </th>
                    <th 
                      className="px-4 py-2 font-bold text-sm uppercase tracking-wider cursor-pointer hover:bg-[#2c4d55] transition-colors text-center"
                      onClick={() => handleSort('turma')}
                    >
                      <div className="flex items-center justify-center">
                        Turma
                        <span className="print:hidden pdf-only-element:hidden"><SortIcon column="turma" /></span>
                      </div>
                    </th>
                    <th className="px-6 py-2 font-bold text-sm uppercase tracking-wider w-24 text-center print:hidden pdf-only-element:hidden">Ações</th>
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
                        <td className="px-4 py-2 print:hidden pdf-only-element:hidden">
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
                        <td className="px-4 py-2 text-sm text-center">
                          <div className="hidden turma-text">
                            {student.turma ? (
                              <span className="bg-[#FFBD00]/10 text-[#7A5C00] border border-[#FFBD00]/20 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap">
                                TURMA {student.turma}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </div>
                          <div className="select-turma-ui">
                            <select
                              value={student.turma || ''}
                              onChange={(e) => handleUpdateTurma(student.id, e.target.value)}
                              className={`px-2 py-1 rounded-lg font-bold text-xs border-none focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer appearance-none text-center transition-all ${
                                student.turma 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-gray-100 text-gray-400 italic'
                              }`}
                            >
                              <option value="">-</option>
                              <option value="1">TURMA 1</option>
                              <option value="2">TURMA 2</option>
                              <option value="3">TURMA 3</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-6 py-2 text-sm print:hidden pdf-only-element:hidden">
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
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-[#37616b] text-white">
                    <th className="px-4 py-3 font-bold text-sm uppercase tracking-wider w-16 text-center border-r border-white/10">
                      {/* Workshop Sidebar Header */}
                    </th>
                    <th className="px-6 py-3 font-bold text-sm uppercase tracking-wider border-r border-white/10 w-[60%]">
                      Sessão de Treino
                    </th>
                    <th className="px-6 py-3 font-bold text-sm uppercase tracking-wider w-[40%]">
                      Participantes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {WORKSHOP_DATA.map((workshop) => (
                    workshop.scenarios.map((scenario, sIndex) => (
                      <tr key={scenario.id} className={`${scenario.id % 2 === 0 ? 'bg-white' : 'bg-[#e8f1f3]'} border-b border-gray-100`}>
                        {sIndex === 0 && (
                          <td 
                            rowSpan={workshop.scenarios.length} 
                            className="bg-[#37616b] text-white font-bold text-[10px] uppercase tracking-widest text-center border-r border-white/10 relative overflow-hidden"
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="rotate-[-90deg] whitespace-nowrap">
                                {workshop.label}
                              </span>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4 text-sm text-gray-800 border-r border-gray-200 font-medium leading-relaxed">
                          <div 
                            className="cursor-pointer hover:text-[#37616b] transition-colors group"
                            onClick={() => setExpandedScenario(expandedScenario === scenario.id ? null : scenario.id)}
                          >
                            <span className="font-bold mr-2">({scenario.id})</span>
                            {scenario.text}
                            <div className="inline-block ml-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden pdf-only-element:hidden">
                              <ChevronDown size={14} className={`transform transition-transform ${expandedScenario === scenario.id ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          
                          <AnimatePresence>
                            {(expandedScenario === scenario.id || true) && scenario.instructions && (
                              <motion.div
                                initial={expandedScenario === scenario.id ? { height: 0, opacity: 0 } : false}
                                animate={{ height: 'auto', opacity: 1 }}
                                className={`overflow-hidden ${(expandedScenario !== scenario.id) ? 'hidden print:block pdf-capture:block' : ''}`}
                              >
                                <div className="mt-3 p-3 bg-[#f0f7f8] border-l-4 border-[#37616b] rounded-r-lg text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                                  <p className="font-bold text-[#37616b] mb-1">Instruções:</p>
                                  {scenario.instructions.replace('Instruções para a parte:', '').replace('Instruções para a parte', '').trim()}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            {Array.from({ length: scenario.id === 5 ? 4 : 2 }).map((_, idx) => {
                              const participant = workshopAssignments[scenario.id]?.participants?.split('|')[idx] || '';
                              return (
                                <div key={idx} className="relative">
                                  <div className="hidden workshop-participant-text py-2 text-sm">
                                    {participant || '............................................................'}
                                  </div>
                                  <div className="workshop-select-ui">
                                    <select
                                      value={participant}
                                      onChange={(e) => handleParticipantChange(scenario.id, idx, e.target.value)}
                                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-[#37616b] focus:border-[#37616b] outline-none transition-all appearance-none cursor-pointer pr-8 shadow-sm hover:border-gray-300"
                                    >
                                      <option value="">Selecionar aluno...</option>
                                      {workshopDropdownStudents.map((student) => (
                                        <option key={student.id} value={student.nome}>
                                          {student.nome} {assignedStudentNames.has(student.nome) ? '✓' : ''}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                      <ChevronDown size={14} />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Turma</label>
                  <select
                    value={formData.turma}
                    onChange={(e) => setFormData({ ...formData, turma: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4CAF50] outline-none bg-white"
                  >
                    <option value="">Nenhuma turma</option>
                    <option value="1">Turma 1</option>
                    <option value="2">Turma 2</option>
                    <option value="3">Turma 3</option>
                  </select>
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
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
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

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
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
