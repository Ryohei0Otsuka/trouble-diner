import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { BottomNav, type Screen as NavScreen } from "./components/BottomNav";
import { Dashboard } from "./components/Dashboard";
import { FlowRunner } from "./components/FlowRunner";
import { HomeScreen } from "./components/HomeScreen";
import { ScenarioEditor } from "./components/ScenarioEditor";
import { ScenarioList } from "./components/ScenarioList";
import { UnclassifiedForm } from "./components/UnclassifiedForm";
import { loadBootstrap, refreshDashboard } from "./lib/api";
import type { AppMode, Area, BootstrapData, Scenario } from "./types";

type Screen = "home" | "scenarios" | "flow" | "dashboard" | "editor" | "unclassified";

export default function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [mode, setMode] = useState<AppMode>(() => (localStorage.getItem("trouble-diner:mode") as AppMode) || "training");
  const [xp, setXp] = useState(() => Number(localStorage.getItem("trouble-diner:xp") || 0));

  useEffect(() => { loadBootstrap().then(setData); }, []);

  const areaScenarios = useMemo(() => data && selectedArea ? data.scenarios.filter((item) => item.areaId === selectedArea.id) : [], [data, selectedArea]);

  const changeMode = (next: AppMode) => { setMode(next); localStorage.setItem("trouble-diner:mode", next); };
  const goHome = () => { setScreen("home"); setSelectedScenario(null); };
  const selectArea = (area: Area) => { setSelectedArea(area); setScreen("scenarios"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const startScenario = (scenario: Scenario) => { setSelectedScenario(scenario); setScreen("flow"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const updateDashboard = async () => {
    const dashboard = await refreshDashboard();
    setData((current) => current ? { ...current, dashboard } : current);
  };
  const completeFlow = async (earnedXp: number) => {
    if (earnedXp) {
      const next = xp + earnedXp;
      setXp(next);
      localStorage.setItem("trouble-diner:xp", String(next));
    }
    await updateDashboard();
    setScreen("dashboard");
  };
  const scenarioCreated = (scenario: Scenario) => {
    setData((current) => current ? { ...current, scenarios: [scenario, ...current.scenarios] } : current);
  };
  const navChange = (next: NavScreen) => { setScreen(next); setSelectedScenario(null); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (!data) {
    return <main className="loading-screen"><div className="loading-pixel">TD</div><h1>NOW LOADING...</h1><div className="loading-bar"><i /></div><p>クエストデータを準備中</p></main>;
  }

  return (
    <main className="app-shell">
      <AppHeader mode={mode} source={data.dataSource} xp={xp} onModeChange={changeMode} onHome={goHome} />

      {screen === "home" && <HomeScreen areas={data.areas} scenarios={data.scenarios} onSelectArea={selectArea} />}
      {screen === "scenarios" && selectedArea && <ScenarioList area={selectedArea} scenarios={areaScenarios} onBack={goHome} onStart={startScenario} onUnclassified={() => setScreen("unclassified")} />}
      {screen === "flow" && selectedArea && selectedScenario && <FlowRunner key={`${selectedScenario.id}-${mode}`} area={selectedArea} scenario={selectedScenario} mode={mode} onExit={() => setScreen("scenarios")} onComplete={completeFlow} />}
      {screen === "dashboard" && <Dashboard data={data.dashboard} onRefresh={updateDashboard} />}
      {screen === "editor" && <ScenarioEditor areas={data.areas} onCreated={scenarioCreated} />}
      {screen === "unclassified" && selectedArea && <UnclassifiedForm area={selectedArea} onBack={() => setScreen("scenarios")} onSaved={async () => { await updateDashboard(); setScreen("dashboard"); }} />}

      {screen !== "flow" && screen !== "unclassified" && <BottomNav active={screen === "home" || screen === "dashboard" || screen === "editor" ? screen : "other"} onChange={navChange} />}
    </main>
  );
}
