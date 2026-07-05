# 일본어 쉐도잉 학습 웹앱 설계 문서

틱재팬(TIC Japan) 스타일의 유튜브 기반 일본어 쉐도잉 학습 PWA.

## 1. 개요 및 핵심 기능

- 유튜브 영상 URL을 등록하면 자막을 자동 추출해 문장 단위 구간으로 분할
- 각 구간에 대해 일본어 원문(후리가나 포함) + 한국어 번역 자동 생성
- 영상 재생 컨트롤: 이전 구간 / 다음 구간 / 다시 재생 / 구간 반복(loop)
- 구간별 일본어/한국어 텍스트를 각각 독립적으로 블라인드(가리기) 처리
- 구간 단위 북마크 저장 및 북마크 모음 화면
- AI(OpenAI ChatGPT API)를 이용한 구간별 문장 분석: 문법 설명, 단어별 품사/사전형/뜻 분해, JLPT 난이도, 뉘앙스/문화적 맥락 설명

## 2. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js 14 (App Router) + TypeScript | 프론트+백엔드(API Route)를 한 프로젝트에서 처리, PWA 전환 용이 |
| 스타일 | Tailwind CSS | 빠른 UI 개발 |
| 영상 재생 | YouTube IFrame Player API | 다운로드 없이 스트리밍 재생, seek/구간반복 제어 가능 (ToS 준수 필수) |
| 자막 추출 | `youtubei.js` (또는 timedtext 엔드포인트 파싱) | 유튜브 자동/수동 자막을 타임스탬프와 함께 서버에서 추출 (CORS 때문에 클라이언트 직접 호출 불가 → API Route에서 처리) |
| 후리가나 생성 | `kuromoji.js` + `kuroshiro` | 일본어 형태소 분석 후 한자에 읽기(furigana) 부여. 사전 로딩이 무거우므로 서버(API Route)에서 처리 후 캐싱 |
| 한국어 번역 | 네이버 Papago Translation API (NCP) | 문장 단위 REST 호출(배치 미지원)이라 동시 요청 수를 제한해 병렬 처리. 하루 10,000자 무료. 키 없으면 번역만 건너뛰고 나머지는 정상 동작 |
| 문장 분석 | OpenAI ChatGPT API | 문법/단어분해/JLPT/문화적 맥락을 구조화된 JSON으로 생성. 영상 등록 시 서버에서 구간을 배치로 묶어 호출 |
| 로컬 저장 | IndexedDB (Dexie.js) | 로그인 없는 MVP 단계에서 영상/구간/북마크를 기기에 저장 |
| 배포 | Vercel | Next.js와 궁합, PWA 매니페스트+서비스워커 추가로 앱처럼 설치 가능 |

> MVP는 로그인 없이 로컬(IndexedDB) 저장으로 시작하고, 이후 계정 기능이 필요해지면 Supabase 등으로 클라우드 동기화를 추가하는 순서를 권장합니다.

## 3. 데이터 모델

```ts
// 영상
type Video = {
  id: string              // 내부 uuid
  youtubeId: string       // 유튜브 videoId
  title: string
  channelTitle: string
  thumbnailUrl: string
  durationSec: number
  createdAt: string
}

// 구간(문장 단위)
type Segment = {
  id: string
  videoId: string
  order: number
  startSec: number
  endSec: number
  textJa: string           // 일본어 원문
  furigana: FuriganaToken[] // 렌더링용 토큰 배열
  textKo: string           // 한국어 번역
}

type FuriganaToken = {
  surface: string   // 화면에 보일 글자 (한자 포함 가능)
  reading?: string  // 한자일 때만 존재, <ruby>surface<rt>reading</rt></ruby> 로 렌더링
}

// 구간별 AI 문장 분석 결과 (OpenAI ChatGPT API로 생성, Segment에 1:1 귀속)
type SentenceAnalysis = {
  segmentId: string
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  grammarPoints: {
    pattern: string        // 예: "〜ことにする"
    explanation: string    // 한국어로 된 문법 설명
  }[]
  words: {
    surface: string        // 문장에 등장한 형태
    dictionaryForm: string // 사전형(기본형)
    reading: string        // 히라가나 읽기
    partOfSpeech: string   // 품사 (명사/동사/조사 등)
    meaningKo: string      // 한국어 뜻
  }[]
  culturalNote?: string    // 뉘앙스, 회화체, 문화적 맥락 설명
}

// 북마크
type Bookmark = {
  id: string
  videoId: string
  segmentId: string
  memo?: string
  createdAt: string
}

// 사용자 설정
type Settings = {
  defaultPlaybackRate: number   // 0.75, 1.0 등
  showFurigana: boolean
  blindJa: boolean
  blindKo: boolean
}
```

