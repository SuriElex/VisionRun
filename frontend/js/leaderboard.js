
export function createLeaderboard() {
  const API_URL = "http://localhost:8080/api/scores/leaderboard";

  let section = document.getElementById("leaderboardSection");

  if (!section) {
    section = document.createElement("section");
    section.id = "leaderboardSection";

    section.style.cssText = `
      max-width: 700px;
      margin: 30px auto;
      padding: 24px;
      background: #101d30;
      color: #e6f4ff;
      border: 1px solid #29415d;
      border-radius: 16px;
      font-family: Arial, sans-serif;
    `;

    document.body.appendChild(section);
  }

  section.innerHTML = `
    <h2 style="text-align:center;color:#6ee7ef;">
      🏆 VisionRun Leaderboard
    </h2>

    <p id="leaderboardStatus" style="text-align:center;">
      Loading leaderboard...
    </p>

    <div style="overflow-x:auto;">
      <table style="
        width:100%;
        border-collapse:collapse;
        text-align:left;
      ">
        <thead>
          <tr style="background:#1b3049;">
            <th style="padding:12px;">Rank</th>
            <th style="padding:12px;">Player</th>
            <th style="padding:12px;">Score</th>
            <th style="padding:12px;">Coins</th>
          </tr>
        </thead>
        <tbody id="leaderboardBody"></tbody>
      </table>
    </div>

    <button id="refreshLeaderboard" type="button" style="
      display:block;
      margin:20px auto 0;
      padding:10px 18px;
      border:0;
      border-radius:8px;
      background:#6ee7ef;
      color:#07111f;
      font-weight:bold;
      cursor:pointer;
    ">
      🔄 Refresh Scores
    </button>
  `;

  const status = section.querySelector("#leaderboardStatus");
  const tbody = section.querySelector("#leaderboardBody");
  const refreshButton = section.querySelector("#refreshLeaderboard");

  async function loadScores() {
    status.textContent = "Loading leaderboard...";
    tbody.replaceChildren();
    refreshButton.disabled = true;

    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const scores = await response.json();

      if (!Array.isArray(scores) || scores.length === 0) {
        status.textContent =
          "No scores yet. Play a game to get started!";
        return;
      }

      scores
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 10)
        .forEach((player, index) => {
          const row = document.createElement("tr");
          row.style.borderBottom = "1px solid #29415d";

          const rank =
            index === 0 ? "🥇 1" :
            index === 1 ? "🥈 2" :
            index === 2 ? "🥉 3" :
            String(index + 1);

          const values = [
            rank,
            player.playerName ?? "Player",
            player.score ?? 0,
            player.coinsCollected ?? 0
          ];

          values.forEach((value) => {
            const cell = document.createElement("td");
            cell.style.padding = "12px";
            cell.textContent = String(value);

            if (index === 0) {
              cell.style.color = "#ffd166";
            }

            row.appendChild(cell);
          });

          tbody.appendChild(row);
        });

      status.textContent =
        "Top players — highest score first";
    } catch (error) {
      console.error("Leaderboard loading failed:", error);

      status.textContent =
        "Could not load scores. Check whether the backend is running.";
    } finally {
      refreshButton.disabled = false;
    }
  }

  refreshButton.addEventListener("click", loadScores);

  // Reload leaderboard automatically after a score is saved.
  window.addEventListener("visionrun-score-saved", loadScores);

  // Load leaderboard when the page starts.
  loadScores();

  return {
    refresh: loadScores
  };
}
