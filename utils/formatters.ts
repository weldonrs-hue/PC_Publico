/**
 * Formata um número de telefone brasileiro
 * Aceita 10 ou 11 dígitos
 */
export const formatBRPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

/**
 * Formata CEP (00000-000)
 */
export const formatCEP = (value: string): string => {
  const numbers = value.replace(/\D/g, '').slice(0, 8);
  if (numbers.length <= 5) return numbers;
  return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
};

/**
 * Formata Circuito (LL-NNN ou LLL-NN)
 * LL-NNN (ex: AB-123) ou LLL-NN (ex: ABC-12)
 */
export const formatCircuito = (value: string): string => {
  let cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5);
  
  if (cleaned.length <= 2) return cleaned;
  
  // Se o terceiro caractere for um número, o formato é LL-NNN
  if (/[0-9]/.test(cleaned[2])) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  }
  
  // Se o terceiro caractere for uma letra, o formato é LLL-NN (ou pelo menos começa com 3 letras)
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
};

/**
 * Valida email
 */
export const isValidEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};
