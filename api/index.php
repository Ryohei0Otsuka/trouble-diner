<?php
declare(strict_types=1);
date_default_timezone_set('Asia/Tokyo');

require __DIR__ . '/database.php';

$config = require __DIR__ . '/config.php';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $config['allowed_origins'], true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(mixed $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode(['ok' => $status < 400, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status = 400): never
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        fail('JSON形式が正しくありません。');
    }
    return $decoded;
}

function requiredString(array $input, string $key, int $max = 255): string
{
    $value = trim((string)($input[$key] ?? ''));
    if ($value === '') {
        fail("{$key} は必須です。");
    }
    if (mb_strlen($value) > $max) {
        fail("{$key} が長すぎます。");
    }
    return $value;
}

function derivedSeverity(string $risk, string $result): string
{
    if ($risk === 'critical' || $result === 'stopped') return 'high';
    if ($risk === 'caution' || in_array($result, ['escalated', 'unclassified'], true)) return 'medium';
    return 'low';
}

function incidentRecord(array $row): array
{
    return [
        'id' => (int)$row['id'],
        'occurredAt' => $row['occurred_at'],
        'areaName' => $row['area_name'],
        'scenarioTitle' => $row['scenario_title'],
        'result' => $row['result'],
        'severity' => $row['severity'],
        'status' => $row['incident_status'],
        'triageSeconds' => (int)$row['triage_seconds'],
        'recoverySeconds' => $row['recovery_seconds'] === null ? null : (int)$row['recovery_seconds'],
        'recoveredAt' => $row['recovered_at'],
        'recurrence' => (bool)$row['recurrence'],
        'note' => $row['note'],
        'routeSummary' => $row['route_summary'],
        'resolutionNote' => $row['resolution_note'],
    ];
}

