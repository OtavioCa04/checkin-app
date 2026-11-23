<?php
declare(strict_types=1);
namespace App\Repositories;
use PDO;

final class SetorRepository
{
    public function __construct(private PDO $db) {}
    private const SELECT = 'SELECT s.id, s.nome, s.ativo, (SELECT COUNT(*) FROM usuarios u WHERE u.setor_id = s.id AND u.ativo = 1) AS usuarios FROM setores s WHERE s.empresa_id = ?';
    public function list(int $company, ?bool $active = null): array
    {
        $q = $this->db->prepare(self::SELECT . ($active === null ? '' : ' AND s.ativo = ?') . ' ORDER BY s.nome, s.id');
        $q->execute($active === null ? [$company] : [$company, (int) $active]);
        return array_map(self::row(...), $q->fetchAll());
    }
    public function find(int $company, int $id): ?array
    {
        $q = $this->db->prepare(self::SELECT . ' AND s.id = ?');
        $q->execute([$company, $id]);
        $row = $q->fetch();
        return $row ? self::row($row) : null;
    }
    public function create(int $company, string $nome): int
    {
        $q = $this->db->prepare('INSERT INTO setores (empresa_id, nome) VALUES (?, ?)');
        $q->execute([$company, $nome]);
        return (int) $this->db->lastInsertId();
    }
    public function update(int $company, int $id, array $data): void
    {
        $parts = [];
        $values = [];
        foreach ($data as $key => $value) {
            if (!in_array($key, ['nome', 'ativo'], true)) { throw new \InvalidArgumentException('Campo inválido.'); }
            $parts[] = "{$key} = ?";
            $values[] = $key === 'ativo' ? (int) $value : $value;
        }
        $q = $this->db->prepare('UPDATE setores SET ' . implode(', ', $parts) . ' WHERE id = ? AND empresa_id = ?');
        $q->execute([...$values, $id, $company]);
    }
    private static function row(array $row): array
    {
        return ['id' => (int) $row['id'], 'nome' => $row['nome'], 'ativo' => (bool) $row['ativo'], 'usuarios' => (int) $row['usuarios']];
    }
}
