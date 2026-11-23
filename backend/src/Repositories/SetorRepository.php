<?php
declare(strict_types=1);
namespace App\Repositories;
use PDO;

final class SetorRepository
{
    public function __construct(private PDO $db) {}
    public function list(?bool $active = null): array
    {
        $sql = 'SELECT s.id, s.nome, s.ativo, (SELECT COUNT(*) FROM usuarios u WHERE u.setor_id = s.id AND u.ativo = 1) AS usuarios FROM setores s';
        $q = $this->db->prepare($sql . ($active === null ? '' : ' WHERE s.ativo = ?') . ' ORDER BY s.nome, s.id');
        $q->execute($active === null ? [] : [(int) $active]);
        return array_map(self::row(...), $q->fetchAll());
    }
    public function find(int $id): ?array
    {
        $q = $this->db->prepare('SELECT s.id, s.nome, s.ativo, (SELECT COUNT(*) FROM usuarios u WHERE u.setor_id = s.id AND u.ativo = 1) AS usuarios FROM setores s WHERE s.id = ?');
        $q->execute([$id]);
        $row = $q->fetch();
        return $row ? self::row($row) : null;
    }
    public function create(string $nome): int
    {
        $q = $this->db->prepare('INSERT INTO setores (nome) VALUES (?)');
        $q->execute([$nome]);
        return (int) $this->db->lastInsertId();
    }
    public function update(int $id, array $data): void
    {
        $parts = [];
        $values = [];
        foreach ($data as $key => $value) {
            if (!in_array($key, ['nome', 'ativo'], true)) { throw new \InvalidArgumentException('Campo inválido.'); }
            $parts[] = "{$key} = ?";
            $values[] = $key === 'ativo' ? (int) $value : $value;
        }
        $q = $this->db->prepare('UPDATE setores SET ' . implode(', ', $parts) . ' WHERE id = ?');
        $q->execute([...$values, $id]);
    }
    private static function row(array $row): array
    {
        return ['id' => (int) $row['id'], 'nome' => $row['nome'], 'ativo' => (bool) $row['ativo'], 'usuarios' => (int) $row['usuarios']];
    }
}