function dashboard(PDO $pdo): array
{
    $summary = $pdo->query(
        "SELECT
            COUNT(*) AS total,
            COALESCE(ROUND(SUM(result = 'resolved') / NULLIF(COUNT(*), 0) * 100), 0) AS resolved_rate,
            COALESCE(ROUND(SUM(result IN ('escalated','stopped','unclassified')) / NULLIF(COUNT(*), 0) * 100), 0) AS escalation_rate,
            COALESCE(ROUND(AVG(recovery_seconds) / 60), 0) AS average_recovery_minutes
         FROM incidents"
    )->fetch();

    $unclassifiedStmt = $pdo->query(
        "SELECT u.id, u.area_id, u.title, u.details, u.safety_concern, u.status, u.occurred_at, a.name AS area_name
         FROM unclassified_reports u
         INNER JOIN areas a ON a.id = u.area_id
         WHERE u.status IN ('new','reviewing')
         ORDER BY u.safety_concern DESC, u.occurred_at DESC, u.id DESC
         LIMIT 50"
    );
    $unclassified = array_map(static fn(array $row): array => [
        'id' => (int)$row['id'],
        'occurredAt' => $row['occurred_at'],
        'areaId' => (int)$row['area_id'],
        'areaName' => $row['area_name'],
        'title' => $row['title'],
        'details' => $row['details'],
        'safetyConcern' => (bool)$row['safety_concern'],
        'status' => $row['status'],
    ], $unclassifiedStmt->fetchAll());
    $safetyCount = count(array_filter($unclassified, static fn(array $item): bool => $item['safetyConcern']));

    $priorityStmt = $pdo->query(
        "SELECT s.title AS scenario_title, a.name AS area_name, COUNT(i.id) AS incident_count,
            SUM(i.result = 'stopped') AS stopped_count,
            SUM(i.recurrence = 1) AS repeat_count,
            COALESCE(ROUND(AVG(i.recovery_seconds) / 60), 0) AS average_recovery_minutes,
            ROUND(SUM(
                (CASE i.severity WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END)
                * GREATEST(1, COALESCE(i.recovery_seconds, TIMESTAMPDIFF(SECOND, i.occurred_at, NOW())) / 60)
                * (CASE WHEN i.recurrence = 1 THEN 1.5 ELSE 1 END)
            )) AS score
         FROM incidents i
         INNER JOIN scenarios s ON s.id = i.scenario_id
         INNER JOIN areas a ON a.id = i.area_id
         GROUP BY s.id, s.title, a.name
         ORDER BY score DESC, incident_count DESC
         LIMIT 5"
    );
    $priorities = array_map(static fn(array $row): array => [
        'scenarioTitle' => $row['scenario_title'],
        'areaName' => $row['area_name'],
        'count' => (int)$row['incident_count'],
        'score' => (int)$row['score'],
        'stoppedCount' => (int)$row['stopped_count'],
        'repeatCount' => (int)$row['repeat_count'],
        'averageRecoveryMinutes' => (int)$row['average_recovery_minutes'],
    ], $priorityStmt->fetchAll());

    $incidentSelect =
        "SELECT i.id, i.occurred_at, a.name AS area_name, COALESCE(s.title, '未分類トラブル') AS scenario_title,
                i.result, i.severity, i.status AS incident_status, i.triage_seconds, i.recovery_seconds,
                i.recovered_at, i.recurrence, i.note, i.resolution_note,
                COALESCE((
                    SELECT GROUP_CONCAT(CONCAT(st.prompt, ' → ', st.choice_label) ORDER BY st.step_order SEPARATOR ' / ')
                    FROM incident_steps st WHERE st.incident_id = i.id
                ), '') AS route_summary
         FROM incidents i
         INNER JOIN areas a ON a.id = i.area_id
         LEFT JOIN scenarios s ON s.id = i.scenario_id";
    $activeIncidents = array_map('incidentRecord', $pdo->query($incidentSelect . " WHERE i.status = 'open' ORDER BY i.occurred_at ASC, i.id ASC LIMIT 50")->fetchAll());
    $recent = array_map('incidentRecord', $pdo->query($incidentSelect . " ORDER BY i.occurred_at DESC, i.id DESC LIMIT 10")->fetchAll());
    $escalatedCount = count(array_filter($activeIncidents, static fn(array $item): bool => in_array($item['result'], ['escalated', 'unclassified'], true)));
    $stoppedCount = count(array_filter($activeIncidents, static fn(array $item): bool => $item['result'] === 'stopped'));

    return [
        'total' => (int)$summary['total'],
        'resolvedRate' => (int)$summary['resolved_rate'],
        'escalationRate' => (int)$summary['escalation_rate'],
        'averageRecoveryMinutes' => (int)$summary['average_recovery_minutes'],
        'unclassifiedCount' => count($unclassified),
        'activeSummary' => [
            'total' => count($activeIncidents) + $safetyCount,
            'escalated' => $escalatedCount,
            'stopped' => $stoppedCount,
            'safety' => $safetyCount,
        ],
        'activeIncidents' => $activeIncidents,
        'unclassified' => $unclassified,
        'priorities' => $priorities,
        'recent' => $recent,
    ];
}

