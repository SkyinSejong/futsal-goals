// Plan2.md 형식의 원본 타임스탬프 블록을 구조화된 골 데이터로 변환한다.
//
// 사용법:
//   node parse.mjs <videoUrl> <rawFile> [--title "제목"] [--date YYYY-MM-DD]
//
// 동작:
//   1) raw/<videoId>.txt 로 원본을 보관
//   2) data.js 의 window.DATA.videos 에 항목을 추가/갱신 (videoId 기준 upsert)
//
// 파싱 규칙 (Plan2.md 기준, 사용자 확정 사항 반영):
//   - "(안보임)" 접두어는 카메라가 못 따라갔을 뿐 득점은 인정 -> hidden=true 로만 표시
//   - 접두어 제거 후 남은 텍스트가 "???" 이면 득점자 미상 -> player="???"
//   - 남은 텍스트가 공백 없는 단일 토큰이면 선수 이름으로 인정
//   - 그 외(다중 토큰: "경기 시작 7v7 (1)", "이사 vlog", "박승민 스페셜" 등)는 통계 제외

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));

const UNKNOWN = "???";
const TS_RE = /^(\d{1,2}):(\d{2}):(\d{2})\s+(.+?)\s*$/;
const HIDDEN_RE = /^\(안보임\)\s*/;

export function extractVideoId(url) {
  const m =
    url.match(/[?&]v=([\w-]{11})/) ||
    url.match(/youtu\.be\/([\w-]{11})/) ||
    url.match(/\/embed\/([\w-]{11})/);
  if (!m) throw new Error(`유튜브 영상 ID를 찾을 수 없습니다: ${url}`);
  return m[1];
}

export function toSeconds(h, m, s) {
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

// 한 줄을 골 객체로 변환한다. 통계 제외 대상이면 null 을 반환한다.
export function parseLine(line) {
  const m = line.trim().match(TS_RE);
  if (!m) return null;
  const [, hh, mm, ss, rawLabel] = m;

  let label = rawLabel.trim();
  let hidden = false;
  if (HIDDEN_RE.test(label)) {
    hidden = true;
    label = label.replace(HIDDEN_RE, "").trim();
  }

  let player;
  if (label === UNKNOWN) {
    player = UNKNOWN;
  } else if (label.length > 0 && !/\s/.test(label)) {
    player = label; // 공백 없는 단일 토큰만 선수 이름으로 인정
  } else {
    return null; // 다중 토큰 -> 통계 제외 (구간 표시, 스페셜 등)
  }

  const ts = `${hh.padStart(2, "0")}:${mm}:${ss}`;
  return { t: toSeconds(hh, mm, ss), ts, player, hidden };
}

export function parseRaw(rawText) {
  return rawText
    .split(/\r?\n/)
    .map(parseLine)
    .filter(Boolean)
    .sort((a, b) => a.t - b.t);
}

function loadData(dataPath) {
  if (!existsSync(dataPath)) return { videos: [] };
  const src = readFileSync(dataPath, "utf8");
  const m = src.match(/window\.DATA\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!m) throw new Error("data.js 형식을 해석할 수 없습니다.");
  return JSON.parse(m[1]);
}

function saveData(dataPath, data) {
  data.videos.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const banner =
    "// 이 파일은 parse.mjs 가 생성/갱신한다. 직접 편집하지 말 것.\n";
  writeFileSync(dataPath, banner + "window.DATA = " + JSON.stringify(data, null, 2) + ";\n", "utf8");
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('사용법: node parse.mjs <videoUrl> <rawFile> [--title "제목"] [--date YYYY-MM-DD]');
    process.exit(1);
  }
  const [url, rawFile] = args;
  const titleIdx = args.indexOf("--title");
  const dateIdx = args.indexOf("--date");
  const title = titleIdx > -1 ? args[titleIdx + 1] : null;
  const date = dateIdx > -1 ? args[dateIdx + 1] : new Date().toISOString().slice(0, 10);

  const videoId = extractVideoId(url);
  const rawText = readFileSync(rawFile, "utf8");
  const goals = parseRaw(rawText);

  const rawDir = join(ROOT, "raw");
  if (!existsSync(rawDir)) mkdirSync(rawDir, { recursive: true });
  writeFileSync(join(rawDir, `${videoId}.txt`), rawText, "utf8");

  const dataPath = join(ROOT, "data.js");
  const data = loadData(dataPath);
  const entry = {
    id: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: title || `정기전 (${videoId})`,
    date,
    goals,
  };
  const i = data.videos.findIndex((v) => v.id === videoId);
  if (i > -1) data.videos[i] = { ...data.videos[i], ...entry };
  else data.videos.push(entry);

  saveData(dataPath, data);

  const identified = goals.filter((g) => g.player !== UNKNOWN).length;
  console.log(`완료: ${videoId} — 식별 골 ${identified}, 미상 ${goals.length - identified}, 총 ${goals.length}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("parse.mjs")) {
  main();
}
