import type { Area, BootstrapData, FlowNode, OutcomeType, RecentIncident, RiskLevel, Scenario } from "../types";

export const demoAreas: Area[] = [
  { id: 1, slug: "floor", name: "ホール", shortName: "FLOOR", icon: "テ", color: "#ff7b63", description: "注文・提供・お客様対応" },
  { id: 2, slug: "kitchen", name: "キッチン", shortName: "KITCHEN", icon: "鍋", color: "#ffb23e", description: "調理・冷蔵・厨房機器" },
  { id: 3, slug: "register", name: "レジ", shortName: "REGISTER", icon: "￥", color: "#5bbda8", description: "POS・会計・決済" },
  { id: 4, slug: "stock", name: "倉庫", shortName: "STOCK", icon: "箱", color: "#8f78d8", description: "在庫・納品・備品" },
  { id: 5, slug: "delivery", name: "受取口", shortName: "DELIVERY", icon: "袋", color: "#4ea7dc", description: "持帰り・配達注文" },
  { id: 6, slug: "facility", name: "設備", shortName: "FACILITY", icon: "工", color: "#e66767", description: "水道・電気・空調" },
  { id: 7, slug: "staff", name: "スタッフ", shortName: "CREW", icon: "人", color: "#7eb64a", description: "欠勤・負傷・引継ぎ" },
  { id: 8, slug: "other", name: "その他", shortName: "OTHER", icon: "？", color: "#7a8890", description: "未分類・判断不能" },
];

const q = (key: string, title: string, body: string, yes: string, no: string, yesLabel = "はい", noLabel = "いいえ"): FlowNode => ({
  key, type: "question", title, body,
  choices: [
    { label: yesLabel, nextNodeKey: yes, choiceType: "positive", sortOrder: 1 },
    { label: noLabel, nextNodeKey: no, choiceType: "negative", sortOrder: 2 },
  ],
});

const action = (key: string, title: string, body: string, next: string): FlowNode => ({
  key, type: "action", title, body,
  choices: [{ label: "実施した", nextNodeKey: next, choiceType: "positive", sortOrder: 1 }],
});

const end = (key: string, title: string, body: string, outcomeType: OutcomeType, escalationTarget = ""): FlowNode => ({
  key, type: "outcome", title, body, outcomeType, escalationTarget, choices: [],
});

const scenario = (
  id: number, areaId: number, slug: string, title: string, summary: string,
  riskLevel: RiskLevel, estimatedMinutes: number, nodes: FlowNode[], startNodeKey = "start",
): Scenario => ({
  id, areaId, slug, title, summary, riskLevel, version: 1, startNodeKey, estimatedMinutes,
  nodes: Object.fromEntries(nodes.map((node) => [node.key, node])),
});