function bootstrap(PDO $pdo): array
{
    $areas = array_map(static fn(array $row): array => [
        'id' => (int)$row['id'],
        'slug' => $row['slug'],
        'name' => $row['name'],
        'shortName' => $row['short_name'],
        'icon' => $row['icon'],
        'color' => $row['color'],
        'description' => $row['description'],
    ], $pdo->query('SELECT * FROM areas ORDER BY sort_order, id')->fetchAll());

    $scenarioRows = $pdo->query("SELECT * FROM scenarios WHERE status = 'published' ORDER BY id DESC")->fetchAll();
    $nodeStmt = $pdo->prepare('SELECT * FROM flow_nodes WHERE scenario_id = ? ORDER BY sort_order, id');
    $choiceStmt = $pdo->prepare('SELECT * FROM flow_choices WHERE node_id = ? ORDER BY sort_order, id');
    $scenarios = [];

    foreach ($scenarioRows as $scenarioRow) {
        $nodeStmt->execute([(int)$scenarioRow['id']]);
        $nodes = [];
        foreach ($nodeStmt->fetchAll() as $nodeRow) {
            $choiceStmt->execute([(int)$nodeRow['id']]);
            $choices = array_map(static fn(array $choice): array => [
                'id' => (int)$choice['id'],
                'label' => $choice['label'],
                'nextNodeKey' => $choice['next_node_key'],
                'choiceType' => $choice['choice_type'],
                'sortOrder' => (int)$choice['sort_order'],
            ], $choiceStmt->fetchAll());
            $nodes[$nodeRow['node_key']] = [
                'id' => (int)$nodeRow['id'],
                'key' => $nodeRow['node_key'],
                'type' => $nodeRow['node_type'],
                'title' => $nodeRow['title'],
                'body' => $nodeRow['body'],
                'outcomeType' => $nodeRow['outcome_type'] ?: null,
                'escalationTarget' => $nodeRow['escalation_target'] ?: null,
                'choices' => $choices,
            ];
        }
        $scenarios[] = [
            'id' => (int)$scenarioRow['id'],
            'areaId' => (int)$scenarioRow['area_id'],
            'slug' => $scenarioRow['slug'],
            'title' => $scenarioRow['title'],
            'summary' => $scenarioRow['summary'],
            'riskLevel' => $scenarioRow['risk_level'],
            'version' => (int)$scenarioRow['version'],
            'startNodeKey' => $scenarioRow['start_node_key'],
            'estimatedMinutes' => (int)$scenarioRow['estimated_minutes'],
            'nodes' => $nodes,
        ];
    }

    return ['areas' => $areas, 'scenarios' => $scenarios, 'dashboard' => dashboard($pdo), 'dataSource' => 'mysql'];
}

function saveIncident(PDO $pdo, array $input): array
{
    $result = in_array($input['result'] ?? '', ['resolved', 'escalated', 'stopped', 'unclassified'], true) ? $input['result'] : 'unclassified';
    $scenarioId = isset($input['scenarioId']) ? (int)$input['scenarioId'] : null;
    $areaId = (int)($input['areaId'] ?? 0);
    if ($areaId < 1) fail('areaId が正しくありません。');
    $risk = 'normal';
    if ($scenarioId !== null && $scenarioId > 0) {
        $scenarioStmt = $pdo->prepare('SELECT area_id, risk_level FROM scenarios WHERE id = ?');
        $scenarioStmt->execute([$scenarioId]);
        $scenario = $scenarioStmt->fetch();
        if (!$scenario) fail('scenarioId が正しくありません。');
        if ((int)$scenario['area_id'] !== $areaId) fail('シナリオとエリアが一致しません。');
        $risk = (string)$scenario['risk_level'];
    }
    $severity = derivedSeverity($risk, $result);
    $triage = max(1, min(86400, (int)($input['triageSeconds'] ?? 1)));
    try {
        $occurredAt = new DateTimeImmutable((string)($input['occurredAt'] ?? 'now'));
    } catch (Throwable) {
        fail('occurredAt が正しくありません。');
    }
    $occurredAt = $occurredAt->setTimezone(new DateTimeZone(date_default_timezone_get()));
    if ($occurredAt->getTimestamp() > time() + 300) fail('発生日時が未来になっています。');
    $occurredSql = $occurredAt->format('Y-m-d H:i:s');
    $status = $result === 'resolved' ? 'resolved' : 'open';
    $recoverySeconds = $status === 'resolved' ? max($triage, time() - $occurredAt->getTimestamp()) : null;
    $recoveredAt = $status === 'resolved' ? date('Y-m-d H:i:s') : null;
    $resolutionNote = $status === 'resolved' ? '一次対応で解決' : '';
    $note = mb_substr(trim((string)($input['note'] ?? '')), 0, 2000);
    $steps = is_array($input['steps'] ?? null) ? $input['steps'] : [];

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO incidents (scenario_id, area_id, severity, result, status, recurrence, duration_seconds, triage_seconds, recovery_seconds, recovered_at, note, resolution_note, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$scenarioId, $areaId, $severity, $result, $status, !empty($input['recurrence']) ? 1 : 0, $triage, $triage, $recoverySeconds, $recoveredAt, $note, $resolutionNote, $occurredSql]);
        $incidentId = (int)$pdo->lastInsertId();

        $stepStmt = $pdo->prepare('INSERT INTO incident_steps (incident_id, node_key, prompt, choice_label, step_order) VALUES (?, ?, ?, ?, ?)');
        foreach (array_slice($steps, 0, 50) as $index => $step) {
            $stepStmt->execute([
                $incidentId,
                mb_substr((string)($step['nodeKey'] ?? ''), 0, 80),
                mb_substr((string)($step['prompt'] ?? ''), 0, 500),
                mb_substr((string)($step['choiceLabel'] ?? ''), 0, 255),
                $index + 1,
            ]);
        }
        $pdo->commit();
        return ['id' => $incidentId, 'occurredAt' => $occurredSql, 'status' => $status];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function saveUnclassified(PDO $pdo, array $input): array
{
    $areaId = (int)($input['areaId'] ?? 0);
    if ($areaId < 1) fail('areaId が正しくありません。');
    $title = requiredString($input, 'title', 255);
    $details = mb_substr(trim((string)($input['details'] ?? '')), 0, 3000);
    $stmt = $pdo->prepare('INSERT INTO unclassified_reports (area_id, title, details, safety_concern) VALUES (?, ?, ?, ?)');
    $stmt->execute([$areaId, $title, $details, !empty($input['safetyConcern']) ? 1 : 0]);
    $reportId = (int)$pdo->lastInsertId();
    $areaStmt = $pdo->prepare('SELECT name FROM areas WHERE id = ?');
    $areaStmt->execute([$areaId]);
    return [
        'id' => $reportId,
        'occurredAt' => date('Y-m-d H:i:s'),
        'areaId' => $areaId,
        'areaName' => (string)$areaStmt->fetchColumn(),
        'title' => $title,
        'details' => $details,
        'safetyConcern' => !empty($input['safetyConcern']),
        'status' => 'new',
    ];
}

