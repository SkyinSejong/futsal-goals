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

  // ---- 영상 선택 상태 ----
  // scope: null = 영상 목록 화면, "ALL" = 전체 영상 통합, 그 외 = 해당 영상 id
  let scope = null;
  const ALL = "ALL";

  function setScope(next) {
    scope = next;
    renderVideoNav();
    render();
    document.querySelector(".content-head").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  // ---- 사이드: 영상 선택 목록 ----
  function renderVideoNav() {
    const box = $("videoNav");
    box.innerHTML = "";
    const items = [
      { key: ALL, title: "전체 영상", meta: `골 ${allGoals}` },
      ...videos.map((v) => ({
        key: v.id,
        title: v.title,
        meta: `${v.date} · 골 ${v.goals.length}`,
      })),
    ];
    for (const it of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vn-item" + (scope === it.key ? " active" : "");
      btn.innerHTML =
        `<span class="vn-title">${it.title}</span>` +
        `<span class="vn-meta">${it.meta}</span>`;
      btn.addEventListener("click", () => setScope(it.key));
      box.appendChild(btn);
    }
  }

  // ---- 영상 목록 카드 (scope=null) ----
  function renderVideoGrid() {
    const box = $("videoGrid");
    box.innerHTML = "";
    for (const v of videos) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "video-card";
      card.innerHTML =
        `<span class="vc-title">${v.title}</span>` +
        `<span class="vc-meta">${v.date}</span>` +
        `<span class="vc-goals">골 ${v.goals.length}개</span>` +
        `<span class="vc-go">골 목록 보기 ›</span>`;
      card.addEventListener("click", () => setScope(v.id));
      box.appendChild(card);
    }
  }

  // ---- 골 목록 (scope=ALL 또는 특정 영상) ----
  function renderGoalGroups() {
    const box = $("goalList");
    box.innerHTML = "";
    const list = scope === ALL ? videos : videos.filter((v) => v.id === scope);
    let shown = 0;

    for (const v of list) {
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
    return shown;
  }

  // ---- 화면 렌더 분기 ----
  function render() {
    const grid = $("videoGrid");
    const listBox = $("goalList");
    const empty = $("emptyState");
    const back = $("backToList");

    if (scope === null) {
      renderVideoGrid();
      grid.hidden = false;
      listBox.hidden = true;
      empty.hidden = true;
      back.hidden = true;
      $("resultTitle").textContent = "영상 목록";
      $("resultCount").textContent = `${videos.length}개 영상`;
      return;
    }

    back.hidden = false;
    grid.hidden = true;
    listBox.hidden = false;
    const shown = renderGoalGroups();

    if (scope === ALL) {
      const names = [...selected].map(labelOf);
      $("resultTitle").textContent =
        selected.size === 0 ? "전체 골 장면" : `${names.join(", ")} 골 장면`;
    } else {
      const v = videos.find((x) => x.id === scope);
      $("resultTitle").textContent = v ? v.title : "골 장면";
    }
    $("resultCount").textContent = `${shown}골`;
    empty.hidden = shown !== 0;
  }

  // ---- 상태 변경 ----
  function toggle(p) {
    if (selected.has(p)) selected.delete(p);
    else selected.add(p);
    // 영상 목록 화면에서 선수를 고르면 전체 영상 교차 검색으로 전환
    if (scope === null) scope = ALL;
    renderChips();
    renderVideoNav();
    render();
  }

  function reset() {
    selected.clear();
    $("playerSearch").value = "";
    renderChips();
    render();
  }

  $("resetFilter").addEventListener("click", reset);
  $("playerSearch").addEventListener("input", renderChips);
  $("backToList").addEventListener("click", () => setScope(null));

  // 득점 순위: 기본 접힘, 헤더를 눌러야 펼쳐짐
  $("lbToggle").addEventListener("click", () => {
    const willOpen = $("leaderboard").hidden;
    $("leaderboard").hidden = !willOpen;
    $("lbBlock").classList.toggle("open", willOpen);
    $("lbToggle").setAttribute("aria-expanded", String(willOpen));
    $("lbInd").textContent = willOpen ? "접기" : "펼치기";
  });

  renderStats();
  renderChips();
  renderLeaderboard();
  renderVideoNav();
  render();
})();
