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
