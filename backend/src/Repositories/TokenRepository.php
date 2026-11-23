<?php
declare(strict_types=1);
namespace App\Repositories;
use PDO;

final class TokenRepository
{
    public function __construct(private PDO $db) {}
    public function create(int $userId, string $hash, string $expires): void
    {
        $q = $this->db->prepare('DELETE FROM auth_tokens WHERE usuario_id = ? AND expira_em <= UTC_TIMESTAMP()');
        $q->execute([$userId]);
        $q = $this->db->prepare('INSERT INTO auth_tokens (usuario_id, token_hash, expira_em) VALUES (?, ?, ?)');
        $q->execute([$userId, $hash, $expires]);
    }
    public function user(string $hash): ?array
    {
        // Empresa desativada encerra o acesso de todos os seus usuários.
        $q = $this->db->prepare('SELECT u.*, e.nome AS empresa_nome, s.nome AS setor_nome FROM auth_tokens t JOIN usuarios u ON u.id = t.usuario_id JOIN empresas e ON e.id = u.empresa_id AND e.ativo = 1 LEFT JOIN setores s ON s.id = u.setor_id WHERE t.token_hash = ? AND t.expira_em > UTC_TIMESTAMP() AND u.ativo = 1');
        $q->execute([$hash]);
        return $q->fetch() ?: null;
    }
    public function revoke(string $hash): void
    {
        $q = $this->db->prepare('DELETE FROM auth_tokens WHERE token_hash = ?');
        $q->execute([$hash]);
    }
    public function revokeUser(int $userId): void
    {
        $q = $this->db->prepare('DELETE FROM auth_tokens WHERE usuario_id = ?');
        $q->execute([$userId]);
    }
}
