-- TROUBLE DINER / XAMPP MySQL・MariaDB 初期化
-- 既存テーブルや記録は削除しません。初期データは同じキーなら更新されます。

CREATE DATABASE IF NOT EXISTS trouble_diner
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE trouble_diner;

CREATE TABLE IF NOT EXISTS areas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  short_name VARCHAR(50) NOT NULL,
  icon VARCHAR(10) NOT NULL,
  color CHAR(7) NOT NULL,
  description VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_areas_slug (slug)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS scenarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  area_id INT UNSIGNED NOT NULL,
  slug VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary VARCHAR(500) NOT NULL DEFAULT '',
  risk_level ENUM('normal','caution','critical') NOT NULL DEFAULT 'normal',
  version INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'published',
  start_node_key VARCHAR(80) NOT NULL DEFAULT 'start',
  estimated_minutes INT UNSIGNED NOT NULL DEFAULT 5,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_scenarios_slug (slug),
  KEY idx_scenarios_area (area_id),
  CONSTRAINT fk_scenarios_area FOREIGN KEY (area_id) REFERENCES areas(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS flow_nodes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  scenario_id INT UNSIGNED NOT NULL,
  node_key VARCHAR(80) NOT NULL,
  node_type ENUM('question','action','outcome') NOT NULL,
  title VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  outcome_type ENUM('resolved','escalated','stopped','unclassified') NULL,
  escalation_target VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_flow_node_key (scenario_id, node_key),
  CONSTRAINT fk_nodes_scenario FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS flow_choices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  node_id INT UNSIGNED NOT NULL,
  label VARCHAR(255) NOT NULL,
  next_node_key VARCHAR(80) NOT NULL,
  choice_type ENUM('positive','negative','neutral','danger') NOT NULL DEFAULT 'neutral',
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_choice_order (node_id, sort_order),
  CONSTRAINT fk_choices_node FOREIGN KEY (node_id) REFERENCES flow_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS incidents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scenario_id INT UNSIGNED NULL,
  area_id INT UNSIGNED NOT NULL,
  mode ENUM('training','mock-live') NOT NULL DEFAULT 'training',
  severity ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  result ENUM('resolved','escalated','stopped','unclassified') NOT NULL,
  recurrence TINYINT(1) NOT NULL DEFAULT 0,
  duration_seconds INT UNSIGNED NOT NULL DEFAULT 1,
  note TEXT NOT NULL,
  seed_key VARCHAR(50) NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_incidents_seed (seed_key),
  KEY idx_incidents_scenario (scenario_id),
  KEY idx_incidents_area_date (area_id, occurred_at),
  CONSTRAINT fk_incidents_scenario FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_incidents_area FOREIGN KEY (area_id) REFERENCES areas(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS incident_steps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_id BIGINT UNSIGNED NOT NULL,
  node_key VARCHAR(80) NOT NULL,
  prompt VARCHAR(500) NOT NULL,
  choice_label VARCHAR(255) NOT NULL,
  step_order INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY idx_steps_incident (incident_id, step_order),
  CONSTRAINT fk_steps_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS unclassified_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  area_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  details TEXT NOT NULL,
  safety_concern TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('new','reviewing','converted','closed') NOT NULL DEFAULT 'new',
  seed_key VARCHAR(50) NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_unclassified_seed (seed_key),
  KEY idx_unclassified_status (status, occurred_at),
  CONSTRAINT fk_unclassified_area FOREIGN KEY (area_id) REFERENCES areas(id)
) ENGINE=InnoDB;

INSERT INTO areas (id, slug, name, short_name, icon, color, description, sort_order) VALUES
  (1, 'floor', 'ホール', 'FLOOR', 'テ', '#ff7b63', '注文・提供・お客様対応', 1),
  (2, 'kitchen', 'キッチン', 'KITCHEN', '鍋', '#ffb23e', '調理・冷蔵・厨房機器', 2),
  (3, 'register', 'レジ', 'REGISTER', '￥', '#5bbda8', 'POS・会計・決済', 3),
  (4, 'stock', '倉庫', 'STOCK', '箱', '#8f78d8', '在庫・納品・備品', 4),
  (5, 'delivery', '受取口', 'DELIVERY', '袋', '#4ea7dc', '持帰り・配達注文', 5),
  (6, 'facility', '設備', 'FACILITY', '工', '#e66767', '水道・電気・空調', 6),
  (7, 'staff', 'スタッフ', 'CREW', '人', '#7eb64a', '欠勤・負傷・引継ぎ', 7),
  (8, 'other', 'その他', 'OTHER', '？', '#7a8890', '未分類・判断不能', 8)
ON DUPLICATE KEY UPDATE name=VALUES(name), short_name=VALUES(short_name), icon=VALUES(icon), color=VALUES(color), description=VALUES(description), sort_order=VALUES(sort_order);

INSERT INTO scenarios (id, area_id, slug, title, summary, risk_level, version, status, start_node_key, estimated_minutes) VALUES
  (1, 1, 'wrong-order', '注文と違う料理を提供した', '注文内容と提供状況を確認し、作り直し・責任者連携を判断する', 'normal', 1, 'published', 'start', 4),
  (2, 1, 'long-wait', '料理の提供が大幅に遅れている', '注文送信・厨房受付・調理状況のどこで止まっているか確認する', 'normal', 1, 'published', 'start', 5),
  (3, 3, 'pos-down', 'POSレジが操作できない', '端末単体か店舗全体かを切り分け、二重会計を防ぐ', 'caution', 1, 'published', 'start', 6),
  (4, 3, 'payment-error', 'キャッシュレス決済が完了しない', '決済結果を確認し、再試行による二重請求を防ぐ', 'caution', 1, 'published', 'start', 5),
  (5, 2, 'fridge-alert', '冷蔵設備に異常表示が出た', '商品を安易に使用せず、影響範囲と記録を保全する', 'critical', 1, 'published', 'start', 5),
  (6, 4, 'ingredient-shortage', '営業中に主要食材が不足した', '残数・影響メニュー・代替可否を整理する', 'normal', 1, 'published', 'start', 4),
  (7, 5, 'delivery-mismatch', '持ち帰り商品と注文内容が違う', '注文番号・受渡状況・作り直し可否を整理する', 'normal', 1, 'published', 'start', 6),
  (8, 7, 'crew-absence', '急な欠勤で人員が不足した', '欠員数と停止する業務を整理し、安全な営業範囲を判断する', 'caution', 1, 'published', 'start', 7),
  (9, 1, 'allergy-question', 'アレルギーについて質問された', '曖昧な回答を避け、確認済み情報だけを案内する', 'critical', 1, 'published', 'start', 3),
  (10, 6, 'power-trouble', '店舗設備の電源が入らない', '端末単体か系統障害かを確認し、危険な復旧操作を避ける', 'caution', 1, 'published', 'start', 5)
ON DUPLICATE KEY UPDATE area_id=VALUES(area_id), title=VALUES(title), summary=VALUES(summary), risk_level=VALUES(risk_level), version=VALUES(version), status=VALUES(status), start_node_key=VALUES(start_node_key), estimated_minutes=VALUES(estimated_minutes);

INSERT INTO flow_nodes (id, scenario_id, node_key, node_type, title, body, outcome_type, escalation_target, sort_order) VALUES
  (101,1,'start','question','お客様はまだ料理に手を付けていませんか？','下げる前に、伝票・卓番号・料理名を照合します。',NULL,NULL,1),
  (102,1,'untouched','action','誤提供品を下げて注文を再確認','お詫びし、正しい注文内容と提供見込みを復唱します。',NULL,NULL,2),
  (103,1,'can-remake','question','通常の調理時間内で作り直せますか？','厨房の混雑と食材在庫を確認します。',NULL,NULL,3),
  (104,1,'resolved','outcome','作り直しを手配して一次対応完了','正しい料理の提供まで担当者を決め、誤提供の原因を記録します。','resolved',NULL,4),
  (105,1,'touched','outcome','責任者へ引き継ぐ','飲食済みのため、料理の扱い・会計対応を現場判断せず責任者へ連携します。','escalated','店舗責任者',5),
  (106,1,'manager','outcome','提供遅延を含め責任者へ相談','代替提案や会計対応を作業者だけで決めず、責任者へ連携します。','escalated','店舗責任者',6),

  (201,2,'start','question','注文は厨房へ送信されていますか？','POSの送信履歴または厨房伝票を確認します。',NULL,NULL,1),
  (202,2,'resend','action','注文を重複させず厨房へ連携','未送信を確認したうえで一度だけ送信し、厨房へ口頭でも共有します。',NULL,NULL,2),
  (203,2,'kitchen','question','厨房で調理状況を特定できましたか？','担当・現在工程・完成見込みを確認します。',NULL,NULL,3),
  (204,2,'estimate','action','提供見込みをお客様へ案内','曖昧な約束をせず、確認できた見込みとお詫びを伝えます。',NULL,NULL,4),
  (205,2,'resolved','outcome','提供担当を決めて完了','完成後の提供漏れを防ぐため、担当者と卓番号を記録します。','resolved',NULL,5),
  (206,2,'manager','outcome','原因不明として責任者へ連携','注文情報・経過時間・確認済み箇所をまとめて責任者へ引き継ぎます。','escalated','店舗責任者',6),

  (301,3,'start','question','他のレジ端末は動いていますか？','同じ操作を何度も行わず、影響範囲だけ確認します。',NULL,NULL,1),
  (302,3,'single','action','正常端末へ会計を切り替える','未確定伝票の状態を確認し、会計を一度だけ処理します。',NULL,NULL,2),
  (303,3,'duplicate','question','元端末に会計完了の記録はありませんか？','レシート・決済端末・POS履歴の三点を確認します。',NULL,NULL,3),
  (304,3,'resolved','outcome','代替端末で会計完了','停止端末と発生時刻を記録し、保守確認対象にします。','resolved',NULL,4),
  (305,3,'all','outcome','全端末障害として利用停止を連携','手書き・現金対応を独断で開始せず、店舗の障害時手順へ切り替えます。','stopped','POS保守・店舗責任者',5),
  (306,3,'manager','outcome','二重決済の可能性を連携','追加決済を止め、取引時刻と参照情報を責任者へ引き継ぎます。','escalated','店舗責任者・決済担当',6),

  (401,4,'start','question','決済端末に完了表示がありますか？','金額・時刻・取引結果だけを確認し、カード情報は記録しません。',NULL,NULL,1),
  (402,4,'pos-check','question','POS側にも会計済みで記録されていますか？','両方の記録が一致するか確認します。',NULL,NULL,2),
  (403,4,'retry-check','question','取引履歴に処理中または成功が残っていませんか？','結果不明のまま再試行しません。',NULL,NULL,3),
  (404,4,'alternate','outcome','別の決済手段を案内','元取引が未成立であることを確認後、利用可能な方法を案内します。','resolved',NULL,4),
  (405,4,'resolved','outcome','決済完了を確認','レシートとPOS履歴が一致していることを確認します。','resolved',NULL,5),
  (406,4,'manager','outcome','結果不整合として連携','追加操作を止め、取引参照情報を責任者へ引き継ぎます。','escalated','店舗責任者・決済担当',6),

  (501,5,'start','question','庫内の商品へ影響する可能性がありますか？','判断できない場合は「ある」として扱います。',NULL,NULL,1),
  (502,5,'stop-use','action','対象商品の使用を止めて区分する','廃棄・提供可否を作業者だけで決めず、店舗の衛生管理計画に従います。',NULL,NULL,2),
  (503,5,'record','action','表示内容と確認時刻を記録','設定変更や分解をせず、設備の状態をそのまま記録します。',NULL,NULL,3),
  (504,5,'manager','outcome','責任者・設備保守へ優先連携','対象設備、確認時刻、商品への影響可能性をまとめて引き継ぎます。','stopped','衛生管理責任者・設備保守',4),

  (601,6,'start','question','同じ品質で提供できる承認済み代替品がありますか？','個人判断でレシピや原材料を変更しません。',NULL,NULL,1),
  (602,6,'stock-check','question','次回納品まで必要数を確保できますか？','予約数・残数・使用予定数を確認します。',NULL,NULL,2),
  (603,6,'resolved','outcome','代替品へ切り替えて記録','切替時刻と対象メニューをスタッフへ共有します。','resolved',NULL,3),
  (604,6,'sold-out','outcome','対象メニューを販売停止','注文受付を止め、表示・口頭案内・デリバリー在庫をそろえて更新します。','stopped','店舗責任者',4),
  (605,6,'manager','outcome','不足見込みを責任者へ連携','残数と影響見込みを共有し、販売継続範囲を判断してもらいます。','escalated','店舗責任者',5),

  (701,7,'start','question','商品はまだ店舗内にありますか？','注文番号と袋のラベルを照合します。',NULL,NULL,1),
  (702,7,'inside','action','正しい商品へ入れ替える','受渡前に全品を再確認し、誤った袋を分離します。',NULL,NULL,2),
  (703,7,'resolved','outcome','受渡内容を確認して完了','注文番号と商品数を復唱し、原因を記録します。','resolved',NULL,3),
  (704,7,'left','outcome','店舗外受渡しとして責任者へ連携','連絡方法・再配送・返金を独断で決めず、注文情報をまとめます。','escalated','店舗責任者・デリバリー担当',4),

  (801,8,'start','question','必須ポジションをすべて配置できますか？','人数だけでなく、担当可能な業務と休憩を確認します。',NULL,NULL,1),
  (802,8,'limit','question','一部メニュー・席数を制限すれば安全に運営できますか？','無理な兼務を前提にしません。',NULL,NULL,2),
  (803,8,'resolved','outcome','制限営業へ切り替える','停止範囲と再判断時刻を全員へ共有します。','resolved',NULL,3),
  (804,8,'manager','outcome','営業範囲の判断を責任者へ連携','欠員、配置可能業務、混雑見込みを整理して判断を依頼します。','escalated','店舗責任者',4),

  (901,9,'start','question','店舗の正式な原材料情報で確認できますか？','記憶や見た目で判断しません。',NULL,NULL,1),
  (902,9,'official','question','交差接触を含め、安全を断言できる運用ですか？','不明点が一つでもあれば断言しません。',NULL,NULL,2),
  (903,9,'explain','action','確認できた範囲だけを説明','最終的な利用判断はお客様に委ね、回答内容を記録します。',NULL,NULL,3),
  (904,9,'resolved','outcome','案内内容を記録して完了','参照した情報と説明担当者を記録します。','resolved',NULL,4),
  (905,9,'manager','outcome','回答せず責任者へ引き継ぐ','安全を推測せず、正式資料を確認できる責任者へ連携します。','escalated','衛生管理責任者',5),

  (1001,10,'start','question','焦げ臭・煙・異音・発熱がありますか？','一つでもある、または判断できない場合は危険側へ進みます。',NULL,NULL,1),
  (1002,10,'range','question','同じ周辺の複数設備が停止していますか？','分解や配線変更はせず、影響範囲のみ確認します。',NULL,NULL,2),
  (1003,10,'danger','outcome','使用中止・安全確保を優先','設備に触れず、店舗の緊急手順に従い責任者へ直ちに連携します。','stopped','店舗責任者・緊急窓口',3),
  (1004,10,'facility','outcome','系統障害として設備担当へ連携','停止範囲と発生時刻を記録し、営業への影響判断を依頼します。','escalated','設備保守・店舗責任者',4),
  (1005,10,'single','outcome','単体故障として使用停止','代替設備の有無を確認し、対象設備を使用停止表示にします。','stopped','設備保守',5)
ON DUPLICATE KEY UPDATE node_type=VALUES(node_type), title=VALUES(title), body=VALUES(body), outcome_type=VALUES(outcome_type), escalation_target=VALUES(escalation_target), sort_order=VALUES(sort_order);

INSERT INTO flow_choices (node_id, label, next_node_key, choice_type, sort_order) VALUES
  (101,'はい','untouched','positive',1),(101,'いいえ','touched','negative',2),(102,'実施した','can-remake','positive',1),(103,'はい','resolved','positive',1),(103,'いいえ','manager','negative',2),
  (201,'はい','kitchen','positive',1),(201,'いいえ','resend','negative',2),(202,'実施した','estimate','positive',1),(203,'はい','estimate','positive',1),(203,'いいえ','manager','negative',2),(204,'実施した','resolved','positive',1),
  (301,'はい','single','positive',1),(301,'いいえ','all','negative',2),(302,'実施した','duplicate','positive',1),(303,'はい','manager','positive',1),(303,'いいえ','resolved','negative',2),
  (401,'はい','pos-check','positive',1),(401,'いいえ','retry-check','negative',2),(402,'はい','resolved','positive',1),(402,'いいえ','manager','negative',2),(403,'はい','manager','positive',1),(403,'いいえ','alternate','negative',2),
  (501,'ある・不明','stop-use','positive',1),(501,'ない','record','negative',2),(502,'実施した','manager','positive',1),(503,'実施した','manager','positive',1),
  (601,'はい','stock-check','positive',1),(601,'いいえ','sold-out','negative',2),(602,'はい','resolved','positive',1),(602,'いいえ','manager','negative',2),
  (701,'はい','inside','positive',1),(701,'いいえ','left','negative',2),(702,'実施した','resolved','positive',1),
  (801,'はい','limit','positive',1),(801,'いいえ','manager','negative',2),(802,'はい','resolved','positive',1),(802,'いいえ','manager','negative',2),
  (901,'はい','official','positive',1),(901,'いいえ','manager','negative',2),(902,'はい','explain','positive',1),(902,'いいえ','manager','negative',2),(903,'実施した','resolved','positive',1),
  (1001,'ある・不明','danger','positive',1),(1001,'ない','range','negative',2),(1002,'はい','facility','positive',1),(1002,'いいえ','single','negative',2)
ON DUPLICATE KEY UPDATE label=VALUES(label), next_node_key=VALUES(next_node_key), choice_type=VALUES(choice_type);

INSERT INTO incidents (scenario_id, area_id, mode, severity, result, recurrence, duration_seconds, note, seed_key, occurred_at) VALUES
  (3,3,'training','high','escalated',1,780,'模擬データ','demo-01','2026-08-22 10:42:00'),
  (1,1,'training','medium','resolved',0,310,'模擬データ','demo-02','2026-08-22 09:18:00'),
  (5,2,'training','high','stopped',1,1020,'模擬データ','demo-03','2026-08-21 19:37:00'),
  (7,5,'training','low','resolved',0,240,'模擬データ','demo-04','2026-08-21 17:04:00'),
  (8,7,'training','medium','escalated',0,900,'模擬データ','demo-05','2026-08-20 12:26:00'),
  (2,1,'training','medium','resolved',1,480,'模擬データ','demo-06','2026-08-20 11:13:00'),
  (3,3,'training','medium','resolved',0,360,'模擬データ','demo-07','2026-08-19 18:10:00'),
  (5,2,'training','high','stopped',0,850,'模擬データ','demo-08','2026-08-19 15:05:00'),
  (2,1,'training','low','resolved',1,420,'模擬データ','demo-09','2026-08-18 13:42:00'),
  (1,1,'training','medium','resolved',0,290,'模擬データ','demo-10','2026-08-18 11:22:00')
ON DUPLICATE KEY UPDATE scenario_id=VALUES(scenario_id), area_id=VALUES(area_id), severity=VALUES(severity), result=VALUES(result), recurrence=VALUES(recurrence), duration_seconds=VALUES(duration_seconds), occurred_at=VALUES(occurred_at);

INSERT INTO unclassified_reports (area_id, title, details, safety_concern, status, seed_key, occurred_at) VALUES
  (1,'座席移動後に注文が二重表示','卓移動と追加注文の順序を確認する必要あり',0,'new','unknown-01','2026-08-21 20:10:00'),
  (5,'受取番号が呼出画面に出ない','受付済みだが表示だけ反映されない',0,'new','unknown-02','2026-08-20 18:30:00'),
  (6,'特定区画だけ照明が点滅','安全確認後に区画を使用停止',1,'new','unknown-03','2026-08-19 09:15:00')
ON DUPLICATE KEY UPDATE title=VALUES(title), details=VALUES(details), safety_concern=VALUES(safety_concern), status=VALUES(status), occurred_at=VALUES(occurred_at);
