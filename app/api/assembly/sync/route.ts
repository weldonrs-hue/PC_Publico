import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { syncAssemblyProgram, matchPrograms, calculateSHA256, getNextSeason } from '@/lib/assembly-sync';

export async function POST(req: NextRequest) {
  try {
    const { year, type, mode = 'update' } = await req.json();

    if (!year || !type) {
      return NextResponse.json({ error: 'Parâmetros ausentes (year, type)' }, { status: 400 });
    }

    if (mode === 'check-next') {
      // MODO: Verificar Próxima Programação (Apenas consulta e validação)
      const nextSeason = getNextSeason(year);
      try {
        const scrapedData = await syncAssemblyProgram(nextSeason, type);
        
        // Se chegou aqui, a programação existe e é válida
        return NextResponse.json({ 
          success: true, 
          status: 'AVAILABLE',
          year: nextSeason,
          data: {
            theme: scrapedData.theme,
            headerImage: scrapedData.headerImage,
            itemCount: scrapedData.sessions?.reduce((acc: number, s: any) => acc + (s.items?.length || 0), 0) || 0,
            fullData: scrapedData
          }
        });
      } catch (err: any) {
        const status = err.message.includes('não encontrada') ? 'NOT_PUBLISHED' : 'INCOMPLETE';
        return NextResponse.json({ 
          success: true, 
          status, 
          year: nextSeason,
          message: err.message 
        });
      }
    }

    const results = [];
    
    // MODO: Atualizar Programação (Apenas a temporada enviada)
    try {
      const currentResult = await performSync(year, type);
      results.push({ ...currentResult, isNext: false });
    } catch (err: any) {
      results.push({ year, status: 'SYNC_ERROR', error: err.message, isNext: false });
    }

    return NextResponse.json({ 
      success: true, 
      results
    });

  } catch (error: any) {
    console.error('Erro crítico na sincronização:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}

async function performSync(currentYear: string, type: 'supt' | 'branch') {
  const scrapedData = await syncAssemblyProgram(currentYear, type);
  const docId = `${currentYear}_${type}`;
  const docRef = doc(db, 'assembly_programs', docId);
  
  const existingSnap = await getDoc(docRef);
  const existingData = existingSnap.exists() ? existingSnap.data() : null;

  let status: 'CURRENT_UP_TO_DATE' | 'NEXT_AVAILABLE' | 'UPDATE_AVAILABLE' = 'CURRENT_UP_TO_DATE';
  let matchedSessions = scrapedData.sessions;
  let auditLog = [];

  if (!existingData) {
    status = 'NEXT_AVAILABLE';
    // Usamos o matcher para gerar IDs estáveis mesmo para novas temporadas, suportando subitens
    const matchResult = matchPrograms([], scrapedData.sessions || []);
    matchedSessions = matchResult.sessions;
    auditLog = matchResult.decisions;
  } else {
    // Se já existe, usamos o matcher para preservar os IDs estáveis
    const matchResult = matchPrograms(existingData.sessions || [], scrapedData.sessions || []);
    matchedSessions = matchResult.sessions;
    auditLog = matchResult.decisions;

    if (existingData.hash !== scrapedData.hash) {
      status = 'UPDATE_AVAILABLE';
    }
  }

  // Remove undefined values recursively from dataToSave
  const cleanObject = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(cleanObject);
    if (obj && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, cleanObject(v)])
      );
    }
    return obj;
  };

  const dataToSave = cleanObject({
    ...scrapedData,
    sessions: matchedSessions,
    lastUpdated: new Date().toISOString(),
    status,
    auditLog
  });

  await setDoc(docRef, dataToSave, { merge: true });
  
  return { 
    year: currentYear, 
    status, 
    message: status === 'NEXT_AVAILABLE' ? 'Nova temporada cadastrada.' : (status === 'UPDATE_AVAILABLE' ? 'Programação atualizada.' : 'Programação em dia.'), 
    data: dataToSave 
  };
}
