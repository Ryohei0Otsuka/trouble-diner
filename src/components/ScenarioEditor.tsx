import { useState } from "react";
import { createScenario } from "../lib/api";
import type { Area, NewScenarioInput, RiskLevel, Scenario } from "../types";

interface Props { areas: Area[]; onCreated: (scenario: Scenario) => void; }

const initial = (areaId: number): NewScenarioInput => ({ areaId, title: "", summary: "", riskLevel: "normal", question: "", yesAction: "", noAction: "", escalationTarget: "店舗責任者" });

export function ScenarioEditor({ areas, onCreated }: Props) {
  const [form, setForm] = useState<NewScenarioInput>(() => initial(areas[0]?.id || 1));
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const update = <K extends keyof NewScenarioInput>(key: K, value: NewScenarioInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const valid = form.title.trim() && form.question.trim() && form.yesAction.trim() && form.noAction.trim();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    const scenario = await createScenario(form);
    onCreated(scenario);
    setForm(initial(form.areaId));
    setSaving(false);
    setCreated(true);
    window.setTimeout(() => setCreated(false), 2600);
  };

  return (
    <section className="editor-screen screen-wrap">
      <div className="editor-title"><div><p className="pixel-kicker">FLOW MAKER</p><h1>新しい対応を追加</h1><p>未分類トラブルを、次回から迷わない小さなフローへ変えます。</p></div><img src="./assets/crew-mascot.png" alt="フロー作成を手伝うクルー" /></div>
      <form className="editor-form pixel-window" onSubmit={submit}>
        <header><div><span>FLOW VERSION 1</span><h2>YES／NOの最小構成</h2></div><small>1画面1判断</small></header>
        <div className="form-grid">
          <label><span>発生エリア</span><select value={form.areaId} onChange={(event) => update("areaId", Number(event.target.value))}>{areas.map((area) => <option value={area.id} key={area.id}>{area.name}</option>)}</select></label>
          <label><span>フローの安全区分</span><select value={form.riskLevel} onChange={(event) => update("riskLevel", event.target.value as RiskLevel)}><option value="normal">通常</option><option value="caution">注意・責任者確認</option><option value="critical">停止基準あり</option></select></label>
          <label className="wide"><span>トラブル名 *</span><input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="例：予約台帳と来店人数が合わない" /></label>
          <label className="wide"><span>説明</span><input value={form.summary} onChange={(event) => update("summary", event.target.value)} placeholder="このフローで減らしたい迷い" /></label>
        </div>

        <div className="flow-builder">
          <div className="builder-node question-node"><span>Q1</span><label><b>最初に確認すること *</b><textarea value={form.question} onChange={(event) => update("question", event.target.value)} rows={2} placeholder="確認できる事実をYES / NOで聞く" /></label></div>
          <div className="branch-lines"><i /><i /></div>
          <div className="builder-outcomes">
            <div className="builder-node yes-node"><span>YES</span><label><b>一次対応 *</b><textarea value={form.yesAction} onChange={(event) => update("yesAction", event.target.value)} rows={3} placeholder="作業者が行う安全な対応" /></label></div>
            <div className="builder-node no-node"><span>NO</span><label><b>引き継ぎ判断 *</b><textarea value={form.noAction} onChange={(event) => update("noAction", event.target.value)} rows={3} placeholder="判断できない場合の行動" /></label></div>
          </div>
          <label className="route-input"><span>NOの場合の連携先</span><input value={form.escalationTarget} onChange={(event) => update("escalationTarget", event.target.value)} /></label>
        </div>

        <button className="pixel-primary editor-submit" type="submit" disabled={!valid || saving}>{saving ? "SAVING..." : "+ 対応フローを登録"}</button>
        {created && <p className="created-toast" role="status">✓ 対応フローを追加しました</p>}
      </form>
      <div className="editor-note"><span>登録範囲</span><p>この画面では最初の質問と、YES／NO後の対応を登録します。安全区分はフロー設計者が設定し、実行時の対応レベルは結果から自動判定します。</p></div>
    </section>
  );
}