export const demoScenarios: Scenario[] = [
  scenario(1, 1, "wrong-order", "注文と違う料理を提供した", "注文内容と提供状況を確認し、作り直し・責任者連携を判断する", "normal", 4, [
    q("start", "お客様はまだ料理に手を付けていませんか？", "下げる前に、伝票・卓番号・料理名を照合します。", "untouched", "touched"),
    action("untouched", "誤提供品を下げて注文を再確認", "お詫びし、正しい注文内容と提供見込みを復唱します。", "can-remake"),
    q("can-remake", "通常の調理時間内で作り直せますか？", "厨房の混雑と食材在庫を確認します。", "resolved", "manager"),
    end("resolved", "作り直しを手配して一次対応完了", "正しい料理の提供まで担当者を決め、誤提供の原因を記録します。", "resolved"),
    end("touched", "責任者へ引き継ぐ", "飲食済みのため、料理の扱い・会計対応を現場判断せず責任者へ連携します。", "escalated", "店舗責任者"),
    end("manager", "提供遅延を含め責任者へ相談", "代替提案や会計対応を作業者だけで決めず、責任者へ連携します。", "escalated", "店舗責任者"),
  ]),
  scenario(2, 1, "long-wait", "料理の提供が大幅に遅れている", "注文送信・厨房受付・調理状況のどこで止まっているか確認する", "normal", 5, [
    q("start", "注文は厨房へ送信されていますか？", "POSの送信履歴または厨房伝票を確認します。", "kitchen", "resend"),
    action("resend", "注文を重複させず厨房へ連携", "未送信を確認したうえで一度だけ送信し、厨房へ口頭でも共有します。", "estimate"),
    q("kitchen", "厨房で調理状況を特定できましたか？", "担当・現在工程・完成見込みを確認します。", "estimate", "manager"),
    action("estimate", "提供見込みをお客様へ案内", "曖昧な約束をせず、確認できた見込みとお詫びを伝えます。", "resolved"),
    end("resolved", "提供担当を決めて完了", "完成後の提供漏れを防ぐため、担当者と卓番号を記録します。", "resolved"),
    end("manager", "原因不明として責任者へ連携", "注文情報・経過時間・確認済み箇所をまとめて責任者へ引き継ぎます。", "escalated", "店舗責任者"),
  ]),
  scenario(3, 3, "pos-down", "POSレジが操作できない", "端末単体か店舗全体かを切り分け、二重会計を防ぐ", "caution", 6, [
    q("start", "他のレジ端末は動いていますか？", "同じ操作を何度も行わず、影響範囲だけ確認します。", "single", "all"),
    action("single", "正常端末へ会計を切り替える", "未確定伝票の状態を確認し、会計を一度だけ処理します。", "duplicate"),
    q("duplicate", "元端末に会計完了の記録はありませんか？", "レシート・決済端末・POS履歴の三点を確認します。", "manager", "resolved"),
    end("resolved", "代替端末で会計完了", "停止端末と発生時刻を記録し、保守確認対象にします。", "resolved"),
    end("all", "全端末障害として利用停止を連携", "手書き・現金対応を独断で開始せず、店舗の障害時手順へ切り替えます。", "stopped", "POS保守・店舗責任者"),
    end("manager", "二重決済の可能性を連携", "追加決済を止め、取引時刻と参照情報を責任者へ引き継ぎます。", "escalated", "店舗責任者・決済担当"),
  ]),
  scenario(4, 3, "payment-error", "キャッシュレス決済が完了しない", "決済結果を確認し、再試行による二重請求を防ぐ", "caution", 5, [
    q("start", "決済端末に完了表示がありますか？", "金額・時刻・取引結果だけを確認し、カード情報は記録しません。", "pos-check", "retry-check"),
    q("pos-check", "POS側にも会計済みで記録されていますか？", "両方の記録が一致するか確認します。", "resolved", "manager"),
    q("retry-check", "取引履歴に処理中または成功が残っていませんか？", "結果不明のまま再試行しません。", "manager", "alternate"),
    end("alternate", "別の決済手段を案内", "元取引が未成立であることを確認後、利用可能な方法を案内します。", "resolved"),
    end("resolved", "決済完了を確認", "レシートとPOS履歴が一致していることを確認します。", "resolved"),
    end("manager", "結果不整合として連携", "追加操作を止め、取引参照情報を責任者へ引き継ぎます。", "escalated", "店舗責任者・決済担当"),
  ]),
  scenario(5, 2, "fridge-alert", "冷蔵設備に異常表示が出た", "商品を安易に使用せず、影響範囲と記録を保全する", "critical", 5, [
    q("start", "庫内の商品へ影響する可能性がありますか？", "判断できない場合は「ある」として扱います。", "stop-use", "record", "ある・不明", "ない"),
    action("stop-use", "対象商品の使用を止めて区分する", "廃棄・提供可否を作業者だけで決めず、店舗の衛生管理計画に従います。", "manager"),
    action("record", "表示内容と確認時刻を記録", "設定変更や分解をせず、設備の状態をそのまま記録します。", "manager"),
    end("manager", "責任者・設備保守へ優先連携", "対象設備、確認時刻、商品への影響可能性をまとめて引き継ぎます。", "stopped", "衛生管理責任者・設備保守"),
  ]),
  scenario(6, 4, "ingredient-shortage", "営業中に主要食材が不足した", "残数・影響メニュー・代替可否を整理する", "normal", 4, [
    q("start", "同じ品質で提供できる承認済み代替品がありますか？", "個人判断でレシピや原材料を変更しません。", "stock-check", "sold-out"),
    q("stock-check", "次回納品まで必要数を確保できますか？", "予約数・残数・使用予定数を確認します。", "resolved", "manager"),
    end("resolved", "代替品へ切り替えて記録", "切替時刻と対象メニューをスタッフへ共有します。", "resolved"),
    end("sold-out", "対象メニューを販売停止", "注文受付を止め、表示・口頭案内・デリバリー在庫をそろえて更新します。", "stopped", "店舗責任者"),
    end("manager", "不足見込みを責任者へ連携", "残数と影響見込みを共有し、販売継続範囲を判断してもらいます。", "escalated", "店舗責任者"),
  ]),
  scenario(7, 5, "delivery-mismatch", "持ち帰り商品と注文内容が違う", "注文番号・受渡状況・作り直し可否を整理する", "normal", 6, [
    q("start", "商品はまだ店舗内にありますか？", "注文番号と袋のラベルを照合します。", "inside", "left"),
    action("inside", "正しい商品へ入れ替える", "受渡前に全品を再確認し、誤った袋を分離します。", "resolved"),
    end("resolved", "受渡内容を確認して完了", "注文番号と商品数を復唱し、原因を記録します。", "resolved"),
    end("left", "店舗外受渡しとして責任者へ連携", "連絡方法・再配送・返金を独断で決めず、注文情報をまとめます。", "escalated", "店舗責任者・デリバリー担当"),
  ]),
  scenario(8, 7, "crew-absence", "急な欠勤で人員が不足した", "欠員数と停止する業務を整理し、安全な営業範囲を判断する", "caution", 7, [
    q("start", "必須ポジションをすべて配置できますか？", "人数だけでなく、担当可能な業務と休憩を確認します。", "limit", "manager"),
    q("limit", "一部メニュー・席数を制限すれば安全に運営できますか？", "無理な兼務を前提にしません。", "resolved", "manager"),
    end("resolved", "制限営業へ切り替える", "停止範囲と再判断時刻を全員へ共有します。", "resolved"),
    end("manager", "営業範囲の判断を責任者へ連携", "欠員、配置可能業務、混雑見込みを整理して判断を依頼します。", "escalated", "店舗責任者"),
  ]),
  scenario(9, 1, "allergy-question", "アレルギーについて質問された", "曖昧な回答を避け、確認済み情報だけを案内する", "critical", 3, [
    q("start", "店舗の正式な原材料情報で確認できますか？", "記憶や見た目で判断しません。", "official", "manager"),
    q("official", "交差接触を含め、安全を断言できる運用ですか？", "不明点が一つでもあれば断言しません。", "explain", "manager"),
    action("explain", "確認できた範囲だけを説明", "最終的な利用判断はお客様に委ね、回答内容を記録します。", "resolved"),
    end("resolved", "案内内容を記録して完了", "参照した情報と説明担当者を記録します。", "resolved"),
    end("manager", "回答せず責任者へ引き継ぐ", "安全を推測せず、正式資料を確認できる責任者へ連携します。", "escalated", "衛生管理責任者"),
  ]),
  scenario(10, 6, "power-trouble", "店舗設備の電源が入らない", "端末単体か系統障害かを確認し、危険な復旧操作を避ける", "caution", 5, [
    q("start", "焦げ臭・煙・異音・発熱がありますか？", "一つでもある、または判断できない場合は危険側へ進みます。", "danger", "range", "ある・不明", "ない"),
    q("range", "同じ周辺の複数設備が停止していますか？", "分解や配線変更はせず、影響範囲のみ確認します。", "facility", "single"),
    end("danger", "使用中止・安全確保を優先", "設備に触れず、店舗の緊急手順に従い責任者へ直ちに連携します。", "stopped", "店舗責任者・緊急窓口"),
    end("facility", "系統障害として設備担当へ連携", "停止範囲と発生時刻を記録し、営業への影響判断を依頼します。", "escalated", "設備保守・店舗責任者"),
    end("single", "単体故障として使用停止", "代替設備の有無を確認し、対象設備を使用停止表示にします。", "stopped", "設備保守"),
  ]),
];

