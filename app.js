"use strict";

// data.js 가 window.DATA 를 제공한다. { videos: [{ id, url, title, date, goals:[{t,ts,player,hidden}] }] }
(function () {
  const UNKNOWN = "???";
  const data = window.DATA || { videos: [] };
  const videos = [...data.videos].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0
  );

  // 선택된 선수 집합 (비어 있으면 전체)
  const selected = new Set();

  // 선수별 골 수 집계
  const tally = new Map();
  for (const v of videos) {
    for (const g of v.goals) {
      tally.set(g.player, (tally.get(g.player) || 0) + 1);
    }
  }
  const allGoals = videos.reduce((n, v) => n + v.goals.length, 0);
  const unknownGoals = tally.get(UNKNOWN) || 0;

  // 정렬: 골 많은 순, 미상은 항상 맨 끝
  const players = [...tally.entries()].sort((a, b) => {
    if (a[0] === UNKNOWN) return 1;
    if (b[0] === UNKNOWN) return -1;
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], "ko");
  });
  const maxGoals = players.reduce(
    (m, [p, c]) => (p === UNKNOWN ? m : Math.max(m, c)),
    1
  );

  const $ = (id) => document.getElementById(id);
  const labelOf = (p) => (p === UNKNOWN ? "미상(???)" : p);

  // ---- 페이지 내 유튜브 플레이어 ----
  // IFrame API 는 file:// 에서 origin 이 null 이라 동작하지 않는다.
  // iframe src 를 직접 교체하는 방식은 로컬·배포 모두 확실히 동작한다.
  const playerEl = $("player");

  const placeholderEl = $("playerPlaceholder");

  function embedUrl(id, t) {
    const p = new URLSearchParams({
      rel: "0",
      playsinline: "1",
      modestbranding: "1",
      autoplay: "1",
    });
    if (t > 0) p.set("start", String(Math.floor(t)));
    return `https://www.youtube-nocookie.com/embed/${id}?${p}`;
  }

  // 어떤 영상도 미리 고정하지 않는다. 골을 클릭해야만 그 영상을 로드한다.
  function playGoal(video, t, label) {
    $("npTitle").textContent = video.title;
    $("npGoal").textContent = label || "";
    if (placeholderEl) placeholderEl.hidden = true;
    playerEl.src = embedUrl(video.id, t);
    document.querySelector(".player-dock").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  // ---- 상단 통계 ----
  function renderStats() {
    const cards = [
      ["영상", videos.length],
      ["전체 골", allGoals],
      ["식별 골", allGoals - unknownGoals],
      ["미상", unknownGoals],
    ];
    $("stats").innerHTML = cards
      .map(
        ([lbl, num]) =>
          `<div class="stat"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`
      )
      .join("");
  }

  // ---- 선수 필터 칩 ----
  function renderChips() {
    const q = $("playerSearch").value.trim().toLowerCase();
    const frag = document.createDocumentFragment();
    for (const [p, count] of players) {
      if (q && !labelOf(p).toLowerCase().includes(q)) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "chip" +
        (selected.has(p) ? " active" : "") +
        (p === UNKNOWN ? " unknown" : "");
      btn.innerHTML = `<span>${labelOf(p)}</span><span class="c-count">${count}</span>`;
      btn.addEventListener("click", () => toggle(p));
      frag.appendChild(btn);
    }
    const box = $("playerChips");
    box.innerHTML = "";
    box.appendChild(frag);
  }

  // ---- 득점 순위 ----
  function renderLeaderboard() {
    const box = $("leaderboard");
    box.innerHTML = "";
    players.forEach(([p, count], i) => {
      const li = document.createElement("li");
      li.className = "lb-row" + (p === UNKNOWN ? " unknown" : "");
      const pct = p === UNKNOWN ? 100 : Math.round((count / maxGoals) * 100);
      const rank = p === UNKNOWN ? "-" : i + 1;
      li.innerHTML =
        `<div class="lb-top">` +
        `<span class="lb-name"><span class="rank">${rank}</span>${labelOf(p)}</span>` +
        `<span class="lb-goals">${count}</span></div>` +
        `<div class="lb-bar"><div class="lb-fill" style="width:${pct}%"></div></div>`;
      li.addEventListener("click", () => toggle(p));
      box.appendChild(li);
    });
  }

  // ---- 골 목록 ----
  function renderList() {
    const box = $("goalList");
    box.innerHTML = "";
    let shown = 0;

    for (const v of videos) {
      const goals = v.goals
        .filter((g) => selected.size === 0 || selected.has(g.player))
        .sort((a, b) => a.t - b.t);
      if (goals.length === 0) continue;
      shown += goals.length;

      const group = document.createElement("section");
      group.className = "video-group";

      const head = document.createElement("div");
      head.className = "vg-head";
      head.innerHTML =
        `<div><div class="vg-title">${v.title}</div>` +
        `<div class="vg-meta">${v.date} · 골 ${goals.length}</div></div>` +
        `<button type="button" class="vg-open">처음부터 재생</button>`;
      head
        .querySelector(".vg-open")
        .addEventListener("click", () => playGoal(v, 0, "처음부터"));
      group.appendChild(head);

      for (const g of goals) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "goal-row";
        const isUnknown = g.player === UNKNOWN;
        row.innerHTML =
          `<span class="time-badge">${g.ts}</span>` +
          `<span class="goal-player${isUnknown ? " unknown" : ""}">${labelOf(g.player)}</span>` +
          (g.hidden ? `<span class="tag-hidden">안보임</span>` : "") +
          `<span class="play-hint">재생 ›</span>`;
        row.addEventListener("click", () =>
          playGoal(v, g.t, `${labelOf(g.player)} · ${g.ts}`)
        );
        group.appendChild(row);
      }
      box.appendChild(group);
    }

    const names = [...selected].map(labelOf);
    $("resultTitle").textContent =
      selected.size === 0 ? "전체 골 장면" : `${names.join(", ")} 골 장면`;
    $("resultCount").textContent = `${shown}골`;
    $("emptyState").hidden = shown !== 0;
  }

  // ---- 상태 변경 ----
  function toggle(p) {
    if (selected.has(p)) selected.delete(p);
    else selected.add(p);
    renderChips();
    renderList();
  }

  function reset() {
    selected.clear();
    $("playerSearch").value = "";
    renderChips();
    renderList();
  }

  $("resetFilter").addEventListener("click", reset);
  $("playerSearch").addEventListener("input", renderChips);

  renderStats();
  renderChips();
  renderLeaderboard();
  renderList();
})();
