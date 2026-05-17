# 풋살 골 모음

풋살 유튜브 채널의 모든 골 장면을 선수별로 필터링하여 탐색하는 정적 사이트입니다.
GitHub Pages 로 무료 호스팅하며, 서버가 필요 없습니다.

## 구성

| 파일 | 역할 |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | 사이트 본체 (라이트 테마 UI) |
| `data.js` | 구조화된 골 데이터 (parse.mjs 가 생성/갱신, 직접 편집 금지) |
| `raw/<videoId>.txt` | 영상별 원본 타임스탬프 (재현성 보관) |
| `parse.mjs` | 원본 타임스탬프 → data.js 변환 스크립트 (Node 18+) |

## 새 영상 추가하는 법

1. 영상의 타임스탬프 블록을 `raw/<videoId>.txt` 로 저장한다. (Plan2.md 와 같은 형식)
2. 아래 명령을 실행한다.

   ```
   node parse.mjs "https://www.youtube.com/watch?v=영상ID" "raw/영상ID.txt" --title "경기 제목" --date 2026-05-17
   ```

3. `data.js` 가 갱신되면 커밋/푸시한다. GitHub Pages 가 자동 배포한다.

   ```
   git add -A && git commit -m "데이터 추가: 영상ID" && git push
   ```

같은 영상 ID 로 다시 실행하면 해당 영상 데이터가 덮어써집니다(중복 추가 아님).

## 파싱 규칙

- `(안보임) 이름` : 카메라가 못 따라갔을 뿐 득점 인정. "안보임" 표시만 붙음
- `(안보임) ???` / `???` : 득점자 미상. `???` 항목으로 별도 집계되며 필터에도 노출
- 이름 뒤에 단어가 붙으면(예: `박승민 스페셜`) 통계 제외
- 다중 토큰 문구(`경기 시작 7v7 (1)`, `이사 vlog`, `경기 종료` 등) 통계 제외

## 로컬 미리보기

데이터/필터/순위는 `index.html` 을 그냥 열어도 보이지만, **유튜브 영상 재생은 반드시
`http://localhost` 로 열어야 합니다.** `file://` 로 열면 페이지 origin 이 `null` 이라
유튜브가 임베드를 거부해 "오류 153" 이 납니다. (GitHub Pages 는 https 라 정상 동작합니다.)

```
cd "futsal-goals"
node serve.mjs            # 기본 포트 8080
```

브라우저에서 `http://localhost:8080` 접속. 종료는 Ctrl+C.

## GitHub Pages 배포

저장소 Settings → Pages → Source 를 `main` 브랜치 루트로 지정하면
`https://<계정>.github.io/<저장소명>/` 에서 공개됩니다.
