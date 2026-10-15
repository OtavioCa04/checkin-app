<?php
declare(strict_types=1);
namespace App\Repositories;
use PDO;

final class VisitaRepository
{
    public function __construct(private PDO $db) {}
    public function create(array $data): int
    {
        $q = $this->db->prepare('INSERT INTO visitas (usuario_id, responsavel_id, latitude, longitude, precisao_gps, contato, empresa, assunto, descricao, agendamento_id, data_hora_checkin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())');
        $q->execute([...array_map(static fn (string $key) => $data[$key], ['usuario_id', 'responsavel_id', 'latitude', 'longitude', 'precisao_gps', 'contato', 'empresa', 'assunto', 'descricao']), $data['agendamento_id'] ?? null]);
        return (int) $this->db->lastInsertId();
    }
    public function find(int $id, bool $lock = false): ?array
    {
        if ($lock) {
            $q = $this->db->prepare('SELECT id FROM visitas WHERE id = ? FOR UPDATE');
            $q->execute([$id]);
            if (!$q->fetch()) { return null; }
        }
        $q = $this->db->prepare('SELECT v.*, u.nome AS funcionario_nome, r.nome AS responsavel_nome FROM visitas v JOIN usuarios u ON u.id = v.usuario_id JOIN usuarios r ON r.id = v.responsavel_id WHERE v.id = ?');
        $q->execute([$id]);
        return $q->fetch() ?: null;
    }
    public function list(?string $column, int $userId, int $limit, int $offset, array $filters = []): array
    {
        if (!in_array($column, [null, 'usuario_id', 'responsavel_id'], true)) { throw new \InvalidArgumentException('Filtro inválido.'); }
        $where = []; $values = [];
        if ($column) { $where[] = "v.{$column} = ?"; $values[] = $userId; }
        foreach (['inicio' => 'v.data_hora_checkin >= ?', 'fim' => 'v.data_hora_checkin < ?', 'status' => 'v.status = ?', 'funcionario_id' => 'v.usuario_id = ?'] as $key => $clause) {
            if (isset($filters[$key])) { $where[] = $clause; $values[] = $filters[$key]; }
        }
        if (isset($filters['empresa'])) {
            $where[] = "v.empresa LIKE ? ESCAPE '!'";
            $values[] = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $filters['empresa']) . '%';
        }
        $q = $this->db->prepare('SELECT v.*, u.nome AS funcionario_nome, r.nome AS responsavel_nome FROM visitas v JOIN usuarios u ON u.id = v.usuario_id JOIN usuarios r ON r.id = v.responsavel_id' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY v.id DESC LIMIT ? OFFSET ?');
        $i = 1;
        foreach ($values as $value) { $q->bindValue($i++, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR); }
        $q->bindValue($i++, $limit, PDO::PARAM_INT);
        $q->bindValue($i, $offset, PDO::PARAM_INT);
        $q->execute();
        return $q->fetchAll();
    }
    public function update(int $id, array $data): void
    {
        $parts = [];
        foreach ($data as $key => $value) {
            if (!in_array($key, [...array_keys(\App\Models\Visita::TEXT), 'status'], true)) { throw new \InvalidArgumentException('Campo inválido.'); }
            $parts[] = "{$key} = ?";
        }
        if (($data['status'] ?? '') === 'concluida') { $parts[] = 'data_hora_checkout = UTC_TIMESTAMP()'; }
        $q = $this->db->prepare('UPDATE visitas SET ' . implode(', ', $parts) . ' WHERE id = ?');
        $q->execute([...array_values($data), $id]);
    }
}
