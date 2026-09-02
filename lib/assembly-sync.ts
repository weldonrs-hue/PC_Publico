import { parse } from 'node-html-parser';
import { sha256 } from 'js-sha256';

export interface AssemblyProgram {
  id: string;
  year: string;
  type: 'supt' | 'branch';
  title: string;
  theme: string;
  headerImage?: string;
  sessions: {
    period: string;
    items: AssemblyItem[];
  }[];
  lastChecked: string;
  lastUpdated: string;
  hash: string;
  baseUrl: string;
  themeUrl: string;
}

export interface AssemblyItem {
  id: string; // O programItemId persistente
  time: string | null;
  title: string;
  label?: string;
  bibleRef?: string;
  noSpeaker: boolean;
  type?: string;
  isRole?: boolean;
  isSeries?: boolean;
  subitems?: AssemblyItem[];
}

/**
 * Calcula o Hash SHA-256 de um objeto ou string
 */
export function calculateSHA256(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return sha256(content);
}

/**
 * Calcula a próxima temporada a partir de uma temporada atual (Ex: 2026-2027 -> 2027-2028)
 */
export function getNextSeason(currentSeason: string): string {
  const parts = currentSeason.split('-');
  if (parts.length !== 2) return currentSeason;
  
  const startYear = parseInt(parts[0]);
  const endYear = parseInt(parts[1]);
  
  if (isNaN(startYear) || isNaN(endYear)) return currentSeason;
  
  return `${startYear + 1}-${endYear + 1}`;
}

/**
 * Normaliza strings para comparação e extração
 */
function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Extrai referência bíblica de uma string
 */
function extractBibleRef(text: string): string | undefined {
  const match = text.match(/\(([^)]*\d+:\d+[^)]*)\)/);
  return match ? match[1].trim() : undefined;
}

/**
 * Formata referência bíblica (Ex: PROVÉRBIOS 16:20 -> Provérbios 16:20)
 */
