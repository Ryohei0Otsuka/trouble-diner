interface Props {
  source: "mysql" | "demo";
  focusMode: boolean;
  onHome: () => void;
}

export function AppHeader({ source, focusMode, onHome }: Props) {
  return (
    <header className={`app-header ${focusMode ? "focus-mode" : ""}`}>
      <button className="brand-button" onClick={onHome} disabled={focusMode} aria-label={focusMode ? "対応中" : "ホームへ戻る"}>
        <span className="pixel-logo">TD</span>
        <span><strong>TROUBLE DINER</strong><small>RESTAURANT SUPPORT FLOW</small></span>
      </button>
      <div className="header-status">
        <div className={`source-badge ${source}`}><i />{source === "mysql" ? "DB CONNECTED" : "DEMO MODE"}</div>
        {focusMode && <div className="focus-badge"><i />対応中</div>}
      </div>
    </header>
  );
}
