/**
 * Consulta o ViaCEP (https://viacep.com.br) e devolve { city, state } ou
 * null se o CEP for inválido/não encontrado ou a rede falhar. Nunca lança —
 * quem chama decide se avisa o usuário ou ignora silenciosamente.
 *
 * Usa fetch nativo (não services/api.js): é uma API pública de terceiros,
 * sem autenticação — não deve levar o Bearer token do Firebase.
 */
export async function lookupCep(cep) {
  const digits = String(cep ?? '').replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.erro) return null
    return { city: data.localidade ?? '', state: data.uf ?? '' }
  } catch {
    return null
  }
}
