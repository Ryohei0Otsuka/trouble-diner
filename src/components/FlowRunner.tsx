import { useMemo, useState } from "react";
import { saveIncident } from "../lib/api";
import { determineSeverity, severityLabels, severityReason } from "../lib/severity";
import type { Area, FlowNode, IncidentInput, SavedIncident, Scenario, StepLog } from "../types";

interface Props {
  area: Area;
  scenario: Scenario;
  onExit: () => void;
  onComplete: () => void;
}

const resultLabels = { resolved: "一次対応完了", escalated: "責任者へ引継ぎ", stopped: "使用停止・連携", unclassified: "未分類として記録" };
const riskLabels = { normal: "通常", caution: "注意", critical: "停止基準あり" };

const dangerNode: FlowNode = {
  key: "__danger__", type: "outcome", title: "作業を止めて安全確保", body: "無理に解決せず、店舗の緊急手順に従って責任者・緊急窓口へ連携します。",
  outcomeType: "stopped", escalationTarget: "店舗責任者・緊急窓口", choices: [],
};

const unknownNode: FlowNode = {
  key: "__unknown__", type: "outcome", title: "判断材料を整理して引き継ぐ", body: "該当しない事実、試したこと、期待する状態を記録します。後から新しい対応フローの候補として集計します。",
  outcomeType: "unclassified", escalationTarget: "店舗責任者", choices: [],
};

const localDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const formatTicketDate = (value: string) => new Intl.DateTimeFormat("ja-JP", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
}).format(new Date(value));

