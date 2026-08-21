import { demoBootstrap } from "../data/demo";
import type { BootstrapData, DashboardData, IncidentInput, NewScenarioInput, PriorityItem, RecentIncident, Scenario } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "/trouble-diner/api/index.php";
const EXPLICIT_DEMO = import.meta.env.MODE === "demo" || import.meta.env.VITE_DEMO_MODE === "true";
const INCIDENT_KEY = "trouble-diner:incidents";
const SCENARIO_KEY = "trouble-diner:custom-scenarios";
const UNCLASSIFIED_KEY = "trouble-diner:unclassified";

const readLocal = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const writeLocal = <T,>(key: string, value: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // プライベートブラウズや容量制限時も画面操作を止めない。
  }
};

async function request<T>(action: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "API error");
  return payload.data as T;
}

const localDashboard = (): DashboardData => {
  const stored = readLocal<RecentIncident[]>(INCIDENT_KEY, []);
  if (!stored.length) return demoBootstrap.dashboard;

  const base = demoBootstrap.dashboard;
  const all = [...stored, ...base.recent].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const total = demoBootstrap.dashboard.total + stored.length;
  const resolved = Math.round(base.total * base.resolvedRate / 100) + stored.filter((item) => item.result === "resolved").length;
  const escalated = Math.round(base.total * base.escalationRate / 100) + stored.filter((item) => item.result !== "resolved").length;
  const averageMinutes = Math.round((base.averageMinutes * base.total + stored.reduce((sum, item) => sum + item.durationSeconds / 60, 0)) / total);

  const priorities = new Map<string, PriorityItem>(base.priorities.map((item) => [`${item.areaName}:${item.scenarioTitle}`, { ...item }]));
  stored.forEach((item) => {
    const key = `${item.areaName}:${item.scenarioTitle}`;
    const current = priorities.get(key) || { scenarioTitle: item.scenarioTitle, areaName: item.areaName, count: 0, score: 0 };
    const severityWeight = item.severity === "high" ? 3 : item.severity === "medium" ? 2 : 1;
    const addedScore = Math.round(severityWeight * Math.max(1, item.durationSeconds / 60) * (item.recurrence ? 1.5 : 1));
    priorities.set(key, { ...current, count: current.count + 1, score: current.score + addedScore });
  });

  return {
    ...base,
    total,
    resolvedRate: Math.round((resolved / total) * 100),
    escalationRate: Math.round((escalated / total) * 100),
    averageMinutes,
    unclassifiedCount: base.unclassifiedCount + readLocal<unknown[]>(UNCLASSIFIED_KEY, []).length,
    priorities: [...priorities.values()].sort((a, b) => b.score - a.score || b.count - a.count).slice(0, 5),
    recent: all.slice(0, 8),
  };
};

const localBootstrap = (): BootstrapData => {
  const custom = readLocal<Scenario[]>(SCENARIO_KEY, []);
  return { ...demoBootstrap, scenarios: [...custom, ...demoBootstrap.scenarios], dashboard: localDashboard(), dataSource: "demo" };
};

export async function loadBootstrap(): Promise<BootstrapData> {
  if (EXPLICIT_DEMO) return localBootstrap();
  try {
    const data = await request<BootstrapData>("bootstrap");
    return { ...data, dataSource: "mysql" };
  } catch {
    return localBootstrap();
  }
}

export async function refreshDashboard(): Promise<DashboardData> {
  if (EXPLICIT_DEMO) return localDashboard();
  try {
    return await request<DashboardData>("dashboard");
  } catch {
    return localDashboard();
  }
}

export async function saveIncident(input: IncidentInput, scenarioTitle: string, areaName: string): Promise<void> {
  const saveLocal = () => {
    const stored = readLocal<RecentIncident[]>(INCIDENT_KEY, []);
    stored.unshift({
      id: `local-${Date.now()}`,
      occurredAt: new Date().toISOString(),
      areaName,
      scenarioTitle,
      result: input.result,
      severity: input.severity,
      durationSeconds: input.durationSeconds,
      recurrence: input.recurrence,
    });
    writeLocal(INCIDENT_KEY, stored.slice(0, 50));
  };

  if (EXPLICIT_DEMO) {
    saveLocal();
    return;
  }

  try {
    await request<{ id: number }>("incidents", { method: "POST", body: JSON.stringify(input) });
  } catch {
    saveLocal();
  }
}

export async function saveUnclassified(areaId: number, title: string, details: string, safetyConcern: boolean): Promise<void> {
  const body = { areaId, title, details, safetyConcern };
  const saveLocal = () => {
    const stored = readLocal<(typeof body & { id: string; occurredAt: string })[]>(UNCLASSIFIED_KEY, []);
    stored.unshift({ ...body, id: `local-${Date.now()}`, occurredAt: new Date().toISOString() });
    writeLocal(UNCLASSIFIED_KEY, stored);
  };

  if (EXPLICIT_DEMO) {
    saveLocal();
    return;
  }

  try {
    await request<{ id: number }>("unclassified", { method: "POST", body: JSON.stringify(body) });
  } catch {
    saveLocal();
  }
}

export async function createScenario(input: NewScenarioInput): Promise<Scenario> {
  const createLocal = () => {
    const id = Date.now();
    const scenario: Scenario = {
      id,
      areaId: input.areaId,
      slug: `custom-${id}`,
      title: input.title,
      summary: input.summary,
      riskLevel: input.riskLevel,
      version: 1,
      startNodeKey: "start",
      estimatedMinutes: 5,
      custom: true,
      nodes: {
        start: {
          key: "start", type: "question", title: input.question, body: "現場で確認できた事実だけをもとに選択します。",
          choices: [
            { label: "はい", nextNodeKey: "yes", choiceType: "positive", sortOrder: 1 },
            { label: "いいえ", nextNodeKey: "no", choiceType: "negative", sortOrder: 2 },
          ],
        },
        yes: { key: "yes", type: "outcome", title: input.yesAction, body: "実施内容と結果を記録します。", outcomeType: "resolved", choices: [] },
        no: { key: "no", type: "outcome", title: input.noAction, body: "判断材料をそろえて責任者へ連携します。", outcomeType: "escalated", escalationTarget: input.escalationTarget, choices: [] },
      },
    };
    const stored = readLocal<Scenario[]>(SCENARIO_KEY, []);
    writeLocal(SCENARIO_KEY, [scenario, ...stored]);
    return scenario;
  };

  if (EXPLICIT_DEMO) return createLocal();

  try {
    return await request<Scenario>("scenarios", { method: "POST", body: JSON.stringify(input) });
  } catch {
    return createLocal();
  }
}

export function resetDemoData(): void {
  try {
    [INCIDENT_KEY, SCENARIO_KEY, UNCLASSIFIED_KEY].forEach((key) => localStorage.removeItem(key));
  } catch {
    // ブラウザの保存領域が利用できない場合も、画面操作を止めない。
  }
}
