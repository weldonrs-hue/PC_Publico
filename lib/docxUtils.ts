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
      /PSS\s*assignment\s*letter/gi,
      /Student\s*Assignments/gi,
      /Publication:\s*/gi,
      /English\s*Title:\s*/gi
    ];

    // 1. First, search for paragraphs that contain these terms and clear them if they don't have other valuable text
    const paragraphRegex = /<w:p(?: [^>]+)?>([\s\S]*?)<\/w:p>/g;
    content = content.replace(paragraphRegex, (match, pContent) => {
      // Get plain text from paragraph content
      const plainText = pContent.replace(/<[^>]+>/g, '')
                                .replace(/[\s\u2000-\u200F\uFEFF]+/g, ' ')
                                .trim();
      
      if (!plainText) return match; // Already empty or just tags

      let matchesAnyTerm = false;
      let onlyContainsTerms = true;
      
      // Check if it matches any term and if it contains ONLY those terms
      let remainingText = plainText;
      termsToRemoveRegex.forEach(regex => {
        if (regex.test(plainText)) {
          matchesAnyTerm = true;
          remainingText = remainingText.replace(regex, '').trim();
        }
      });

      // If it contains any of the terms and the remaining text is empty or just punctuation/junk/whitespace
      // This is now more aggressive to catch cases like "   Page #" or "Document: PSS..."
      if (matchesAnyTerm && (remainingText.length === 0 || /^[:\-\s\.\(\)\#\u2000-\u200F\uFEFF]*$/.test(remainingText))) {
        fileModified = true;
        anyModified = true;
        return ''; // Remove the whole paragraph
      }

      return match;
    });

    // 2. Surgical cleaning of individual text nodes (in case they are mixed with real content)
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
        const spaceAttr = fullMatch.includes('xml:space="preserve"') ? ' xml:space="preserve"' : '';
        return `<w:${tagName}${spaceAttr}>${newText}</w:${tagName}>`;
      }
      return fullMatch;
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
