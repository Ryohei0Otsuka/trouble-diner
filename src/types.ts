export type RiskLevel = "normal" | "caution" | "critical";
export type NodeType = "question" | "action" | "outcome";
export type OutcomeType = "resolved" | "escalated" | "stopped" | "unclassified";
export type Severity = "low" | "medium" | "high";

export interface Area {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  description: string;
}

export interface FlowChoice {
  id?: number;
  label: string;
  nextNodeKey: string;
  choiceType: "positive" | "negative" | "neutral" | "danger";
  sortOrder: number;
}

export interface FlowNode {
  id?: number;
  key: string;
  type: NodeType;
  title: string;
  body: string;
  outcomeType?: OutcomeType;
  escalationTarget?: string;
  choices: FlowChoice[];
}

export interface Scenario {
  id: number;
  areaId: number;
  slug: string;
  title: string;
  summary: string;
  riskLevel: RiskLevel;
  version: number;
  startNodeKey: string;
  estimatedMinutes: number;
  nodes: Record<string, FlowNode>;
  custom?: boolean;
}

export interface StepLog {
  nodeKey: string;
  prompt: string;
  choiceLabel: string;
}

export interface IncidentInput {
  scenarioId: number | null;
  areaId: number;
  severity: Severity;
  result: OutcomeType;
  recurrence: boolean;
  durationSeconds: number;
  note: string;
  steps: StepLog[];
}

export interface RecentIncident {
  id: number | string;
  occurredAt: string;
  areaName: string;
  scenarioTitle: string;
  result: OutcomeType;
  severity: Severity;
  durationSeconds: number;
  recurrence: boolean;
}

export interface PriorityItem {
  scenarioTitle: string;
  areaName: string;
  count: number;
  score: number;
}

export interface DashboardData {
  total: number;
  resolvedRate: number;
  escalationRate: number;
  averageMinutes: number;
  unclassifiedCount: number;
  priorities: PriorityItem[];
  recent: RecentIncident[];
}

export interface BootstrapData {
  areas: Area[];
  scenarios: Scenario[];
  dashboard: DashboardData;
  dataSource: "mysql" | "demo";
}

export interface NewScenarioInput {
  areaId: number;
  title: string;
  summary: string;
  riskLevel: RiskLevel;
  question: string;
  yesAction: string;
  noAction: string;
  escalationTarget: string;
}
