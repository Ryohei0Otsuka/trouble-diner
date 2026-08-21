import type { AppMode } from "../types";

interface Props {
  mode: AppMode;
  source: "mysql" | "demo";
  xp: number;
  onModeChange: (mode: AppMode) => void;
  onHome: () => void;
}

export function AppHeader({ mode, source, xp, onModeChange, onHome }: Props) {
  return (
    <header className="app-header">
      <button className="brand-button" onClick={onHome} aria-label="ホームへ戻る">
        <span className="pixel-logo">TD</span>
        <span><strong>TROUBLE DINER</strong><small>RESTAURANT SUPPORT QUEST</small></span>
      </button>
      <div className="header-status">
        <div className={`source-badge ${source}`}><i />{source === "mysql" ? "DB CONNECTED" : "DEMO MODE"}</div>
        <div className="xp-badge"><span>★</span><b>{xp}</b> EXP</div>
        <label className="mode-switch">
          <span>MODE</span>
          <select value={mode} onChange={(event) => onModeChange(event.target.value as AppMode)}>
            <option value="training">TRAINING</option>
            <option value="mock-live">LIVE MOCK</option>
          </select>
        </label>
      </div>
    </header>
  );
}
