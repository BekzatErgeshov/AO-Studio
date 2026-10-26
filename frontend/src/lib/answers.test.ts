import { describe, expect, it } from 'vitest'
import { checkAnswer, normalizeAnswer } from './answers'

describe('normalizeAnswer', () => {
  it('приводит к нижнему регистру и заменяет «ё» на «е»', () => {
    expect(normalizeAnswer('Ёжик')).toBe('ежик')
    expect(normalizeAnswer('МАНАС')).toBe('манас')
  })

  it('выбрасывает знаки препинания и сжимает пробелы', () => {
    expect(normalizeAnswer('  Иссык-Куль!  ')).toBe('иссык куль')
    expect(normalizeAnswer('А.С. Пушкин')).toBe('а с пушкин')
  })

  it('оставляет буквы и цифры любого алфавита', () => {
    expect(normalizeAnswer('Windows 95')).toBe('windows 95')
    expect(normalizeAnswer('Айтматов')).toBe('айтматов')
  })

  it('пустое и мусорное значение превращает в пустую строку', () => {
    expect(normalizeAnswer('')).toBe('')
    expect(normalizeAnswer('   ')).toBe('')
    expect(normalizeAnswer('!!!')).toBe('')
    expect(normalizeAnswer(undefined as unknown as string)).toBe('')
  })
})

describe('checkAnswer', () => {
  it('принимает ответ без учёта регистра, «ё» и знаков', () => {
    expect(checkAnswer('манас', 'Манас')).toBe(true)
    expect(checkAnswer('Ёжик', 'ежик')).toBe(true)
    expect(checkAnswer('иссык куль', 'Иссык-Куль')).toBe(true)
    expect(checkAnswer('  Манас  ', 'Манас')).toBe(true)
  })

  it('не принимает неверный или пустой ответ', () => {
    expect(checkAnswer('Бишкек', 'Ош')).toBe(false)
    expect(checkAnswer('', 'Манас')).toBe(false)
    expect(checkAnswer('   ', 'Манас')).toBe(false)
    expect(checkAnswer('!!!', 'Манас')).toBe(false)
  })

  it('не принимает частичное совпадение — ответ сверяется целиком', () => {
    expect(checkAnswer('Манас', 'Манас Великодушный')).toBe(false)
    expect(checkAnswer('Манас Великодушный', 'Манас')).toBe(false)
  })

  describe('варианты правильного ответа', () => {
    it('через «/»', () => {
      expect(checkAnswer('Ош', 'Ош/Бишкек')).toBe(true)
      expect(checkAnswer('Бишкек', 'Ош/Бишкек')).toBe(true)
      expect(checkAnswer('Нарын', 'Ош/Бишкек')).toBe(false)
    })

    it('через «;» и «,»', () => {
      expect(checkAnswer('Бишкек', 'Ош; Бишкек')).toBe(true)
      expect(checkAnswer('Бишкек', 'Ош, Бишкек')).toBe(true)
    })

    it('через «или» как отдельное слово', () => {
      expect(checkAnswer('Фрунзе', 'Бишкек или Фрунзе')).toBe(true)
      expect(checkAnswer('Бишкек', 'Бишкек или Фрунзе')).toBe(true)
      expect(checkAnswer('ИЛИ', 'Бишкек или Фрунзе')).toBe(false)
    })

    it('«или» внутри слова вариантом не считается', () => {
      // «Молоко» не разрезается на «мол» и «ко» — вариант остаётся целым словом
      expect(checkAnswer('Молоко', 'Молоко')).toBe(true)
      expect(checkAnswer('мол', 'Молоко')).toBe(false)
    })

    it('в скобках', () => {
      expect(checkAnswer('Чингиз Айтматов', 'Айтматов (Чингиз Айтматов)')).toBe(true)
      expect(checkAnswer('Айтматов', 'Айтматов (Чингиз Айтматов)')).toBe(true)
    })

    it('правильный ответ целиком тоже подходит, даже если выглядит как список', () => {
      expect(checkAnswer('Ош Бишкек', 'Ош, Бишкек')).toBe(true)
    })
  })
})
