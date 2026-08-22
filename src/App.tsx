import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { BottomNav, type Screen as NavScreen } from "./components/BottomNav";
import { Dashboard } from "./components/Dashboard";
import { FlowRunner } from "./components/FlowRunner";
import { HomeScreen } from "./components/HomeScreen";
import { ScenarioEditor } from "./components/ScenarioEditor";
import { ScenarioList } from "./components/ScenarioList";
import { UnclassifiedForm } from "./components/UnclassifiedForm";
import { loadBootstrap, refreshDashboard, resetDemoData } from "./lib/api";
import type { Area, BootstrapData, Scenario } from "./types";

type Screen = "home" | "scenarios" | "flow" | "dashboard" | "editor" | "unclassified";

export default function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);

  useEffect(() => {
    try {
      localStorage.removeItem("trouble-diner:mode");
      localStorage.removeItem("trouble-diner:xp");
    } catch {
      // 保存領域が使えない環境でも起動を続ける。
    }
    loadBootstrap().then(setData);
  }, []);

  const areaScenarios = useMemo(() => data && selectedArea ? data.scenarios.filter((item) => item.areaId === selectedArea.id) : [], [data, selectedArea]);

  const goHome = () => { setScreen("home"); setSelectedScenario(null); };
  const selectArea = (area: Area) => { setSelectedArea(area); setScreen("scenarios"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const startScenario = (scenario: Scenario) => { setSelectedScenario(scenario); setScreen("flow"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const updateDashboard = async () => {
    const dashboard = await refreshDashboard();
    setData((current) => current ? { ...current, dashboard } : current);
  };
  const completeFlow = async () => {
    await updateDashboard();
    setScreen("dashboard");
  };
  const scenarioCreated = (scenario: Scenario) => {
    setData((current) => current ? { ...current, scenarios: [scenario, ...current.scenarios] } : current);
  };
  const resetDemo = async () => {
    if (!window.confirm("このブラウザに保存したデモ記録・追加フローを初期状態へ戻しますか？")) return;
    resetDemoData();
    setData(await loadBootstrap());
  };
  const navChange = (next: NavScreen) => { setScreen(next); setSelectedScenario(null); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (!data) {
    return <main className="loading-screen"><div className="loading-pixel">TD</div><h1>NOW LOADING...</h1><div className="loading-bar"><i /></div><p>対応フローを準備中</p></main>;
  }

  const focusMode = screen === "flow" || screen === "unclassified";

  return (
    <main className="app-shell">
      <AppHeader source={data.dataSource} focusMode={focusMode} onHome={goHome} />

      {data.dataSource === "demo" && !focusMode && <aside className="demo-ribbon"><strong>DEMO MODE</strong><span>対応記録と追加フローは、このブラウザ内にだけ保存されます。</span></aside>}

      {screen === "home" && <HomeScreen areas={data.areas} scenarios={data.scenarios} onSelectArea={selectArea} />}
      {screen === "scenarios" && selectedArea && <ScenarioList area={selectedArea} scenarios={areaScenarios} onBack={goHome} onStart={startScenario} onUnclassified={() => setScreen("unclassified")} />}
      {screen === "flow" && selectedArea && selectedScenario && <FlowRunner key={selectedScenario.id} area={selectedArea} scenario={selectedScenario} onExit={() => setScreen("scenarios")} onComplete={completeFlow} />}
      {screen === "dashboard" && <Dashboard data={data.dashboard} source={data.dataSource} onRefresh={updateDashboard} onResetDemo={resetDemo} />}
      {screen === "editor" && <ScenarioEditor areas={data.areas} onCreated={scenarioCreated} />}
      {screen === "unclassified" && selectedArea && <UnclassifiedForm area={selectedArea} onBack={() => setScreen("scenarios")} onSaved={async () => { await updateDashboard(); setScreen("dashboard"); }} />}

      {screen !== "flow" && screen !== "unclassified" && <BottomNav active={screen === "home" || screen === "dashboard" || screen === "editor" ? screen : "other"} onChange={navChange} />}
    </main>
  );
}
