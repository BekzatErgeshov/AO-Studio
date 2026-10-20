// Автопроверка ответа — та же логика, что на сервере (backend/game/live.py)

export function normalizeAnswer(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Совпадает ли ответ с правильным: без учёта регистра, «ё», знаков препинания.
 * Правильный ответ может содержать варианты через «/», «;», «,», скобки или «или».
 */
export function checkAnswer(given: string, correct: string): boolean {
  const g = normalizeAnswer(given)
  if (!g) return false
  // «или» как отдельное слово (в JS \b не понимает кириллицу)
  const variants = [correct, ...correct.split(/\/|;|,|\(|\)|(?<![\p{L}\p{N}])или(?![\p{L}\p{N}])/iu)]
  return variants.some((v) => {
    const n = normalizeAnswer(v)
    return n !== '' && n === g
  })
}