function formatScripture(scrp: string): string {
  if (!scrp) return '';
  return scrp.trim().split(/\s+/).map((w) => {
    if (w.includes(':') || /^\d+$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

/**
 * Extrai imagem em alta resolução do HTML do JW.org
 */
function extractImageFromRoot(root: any): string {
  const jsRespImg = root.querySelector('.jsRespImg') || root.querySelector('#articleTopRelatedImage .jsRespImg');
  let img = 
    jsRespImg?.getAttribute('data-zoom') ||
    jsRespImg?.getAttribute('data-img-size-lg') ||
    jsRespImg?.getAttribute('data-img-size-md') ||
    jsRespImg?.getAttribute('data-img-size-sm') ||
    root.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
    root.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
    root.querySelector('.image')?.text?.trim() ||
    root.querySelector('figure img, #articleTopRelatedImage img')?.getAttribute('src') ||
    root.querySelector('figure noscript img')?.getAttribute('src') ||
    '';
  if (img.startsWith('/')) {
    img = `https://www.jw.org${img}`;
  }
  return img;
}

/**
 * Atribui uma pontuação de confiança a uma página para determinar se é uma programação oficial
 */
async function scoreCandidatePage(url: string): Promise<{ score: number; data?: any }> {
  try {
    const response = await fetch(url);
    if (!response.ok) return { score: 0 };
    
    const html = await response.text();
    const root = parse(html);
    let score = 0;

    const text = root.text;
    const lowerText = text.toLowerCase();

    // 1. Possuir estrutura de manhã/tarde (+20 cada)
    if (lowerText.includes('manhã') || lowerText.includes('morning')) score += 20;
    if (lowerText.includes('tarde') || lowerText.includes('afternoon')) score += 20;

    // 2. Possuir horários (padrão 9:40) (+5 por horário, max 30)
    const timeMatches = text.match(/\d{1,2}:\d{2}/g);
    if (timeMatches) {
      score += Math.min(timeMatches.length * 5, 30);
    }

    // 3. Possuir termos característicos (+10 cada)
    if (lowerText.includes('cântico')) score += 10;
    if (lowerText.includes('oração')) score += 10;
    if (lowerText.includes('discurso público')) score += 15;
    if (lowerText.includes('estudo de a sentinela')) score += 15;
    if (lowerText.includes('música')) score += 5;

    // 4. Possuir um título/tema claro (+10)
    const title = root.querySelector('.documentTitle')?.text || root.querySelector('h1')?.text;
    if (title) score += 10;

    const themeScrp = root.querySelector('.themeScrp')?.text?.trim() || root.querySelector('.themeScripture')?.text?.trim();
    let fullTheme = normalize(title || '');
    if (themeScrp && !fullTheme.includes('—')) {
      fullTheme = `${fullTheme} — ${formatScripture(themeScrp)}`;
    }

    const pageImg = extractImageFromRoot(root);

    // Extração preliminar para validação de estrutura
    const sessions = extractProgramStructure(root);
    if (sessions.length >= 2) score += 20; // Pelo menos manhã e tarde

    return { 
      score, 
      data: score >= 50 ? { title: normalize(title || ''), theme: fullTheme, headerImage: pageImg, sessions } : null 
    };
  } catch (e) {
    return { score: 0 };
  }
}

function extractProgramStructure(root: any): { period: string; items: AssemblyItem[] }[] {
  const sessions: { period: string; items: AssemblyItem[] }[] = [];
  const contentBody = root.querySelector('#contentBody') || root;
  const elements = contentBody.querySelectorAll('h2, h3, p, div.synopsis, table tr, .programItem, .pGroup');

  let currentPeriod = '';
  let currentItems: AssemblyItem[] = [];
  let currentSeries: AssemblyItem | null = null;

  elements.forEach((el: any) => {
    const text = normalize(el.text);
    const lowerText = text.toLowerCase();

    // Detecção de Período (Manhã/Tarde)
    if ((lowerText.includes('manhã') || lowerText.includes('morning')) && (el.tagName === 'H2' || el.tagName === 'H3')) {
      if (currentSeries) {
        currentItems.push(currentSeries);
        currentSeries = null;
      }
      if (currentPeriod && currentItems.length > 0) sessions.push({ period: currentPeriod, items: currentItems });
      currentPeriod = 'Manhã';
      currentItems = [];
      return;
    } else if ((lowerText.includes('tarde') || lowerText.includes('afternoon')) && (el.tagName === 'H2' || el.tagName === 'H3')) {
      if (currentSeries) {
        currentItems.push(currentSeries);
        currentSeries = null;
      }
      if (currentPeriod && currentItems.length > 0) sessions.push({ period: currentPeriod, items: currentItems });
      currentPeriod = 'Tarde';
      currentItems = [];
      return;
    }

    if (!currentPeriod) return;

    // Tentar extrair horário e título do texto
    const timeMatch = text.match(/^(\d{1,2}:\d{2})\s+(.*)/);
    
    if (timeMatch) {
      const time = timeMatch[1];
      const rawTitle = normalize(timeMatch[2]);
      
      // Detecção de Início de Série (Pai)
      if (rawTitle.toLowerCase().includes('série de discursos') || rawTitle.toLowerCase().includes('symposium')) {
        if (currentSeries) currentItems.push(currentSeries);
        
        const seriesParts = rawTitle.split(/:\s*/);
        const label = seriesParts[0].trim();
        const title = seriesParts.length > 1 ? seriesParts.slice(1).join(': ').trim() : '';

        currentSeries = {
          id: `series_${calculateSHA256(rawTitle + time).substring(0, 8)}`,
          time: time,
          title: title || rawTitle,
          label: label,
          noSpeaker: true,
          isSeries: true,
          subitems: []
        };
        return;
      }

      // Item normal com horário (pode fechar uma série ou ser independente)
      const bibleRef = extractBibleRef(rawTitle);
      const title = bibleRef ? rawTitle.replace(`(${bibleRef})`, '').trim() : rawTitle;
      const lowerT = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isPrayer = lowerT.includes('oracao') || lowerT.includes('prayer');
      const noSpeaker = !isPrayer && (
        lowerT.includes('musica') || 
        lowerT.includes('cantico') || 
        lowerT.includes('intervalo') || 
        lowerT.includes('anuncio')
      );

      const newItem: AssemblyItem = {
        id: `temp_${Math.random().toString(36).substr(2, 9)}`,
        time,
        title,
        ...(bibleRef ? { bibleRef } : {}),
        noSpeaker
      };

      if (currentSeries) {
        // Se encontrarmos um item com horário enquanto uma série está aberta, 
        // ele pode ser o primeiro item da série ou um item que fecha a série.
        // Geralmente, o primeiro item do simpósio tem o mesmo horário da série.
        if (time === currentSeries.time) {
          currentSeries.subitems!.push(newItem);
        } else {
          // Se o horário é diferente, a série acabou
          currentItems.push(currentSeries);
          currentSeries = null;
          currentItems.push(newItem);
        }
      } else {
        currentItems.push(newItem);
      }
    } else if (text.length > 3 && !text.match(/^\d+$/)) {
      // Texto sem horário - Definitivamente um subitem se houver série aberta
      if (currentSeries) {
        const bibleRef = extractBibleRef(text);
        const title = bibleRef ? text.replace(`(${bibleRef})`, '').trim() : text;
        
        currentSeries.subitems!.push({
          id: `temp_${Math.random().toString(36).substr(2, 9)}`,
          time: null,
          title,
          ...(bibleRef ? { bibleRef } : {}),
          noSpeaker: false
        });
      }
    }

    // Fechar série se encontrarmos um marcador de fim ou novo item principal (baseado na tag ou estrutura)
    // No entanto, a lógica de `timeMatch` acima já lida com a maioria dos casos.
  });

  if (currentSeries) currentItems.push(currentSeries);
  if (currentPeriod && currentItems.length > 0) sessions.push({ period: currentPeriod, items: currentItems });
  
  // Garantir que cada sessão tenha o Presidente de Sessão com IDs exclusivos (m0 para Manhã, t0 para Tarde)
  return sessions.map((session, sIdx) => {
    const isMorning = session.period.toLowerCase().includes('manhã') || sIdx === 0;
    const expectedId = isMorning ? 'm0' : 't0';
    const presIdx = session.items.findIndex(i => i.isRole || i.title.toLowerCase().includes('presidente') || i.id === 'm0' || i.id === 't0');
    
    if (presIdx >= 0) {
      const items = [...session.items];
      items[presIdx] = {
        ...items[presIdx],
        id: expectedId,
        title: 'PRESIDENTE DE SESSÃO',
        isRole: true,
        noSpeaker: false
      };
      return { ...session, items };
    }

    return {
      ...session,
      items: [
        { id: expectedId, time: null, title: 'PRESIDENTE DE SESSÃO', isRole: true, noSpeaker: false },
        ...session.items
      ]
    };
  });
}

/**
 * Calcula a pontuação de correspondência entre dois itens com base em múltiplos sinais
 */
function calculateMatchScore(oldItem: AssemblyItem, newItem: AssemblyItem, context?: { prevMatch?: boolean; nextMatch?: boolean }): number {
  let score = 0;

  // 1. Título Exato (+80) - Peso aumentado conforme solicitado
  if (normalize(oldItem.title).toLowerCase() === normalize(newItem.title).toLowerCase()) {
    score += 80;
  } else {
    // 2. Similaridade de Título (Fuzzy aprox) (+40)
    const s1 = normalize(oldItem.title).toLowerCase();
    const s2 = normalize(newItem.title).toLowerCase();
    if (s1.includes(s2) || s2.includes(s1) || (s1.length > 5 && s2.length > 5 && (s1.startsWith(s2.substring(0, 5)) || s2.startsWith(s1.substring(0, 5))))) {
      score += 40;
    }
  }

  // 3. Referência Bíblica (+40)
  if (oldItem.bibleRef && newItem.bibleRef && oldItem.bibleRef === newItem.bibleRef) {
    score += 40;
  }

  // 4. Horário (+15) - Apenas evidência auxiliar
  if (oldItem.time === newItem.time && oldItem.time !== null) {
    score += 15;
  }

  // 5. Contexto de Vizinhança (+20)
  if (context?.prevMatch) score += 10;
  if (context?.nextMatch) score += 10;

  return score;
}

/**
 * Realiza a correspondência de uma lista de itens (usada recursivamente para subitens)
 */
function matchItemList(oldItems: AssemblyItem[], newItems: AssemblyItem[], decisions: any[], parentId?: string, sessionPeriod?: string): AssemblyItem[] {
  const isMorning = sessionPeriod?.toLowerCase().includes('manhã');

  if (!oldItems || oldItems.length === 0) {
    return newItems.map((item, idx) => {
      let id = item.id;
      const isPresident = item.isRole || item.title?.toLowerCase().includes('presidente') || item.id === 'm0' || item.id === 't0';
      if (isPresident) {
        id = (isMorning || item.id === 'm0') ? 'm0' : 't0';
      } else if (!item.isSeries) {
        id = `item_${calculateSHA256(item.title + (item.time || '') + (parentId || '') + (sessionPeriod || '') + idx).substring(0, 8)}`;
      }
      
      const matchedItem = { ...item, id };
      if (item.subitems) {
        matchedItem.subitems = matchItemList([], item.subitems, decisions, id, sessionPeriod);
      }
      return matchedItem;
    });
  }

  const matchedResult: AssemblyItem[] = [];
  const scoringMatrix: { oldItem: AssemblyItem; newItem: AssemblyItem; score: number; index: number; oldIdx: number }[] = [];
  
  newItems.forEach((newItem, newIdx) => {
    oldItems.forEach((oldItem, oldIdx) => {
      const score = calculateMatchScore(oldItem, newItem);
      scoringMatrix.push({ oldItem, newItem, score, index: newIdx, oldIdx });
    });
  });

  // Adicionar Sinais de Contexto (Vizinhança)
  scoringMatrix.forEach(match => {
    const prevNewIdx = match.index - 1;
    const prevOldIdx = match.oldIdx - 1;
    const nextNewIdx = match.index + 1;
    const nextOldIdx = match.oldIdx + 1;

    let contextBonus = 0;
    if (prevNewIdx >= 0 && prevOldIdx >= 0) {
      const prevMatch = scoringMatrix.find(m => m.index === prevNewIdx && m.oldIdx === prevOldIdx && m.score >= 40);
      if (prevMatch) contextBonus += 10;
    }
    if (nextNewIdx < newItems.length && nextOldIdx < oldItems.length) {
      const nextMatch = scoringMatrix.find(m => m.index === nextNewIdx && m.oldIdx === nextOldIdx && m.score >= 40);
      if (nextMatch) contextBonus += 10;
    }
    match.score += contextBonus;
  });

  scoringMatrix.sort((a, b) => b.score - a.score);

  const usedOldIds = new Set<string>();
  const matchedNewIndices = new Set<number>();
  const finalMatches = new Map<number, { item: AssemblyItem; score: number; oldId: string; secondScore?: number }>();

  scoringMatrix.forEach(match => {
    if (matchedNewIndices.has(match.index) || usedOldIds.has(match.oldItem.id)) return;
    if (match.score < 40) return;

    const secondBest = scoringMatrix.find(m => m.index === match.index && m.oldItem.id !== match.oldItem.id && m.score >= 40);
    const margin = secondBest ? (match.score - secondBest.score) : match.score;

    if (match.score >= 80 && margin >= 15) {
      finalMatches.set(match.index, { item: { ...match.newItem, id: match.oldItem.id }, score: match.score, oldId: match.oldItem.id });
      usedOldIds.add(match.oldItem.id);
      matchedNewIndices.add(match.index);
    } else if (match.score >= 40) {
      const tempId = match.newItem.isSeries ? match.newItem.id : `item_${calculateSHA256(match.newItem.title + (match.newItem.time || '') + (parentId || '')).substring(0, 8)}`;
      finalMatches.set(match.index, { 
        item: { ...match.newItem, id: tempId }, 
        score: match.score, 
        oldId: match.oldItem.id,
        secondScore: secondBest?.score
      });
      matchedNewIndices.add(match.index);
    }
  });

  newItems.forEach((item, idx) => {
    const match = finalMatches.get(idx);
    let finalItem: AssemblyItem;

    if (match) {
      const isPresident = item.isRole || item.title?.toLowerCase().includes('presidente') || item.id === 'm0' || item.id === 't0';
      const canonicalId = isPresident ? (isMorning ? 'm0' : 't0') : match.item.id;
      const resolvedItem = { ...match.item, id: canonicalId, ...(isPresident ? { isRole: true, noSpeaker: false } : {}) };

      if (match.score >= 80 && (!match.secondScore || (match.score - match.secondScore >= 15))) {
        finalItem = resolvedItem;
        decisions.push({ type: 'match', oldId: match.oldId, newId: resolvedItem.id, score: match.score, title: item.title });
      } else {
        finalItem = resolvedItem;
        decisions.push({ 
          type: 'ambiguity', 
          oldId: match.oldId, 
          newId: resolvedItem.id, 
          score: match.score, 
          ...(match.secondScore !== undefined ? { secondScore: match.secondScore } : {}), 
          title: item.title 
        });
      }
      
      // Recursão para subitens se for uma série
      if (item.isSeries && item.subitems) {
        const oldItem = oldItems.find(oi => oi.id === match.oldId);
        finalItem.subitems = matchItemList(oldItem?.subitems || [], item.subitems, decisions, finalItem.id, sessionPeriod);
      }
    } else {
      const isPresident = item.isRole || item.title?.toLowerCase().includes('presidente') || item.id === 'm0' || item.id === 't0';
      const id = isPresident 
        ? (isMorning ? 'm0' : 't0')
        : (item.isSeries ? item.id : `item_${calculateSHA256(item.title + (item.time || '') + (parentId || '') + (sessionPeriod || '') + idx).substring(0, 8)}`);
      
      finalItem = { ...item, id, ...(isPresident ? { isRole: true, noSpeaker: false } : {}) };
      decisions.push({ type: 'new', newId: id, title: item.title });
      
      if (item.isSeries && item.subitems) {
        finalItem.subitems = matchItemList([], item.subitems, decisions, finalItem.id, sessionPeriod);
      }
    }
    matchedResult.push(finalItem);
  });

  return matchedResult;
}

/**
 * Realiza a correspondência GLOBAL entre a programação antiga e a nova para preservar IDs
 */
export function matchPrograms(oldSessions: any[], newSessions: any[]): { sessions: any[], decisions: any[] } {
  const matchedSessions: any[] = [];
  const decisions: any[] = [];

  newSessions.forEach((newSession, sIdx) => {
    const oldSession = oldSessions.find(s => s.period?.toLowerCase() === newSession.period?.toLowerCase());
    const isMorning = newSession.period?.toLowerCase().includes('manhã') || sIdx === 0;
    const matchedItems = matchItemList(oldSession?.items || [], newSession.items, decisions, undefined, newSession.period);

    // Enforce distinct canonical ID for the session president (m0 for morning, t0 for afternoon)
    const expectedId = isMorning ? 'm0' : 't0';
    const presIdx = matchedItems.findIndex(i => i.isRole || i.title?.toLowerCase().includes('presidente') || i.id === 'm0' || i.id === 't0');
    let finalItems = [...matchedItems];
    if (presIdx >= 0) {
      finalItems[presIdx] = {
        ...finalItems[presIdx],
        id: expectedId,
        title: 'PRESIDENTE DE SESSÃO',
        isRole: true,
        noSpeaker: false
      };
    } else {
      finalItems.unshift({
        id: expectedId,
        time: null,
        title: 'PRESIDENTE DE SESSÃO',
        isRole: true,
        noSpeaker: false
      });
    }

    matchedSessions.push({ ...newSession, items: finalItems });
  });

  return { sessions: matchedSessions, decisions };
}

export async function syncAssemblyProgram(year: string, type: 'supt' | 'branch'): Promise<Partial<AssemblyProgram>> {
  const baseUrl = `https://www.jw.org/pt/biblioteca/programas/Programa-da-Assembleia-de-Circuito-de-${year}-com-o-${type === 'supt' ? 'Superintendente-de-Circuito' : 'Representante-de-Betel'}/`;
  
  // ETAPA 1: Abrir Página Base
  const response = await fetch(baseUrl);
  if (!response.ok) {
    throw new Error(`Página da temporada ${year} não encontrada ou jw.org indisponível.`);
  }

  const html = await response.text();
  const root = parse(html);
  const rawBaseTitle = root.querySelector('.documentTitle')?.text || root.querySelector('h1')?.text || '';
  const fallbackTitle = `Programa da Assembleia de Circuito de ${year} com o ${type === 'supt' ? 'Superintendente de Circuito' : 'Representante de Betel'}`;
  
  // Se o título extraído não parecer um título de programa (não contém "Assembleia"), usa o fallback
  const baseTitle = normalize(rawBaseTitle.includes('Assembleia') ? rawBaseTitle : fallbackTitle);
  const baseHeaderImage = extractImageFromRoot(root);
  
  // ETAPA 2: Identificar Candidatos
  const contentBody = root.querySelector('#contentBody') || root;
  const links = contentBody.querySelectorAll('a').map(a => {
    let href = a.getAttribute('href') || '';
    if (href.startsWith('/')) href = `https://www.jw.org${href}`;
    return href;
  }).filter(href => href.startsWith(baseUrl) && href !== baseUrl);

  // Remover duplicados
  const uniqueLinks = Array.from(new Set(links));
  
  // ETAPA 3: Validar Candidatos e Pontuar
  let bestCandidate: { url: string; score: number; data: any } | null = null;

  for (const link of uniqueLinks) {
    const { score, data } = await scoreCandidatePage(link);
    if (score >= 50 && (!bestCandidate || score > bestCandidate.score)) {
      bestCandidate = { url: link, score, data };
    }
  }

  if (!bestCandidate) {
    throw new Error(`Nenhuma programação válida encontrada para a temporada ${year}.`);
  }

  // ETAPA 4: Extrair Tema Final e Imagem
  let theme = bestCandidate.data.theme || bestCandidate.data.title;
  const headerImage = baseHeaderImage || bestCandidate.data.headerImage || '';

  // Gerar Hash SHA-256 do CONTEÚDO (para detectar se mudou algo no jw.org)
  const hash = calculateSHA256({ theme, headerImage, sessions: bestCandidate.data.sessions });

  return {
    year,
    type,
    title: baseTitle,
    theme,
    headerImage,
    sessions: bestCandidate.data.sessions,
    hash,
    baseUrl,
    themeUrl: bestCandidate.url,
    lastChecked: new Date().toISOString()
  };
}

