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
  const zip = new PizZip(buffer);
  
  const termsToRemove = [
    'Page #',
    'English Title:',
    'Publication: Student Assignments',
    'Document: PSS assignment letter'
  ];

  let anyModified = false;

  Object.keys(zip.files).forEach(fileName => {
    if (fileName.endsWith('.xml')) {
      const file = zip.file(fileName);
      if (!file) return;
      
      let content = file.asText();
      let fileModified = false;

    // 0. Build a list of regex patterns for surgical removal
    const termsToRemoveRegex = [
      /Page\s*#\s*/gi,
      /English\s*Title:\s*/gi,
      /Publication:\s*Student\s*Assignments/gi,
      /Document:\s*PSS\s*assignment\s*letter[\w\d\_]*/gi,
      /PSS\s*assignment\s*letter/gi
    ];

    // 1. Clean individual text nodes (w:t and w:instrText) surgically
    // This removes the terms even if they are mixed with other text in the same node
    const textNodeRegex = /<w:(t|instrText)(?: [^>]+)?>([^<]*)<\/w:\1>/g;
    content = content.replace(textNodeRegex, (fullMatch, tagName, textContent) => {
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
        // Keep xml:space="preserve" if it was there
        const spaceAttr = fullMatch.includes('xml:space="preserve"') ? ' xml:space="preserve"' : '';
        return `<w:${tagName}${spaceAttr}>${newText}</w:${tagName}>`;
      }
      return fullMatch;
    });

    // 2. Clean entire paragraphs only if they become empty or near-empty after text cleaning
    // This is safer than the previous aggressive paragraph removal
    const paragraphRegex = /<w:p(?: [^>]+)?>[\s\S]*?<\/w:p>/g;
    content = content.replace(paragraphRegex, (match) => {
      const textFromMatch = match.replace(/<[^>]+>/g, '').replace(/[\s\u2000-\u200F\uFEFF]+/g, ' ').trim();
      
      // If the paragraph text is ONLY one of these terms (now cleaned or partially cleaned)
      // or if it's completely empty, we can remove the whole paragraph block
      if (textFromMatch.length === 0) {
        fileModified = true;
        anyModified = true;
        return ''; 
      }
      
      return match;
    });

      // 3. Clean headers/footers explicitly by stripping specific patterns
      // (This part is already handled by the general .xml loop above)

      if (fileModified) {
        zip.file(fileName, content);
      }
    }
  });
  
  return zip.generate({ type: 'arraybuffer' });
}
