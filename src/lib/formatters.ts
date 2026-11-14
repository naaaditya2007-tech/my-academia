/**
 * Converts ALL CAPS or messy academic strings into clean, elegant Title Case
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  
  // Specific course acronyms & roman numerals to preserve uppercase
  const acronyms = new Set(['DSA', 'OS', 'COA', 'APP', 'AI', 'ML', 'UHV', 'UHV-II', 'II', 'III', 'IV', 'V', 'VI', 'PDE', 'MIPS', 'CPU', 'TP', 'UB']);
  const lowerWords = new Set(['and', 'or', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'a', 'an', 'by']);

  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      // Clean punctuation
      const cleanWord = word.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
      if (acronyms.has(cleanWord)) {
        return word.toUpperCase();
      }

      if (index > 0 && lowerWords.has(word)) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\bUhv-Ii\b/g, 'UHV-II')
    .replace(/\bIi\b/g, 'II')
    .replace(/\bIii\b/g, 'III');
}

/**
 * Accurately formats percentage to 1 decimal place with tabular figures
 */
export function formatPercentage(attended: number, conducted: number): string {
  if (conducted === 0) return '100.0%';
  return `${((attended / conducted) * 100).toFixed(1)}%`;
}