const recent: RecentIncident[] = [
  { id: "d1", occurredAt: "2026-08-22T10:42:00+09:00", areaName: "レジ", scenarioTitle: "POSレジが操作できない", result: "escalated", severity: "high", durationSeconds: 780, recurrence: true },
  { id: "d2", occurredAt: "2026-08-22T09:18:00+09:00", areaName: "ホール", scenarioTitle: "注文と違う料理を提供した", result: "resolved", severity: "medium", durationSeconds: 310, recurrence: false },
  { id: "d3", occurredAt: "2026-08-21T19:37:00+09:00", areaName: "キッチン", scenarioTitle: "冷蔵設備に異常表示が出た", result: "stopped", severity: "high", durationSeconds: 1020, recurrence: true },
  { id: "d4", occurredAt: "2026-08-21T17:04:00+09:00", areaName: "受取口", scenarioTitle: "持ち帰り商品と注文内容が違う", result: "resolved", severity: "low", durationSeconds: 240, recurrence: false },
  { id: "d5", occurredAt: "2026-08-20T12:26:00+09:00", areaName: "スタッフ", scenarioTitle: "急な欠勤で人員が不足した", result: "escalated", severity: "medium", durationSeconds: 900, recurrence: false },
  { id: "d6", occurredAt: "2026-08-20T11:13:00+09:00", areaName: "ホール", scenarioTitle: "料理の提供が大幅に遅れている", result: "resolved", severity: "medium", durationSeconds: 480, recurrence: true },
];

export const demoBootstrap: BootstrapData = {
  areas: demoAreas,
  scenarios: demoScenarios,
  dataSource: "demo",
  dashboard: {
    total: 18,
    resolvedRate: 61,
    escalationRate: 28,
    averageMinutes: 9,
    unclassifiedCount: 3,
    priorities: [
      { scenarioTitle: "冷蔵設備に異常表示が出た", areaName: "キッチン", count: 3, score: 243 },
      { scenarioTitle: "POSレジが操作できない", areaName: "レジ", count: 4, score: 196 },
      { scenarioTitle: "料理の提供が大幅に遅れている", areaName: "ホール", count: 5, score: 152 },
      { scenarioTitle: "急な欠勤で人員が不足した", areaName: "スタッフ", count: 2, score: 118 },
      { scenarioTitle: "注文と違う料理を提供した", areaName: "ホール", count: 4, score: 92 },
    ],
    recent,
  },
};
