// Автопроверка ответа — та же логика, что на сервере (backend/game/live.py)

export function normalizeAnswer(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Разбивает один ответ на варианты: «/», «;», «,», скобки и «или» отдельным словом */
function variantsOf(answer: string): string[] {
  // «или» как отдельное слово (в JS \b не понимает кириллицу)
  return [answer, ...answer.split(/\/|;|,|\(|\)|(?<![\p{L}\p{N}])или(?![\p{L}\p{N}])/iu)]
}

/**
 * Совпадает ли ответ с правильным: без учёта регистра, «ё», знаков препинания.
 *
 * Засчитываются основной ответ, дополнительные формулировки из `altAnswers` и варианты,
 * перечисленные прямо в тексте ответа через «/», «;», «,», скобки или «или».
 */
export function checkAnswer(given: string, correct: string, altAnswers: string[] = []): boolean {
  const g = normalizeAnswer(given)
  if (!g) return false
  return [correct, ...altAnswers]
    .filter(Boolean)
    .flatMap(variantsOf)
    .some((v) => {
      const n = normalizeAnswer(v)
      return n !== '' && n === g
    })
}
