export type Screen = "home" | "dashboard" | "editor";

interface Props {
  active: Screen | "other";
  onChange: (screen: Screen) => void;
}

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="メインメニュー">
      <button className={active === "home" ? "active" : ""} onClick={() => onChange("home")}><span>⌂</span><b>お店</b></button>
      <button className={active === "dashboard" ? "active" : ""} onClick={() => onChange("dashboard")}><span>▥</span><b>集計</b></button>
      <button className={active === "editor" ? "active" : ""} onClick={() => onChange("editor")}><span>＋</span><b>設計</b></button>
    </nav>
  );
}
