<?php
declare(strict_types=1);

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

function dashboard(PDO $pdo): array
{
    $summary = $pdo->query(
        "SELECT
            COUNT(*) AS total,
            COALESCE(ROUND(SUM(result = 'resolved') / NULLIF(COUNT(*), 0) * 100), 0) AS resolved_rate,
            COALESCE(ROUND(SUM(result IN ('escalated','stopped','unclassified')) / NULLIF(COUNT(*), 0) * 100), 0) AS escalation_rate,
            COALESCE(ROUND(AVG(duration_seconds) / 60), 0) AS average_minutes
         FROM incidents"
    )->fetch();

    $unclassifiedCount = (int)$pdo->query("SELECT COUNT(*) FROM unclassified_reports WHERE status = 'new'")->fetchColumn();

    $priorityStmt = $pdo->query(
        "SELECT s.title AS scenario_title, a.name AS area_name, COUNT(i.id) AS incident_count,
            ROUND(SUM(
                (CASE i.severity WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END)
                * GREATEST(1, i.duration_seconds / 60)
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
    ], $priorityStmt->fetchAll());

    $recentStmt = $pdo->query(
        "SELECT i.id, i.occurred_at, a.name AS area_name, COALESCE(s.title, '未分類トラブル') AS scenario_title,
                i.result, i.severity, i.duration_seconds, i.recurrence
         FROM incidents i
         INNER JOIN areas a ON a.id = i.area_id
         LEFT JOIN scenarios s ON s.id = i.scenario_id
         ORDER BY i.occurred_at DESC, i.id DESC
         LIMIT 8"
    );
    $recent = array_map(static fn(array $row): array => [
        'id' => (int)$row['id'],
        'occurredAt' => $row['occurred_at'],
        'areaName' => $row['area_name'],
        'scenarioTitle' => $row['scenario_title'],
        'result' => $row['result'],
        'severity' => $row['severity'],
        'durationSeconds' => (int)$row['duration_seconds'],
        'recurrence' => (bool)$row['recurrence'],
    ], $recentStmt->fetchAll());

    return [
        'total' => (int)$summary['total'],
        'resolvedRate' => (int)$summary['resolved_rate'],
        'escalationRate' => (int)$summary['escalation_rate'],
        'averageMinutes' => (int)$summary['average_minutes'],
        'unclassifiedCount' => $unclassifiedCount,
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
    $duration = max(1, min(86400, (int)($input['durationSeconds'] ?? 1)));
    $note = mb_substr(trim((string)($input['note'] ?? '')), 0, 2000);
    $steps = is_array($input['steps'] ?? null) ? $input['steps'] : [];

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO incidents (scenario_id, area_id, severity, result, recurrence, duration_seconds, note) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$scenarioId, $areaId, $severity, $result, !empty($input['recurrence']) ? 1 : 0, $duration, $note]);
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
        return ['id' => $incidentId];
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
    return ['id' => (int)$pdo->lastInsertId()];
}

function createScenario(PDO $pdo, array $input): array
{
    $areaId = (int)($input['areaId'] ?? 0);
    if ($areaId < 1) fail('areaId が正しくありません。');
    $title = requiredString($input, 'title', 255);
    $summary = mb_substr(trim((string)($input['summary'] ?? '')), 0, 500);
    $question = requiredString($input, 'question', 500);
    $yesAction = requiredString($input, 'yesAction', 500);
    $noAction = requiredString($input, 'noAction', 500);
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
    if ($method === 'POST' && $action === 'unclassified') respond(saveUnclassified($pdo, body()), 201);
    if ($method === 'POST' && $action === 'scenarios') respond(createScenario($pdo, body()), 201);
    fail('Endpoint not found.', 404);
} catch (PDOException $error) {
    error_log($error->getMessage());
    fail('データベースへ接続できません。XAMPPとsetup.sqlを確認してください。', 503);
} catch (Throwable $error) {
    error_log($error->getMessage());
    fail('サーバー処理でエラーが発生しました。', 500);
}
