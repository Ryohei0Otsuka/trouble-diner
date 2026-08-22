import { useState } from "react";
import { closeUnclassified, resolveIncident } from "../lib/api";
import type { DashboardData, IncidentRecord, OutcomeType, UnclassifiedRecord } from "../types";

interface Props {
  data: DashboardData;
  source: "mysql" | "demo";
  onRefresh: () => void | Promise<void>;
  onResetDemo: () => void;
}

const resultLabels: Record<OutcomeType, string> = { resolved: "一次解決", escalated: "引継ぎ", stopped: "使用停止", unclassified: "判断不能" };
const formatDate = (value: string) => new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const formatMinutes = (seconds: number | null) => seconds === null ? "対応中" : `${Math.max(1, Math.round(seconds / 60))}分`;
const elapsedMinutes = (value: string) => Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));

export function Dashboard({ data, source, onRefresh, onResetDemo }: Props) {
  const maxScore = data.priorities[0]?.score || 1;
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [selectedUnknown, setSelectedUnknown] = useState<UnclassifiedRecord | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [saving, setSaving] = useState(false);

  const completeRecovery = async () => {
    if (!selectedIncident || !resolutionNote.trim()) return;
    setSaving(true);
    try {
      await resolveIncident(selectedIncident.id, resolutionNote.trim(), source);
      setSelectedIncident(null);
      setResolutionNote("");
      await onRefresh();
    } catch {
      window.alert("復旧記録を保存できませんでした。接続状態を確認してください。");
    } finally {
      setSaving(false);
    }
  };

  const closeUnknown = async () => {
    if (!selectedUnknown || !window.confirm("責任者が内容を確認済みとして、未分類ボックスから閉じますか？")) return;
    setSaving(true);
    try {
      await closeUnclassified(selectedUnknown.id, source);
      setSelectedUnknown(null);
      await onRefresh();
    } catch {
      window.alert("確認済みに変更できませんでした。接続状態を確認してください。");
    } finally {
      setSaving(false);
    }
  };

  const safetyItems = data.unclassified.filter((item) => item.safetyConcern);

  return (
    <section className="dashboard-screen screen-wrap">
      <div className="dashboard-title"><div><p className="pixel-kicker">OPERATION STATUS</p><h1>トラブル集計</h1><p>最初に未復旧と安全懸念を確認し、その後で改善候補を見ます。</p></div><div className="dashboard-actions"><button className="refresh-button" onClick={onRefresh}>↻ 更新</button>{source === "demo" && <button className="demo-reset-button" onClick={onResetDemo}>初期状態へ戻す</button>}</div></div>

      <article className={`urgent-board ${data.activeSummary.total > 0 ? "has-alerts" : "all-clear"}`}>
        <header><div><span>NOW</span><h2>今すぐ見るもの</h2></div><p>{data.activeSummary.total > 0 ? "未復旧・安全懸念が残っています" : "未復旧の記録はありません"}</p></header>
        <div className="urgent-metrics">
          <div className="urgent-total"><span>要確認</span><strong>{data.activeSummary.total}</strong><small>OPEN ITEMS</small></div>
          <div><span>引継ぎ中</span><strong>{data.activeSummary.escalated}</strong></div>
          <div className="stop"><span>使用停止</span><strong>{data.activeSummary.stopped}</strong></div>
          <div className="safety"><span>安全懸念</span><strong>{data.activeSummary.safety}</strong></div>
        </div>

        {(data.activeIncidents.length > 0 || safetyItems.length > 0) ? <div className="active-list">
          {data.activeIncidents.map((item) => <button key={item.id} className={`active-item ${item.result}`} onClick={() => { setSelectedIncident(item); setResolutionNote(""); }}>
            <span className="active-state">{item.result === "stopped" ? "使用停止" : "引継ぎ中"}</span>
            <div><strong>{item.scenarioTitle}</strong><small>{item.areaName}・{formatDate(item.occurredAt)}から {elapsedMinutes(item.occurredAt)}分経過</small></div><b>詳細 →</b>
          </button>)}
          {safetyItems.map((item) => <button key={item.id} className="active-item safety" onClick={() => setSelectedUnknown(item)}>
            <span className="active-state">安全懸念</span><div><strong>{item.title}</strong><small>{item.areaName}・{formatDate(item.occurredAt)}</small></div><b>詳細 →</b>
          </button>)}
        </div> : <div className="no-active">✓ 現在、未復旧として残っている対応はありません。</div>}
      </article>

      <div className="metric-grid">
        <article className="metric-card red"><span>TOTAL</span><strong>{data.total}</strong><small>総対応件数</small></article>
        <article className="metric-card green"><span>FIRST RESPONSE</span><strong>{data.resolvedRate}<em>%</em></strong><small>一次解決率</small></article>
        <article className="metric-card yellow"><span>ESCALATE</span><strong>{data.escalationRate}<em>%</em></strong><small>引継ぎ・停止率</small></article>
        <article className="metric-card blue"><span>RECOVERY</span><strong>{data.averageRecoveryMinutes}<em>分</em></strong><small>平均復旧時間</small></article>
      </div>

      <div className="dashboard-columns">
        <article className="pixel-window priority-window">
          <header><div><span>REPAIR HINTS</span><h2>重点改善候補</h2></div><small>対応レベル × 復旧時間 × 再発性</small></header>
          <div className="priority-list">{data.priorities.map((item, index) => <div className="priority-item" key={`${item.scenarioTitle}-${index}`}>
            <span className="rank">{index + 1}</span><div className="priority-copy"><p><strong>{item.scenarioTitle}</strong><span>{item.areaName}・{item.count}件</span></p><div className="reason-chips"><span>再発 {item.repeatCount}</span><span>停止 {item.stoppedCount}</span><span>復旧平均 {item.averageRecoveryMinutes}分</span></div><div className="pixel-bar"><i style={{ width: `${Math.max(7, (item.score / maxScore) * 100)}%` }} /></div></div><b>{item.score}<small>SCORE</small></b>
          </div>)}</div>
          <p className="priority-note">スコアは並べ替えの目安です。件数だけでなく、安全性・再発・実際の記録を確認して改善対象を決めます。</p>
        </article>

        <article className="pixel-window unknown-window">
          <header><div><span>UNKNOWN EVENTS</span><h2>未分類ボックス</h2></div></header>
          <div className="unknown-count"><span>?</span><strong>{data.unclassifiedCount}</strong><small>REVIEW ITEMS</small></div>
          <div className="unknown-mini-list">{data.unclassified.slice(0, 4).map((item) => <button key={item.id} onClick={() => setSelectedUnknown(item)}><i>{item.safetyConcern ? "!" : "?"}</i><span><strong>{item.title}</strong><small>{item.areaName}・{formatDate(item.occurredAt)}</small></span></button>)}</div>
          <p>重なる想定外は、新しい対応フローの候補です。</p>
        </article>
      </div>

      <article className="pixel-window history-window">
        <header><div><span>RECENT LOG</span><h2>最近の対応記録</h2></div><small>行を選ぶと判断経路とメモを確認できます</small></header>
        <div className="log-table-wrap">
          <table>
            <thead><tr><th>日時</th><th>エリア</th><th>トラブル</th><th>状態</th><th>復旧</th><th>再発</th></tr></thead>
            <tbody>{data.recent.map((item) => (
              <tr key={item.id} className="clickable-row" tabIndex={0} role="button" onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { setSelectedIncident(item); setResolutionNote(""); } }} onClick={() => { setSelectedIncident(item); setResolutionNote(""); }}>
                <td data-label="日時">{formatDate(item.occurredAt)}</td>
                <td data-label="エリア">{item.areaName}</td>
                <td data-label="トラブル"><strong>{item.scenarioTitle}</strong></td>
                <td data-label="状態"><span className={`result-chip ${item.status === "open" ? "open" : item.result}`}>{item.status === "open" ? "対応中" : resultLabels[item.result]}</span></td>
                <td data-label="復旧">{formatMinutes(item.recoverySeconds)}</td>
                <td data-label="再発">{item.recurrence ? <b className="repeat-chip">REPEAT</b> : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </article>

      {selectedIncident && <div className="detail-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedIncident(null); }}>
        <article className="detail-dialog" role="dialog" aria-modal="true" aria-label="対応記録の詳細">
          <header><div><span>INCIDENT #{selectedIncident.id}</span><h2>{selectedIncident.scenarioTitle}</h2></div><button aria-label="閉じる" onClick={() => setSelectedIncident(null)}>×</button></header>
          <div className="detail-body">
            <div className="detail-facts"><p><span>状態</span><strong className={`result-chip ${selectedIncident.status === "open" ? "open" : selectedIncident.result}`}>{selectedIncident.status === "open" ? "未復旧" : "復旧済み"}</strong></p><p><span>発生</span><strong>{formatDate(selectedIncident.occurredAt)}</strong></p><p><span>切り分け</span><strong>{formatMinutes(selectedIncident.triageSeconds)}</strong></p><p><span>復旧時間</span><strong>{formatMinutes(selectedIncident.recoverySeconds)}</strong></p></div>
            <section><h3>確認経路</h3><p>{selectedIncident.routeSummary || "直接判定・履歴なし"}</p></section>
            <section><h3>現場メモ</h3><p>{selectedIncident.note || "記載なし"}</p></section>
            {selectedIncident.resolutionNote && <section><h3>復旧内容</h3><p>{selectedIncident.resolutionNote}</p></section>}
            {selectedIncident.status === "open" && <div className="recovery-form"><label><span>復旧内容 *</span><textarea rows={3} value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="復旧を確認した事実と実施内容" /></label><button className="pixel-primary" disabled={!resolutionNote.trim() || saving} onClick={completeRecovery}>{saving ? "保存中..." : "復旧済みにする"}</button></div>}
          </div>
        </article>
      </div>}

      {selectedUnknown && <div className="detail-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedUnknown(null); }}>
        <article className={`detail-dialog unknown-detail ${selectedUnknown.safetyConcern ? "safety" : ""}`} role="dialog" aria-modal="true" aria-label="未分類トラブルの詳細">
          <header><div><span>UNKNOWN #{selectedUnknown.id}</span><h2>{selectedUnknown.title}</h2></div><button aria-label="閉じる" onClick={() => setSelectedUnknown(null)}>×</button></header>
          <div className="detail-body">
            {selectedUnknown.safetyConcern && <div className="danger-notice">！安全上の懸念あり。アプリ上の確認より、店舗の緊急手順と責任者判断を優先します。</div>}
            <div className="detail-facts"><p><span>エリア</span><strong>{selectedUnknown.areaName}</strong></p><p><span>発生</span><strong>{formatDate(selectedUnknown.occurredAt)}</strong></p></div>
            <section><h3>確認したこと</h3><p>{selectedUnknown.details || "記載なし"}</p></section>
            <button className="pixel-secondary close-unknown" disabled={saving} onClick={closeUnknown}>責任者確認済みとして閉じる</button>
          </div>
        </article>
      </div>}
    </section>
  );
}
