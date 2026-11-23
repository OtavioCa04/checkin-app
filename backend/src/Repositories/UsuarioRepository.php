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
        $q = $this->db->prepare('SELECT u.*, s.nome AS setor_nome FROM usuarios u LEFT JOIN setores s ON s.id = u.setor_id WHERE u.id = ?' . ($lock ? ' FOR UPDATE' : ''));
        $q->execute([$id]);
        return $q->fetch() ?: null;
    }
    public function list(int $limit, int $offset): array
    {
        $q = $this->db->prepare('SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.setor_id, s.nome AS setor_nome FROM usuarios u LEFT JOIN setores s ON s.id = u.setor_id ORDER BY u.id LIMIT ? OFFSET ?');
        $q->bindValue(1, $limit, PDO::PARAM_INT);
        $q->bindValue(2, $offset, PDO::PARAM_INT);
        $q->execute();
        return $q->fetchAll();
    }
    public function managementLock(): void { $this->db->query('SELECT id FROM user_management_lock WHERE id = 1 FOR UPDATE')->fetch(); }
    public function activeAdmins(): int { return (int) $this->db->query("SELECT COUNT(*) FROM usuarios WHERE perfil = 'admin' AND ativo = 1")->fetchColumn(); }
    public function create(array $data): int
    {
        $q = $this->db->prepare('INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, setor_id) VALUES (?, ?, ?, ?, ?, ?)');
        $q->execute([$data['nome'], $data['email'], $data['senha_hash'], $data['perfil'], (int) $data['ativo'], $data['setor_id'] ?? null]);
        return (int) $this->db->lastInsertId();
    }
    public function update(int $id, array $data): void
    {
        $parts = [];
        foreach ($data as $key => $value) {
            if (!in_array($key, ['nome', 'email', 'perfil', 'ativo', 'setor_id'], true)) { throw new \InvalidArgumentException('Campo inválido.'); }
            $parts[] = "{$key} = ?";
        }
        if (isset($data['ativo'])) { $data['ativo'] = (int) $data['ativo']; }
        $q = $this->db->prepare('UPDATE usuarios SET ' . implode(', ', $parts) . ' WHERE id = ?');
        $q->execute([...array_values($data), $id]);
    }
}
