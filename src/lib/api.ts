import { demoBootstrap, demoUnclassified } from "../data/demo";
import type {
  BootstrapData,
  DashboardData,
  IncidentInput,
  IncidentRecord,
  NewScenarioInput,
  PriorityItem,
  SavedIncident,
  Scenario,
  UnclassifiedRecord,
} from "../types";

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
    // 保存領域が使えなくても、その場の操作は止めない。
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

function normalizeIncident(item: Partial<IncidentRecord> & Record<string, unknown>): IncidentRecord {
  const legacyDuration = Number(item.durationSeconds || 0);
  const result = item.result || "unclassified";
  const occurredAt = item.occurredAt || new Date().toISOString();
  const status = item.status || (result === "resolved" ? "resolved" : "open");
  return {
    id: item.id || `local-${Date.now()}`,
    occurredAt,
    areaName: item.areaName || "未設定",
    scenarioTitle: item.scenarioTitle || "未分類トラブル",
    result,
    severity: item.severity || "medium",
    status,
    triageSeconds: Number(item.triageSeconds || Math.min(legacyDuration || 60, 300)),
    recoverySeconds: item.recoverySeconds === null ? null : Number(item.recoverySeconds || (status === "resolved" ? legacyDuration : 0)) || null,
    recoveredAt: item.recoveredAt || null,
    recurrence: Boolean(item.recurrence),
    note: String(item.note || ""),
    routeSummary: String(item.routeSummary || ""),
    resolutionNote: String(item.resolutionNote || ""),
  };
}

function storedIncidents(): IncidentRecord[] {
  return readLocal<Array<Partial<IncidentRecord> & Record<string, unknown>>>(INCIDENT_KEY, []).map(normalizeIncident);
}

function storedUnclassified(): UnclassifiedRecord[] {
  return readLocal<UnclassifiedRecord[]>(UNCLASSIFIED_KEY, []);
}

