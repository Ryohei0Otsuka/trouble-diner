import type { DashboardData, OutcomeType } from "../types";

interface Props {
  data: DashboardData;
  source: "mysql" | "demo";
  onRefresh: () => void;
  onResetDemo: () => void;
}

const resultLabels: Record<OutcomeType, string> = { resolved: "一次解決", escalated: "引継ぎ", stopped: "使用停止", unclassified: "未分類" };
const formatDate = (value: string) => new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export function Dashboard({ data, source, onRefresh, onResetDemo }: Props) {
  const maxScore = data.priorities[0]?.score || 1;
  return (
    <section className="dashboard-screen screen-wrap">
      <div className="dashboard-title"><div><p className="pixel-kicker">QUEST ANALYTICS</p><h1>お店の攻略データ</h1><p>件数だけでなく、影響度・時間・再発性から改善対象を探します。</p></div><div className="dashboard-actions"><button className="refresh-button" onClick={onRefresh}>↻ 更新</button>{source === "demo" && <button className="demo-reset-button" onClick={onResetDemo}>初期状態へ戻す</button>}</div></div>

      <div className="metric-grid">
        <article className="metric-card red"><span>ALL QUESTS</span><strong>{data.total}</strong><small>総対応件数</small></article>
        <article className="metric-card green"><span>FIRST CLEAR</span><strong>{data.resolvedRate}<em>%</em></strong><small>一次解決率</small></article>
        <article className="metric-card yellow"><span>ESCALATE</span><strong>{data.escalationRate}<em>%</em></strong><small>引き継ぎ率</small></article>
        <article className="metric-card blue"><span>AVG TIME</span><strong>{data.averageMinutes}<em>分</em></strong><small>平均対応時間</small></article>
      </div>

      <div className="dashboard-columns">
        <article className="pixel-window priority-window">
          <header><div><span>REPAIR HINTS</span><h2>重点改善ランキング</h2></div><small>影響度 × 時間 × 再発性</small></header>
          <div className="priority-list">{data.priorities.map((item, index) => <div className="priority-item" key={`${item.scenarioTitle}-${index}`}>
            <span className="rank">{index + 1}</span><div className="priority-copy"><p><strong>{item.scenarioTitle}</strong><span>{item.areaName}・{item.count}件</span></p><div className="pixel-bar"><i style={{ width: `${Math.max(7, (item.score / maxScore) * 100)}%` }} /></div></div><b>{item.score}<small>pt</small></b>
          </div>)}</div>
        </article>

        <article className="pixel-window unknown-window">
          <header><div><span>UNKNOWN EVENTS</span><h2>未分類ボックス</h2></div></header>
          <div className="unknown-count"><span>?</span><strong>{data.unclassifiedCount}</strong><small>NEW EVENTS</small></div>
          <p>同じ「想定外」が重なったら、新しい対応クエストとして追加する候補です。</p>
        </article>
      </div>

      <article className="pixel-window history-window">
        <header><div><span>RECENT LOG</span><h2>最近のクエストログ</h2></div></header>
        <div className="log-table-wrap">
          <table>
            <thead><tr><th>日時</th><th>エリア</th><th>トラブル</th><th>結果</th><th>時間</th><th>再発</th></tr></thead>
            <tbody>{data.recent.map((item) => (
              <tr key={item.id}>
                <td data-label="日時">{formatDate(item.occurredAt)}</td>
                <td data-label="エリア">{item.areaName}</td>
                <td data-label="トラブル"><strong>{item.scenarioTitle}</strong></td>
                <td data-label="結果"><span className={`result-chip ${item.result}`}>{resultLabels[item.result]}</span></td>
                <td data-label="時間">{Math.max(1, Math.round(item.durationSeconds / 60))}分</td>
                <td data-label="再発">{item.recurrence ? <b className="repeat-chip">REPEAT</b> : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