function resolveIncident(PDO $pdo, array $input): array
{
    $id = (int)($input['id'] ?? 0);
    if ($id < 1) fail('id が正しくありません。');
    $resolutionNote = requiredString($input, 'resolutionNote', 2000);
    $stmt = $pdo->prepare(
        "UPDATE incidents
         SET status = 'resolved', recovered_at = NOW(),
             recovery_seconds = GREATEST(1, TIMESTAMPDIFF(SECOND, occurred_at, NOW())),
             resolution_note = ?
         WHERE id = ? AND status = 'open'"
    );
    $stmt->execute([$resolutionNote, $id]);
    if ($stmt->rowCount() < 1) fail('対応中の記録が見つかりません。', 404);
    return ['id' => $id, 'status' => 'resolved'];
}

function closeUnclassified(PDO $pdo, array $input): array
{
    $id = (int)($input['id'] ?? 0);
    if ($id < 1) fail('id が正しくありません。');
    $stmt = $pdo->prepare("UPDATE unclassified_reports SET status = 'closed' WHERE id = ? AND status IN ('new','reviewing')");
    $stmt->execute([$id]);
    if ($stmt->rowCount() < 1) fail('確認待ちの未分類記録が見つかりません。', 404);
    return ['id' => $id, 'status' => 'closed'];
}

