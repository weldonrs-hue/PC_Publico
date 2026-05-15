import PizZip from 'pizzip';

/**
 * Extracts all tags from a docx file.
 * Supports tags in the format [TAG] and @TAG.
 */
export async function extractTagsFromDocx(file: File | ArrayBuffer): Promise<string[]> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const zip = new PizZip(arrayBuffer);
  const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
  
  const tags = new Set<string>();
  
  xmlFiles.forEach(xmlFile => {
    const xmlContent = xmlFile.asText();
    
    // Match [TAG]
    const bracketMatches = xmlContent.matchAll(/\[([A-Z0-9À-ÿ\_]+)\]/g);
    for (const match of bracketMatches) {
      tags.add(match[1].toUpperCase());
    }
    
    // Match @TAG (ignoring emails)
    // We look for @ followed by word characters, but not preceded by word characters (to avoid emails)
    const atMatches = xmlContent.matchAll(/(?:^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g);
    for (const match of atMatches) {
      const tag = match[1].toUpperCase();
      // Filter out common false positives and handle "ASSINATURA GLOBAL" case partially
      if (tag === 'ASSINATURA' && xmlContent.includes('@Assinatura Global')) {
          tags.add('ASSINATURA_GLOBAL');
      }
      tags.add(tag);
    }
  });
  
  return Array.from(tags);
}

/**
 * Validates if the document has the required tags.
 * Returns an array of missing tags.
 */
export function getMissingTags(extractedTags: string[], requiredTags: string[][]): string[] {
  const missingCategories: string[] = [];
  
  for (const aliases of requiredTags) {
    const hasAnyAlias = aliases.some(alias => extractedTags.includes(alias.toUpperCase()));
    if (!hasAnyAlias) {
      // Return the first alias as the "canonical" missing tag name
      missingCategories.push(aliases[0]);
    }
  }
  
  return missingCategories;
}

/**
 * Strips PSS specific metadata headers that shouldn't appear in the final document.
 */
export function cleanPSSMetadata(buffer: ArrayBuffer): ArrayBuffer {
  const zip = new PizZip(buffer);
  
  // PSS/ESP specific markers
  const titleMarkers = [
    "ESCOLA DO SERVIÇO DE PIONEIRO",
    "PIONEER SERVICE SCHOOL"
  ];

  let anyTitleFound = false;

  Object.keys(zip.files).forEach(fileName => {
    if (fileName.endsWith('.xml')) {
      const file = zip.file(fileName);
      if (!file) return;
      
      let content = file.asText();
      
      // Clear headers/footers as they often contain metadata that shouldn't be there
      if (fileName.includes('header') || fileName.includes('footer')) {
        const containsTitle = titleMarkers.some(m => content.toUpperCase().includes(m));
        if (!containsTitle) {
          content = content.replace(/<w:t[^>]*>.*?<\/w:t>/g, '<w:t></w:t>');
          zip.file(fileName, content);
          return;
        }
      }

      if (fileName === 'word/document.xml') {
        let titleFoundInDoc = false;
        content = content.replace(/<w:p(?: [^>]+)?>([\s\S]*?)<\/w:p>/g, (match, pContent) => {
          if (titleFoundInDoc) return match;
          
          const plainText = pContent.replace(/<[^>]+>/g, '').trim().toUpperCase();
          if (titleMarkers.some(marker => plainText.includes(marker))) {
            titleFoundInDoc = true;
            anyTitleFound = true;
            return match;
          }
          
          // Remove paragraphs before the title
          return '';
        });
        zip.file(fileName, content);
      } 
      
      // Secondary cleanup for known metadata terms if still needed
      const termsToRemoveRegex = [
          /Page\s*#\s*/gi,
          /English\s*Title:[\s\S]*?(?=<\/w:p>|$)/gi,
          /Publication:\s*Student\s*Assignments/gi,
          /Document:\s*PSS\s*assignment\s*letter[\w\d\_]*/gi,
          /PSS\s*assignment\s*letter/gi,
          /Student\s*Assignments/gi,
          /Publication:[\s\S]*?(?=<\/w:p>|$)/gi,
          /English\s*Title:[\s\S]*?(?=<\/w:p>|$)/gi
        ];

        let fileModified = false;
        content = content.replace(/<w:p(?: [^>]+)?>([\s\S]*?)<\/w:p>/g, (match, pContent) => {
          const plainText = pContent.replace(/<[^>]+>/g, '').replace(/[\s\u2000-\u200F\uFEFF]+/g, ' ').trim();
          if (!plainText) return match;

          let matchesAnyTerm = false;
          let remainingText = plainText;
          termsToRemoveRegex.forEach(regex => {
            if (regex.test(plainText)) {
              matchesAnyTerm = true;
              remainingText = remainingText.replace(regex, '').trim();
            }
          });

          const isJustJunk = remainingText.length === 0 || /^[:\-\s\.\(\)\#\u2000-\u200F\uFEFF]*$/.test(remainingText);
          if (matchesAnyTerm && isJustJunk) {
            fileModified = true;
            return '';
          }
          return match;
        });

        if (fileModified) {
          zip.file(fileName, content);
        }
      }
    });
  
  return zip.generate({ type: 'arraybuffer' });
}