const localDashboard = (): DashboardData => {
  const stored = storedIncidents();
  const unclassifiedMap = new Map<number | string, UnclassifiedRecord>(demoUnclassified.map((item) => [item.id, item]));
  storedUnclassified().forEach((item) => unclassifiedMap.set(item.id, item));
  const unclassified = [...unclassifiedMap.values()]
    .filter((item) => item.status === "new" || item.status === "reviewing")
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const base = demoBootstrap.dashboard;
  const all = [...stored, ...base.recent].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const total = base.total + stored.length;
  const resolved = Math.round(base.total * base.resolvedRate / 100) + stored.filter((item) => item.result === "resolved").length;
  const escalated = Math.round(base.total * base.escalationRate / 100) + stored.filter((item) => item.result !== "resolved").length;
  const recoveredStored = stored.filter((item) => item.recoverySeconds !== null);
  const averageRecoveryMinutes = Math.round(
    (base.averageRecoveryMinutes * base.total + recoveredStored.reduce((sum, item) => sum + (item.recoverySeconds || 0) / 60, 0))
    / Math.max(1, base.total + recoveredStored.length),
  );
  const activeIncidents = stored.filter((item) => item.status === "open");
  const safety = unclassified.filter((item) => item.safetyConcern).length;

  const priorities = new Map<string, PriorityItem>(base.priorities.map((item) => [`${item.areaName}:${item.scenarioTitle}`, { ...item }]));
  stored.forEach((item) => {
    const key = `${item.areaName}:${item.scenarioTitle}`;
    const current = priorities.get(key) || { scenarioTitle: item.scenarioTitle, areaName: item.areaName, count: 0, score: 0, stoppedCount: 0, repeatCount: 0, averageRecoveryMinutes: 0 };
    const severityWeight = item.severity === "high" ? 3 : item.severity === "medium" ? 2 : 1;
    const elapsedMinutes = item.recoverySeconds !== null
      ? Math.max(1, item.recoverySeconds / 60)
      : Math.max(1, (Date.now() - new Date(item.occurredAt).getTime()) / 60000);
    const addedScore = Math.round(severityWeight * elapsedMinutes * (item.recurrence ? 1.5 : 1));
    const nextAverage = item.recoverySeconds === null
      ? current.averageRecoveryMinutes
      : Math.round((current.averageRecoveryMinutes * current.count + item.recoverySeconds / 60) / Math.max(1, current.count + 1));
    priorities.set(key, {
      ...current,
      count: current.count + 1,
      score: current.score + addedScore,
      stoppedCount: current.stoppedCount + (item.result === "stopped" ? 1 : 0),
      repeatCount: current.repeatCount + (item.recurrence ? 1 : 0),
      averageRecoveryMinutes: nextAverage,
    });
  });

  return {
    total,
    resolvedRate: Math.round((resolved / Math.max(1, total)) * 100),
    escalationRate: Math.round((escalated / Math.max(1, total)) * 100),
    averageRecoveryMinutes,
    unclassifiedCount: unclassified.length,
    activeSummary: {
      total: activeIncidents.length + safety,
      escalated: activeIncidents.filter((item) => item.result === "escalated" || item.result === "unclassified").length,
      stopped: activeIncidents.filter((item) => item.result === "stopped").length,
      safety,
    },
    activeIncidents,
    unclassified,
    priorities: [...priorities.values()].sort((a, b) => b.score - a.score || b.count - a.count).slice(0, 5),
    recent: all.slice(0, 10),
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

export async function saveIncident(input: IncidentInput, scenarioTitle: string, areaName: string): Promise<SavedIncident> {
  const saveLocal = (): SavedIncident => {
    const occurredAt = new Date(input.occurredAt).toISOString();
    const now = new Date().toISOString();
    const status = input.result === "resolved" ? "resolved" : "open";
    const saved: IncidentRecord = {
      id: `local-${Date.now()}`,
      occurredAt,
      areaName,
      scenarioTitle,
      result: input.result,
      severity: input.severity,
      status,
      triageSeconds: input.triageSeconds,
      recoverySeconds: status === "resolved" ? Math.max(input.triageSeconds, Math.round((Date.now() - new Date(occurredAt).getTime()) / 1000)) : null,
      recoveredAt: status === "resolved" ? now : null,
      recurrence: input.recurrence,
      note: input.note,
      routeSummary: input.steps.map((step) => `${step.prompt} → ${step.choiceLabel}`).join(" / "),
      resolutionNote: status === "resolved" ? "一次対応で解決" : "",
    };
    writeLocal(INCIDENT_KEY, [saved, ...storedIncidents()].slice(0, 100));
    return { id: saved.id, occurredAt: saved.occurredAt, status: saved.status };
  };

  if (EXPLICIT_DEMO) return saveLocal();
  try {
    return await request<SavedIncident>("incidents", { method: "POST", body: JSON.stringify(input) });
  } catch {
    return saveLocal();
  }
}

export async function resolveIncident(id: number | string, resolutionNote: string, source: "mysql" | "demo"): Promise<void> {
  const resolveLocal = () => {
    const now = new Date();
    writeLocal(INCIDENT_KEY, storedIncidents().map((item) => item.id === id ? {
      ...item,
      status: "resolved" as const,
      recoveredAt: now.toISOString(),
      recoverySeconds: Math.max(1, Math.round((now.getTime() - new Date(item.occurredAt).getTime()) / 1000)),
      resolutionNote,
    } : item));
  };
  if (EXPLICIT_DEMO || source === "demo" || String(id).startsWith("local-")) return resolveLocal();
  await request<void>("resolve-incident", { method: "POST", body: JSON.stringify({ id, resolutionNote }) });
}

export async function saveUnclassified(areaId: number, areaName: string, title: string, details: string, safetyConcern: boolean): Promise<UnclassifiedRecord> {
  const body = { areaId, title, details, safetyConcern };
  const saveLocal = (): UnclassifiedRecord => {
    const saved: UnclassifiedRecord = { ...body, areaName, id: `unknown-${Date.now()}`, occurredAt: new Date().toISOString(), status: "new" };
    writeLocal(UNCLASSIFIED_KEY, [saved, ...storedUnclassified()]);
    return saved;
  };
  if (EXPLICIT_DEMO) return saveLocal();
  try {
    return await request<UnclassifiedRecord>("unclassified", { method: "POST", body: JSON.stringify(body) });
  } catch {
    return saveLocal();
  }
}

export async function closeUnclassified(id: number | string, source: "mysql" | "demo"): Promise<void> {
  const closeLocal = () => {
    const stored = storedUnclassified();
    const target = stored.find((item) => item.id === id) || demoUnclassified.find((item) => item.id === id);
    if (!target) return;
    writeLocal(UNCLASSIFIED_KEY, [{ ...target, status: "closed" as const }, ...stored.filter((item) => item.id !== id)]);
  };
  if (EXPLICIT_DEMO || source === "demo" || String(id).startsWith("unknown-")) return closeLocal();
  await request<void>("close-unclassified", { method: "POST", body: JSON.stringify({ id }) });
}

export async function createScenario(input: NewScenarioInput): Promise<Scenario> {
  const createLocal = () => {
    const id = Date.now();
    const scenario: Scenario = {
      id, areaId: input.areaId, slug: `custom-${id}`, title: input.title, summary: input.summary,
      riskLevel: input.riskLevel, version: 1, startNodeKey: "start", estimatedMinutes: 5, custom: true,
      nodes: {
        start: { key: "start", type: "question", title: input.question, body: "現場で確認できた事実だけをもとに選択します。", choices: [
          { label: "はい", nextNodeKey: "yes", choiceType: "positive", sortOrder: 1 },
          { label: "いいえ", nextNodeKey: "no", choiceType: "negative", sortOrder: 2 },
        ] },
        yes: { key: "yes", type: "outcome", title: input.yesAction, body: "実施内容と結果を記録します。", outcomeType: "resolved", choices: [] },
        no: { key: "no", type: "outcome", title: input.noAction, body: "判断材料をそろえて責任者へ連携します。", outcomeType: "escalated", escalationTarget: input.escalationTarget, choices: [] },
      },
    };
    writeLocal(SCENARIO_KEY, [scenario, ...readLocal<Scenario[]>(SCENARIO_KEY, [])]);
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
    // 保存領域が使えなくても初期画面は表示する。
  }
}