## 4. 화면 구조 및 플로우

```
[홈: 영상 목록]
   ├─ 유튜브 URL 추가 → [영상 처리 화면] (자막 추출 → 후리가나/번역 생성 → AI 문장 분석, 단계별 진행률) → 완료 시 학습 화면으로 이동
   ├─ 기존 영상 카드 탭 → [쉐도잉 학습 화면]
   └─ 북마크 탭 → [북마크 목록 화면] → 항목 탭 시 해당 영상의 해당 구간으로 [쉐도잉 학습 화면] 진입

[쉐도잉 학습 화면] (메인 화면)
   ├─ 상단: 유튜브 플레이어 (embed, 16:9)
   ├─ 재생 컨트롤 바
   │    [이전 구간] [다시 재생] [다음 구간] [구간반복 토글] [배속 선택]
   ├─ 구간 리스트 (세로 스크롤, 현재 재생 중인 구간 하이라이트 + 자동 스크롤)
   │    각 구간 카드:
   │      - 일본어 문장 (후리가나 <ruby> 표시) — [블라인드 토글: 일본어]
   │      - 한국어 번역                       — [블라인드 토글: 한국어]
   │      - [북마크 버튼] [AI 분석 펼치기 ▾]
   │      - (펼침) JLPT 태그 · 문법 포인트 · 단어별 품사/사전형/뜻 · 뉘앙스/문화적 맥락
   └─ 상단 우측: 전체 일본어 블라인드 / 전체 한국어 블라인드 스위치 (구간별 개별 토글과 별개로 전체 일괄 제어)

[설정 화면]
   - 기본 배속, 후리가나 표시 여부, 폰트 크기
```

## 5. 핵심 기능 상세

### 5.1 구간 반복(Loop)
- 각 구간은 `startSec` ~ `endSec`을 가짐
- "구간반복" 토글 On 시: YouTube Player의 `onStateChange`에서 현재시간이 `endSec`을 넘으면 `seekTo(startSec)` 재호출 → 무한 반복
- "다시 재생": 현재 구간의 `startSec`으로 seek 후 재생
- "이전/다음 구간": `order` 기준으로 인접 구간의 `startSec`으로 이동, 재생 상태 유지

### 5.2 후리가나 표시
- 서버에서 `kuromoji`로 형태소 분석 → 각 토큰이 한자를 포함하면 `kuroshiro`로 읽기 추출
- 클라이언트에서는 `FuriganaToken[]`을 순회하며 한자 토큰만 `<ruby>{surface}<rt>{reading}</rt></ruby>`로, 나머지는 일반 텍스트로 렌더링

### 5.3 블라인드(가리기) 기능
- 구간 카드 내 일본어/한국어 텍스트 각각에 blur 또는 마스킹 오버레이 적용
- 전역 스위치(전체 블라인드)와 구간별 개별 탭(그 구간만 보기) 두 단계로 제어
  - 전역 On 상태에서 특정 구간을 탭하면 해당 구간만 일시적으로 보이고, 다른 구간으로 스크롤/재생 넘어가면 다시 가려지는 UX 권장 (쉐도잉 훈련 목적에 부합)

### 5.4 북마크
- 구간 카드의 북마크 아이콘 클릭 → `Bookmark` 레코드 생성 (videoId + segmentId)
- 북마크 목록 화면에서 영상 썸네일 + 구간 텍스트 미리보기로 표시, 탭하면 해당 영상 해당 구간으로 이동 후 자동 재생

