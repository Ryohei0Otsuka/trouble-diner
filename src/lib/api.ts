import { demoBootstrap } from "../data/demo";
import type { BootstrapData, DashboardData, IncidentInput, NewScenarioInput, RecentIncident, Scenario } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "/trouble-diner/api/index.php";
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

const writeLocal = <T,>(key: string, value: T) => localStorage.setItem(key, JSON.stringify(value));

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
  const all = [...stored, ...demoBootstrap.dashboard.recent];
  const total = demoBootstrap.dashboard.total + stored.length;
  const resolved = all.filter((item) => item.result === "resolved").length;
  const escalated = all.filter((item) => item.result === "escalated" || item.result === "stopped").length;
  const averageMinutes = Math.round(all.reduce((sum, item) => sum + item.durationSeconds, 0) / Math.max(1, all.length) / 60);
  return {
    ...demoBootstrap.dashboard,
    total,
    resolvedRate: Math.round((resolved / all.length) * 100),
    escalationRate: Math.round((escalated / all.length) * 100),
    averageMinutes,
    unclassifiedCount: demoBootstrap.dashboard.unclassifiedCount + readLocal<unknown[]>(UNCLASSIFIED_KEY, []).length,
    recent: all.slice(0, 8),
  };
};

export async function loadBootstrap(): Promise<BootstrapData> {
  try {
    const data = await request<BootstrapData>("bootstrap");
    return { ...data, dataSource: "mysql" };
  } catch {
    const custom = readLocal<Scenario[]>(SCENARIO_KEY, []);
    return { ...demoBootstrap, scenarios: [...custom, ...demoBootstrap.scenarios], dashboard: localDashboard(), dataSource: "demo" };
  }
}

export async function refreshDashboard(): Promise<DashboardData> {
  try {
    return await request<DashboardData>("dashboard");
  } catch {
    return localDashboard();
  }
}

export async function saveIncident(input: IncidentInput, scenarioTitle: string, areaName: string): Promise<void> {
  try {
    await request<{ id: number }>("incidents", { method: "POST", body: JSON.stringify(input) });
  } catch {
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
  }
}

export async function saveUnclassified(areaId: number, title: string, details: string, safetyConcern: boolean): Promise<void> {
  const body = { areaId, title, details, safetyConcern };
  try {
    await request<{ id: number }>("unclassified", { method: "POST", body: JSON.stringify(body) });
  } catch {
    const stored = readLocal<(typeof body & { id: string; occurredAt: string })[]>(UNCLASSIFIED_KEY, []);
    stored.unshift({ ...body, id: `local-${Date.now()}`, occurredAt: new Date().toISOString() });
    writeLocal(UNCLASSIFIED_KEY, stored);
  }
}

export async function createScenario(input: NewScenarioInput): Promise<Scenario> {
  try {
    return await request<Scenario>("scenarios", { method: "POST", body: JSON.stringify(input) });
  } catch {
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
  }
}
