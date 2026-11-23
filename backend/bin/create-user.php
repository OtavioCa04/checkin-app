<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

if ($argc === 4) { $argv[2] = trim($argv[2]); }
if ($argc !== 4 || !filter_var($argv[2], FILTER_VALIDATE_EMAIL) || !in_array($argv[3], App\Models\Usuario::PERFIS, true) || mb_strlen($argv[1]) > 150 || trim($argv[1]) === '' || strlen($argv[2]) > 190) {
    fwrite(STDERR, "Uso: php bin/create-user.php Nome email@example.test funcionario|admin\n"); exit(1);
}
$password = getenv('SEED_PASSWORD');
if ($password === false || strlen($password) < 8 || strlen($password) > 72) { fwrite(STDERR, "Defina SEED_PASSWORD com 8 a 72 bytes.\n"); exit(1); }
$db = App\Core\Database::connection();
// A conta entra na empresa 1 (empresa principal). Outras empresas são criadas pelo superadmin no sistema.
// O primeiro administrador da instalação vira superadmin.
$super = $argv[3] === 'admin' && !(int) $db->query('SELECT COUNT(*) FROM usuarios WHERE superadmin = 1')->fetchColumn();
$q = $db->prepare('INSERT INTO usuarios (empresa_id, nome, email, senha_hash, perfil, superadmin) VALUES (1, ?, ?, ?, ?, ?)');
try {
    $q->execute([trim($argv[1]), $argv[2], password_hash($password, PASSWORD_DEFAULT), $argv[3], (int) $super]);
} catch (PDOException $e) {
    $duplicate = (int) ($e->errorInfo[1] ?? 0) === 1062;
    fwrite(STDERR, $duplicate ? "Este e-mail já está cadastrado. Use outro e-mail; contas existentes não são alteradas.\n" : "Falha ao gravar o usuário no banco. Confira o .env e se 2-PREPARAR-BANCO.cmd foi executado.\n");
    exit(1);
}
echo 'Usuário criado: ' . $db->lastInsertId() . ($super ? ' (superadmin)' : '') . "\n";