### 5.5 AI 구간별 문장 분석
- 영상 등록 시 전체 구간을 대상으로 서버에서 OpenAI ChatGPT API를 배치 호출해 `SentenceAnalysis`를 일괄 생성 (학습 중 대기시간 없음, 대신 등록 시간이 길어짐)
- 배치 방식: 한 번의 요청 컨텍스트가 너무 커지지 않도록 구간을 15~20개 단위로 묶어 여러 번 호출 (영상이 길 경우 API 응답 지연/출력 토큰 제한 방지)
- 출력 형식: `response_format: json_schema`(strict)로 `SentenceAnalysis[]` 스키마를 강제 → 파싱 실패 방지
- 비용 절감: 모든 배치 호출에 공통으로 들어가는 지시문(분석 스키마 설명, 출력 규칙, few-shot 예시)은 system 메시지로 분리해 OpenAI의 자동 프롬프트 캐싱 혜택을 받도록 함
- UI: 기본은 접힌 상태로 표시(문장이 빽빽해 보이지 않도록), 사용자가 펼치면 문법 포인트 → 단어 분해 → 문화적 맥락 순으로 표시
- 실패 처리: 특정 배치 호출이 실패해도 해당 구간들은 `SentenceAnalysis` 없이 두고 자막/번역/후리가나는 정상 노출 (AI 분석은 부가 기능이므로 핵심 학습 흐름을 막지 않음)

## 6. 자막→구간 생성 파이프라인 (영상 추가 시)

1. 사용자가 유튜브 URL 입력 → videoId 추출
2. 서버 API Route: `youtubei.js`로 영상 메타데이터(제목/채널/길이/썸네일) + 자막 트랙(ja) 타임스탬프 목록 가져오기
3. 자막 항목을 문장 단위 `Segment` 후보로 변환 (자막이 이미 문장 단위가 아니면 구두점 기준 병합/분할 로직 필요). 문장부호가 드물어 한 문장이 지나치게 길어지는 경우(45자 또는 12초 초과) 중간에 가까운 쉼표를 기준으로 최대 2개 구간까지만 나눔 (쉼표가 없으면 글자 수 중간 지점에서 분할, 시간은 글자 위치 비율로 선형 보간)
4. 각 `Segment.textJa`를 kuromoji/kuroshiro에 통과시켜 `FuriganaToken[]` 생성
5. 각 `Segment.textJa`를 번역 API에 보내 `textKo` 생성
6. 전체 구간을 배치로 묶어 OpenAI ChatGPT API에 전달, 구간별 `SentenceAnalysis`(문법/단어분해/JLPT/문화적 맥락) 생성
7. 결과를 IndexedDB에 저장, 학습 화면으로 이동

> 주의: 자동 자막(ASR)만 있는 영상은 문장 구분/정확도가 떨어질 수 있음 → MVP 이후 "구간 수동 편집" 화면 추가를 권장 (사용자가 이미 자동생성 방식을 선택했으므로 1차 릴리스는 자동 파이프라인 결과를 그대로 사용하고, 편집 기능은 다음 단계 로드맵으로 분리)

## 7. 폴더 구조 제안

```
study_japan/
├─ app/
│  ├─ page.tsx                 # 홈(영상 목록)
│  ├─ videos/[id]/page.tsx     # 쉐도잉 학습 화면
│  ├─ bookmarks/page.tsx       # 북마크 목록
│  ├─ settings/page.tsx
│  └─ api/
│     ├─ transcript/route.ts   # 유튜브 자막 추출
│     ├─ furigana/route.ts     # 후리가나 생성
│     ├─ translate/route.ts    # 번역
│     └─ analyze/route.ts      # OpenAI ChatGPT API 구간별 문장 분석 (배치)
├─ components/
│  ├─ player/YoutubePlayer.tsx
│  ├─ player/PlaybackControls.tsx
│  ├─ segment/SegmentList.tsx
│  ├─ segment/SegmentCard.tsx
│  ├─ segment/FuriganaText.tsx
│  └─ segment/AnalysisPanel.tsx  # 펼침형 AI 분석 표시
├─ lib/
│  ├─ db.ts                    # Dexie(IndexedDB) 설정
│  ├─ youtube.ts
│  ├─ furigana.ts
│  ├─ translate.ts              # Papago 번역 호출 (동시 요청 제한 처리)
│  └─ types.ts
└─ public/
   └─ manifest.json            # PWA 매니페스트
```

## 8. MVP 로드맵

- v0.1: 영상 등록(자막+후리가나+번역 자동 파이프라인) + 쉐도잉 학습 화면(재생/구간이동/반복) + 로컬 저장
- v0.2: 블라인드 기능(전역/구간별), 북마크 저장 및 목록 화면
- v0.3: AI 구간별 문장 분석(OpenAI ChatGPT API 배치 호출 + 펼침형 UI)
- v0.4: PWA 매니페스트/서비스워커로 홈 화면 설치 지원, 설정 화면
- v1.0 이후: 구간 수동 편집 UI, 계정+클라우드 동기화, 자동 자막 품질 낮은 영상 대응