function createScenario(PDO $pdo, array $input): array
{
    $areaId = (int)($input['areaId'] ?? 0);
    if ($areaId < 1) fail('areaId が正しくありません。');
    $title = requiredString($input, 'title', 255);
    $summary = mb_substr(trim((string)($input['summary'] ?? '')), 0, 500);
    $question = requiredString($input, 'question', 500);
    $yesAction = requiredString($input, 'yesAction', 500);
    $target = mb_substr(trim((string)($input['escalationTarget'] ?? '店舗責任者')), 0, 255);
    $risk = in_array($input['riskLevel'] ?? '', ['normal', 'caution', 'critical'], true) ? $input['riskLevel'] : 'normal';

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO scenarios (area_id, slug, title, summary, risk_level, version, status, start_node_key, estimated_minutes) VALUES (?, 'pending', ?, ?, ?, 1, 'published', 'start', 5)");
        $stmt->execute([$areaId, $title, $summary, $risk]);
        $scenarioId = (int)$pdo->lastInsertId();
        $slug = "custom-{$scenarioId}";
        $pdo->prepare('UPDATE scenarios SET slug = ? WHERE id = ?')->execute([$slug, $scenarioId]);

        $nodeStmt = $pdo->prepare('INSERT INTO flow_nodes (scenario_id, node_key, node_type, title, body, outcome_type, escalation_target, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $nodeStmt->execute([$scenarioId, 'start', 'question', $question, '現場で確認できた事実だけをもとに選択します。', null, null, 1]);
        $startNodeId = (int)$pdo->lastInsertId();
        $nodeStmt->execute([$scenarioId, 'yes', 'outcome', $yesAction, '実施内容と結果を記録します。', 'resolved', null, 2]);
        $nodeStmt->execute([$scenarioId, 'no', 'outcome', $noAction, '判断材料をそろえて責任者へ連携します。', 'escalated', $target, 3]);

        $choiceStmt = $pdo->prepare('INSERT INTO flow_choices (node_id, label, next_node_key, choice_type, sort_order) VALUES (?, ?, ?, ?, ?)');
        $choiceStmt->execute([$startNodeId, 'はい', 'yes', 'positive', 1]);
        $choiceStmt->execute([$startNodeId, 'いいえ', 'no', 'negative', 2]);
        $pdo->commit();

        return [
            'id' => $scenarioId, 'areaId' => $areaId, 'slug' => $slug, 'title' => $title, 'summary' => $summary,
            'riskLevel' => $risk, 'version' => 1, 'startNodeKey' => 'start', 'estimatedMinutes' => 5, 'custom' => true,
            'nodes' => [
                'start' => ['key' => 'start', 'type' => 'question', 'title' => $question, 'body' => '現場で確認できた事実だけをもとに選択します。', 'choices' => [
                    ['label' => 'はい', 'nextNodeKey' => 'yes', 'choiceType' => 'positive', 'sortOrder' => 1],
                    ['label' => 'いいえ', 'nextNodeKey' => 'no', 'choiceType' => 'negative', 'sortOrder' => 2],
                ]],
                'yes' => ['key' => 'yes', 'type' => 'outcome', 'title' => $yesAction, 'body' => '実施内容と結果を記録します。', 'outcomeType' => 'resolved', 'choices' => []],
                'no' => ['key' => 'no', 'type' => 'outcome', 'title' => $noAction, 'body' => '判断材料をそろえて責任者へ連携します。', 'outcomeType' => 'escalated', 'escalationTarget' => $target, 'choices' => []],
            ],
        ];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

try {
    $pdo = database();
    $action = (string)($_GET['action'] ?? 'bootstrap');
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET' && $action === 'bootstrap') respond(bootstrap($pdo));
    if ($method === 'GET' && $action === 'dashboard') respond(dashboard($pdo));
    if ($method === 'POST' && $action === 'incidents') respond(saveIncident($pdo, body()), 201);
    if ($method === 'POST' && $action === 'resolve-incident') respond(resolveIncident($pdo, body()));
    if ($method === 'POST' && $action === 'unclassified') respond(saveUnclassified($pdo, body()), 201);
    if ($method === 'POST' && $action === 'close-unclassified') respond(closeUnclassified($pdo, body()));
    if ($method === 'POST' && $action === 'scenarios') respond(createScenario($pdo, body()), 201);
    fail('Endpoint not found.', 404);
} catch (PDOException $error) {
    error_log($error->getMessage());
    fail('データベースへ接続できません。XAMPPとsetup.sqlを確認してください。', 503);
} catch (Throwable $error) {
    error_log($error->getMessage());
    fail('サーバー処理でエラーが発生しました。', 500);
}
