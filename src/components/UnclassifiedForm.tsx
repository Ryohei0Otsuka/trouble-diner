import { useState } from "react";
import { saveUnclassified } from "../lib/api";
import type { Area } from "../types";

interface Props { area: Area; onBack: () => void; onSaved: () => void; }

export function UnclassifiedForm({ area, onBack, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [safetyConcern, setSafetyConcern] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await saveUnclassified(area.id, title, details, safetyConcern);
    setSaving(false);
    onSaved();
  };

  return (
    <section className="unclassified-screen screen-wrap">
      <button className="pixel-back" onClick={onBack}>← クエスト一覧</button>
      <div className="mystery-card pixel-window">
        <div className="mystery-icon">?</div><p className="pixel-kicker">UNKNOWN EVENT</p><h1>予定外トラブルを記録</h1>
        <p>解決を急いで推測せず、起きている事実を未分類ボックスへ残します。</p>
        <form onSubmit={submit}>
          <label><span>何が起きていますか？ *</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="短い事実で入力" /></label>
          <label><span>確認したこと・試したこと</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={5} placeholder="誰が、どこで、何を確認したか" /></label>
          <label className="pixel-check"><input type="checkbox" checked={safetyConcern} onChange={(event) => setSafetyConcern(event.target.checked)} /><i />人身・衛生・火災など安全上の懸念がある</label>
          {safetyConcern && <div className="danger-notice">！操作を続けず、店舗の緊急手順に従って責任者へ連携してください。</div>}
          <button className="pixel-primary" disabled={!title.trim() || saving}>{saving ? "SAVING..." : "未分類ボックスへ送る"}</button>
        </form>
      </div>
    </section>
  );
}
