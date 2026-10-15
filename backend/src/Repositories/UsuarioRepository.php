<?php
declare(strict_types=1);
namespace App\Repositories;
use PDO;

final class UsuarioRepository
{
    public function __construct(private PDO $db) {}
    public function byEmail(string $email): ?array
    {
        $q = $this->db->prepare('SELECT * FROM usuarios WHERE email = ?');
        $q->execute([$email]);
        return $q->fetch() ?: null;
    }
    public function byId(int $id, bool $lock = false): ?array
    {
        $q = $this->db->prepare('SELECT * FROM usuarios WHERE id = ?' . ($lock ? ' FOR UPDATE' : ''));
        $q->execute([$id]);
        return $q->fetch() ?: null;
    }
    public function list(int $limit, int $offset): array
    {
        $q = $this->db->prepare('SELECT id, nome, email, perfil, ativo FROM usuarios ORDER BY id LIMIT ? OFFSET ?');
        $q->bindValue(1, $limit, PDO::PARAM_INT);
        $q->bindValue(2, $offset, PDO::PARAM_INT);
        $q->execute();
        return $q->fetchAll();
    }
    public function activeResponsibles(): array
    {
        $q = $this->db->prepare("SELECT id, nome FROM usuarios WHERE perfil = ? AND ativo = 1 ORDER BY nome, id");
        $q->execute(['responsavel']);
        return array_map(static fn (array $row): array => ['id' => (int) $row['id'], 'nome' => $row['nome']], $q->fetchAll());
    }
    public function managementLock(): void { $this->db->query('SELECT id FROM user_management_lock WHERE id = 1 FOR UPDATE')->fetch(); }
    public function activeAdmins(): int { return (int) $this->db->query("SELECT COUNT(*) FROM usuarios WHERE perfil = 'admin' AND ativo = 1")->fetchColumn(); }
    public function create(array $data): int
    {
        $q = $this->db->prepare('INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, ?)');
        $q->execute([$data['nome'], $data['email'], $data['senha_hash'], $data['perfil'], (int) $data['ativo']]);
        return (int) $this->db->lastInsertId();
    }
    public function update(int $id, array $data): void
    {
        $parts = [];
        foreach ($data as $key => $value) {
            if (!in_array($key, ['nome', 'email', 'perfil', 'ativo'], true)) { throw new \InvalidArgumentException('Campo inválido.'); }
            $parts[] = "{$key} = ?";
        }
        if (isset($data['ativo'])) { $data['ativo'] = (int) $data['ativo']; }
        $q = $this->db->prepare('UPDATE usuarios SET ' . implode(', ', $parts) . ' WHERE id = ?');
        $q->execute([...array_values($data), $id]);
    }
}
