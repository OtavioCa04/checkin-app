<?php
declare(strict_types=1);
namespace App\Repositories;
use PDO;

final class VisitaRequestRepository
{
    public function __construct(private PDO $db) {}
    public function claim(int $userId, string $key, string $hash): array
    {
        // A chave única bloqueia a segunda transação até o commit/rollback da primeira.
        $q = $this->db->prepare('INSERT INTO visita_requests (usuario_id, chave, payload_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE chave = chave');
        $q->execute([$userId, $key, $hash]);
        $q = $this->db->prepare('SELECT payload_hash, resposta FROM visita_requests WHERE usuario_id = ? AND chave = ? FOR UPDATE');
        $q->execute([$userId, $key]);
        return $q->fetch();
    }
    public function complete(int $userId, string $key, array $result): void
    {
        $q = $this->db->prepare('UPDATE visita_requests SET resposta = ? WHERE usuario_id = ? AND chave = ?');
        $q->execute([json_encode($result, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $userId, $key]);
    }
}
