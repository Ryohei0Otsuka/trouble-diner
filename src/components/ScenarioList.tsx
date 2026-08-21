import type { Area, Scenario } from "../types";

interface Props {
  area: Area;
  scenarios: Scenario[];
  onBack: () => void;
  onStart: (scenario: Scenario) => void;
  onUnclassified: () => void;
}

const riskLabels = { normal: "NORMAL", caution: "CAUTION", critical: "STOP RULE" };

export function ScenarioList({ area, scenarios, onBack, onStart, onUnclassified }: Props) {
  return (
    <section className="scenario-screen screen-wrap">
      <button className="pixel-back" onClick={onBack}>← 店内マップ</button>
      <div className="area-title" style={{ "--area-color": area.color } as React.CSSProperties}>
        <span>{area.icon}</span><div><p>{area.shortName} QUESTS</p><h1>{area.name}のトラブル</h1><small>{area.description}</small></div>
      </div>

      <div className="scenario-list">
        {scenarios.length ? scenarios.map((item, index) => (
          <button className={`scenario-card ${item.riskLevel}`} key={item.id} onClick={() => onStart(item)}>
            <span className="scenario-number">{String(index + 1).padStart(2, "0")}</span>
            <span className="scenario-copy"><span className="risk-pill">{riskLabels[item.riskLevel]}</span><strong>{item.title}</strong><small>{item.summary}</small></span>
            <span className="scenario-meta"><b>約{item.estimatedMinutes}分</b><i>→</i></span>
          </button>
        )) : <div className="empty-quest"><span>…</span><h2>登録クエストなし</h2><p>新しい対応フローを追加できます。</p></div>}

        <button className="unknown-card" onClick={onUnclassified}>
          <span>?</span><div><strong>どれにも当てはまらない</strong><small>予定外のトラブルを「未分類ボックス」へ記録</small></div><b>→</b>
        </button>
      </div>
    </section>
  );
}
