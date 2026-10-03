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
      /English\s*Title\s*:/gi,
      /Publication\s*:\s*Student\s*Assignments/gi,
      /Document\s*:\s*PSS\s*assignment\s*letter/gi,
      /PSS\s*assignment\s*letter/gi,
      /Student\s*Assignments/gi
    ];

    let anyModified = false;
    let paragraphsRemoved = 0;
    let textNodesCleaned = 0;

    Object.keys(zip.files).forEach(fileName => {
      // ONLY clean content files (document, headers, footers)
      // Touching styles.xml, settings.xml etc. can corrupt the document layout
      if (fileName.match(/word\/(document|header\d*|footer\d*)\.xml/)) {
        const file = zip.file(fileName);
        if (!file) return;
        
        let content = file.asText();
        let fileModified = false;

        // 1. Paragraph cleaning (Safely clear text instead of removing tag)
        const paragraphRegex = /<w:p(?: [^>]+)?>([\s\S]*?)<\/w:p>/g;
        content = content.replace(paragraphRegex, (match, pContent) => {
          const plainText = pContent.replace(/<[^>]+>/g, '')
                                    .replace(/[\s\u2000-\u200F\uFEFF]+/g, ' ')
                                    .trim();
          
          if (!plainText) return match;

          let matchesAnyTerm = false;
          termsToRemoveRegex.forEach(regex => {
            if (regex.test(plainText)) {
              matchesAnyTerm = true;
            }
          });

          // Check if the entire paragraph is just the metadata
          const isMetadataOnly = termsToRemoveRegex.some(regex => {
             const clean = plainText.replace(regex, '').trim();
             // Allow for some minor punctuation or common template noise
             return clean.length === 0 || /^[:\-\s\.\#]*$/.test(clean);
          });
          
          if (matchesAnyTerm && isMetadataOnly) {
            fileModified = true;
            anyModified = true;
            paragraphsRemoved++;
            // Instead of returning '', we return a paragraph with empty text nodes 
            // to preserve structure (especially inside tables)
            // AND we ensure we don't break the XML if there are multiple tags
            return match.replace(/<w:t[^>]*>[\s\S]*?<\/w:t>/g, '<w:t></w:t>')
                        .replace(/<w:instrText[^>]*>[\s\S]*?<\/w:instrText>/g, '<w:instrText></w:instrText>');
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

/**
 * Extracts a readable error description from docxtemplater Multi error or standard errors.
 */
export function formatDocxError(error: any): string {
  if (error?.properties?.errors && Array.isArray(error.properties.errors)) {
    const errorDetails = error.properties.errors
      .map((e: any) => e.properties?.explanation || e.message)
      .filter(Boolean);
    if (errorDetails.length > 0) {
      return errorDetails.join('\n');
    }
  }
  return error?.message || 'Erro desconhecido ao processar modelo Word.';
}
