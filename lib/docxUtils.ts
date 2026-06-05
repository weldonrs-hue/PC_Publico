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
 * This version uses a safer approach by removing entire XML elements (paragraphs or runs)
 * that contain the target text, avoiding breaking the XML structure.
 */
export function cleanPSSMetadata(buffer: ArrayBuffer): ArrayBuffer {
  console.log('cleanPSSMetadata: starting processing, buffer size:', buffer.byteLength);
  try {
    if (!buffer || buffer.byteLength === 0) {
      console.error('cleanPSSMetadata: Received empty buffer');
      return buffer;
    }
    const zip = new PizZip(buffer);
    
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

    let anyModified = false;
    let paragraphsRemoved = 0;
    let textNodesCleaned = 0;

    Object.keys(zip.files).forEach(fileName => {
      if (fileName.endsWith('.xml')) {
        const file = zip.file(fileName);
        if (!file) return;
        
        let content = file.asText();
        let fileModified = false;

        // 1. Paragraph cleaning
        const paragraphRegex = /<w:p(?: [^>]+)?>([\s\S]*?)<\/w:p>/g;
        content = content.replace(paragraphRegex, (match, pContent) => {
          const plainText = pContent.replace(/<[^>]+>/g, '')
                                    .replace(/[\s\u2000-\u200F\uFEFF]+/g, ' ')
                                    .trim();
          
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
            anyModified = true;
            paragraphsRemoved++;
            return '';
          }

          return match;
        });

        // 2. Text node cleaning
        const textNodeRegex = /<w:(t|instrText)([^>]*)>([^<]*)<\/w:(t|instrText)>/g;
        content = content.replace(textNodeRegex, (fullMatch, tagName, attrs, textContent, endTagName) => {
          if (tagName !== endTagName) return fullMatch;
          
          let newText = textContent;
          let nodeModified = false;
          
          termsToRemoveRegex.forEach(regex => {
            if (regex.test(newText)) {
              newText = newText.replace(regex, '');
              nodeModified = true;
            }
          });

          if (nodeModified) {
            fileModified = true;
            anyModified = true;
            textNodesCleaned++;
            if (newText.trim() === '' && !attrs.includes('xml:space="preserve"')) {
               return '';
            }
            return `<w:${tagName}${attrs}>${newText}</w:${tagName}>`;
          }
          return fullMatch;
        });

        if (fileModified) {
          zip.file(fileName, content);
        }
      }
    });

    if (anyModified) {
      console.log(`cleanPSSMetadata: changes applied! Paragraphs removed: ${paragraphsRemoved}, text nodes cleaned: ${textNodesCleaned}`);
      return zip.generate({ type: 'arraybuffer' });
    }
    
    console.log('cleanPSSMetadata: no changes needed, document clean.');
    return buffer;
  } catch (err) {
    console.error('cleanPSSMetadata: CRITICAL ERROR processing document:', err);
    return buffer;
  }
}
