import type { OutcomeType, RiskLevel, Severity } from "../types";

export const severityLabels: Record<Severity, string> = {
  low: "通常",
  medium: "注意",
  high: "停止判断",
};

export function determineSeverity(risk: RiskLevel, outcome: OutcomeType): Severity {
  if (risk === "critical" || outcome === "stopped") return "high";
  if (risk === "caution" || outcome === "escalated" || outcome === "unclassified") return "medium";
  return "low";
}

export function severityReason(risk: RiskLevel, outcome: OutcomeType): string {
  if (risk === "critical") return "安全・衛生上の停止基準を含むフローです";
  if (outcome === "stopped") return "使用停止・安全確保を選択したためです";
  if (risk === "caution") return "責任者確認を要する可能性があるフローです";
  if (outcome === "escalated") return "一次対応で解決せず、引継ぎが必要なためです";
  if (outcome === "unclassified") return "未分類として責任者確認が必要なためです";
  return "標準フロー内で一次対応が完了したためです";
}
