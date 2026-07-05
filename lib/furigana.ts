import kuromoji from 'kuromoji'
import path from 'node:path'
import type { FuriganaToken } from './types'

type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>

let tokenizerPromise: Promise<Tokenizer> | null = null

function getTokenizer(): Promise<Tokenizer> {
  if (!tokenizerPromise) {
    const dicPath = path.join(process.cwd(), 'node_modules/kuromoji/dict')
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err) reject(err)
        else resolve(tokenizer)
      })
    })
  }
  return tokenizerPromise
}

const KANJI_RE = /[一-鿿]/

function katakanaToHiragana(str: string): string {
  return str.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

export async function toFuriganaTokens(text: string): Promise<FuriganaToken[]> {
  const tokenizer = await getTokenizer()
  const tokens = tokenizer.tokenize(text)

  return tokens.map((token) => {
    const surface = token.surface_form
    if (KANJI_RE.test(surface) && token.reading) {
      const reading = katakanaToHiragana(token.reading)
      if (reading !== surface) {
        return { surface, reading }
      }
    }
    return { surface }
  })
}

const POS_KO_MAP: Record<string, string> = {
  '名詞': '명사',
  '動詞': '동사',
  '形容詞': '형용사',
  '形容動詞': '형용동사',
  '副詞': '부사',
  '助詞': '조사',
  '助動詞': '조동사',
  '連体詞': '연체사',
  '接続詞': '접속사',
  '感動詞': '감탄사',
  '記号': '기호',
  '接頭詞': '접두사',
  'フィラー': '간투사',
  'その他': '기타',
}

export type AnalyzedToken = {
  surface: string
  reading?: string
  pos: string
  baseForm?: string
}

/** 선택한 일본어 텍스트를 형태소 단위로 분석 (사전형/품사/읽기) */
export async function analyzeTokens(text: string): Promise<AnalyzedToken[]> {
  const tokenizer = await getTokenizer()
  const tokens = tokenizer.tokenize(text)

  return tokens.map((token) => {
    const surface = token.surface_form
    const reading = token.reading ? katakanaToHiragana(token.reading) : undefined
    const baseForm =
      token.basic_form && token.basic_form !== '*' ? token.basic_form : undefined

    return {
      surface,
      reading: reading && reading !== surface ? reading : undefined,
      pos: POS_KO_MAP[token.pos] ?? token.pos,
      baseForm: baseForm && baseForm !== surface ? baseForm : undefined,
    }
  })
}