function copyFallback(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function FlowRunner({ area, scenario, onExit, onComplete }: Props) {
  const [currentKey, setCurrentKey] = useState(scenario.startNodeKey);
  const [forcedNode, setForcedNode] = useState<FlowNode | null>(null);
  const [steps, setSteps] = useState<StepLog[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [occurredAt, setOccurredAt] = useState(() => localDateTime(new Date()));
  const [recurrence, setRecurrence] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedIncident | null>(null);
  const [copied, setCopied] = useState(false);

  const node = forcedNode || scenario.nodes[currentKey];
  const severity = node?.type === "outcome" && node.outcomeType
    ? determineSeverity(scenario.riskLevel, node.outcomeType)
    : scenario.riskLevel === "critical" ? "high" : scenario.riskLevel === "caution" ? "medium" : "low";
  const progress = Math.min(92, 18 + steps.length * 22);
  const routeSummary = useMemo(() => steps.map((step) => `${step.prompt} → ${step.choiceLabel}`).join(" / "), [steps]);

  const choose = (choiceIndex: number) => {
    if (!node || node.type === "outcome") return;
    const choice = node.choices[choiceIndex];
    setSteps((current) => [...current, { nodeKey: node.key, prompt: node.title, choiceLabel: choice.label }]);
    setCurrentKey(choice.nextNodeKey);
  };

  const escape = (type: "danger" | "unknown") => {
    const target = type === "danger" ? dangerNode : unknownNode;
    setSteps((current) => [...current, { nodeKey: node?.key || "unknown", prompt: node?.title || scenario.title, choiceLabel: type === "danger" ? "危険を感じる" : "判断できない" }]);
    setForcedNode(target);
  };

  const undo = () => {
    const previous = steps.at(-1);
    if (!previous) return;
    setCurrentKey(previous.nodeKey);
    setForcedNode(null);
    setSteps((current) => current.slice(0, -1));
  };

  const requestExit = () => {
    if (window.confirm("対応フローを中断して一覧へ戻りますか？\nここまでの選択と入力は保存されません。")) onExit();
  };

  const escalationText = () => {
    if (!node || node.type !== "outcome" || !saved) return "";
    return [
      "【TROUBLE DINER｜引継ぎ票】",
      `記録ID：${saved.id}`,
      `発生日時：${formatTicketDate(saved.occurredAt)}`,
      `エリア：${area.name}`,
      `トラブル：${scenario.title}`,
      `判定：${node.title}`,
      `連携先：${node.escalationTarget || "記録のみ"}`,
      `対応レベル：${severityLabels[severity]}（自動判定）`,
      `再発：${recurrence ? "あり" : "なし・不明"}`,
      `確認経路：${routeSummary || "直接判定"}`,
      `補足：${note || "なし"}`,
      "状態：未復旧（復旧後に集計画面から完了記録）",
      "※架空PoCの模擬データです。",
    ].join("\n");
  };

  const copyEscalation = async () => {
    const text = escalationText();
    try { await navigator.clipboard.writeText(text); } catch { copyFallback(text); }
    setCopied(true);
  };

  const complete = async () => {
    if (!node || node.type !== "outcome" || !node.outcomeType) return;
    const occurrence = new Date(occurredAt);
    if (Number.isNaN(occurrence.getTime())) {
      window.alert("発生日時を確認してください。");
      return;
    }
    setSaving(true);
    const input: IncidentInput = {
      scenarioId: scenario.id,
      areaId: area.id,
      severity,
      result: node.outcomeType,
      recurrence,
      occurredAt: occurrence.toISOString(),
      triageSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      note,
      steps,
    };
    try {
      setSaved(await saveIncident(input, scenario.title, area.name));
    } catch {
      window.alert("記録できませんでした。接続状態を確認してもう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  if (!node) {
    return <section className="flow-screen screen-wrap"><div className="fatal-card"><h2>フローが途切れています</h2><p>シナリオの接続先を確認してください。</p><button onClick={onExit}>フロー一覧へ</button></div></section>;
  }

  if (saved) {
    const needsFollowUp = node.outcomeType !== "resolved";
    return (
      <section className="clear-screen screen-wrap">
        <div className="confetti-pixel p1" /><div className="confetti-pixel p2" /><div className="confetti-pixel p3" />
        <img src="./assets/crew-mascot.png" alt="記録完了を知らせるクルー" />
        <p className="pixel-kicker">RECORD #{saved.id}</p><h1>{needsFollowUp ? "引継ぎ待ち" : "記録しました"}</h1>
        <p>{needsFollowUp ? "未復旧として集計画面に残しました。引継ぎ票には記録IDと発生日時が入ります。" : "判断経路と一次解決をトラブル記録へ保存しました。"}</p>
        {needsFollowUp && <button className="copy-ticket saved-ticket" onClick={copyEscalation}>{copied ? "✓ 引継ぎ票をコピーしました" : "▣ 保存済みの引継ぎ票をコピー"}</button>}
        <div className="clear-actions"><button className="pixel-primary" onClick={onComplete}>集計を確認</button><button className="pixel-secondary" onClick={onExit}>フロー一覧</button></div>
      </section>
    );
  }

  return (
    <section className={`flow-screen screen-wrap risk-${scenario.riskLevel}`}>
      <div className="flow-topline">
        <div className="flow-nav-actions"><button className="pixel-back" onClick={requestExit}>← 中断</button>{steps.length > 0 && <button className="pixel-back flow-undo" onClick={undo}>↶ 1つ戻る</button>}</div>
        <div className="flow-title"><span style={{ background: area.color }}>{area.icon}</span><div><small>{area.shortName}</small><strong>{scenario.title}</strong></div></div>
        <span className={`risk-flag ${scenario.riskLevel}`}>{riskLabels[scenario.riskLevel]}</span>
      </div>

      <div className="progress-track"><i style={{ width: node.type === "outcome" ? "100%" : `${progress}%` }} /></div>

      <article className={`quest-panel node-${node.type} ${node.outcomeType || ""}`}>
        {node.type === "outcome" ? (
          <>
            <div className="outcome-banner"><span>{node.outcomeType === "resolved" ? "★" : node.outcomeType === "stopped" ? "!!" : "↗"}</span><b>{resultLabels[node.outcomeType || "escalated"]}</b></div>
            <h1>{node.title}</h1><p className="node-body">{node.body}</p>
            {node.escalationTarget && <div className="route-box"><span>CALL TO</span><strong>{node.escalationTarget}</strong></div>}

            <div className="record-panel">
              <div className="record-field"><span>対応レベル（自動判定）</span><div className={`severity-readout ${severity}`}><strong>{severityLabels[severity]}</strong><small>{node.outcomeType ? severityReason(scenario.riskLevel, node.outcomeType) : "フロー結果から判定します"}</small></div></div>
              <label className="record-field"><span>発生／受付日時</span><input className="datetime-input" type="datetime-local" value={occurredAt} max={localDateTime(new Date())} onChange={(event) => setOccurredAt(event.target.value)} /></label>
              <label className="pixel-check"><input type="checkbox" checked={recurrence} onChange={(event) => setRecurrence(event.target.checked)} /><i />同じ症状の再発と確認できた</label>
              <label className="note-field"><span>補足メモ</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="確認できた事実だけを記録" /></label>
            </div>

            {node.outcomeType !== "resolved" && <p className="save-first-note">先に記録を保存します。記録ID付きの引継ぎ票は保存後にコピーできます。</p>}
            <button className="pixel-primary record-button" disabled={saving} onClick={complete}>{saving ? "SAVING..." : node.outcomeType === "resolved" ? "一次解決として記録" : "未復旧として記録し、引継ぎへ"}</button>
          </>
        ) : (
          <>
            <p className="pixel-kicker">{node.type === "question" ? `CHECK ${String(steps.length + 1).padStart(2, "0")}` : "ACTION"}</p>
            <h1>{node.title}</h1><p className="node-body">{node.body}</p>
            <div className={`choice-grid ${node.choices.length === 1 ? "single" : ""}`}>
              {node.choices.map((choice, index) => <button key={`${node.key}-${choice.label}`} className={`choice-button ${choice.choiceType}`} onClick={() => choose(index)}><span>{choice.choiceType === "positive" ? "✓" : choice.choiceType === "danger" ? "!" : "×"}</span><strong>{choice.label}</strong><small>選択して次へ</small></button>)}
            </div>
            <div className="escape-row"><button onClick={() => escape("unknown")}><strong>？ 判断できない</strong><small>責任者へ引継ぎ</small></button><button className="danger" onClick={() => escape("danger")}><strong>！ 危険を感じる</strong><small>使用停止・安全確保</small></button></div>
          </>
        )}
      </article>

      {steps.length > 0 && <details className="quest-log"><summary>確認履歴 <span>{steps.length} STEP</span></summary><ol>{steps.map((step, index) => <li key={`${step.nodeKey}-${index}`}><span>{index + 1}</span><p>{step.prompt}<strong>{step.choiceLabel}</strong></p></li>)}</ol></details>}
    </section>
  );
}
