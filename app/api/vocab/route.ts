import { NextRequest, NextResponse } from 'next/server'
import {
  addVocabEntry,
  deleteVocabEntry,
  isVocabDbEnabled,
  listVocabEntries,
} from '@/lib/vocabDb'

export async function GET() {
  if (!isVocabDbEnabled()) {
    return NextResponse.json({
      entries: [],
      warning: 'DATABASE_URL이 설정되어 있지 않아 단어장을 사용할 수 없습니다.',
    })
  }
  const entries = await listVocabEntries()
  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  if (!isVocabDbEnabled()) {
    return NextResponse.json(
      { error: 'DATABASE_URL이 설정되어 있지 않아 단어장에 저장할 수 없습니다' },
      { status: 400 }
    )
  }

  const body = await req.json().catch(() => null)
  const id = body?.id
  const surface = body?.surface

  if (typeof id !== 'string' || typeof surface !== 'string' || !surface.trim()) {
    return NextResponse.json(
      { error: 'id, surface가 필요합니다' },
      { status: 400 }
    )
  }

  try {
    const entry = await addVocabEntry({
      id,
      surface,
      reading: typeof body?.reading === 'string' ? body.reading : undefined,
      pos: typeof body?.pos === 'string' ? body.pos : undefined,
      baseForm: typeof body?.baseForm === 'string' ? body.baseForm : undefined,
      meaningKo: typeof body?.meaningKo === 'string' ? body.meaningKo : undefined,
      youtubeId: typeof body?.youtubeId === 'string' ? body.youtubeId : undefined,
      videoTitle: typeof body?.videoTitle === 'string' ? body.videoTitle : undefined,
      segmentText: typeof body?.segmentText === 'string' ? body.segmentText : undefined,
      segmentStartSec:
        typeof body?.segmentStartSec === 'number' ? body.segmentStartSec : undefined,
    })
    return NextResponse.json({ entry })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: '단어장 저장에 실패했습니다' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!isVocabDbEnabled()) {
    return NextResponse.json(
      { error: 'DATABASE_URL이 설정되어 있지 않아 단어장에서 삭제할 수 없습니다' },
      { status: 400 }
    )
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id 파라미터가 필요합니다' }, { status: 400 })
  }

  try {
    await deleteVocabEntry(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: '단어장 삭제에 실패했습니다' }, { status: 500 })
  }
}
