<?php
declare(strict_types=1);

/*
 * XAMPPローカル開発用の既定値です。
 * 公開サーバーへ配置する場合は、環境変数で上書きし認証も追加してください。
 * 秘密情報はGitHubへコミットしないでください。
 */
return [
    'db_host' => getenv('TROUBLE_DINER_DB_HOST') ?: '127.0.0.1',
    'db_port' => getenv('TROUBLE_DINER_DB_PORT') ?: '3306',
    'db_name' => getenv('TROUBLE_DINER_DB_NAME') ?: 'trouble_diner',
    'db_user' => getenv('TROUBLE_DINER_DB_USER') ?: 'root',
    'db_pass' => getenv('TROUBLE_DINER_DB_PASS') ?: '',
    'allowed_origins' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost',
        'http://127.0.0.1',
    ],
];
