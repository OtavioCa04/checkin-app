<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

$db = App\Core\Database::connection();
$db->exec('CREATE TABLE IF NOT EXISTS schema_migrations (nome VARCHAR(190) PRIMARY KEY, aplicado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
foreach (glob(dirname(__DIR__) . '/database/migrations/*.sql') as $file) {
    $name = basename($file);
    $q = $db->prepare('SELECT nome FROM schema_migrations WHERE nome = ?');
    $q->execute([$name]);
    if ($q->fetch()) { continue; }
    // MySQL faz commit implícito em DDL. Falhas parciais exigem inspeção antes de repetir.
    foreach (explode(';', file_get_contents($file)) as $sql) {
        if (trim($sql) !== '') { $db->exec($sql); }
    }
    $q = $db->prepare('INSERT INTO schema_migrations (nome) VALUES (?)');
    $q->execute([$name]);
    echo "Aplicada: {$name}\n";
}
