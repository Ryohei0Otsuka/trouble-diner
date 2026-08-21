import { useMemo, useState } from "react";
import { saveIncident } from "../lib/api";
import type { AppMode, Area, FlowNode, IncidentInput, Scenario, Severity, StepLog } from "../types";

interface Props {
  area: Area;
  scenario: Scenario;
  mode: AppMode;
  onExit: () => void;
  onComplete: (earnedXp: number) => void;
}

const severityLabels: Record<Severity, string> = { low: "軽微", medium: "中程度", high: "重大" };
const resultLabels = { resolved: "QUEST CLEAR", escalated: "ESCALATE", stopped: "STOP & CALL", unclassified: "NEW EVENT" };

const dangerNode: FlowNode = {
  key: "__danger__", type: "outcome", title: "作業を止めて安全確保", body: "無理に解決せず、店舗の緊急手順に従って責任者・緊急窓口へ連携します。",
  outcomeType: "stopped", escalationTarget: "店舗責任者・緊急窓口", choices: [],
};

const unknownNode: FlowNode = {
  key: "__unknown__", type: "outcome", title: "判断材料を整理して引き継ぐ", body: "該当しない事実、試したこと、期待する状態を記録します。後から新しいクエスト候補として集計します。",
  outcomeType: "unclassified", escalationTarget: "店舗責任者", choices: [],
};

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

export function FlowRunner({ area, scenario, mode, onExit, onComplete }: Props) {
  const [currentKey, setCurrentKey] = useState(scenario.startNodeKey);
  const [forcedNode, setForcedNode] = useState<FlowNode | null>(null);
  const [steps, setSteps] = useState<StepLog[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [severity, setSeverity] = useState<Severity>(scenario.riskLevel === "critical" ? "high" : "medium");
  const [recurrence, setRecurrence] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const node = forcedNode || scenario.nodes[currentKey];
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
    setSeverity(type === "danger" ? "high" : severity);
    setForcedNode(target);
  };

  const escalationText = () => {
    if (!node || node.type !== "outcome") return "";
    return [
      "【TROUBLE DINER｜エスカレーション票】",
      `エリア：${area.name}`,
      `トラブル：${scenario.title}`,
      `判定：${node.title}`,
      `連携先：${node.escalationTarget || "記録のみ"}`,
      `重要度：${severityLabels[severity]}`,
      `再発：${recurrence ? "あり" : "なし・不明"}`,
      `確認経路：${routeSummary || "直接判定"}`,
      `補足：${note || "なし"}`,
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
    setSaving(true);
    const input: IncidentInput = {
      scenarioId: scenario.id,
      areaId: area.id,
      mode,
      severity,
      result: node.outcomeType,
      recurrence,
      durationSeconds: Math.max(30, Math.round((Date.now() - startedAt) / 1000)),
      note,
      steps,
    };
    await saveIncident(input, scenario.title, area.name);
    setSaving(false);
    setSaved(true);
  };

  if (!node) {
    return <section className="flow-screen screen-wrap"><div className="fatal-card"><h2>フローが途切れています</h2><p>シナリオの接続先を確認してください。</p><button onClick={onExit}>クエスト一覧へ</button></div></section>;
  }

  if (saved) {
    const earnedXp = mode === "training" ? 12 : 0;
    return (
      <section className="clear-screen screen-wrap">
        <div className="confetti-pixel p1" /><div className="confetti-pixel p2" /><div className="confetti-pixel p3" />
        <img src="./assets/crew-mascot.png" alt="クエスト完了を喜ぶクルー" />
        <p className="pixel-kicker">RECORD SAVED</p><h1>{earnedXp ? "+12 EXP" : "LOG COMPLETE"}</h1>
        <p>判断経路と対応結果をクエストログへ記録しました。</p>
        <div className="clear-actions"><button className="pixel-primary" onClick={() => onComplete(earnedXp)}>集計を確認</button><button className="pixel-secondary" onClick={onExit}>クエスト一覧</button></div>
      </section>
    );
  }

  return (
    <section className={`flow-screen screen-wrap risk-${scenario.riskLevel}`}>
      <div className="flow-topline">
        <button className="pixel-back" onClick={onExit}>← 中断</button>
        <div className="flow-title"><span style={{ background: area.color }}>{area.icon}</span><div><small>{area.shortName}</small><strong>{scenario.title}</strong></div></div>
        <span className={`risk-flag ${scenario.riskLevel}`}>{scenario.riskLevel.toUpperCase()}</span>
      </div>

      <div className="progress-track"><i style={{ width: node.type === "outcome" ? "100%" : `${progress}%` }} /></div>

      <article className={`quest-panel node-${node.type} ${node.outcomeType || ""}`}>
        {node.type === "outcome" ? (
          <>
            <div className="outcome-banner"><span>{node.outcomeType === "resolved" ? "★" : node.outcomeType === "stopped" ? "!!" : "↗"}</span><b>{resultLabels[node.outcomeType || "escalated"]}</b></div>
            <h1>{node.title}</h1><p className="node-body">{node.body}</p>
            {node.escalationTarget && <div className="route-box"><span>CALL TO</span><strong>{node.escalationTarget}</strong></div>}

            <div className="record-panel">
              <div className="record-field"><span>重要度</span><div className="pixel-segment">{(["low", "medium", "high"] as Severity[]).map((item) => <button key={item} className={severity === item ? "active" : ""} onClick={() => setSeverity(item)}>{severityLabels[item]}</button>)}</div></div>
              <label className="pixel-check"><input type="checkbox" checked={recurrence} onChange={(event) => setRecurrence(event.target.checked)} /><i />同じトラブルの再発</label>
              <label className="note-field"><span>補足メモ</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="確認できた事実だけを記録" /></label>
            </div>

            {node.outcomeType !== "resolved" && <button className="copy-ticket" onClick={copyEscalation}>{copied ? "✓ コピーしました" : "▣ エスカレーション票をコピー"}</button>}
            <button className="pixel-primary record-button" disabled={saving} onClick={complete}>{saving ? "SAVE..." : "対応結果を記録する"}</button>
          </>
        ) : (
          <>
            <p className="pixel-kicker">{node.type === "question" ? `CHECK ${String(steps.length + 1).padStart(2, "0")}` : "ACTION"}</p>
            <h1>{node.title}</h1><p className="node-body">{node.body}</p>
            <div className={`choice-grid ${node.choices.length === 1 ? "single" : ""}`}>
              {node.choices.map((choice, index) => <button key={`${node.key}-${choice.label}`} className={`choice-button ${choice.choiceType}`} onClick={() => choose(index)}><span>{choice.choiceType === "positive" ? "✓" : choice.choiceType === "danger" ? "!" : "×"}</span><strong>{choice.label}</strong><small>選択して次へ</small></button>)}
            </div>
            <div className="escape-row"><button onClick={() => escape("unknown")}>？ 判断できない</button><button className="danger" onClick={() => escape("danger")}>！ 危険を感じる</button></div>
          </>
        )}
      </article>

      {steps.length > 0 && <details className="quest-log"><summary>QUEST LOG <span>{steps.length} STEP</span></summary><ol>{steps.map((step, index) => <li key={`${step.nodeKey}-${index}`}><span>{index + 1}</span><p>{step.prompt}<strong>{step.choiceLabel}</strong></p></li>)}</ol></details>}
    </section>
  );
}
