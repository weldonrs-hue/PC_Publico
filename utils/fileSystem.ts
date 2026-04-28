import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const createCircuitFolderStructure = async (rootHandle: any, circuitName: string, userId: string) => {
  // 1. Create Circuit Folder
  const circuitHandle = await rootHandle.getDirectoryHandle(circuitName, { create: true });

  // 2. Fetch congregations
  const q = query(collection(db, 'congregations'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  const congregations = querySnapshot.docs.map(doc => doc.data().nome);

  // 3. Create Main Structure
  const mainFolders = ['CIRCUITO', 'ESCOLAS', 'EVENTOS', 'DIVERSOS'];
  
  for (const folder of mainFolders) {
    const folderHandle = await circuitHandle.getDirectoryHandle(folder, { create: true });

    if (folder === 'CIRCUITO') {
      for (const cong of congregations) {
        await folderHandle.getDirectoryHandle(cong, { create: true });
      }
    }

    if (folder === 'ESCOLAS') {
      const subFolders = [
        '(ESP) Serviço de Pioneiro',
        '(Anciãos) Ministério do Reino',
        '(Servos) Ministério do Reino'
      ];
      for (const sub of subFolders) {
        await folderHandle.getDirectoryHandle(sub, { create: true });
      }
    }

    if (folder === 'EVENTOS') {
      const subFolders = [
        '(CO) Congresso Regional',
        '(CAco) Assembleia Viajante',
        '(CAbr) Assembleia Representante',
        '(S-312) Reunião Especial Pioneiros'
      ];
      for (const sub of subFolders) {
        await folderHandle.getDirectoryHandle(sub, { create: true });
      }
    }

    if (folder === 'DIVERSOS') {
      const subFolders = [
        'CARTAS ASSEMBLEIAS',
        'PROGRAMAÇÕES',
        'CARTAS ESP',
        'CARTAS EMR-ANCIÃOS',
        'CARTAS EMR-SERVOS'
      ];
      for (const sub of subFolders) {
        await folderHandle.getDirectoryHandle(sub, { create: true });
      }
    }
  }

  return circuitHandle;
};
