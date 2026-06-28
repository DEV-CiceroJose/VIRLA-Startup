// src/utils/dateUtils.js

/**
 * Exact age in full years: subtract one year if this year's birthday has not occurred yet.
 */
export function calculateAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function formatDateBR(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  // O 'UTC' garante que a data não mude por causa do fuso horário
  return date.toLocaleDateString("pt-BR", { timeZone: 'UTC' });
}