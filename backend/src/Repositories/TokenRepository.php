<?php
declare(strict_types=1);
namespace App\Repositories;
use PDO;

final class TokenRepository
{
    public function __construct(private PDO $db) {}
    public function create(int $userId, string $hash, string $expires): void
    {
        $q = $this->db->prepare('INSERT INTO auth_tokens (usuario_id, token_hash, expira_em) VALUES (?, ?, ?)');
        $q->execute([$userId, $hash, $expires]);
    }
    public function user(string $hash): ?array
    {
        $q = $this->db->prepare('SELECT u.* FROM auth_tokens t JOIN usuarios u ON u.id = t.usuario_id WHERE t.token_hash = ? AND t.expira_em > UTC_TIMESTAMP() AND u.ativo = 1');
        $q->execute([$hash]);
        return $q->fetch() ?: null;
    }
    public function revoke(string $hash): void
    {
        $q = $this->db->prepare('DELETE FROM auth_tokens WHERE token_hash = ?');
        $q->execute([$hash]);
    }
}
