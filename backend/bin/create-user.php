<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

if ($argc === 4) { $argv[2] = trim($argv[2]); }
if ($argc !== 4 || !filter_var($argv[2], FILTER_VALIDATE_EMAIL) || !in_array($argv[3], App\Models\Usuario::PERFIS, true) || mb_strlen($argv[1]) > 150 || trim($argv[1]) === '' || strlen($argv[2]) > 190) {
    fwrite(STDERR, "Uso: php bin/create-user.php Nome email@example.test funcionario|responsavel|admin\n"); exit(1);
}
$password = getenv('SEED_PASSWORD');
if ($password === false || strlen($password) < 12 || strlen($password) > 72) { fwrite(STDERR, "Defina SEED_PASSWORD com 12 a 72 bytes.\n"); exit(1); }
$q = App\Core\Database::connection()->prepare('INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)');
try {
    $q->execute([trim($argv[1]), $argv[2], password_hash($password, PASSWORD_DEFAULT), $argv[3]]);
} catch (PDOException $e) {
    $duplicate = (int) ($e->errorInfo[1] ?? 0) === 1062;
    fwrite(STDERR, $duplicate ? "Este e-mail já está cadastrado. Use outro e-mail; contas existentes não são alteradas.\n" : "Falha ao gravar o usuário no banco. Confira o .env e se 2-PREPARAR-BANCO.cmd foi executado.\n");
    exit(1);
}
echo 'Usuário criado: ' . App\Core\Database::connection()->lastInsertId() . "\n";
