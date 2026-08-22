import { useState } from "react";
import { saveUnclassified } from "../lib/api";
import type { Area, UnclassifiedRecord } from "../types";

interface Props { area: Area; onBack: () => void; onSaved: () => void; }

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

export function UnclassifiedForm({ area, onBack, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [safetyConcern, setSafetyConcern] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<UnclassifiedRecord | null>(null);
  const [copied, setCopied] = useState(false);

  const requestBack = () => {
    const hasInput = title.trim() || details.trim() || safetyConcern;
    if (!hasInput || window.confirm("入力内容を破棄してフロー一覧へ戻りますか？")) onBack();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      setSaved(await saveUnclassified(area.id, area.name, title.trim(), details.trim(), safetyConcern));
    } catch {
      window.alert("記録できませんでした。接続状態を確認してください。");
    } finally {
      setSaving(false);
    }
  };

  const copyTicket = async () => {
    if (!saved) return;
    const text = [
      "【TROUBLE DINER｜未分類トラブル連絡票】",
      `記録ID：${saved.id}`,
      `発生日時：${new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(saved.occurredAt))}`,
      `エリア：${saved.areaName}`,
      `事象：${saved.title}`,
      `確認内容：${saved.details || "未記入"}`,
      `安全上の懸念：${saved.safetyConcern ? "あり（直ちに責任者へ連携）" : "なし・不明"}`,
      "状態：未分類・確認待ち",
      "※架空PoCの模擬データです。",
    ].join("\n");
    try { await navigator.clipboard.writeText(text); } catch { copyFallback(text); }
    setCopied(true);
  };

  if (saved) {
    return (
      <section className="unclassified-screen screen-wrap">
        <div className={`mystery-card pixel-window unknown-saved ${saved.safetyConcern ? "safety" : ""}`}>
          <div className="mystery-icon">{saved.safetyConcern ? "!" : "?"}</div>
          <p className="pixel-kicker">UNKNOWN #{saved.id}</p>
          <h1>{saved.safetyConcern ? "安全懸念として記録" : "未分類として記録"}</h1>
          <p>{saved.safetyConcern ? "集計画面の「今すぐ見るもの」に残しました。緊急手順を優先して責任者へ連携してください。" : "未分類ボックスに残しました。同じ事象が重なったら新しいフロー候補になります。"}</p>
          <button className="copy-ticket" onClick={copyTicket}>{copied ? "✓ 連絡票をコピーしました" : "▣ 記録ID付き連絡票をコピー"}</button>
          <div className="clear-actions"><button className="pixel-primary" onClick={onSaved}>集計を確認</button><button className="pixel-secondary" onClick={onBack}>フロー一覧</button></div>
        </div>
      </section>
    );
  }

  return (
    <section className="unclassified-screen screen-wrap">
      <button className="pixel-back" onClick={requestBack}>← フロー一覧</button>
      <div className="mystery-card pixel-window">
        <div className="mystery-icon">?</div><p className="pixel-kicker">UNKNOWN EVENT</p><h1>予定外トラブルを記録</h1>
        <p>解決を急いで推測せず、起きている事実を未分類ボックスへ残します。</p>
        <form onSubmit={submit}>
          <label><span>何が起きていますか？ *</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="短い事実で入力" /></label>
          <label><span>確認したこと・試したこと</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={5} placeholder="誰が、どこで、何を確認したか" /></label>
          <label className="pixel-check"><input type="checkbox" checked={safetyConcern} onChange={(event) => setSafetyConcern(event.target.checked)} /><i />人身・衛生・火災など安全上の懸念がある</label>
          {safetyConcern && <div className="danger-notice">！操作を続けず、店舗の緊急手順に従って責任者へ連携してください。保存後に記録ID付きの連絡票を作れます。</div>}
          <button className="pixel-primary" disabled={!title.trim() || saving}>{saving ? "SAVING..." : safetyConcern ? "安全懸念として記録し、連携へ" : "未分類ボックスへ記録"}</button>
        </form>
      </div>
    </section>
  );
}
