<?php
declare(strict_types=1);
namespace App\Repositories;
use PDO;

final class UsuarioRepository
{
    public function __construct(private PDO $db) {}
    public function byEmail(string $email): ?array
    {
        $q = $this->db->prepare('SELECT u.*, e.nome AS empresa_nome, e.ativo AS empresa_ativa, s.nome AS setor_nome FROM usuarios u JOIN empresas e ON e.id = u.empresa_id LEFT JOIN setores s ON s.id = u.setor_id WHERE u.email = ?');
        $q->execute([$email]);
        return $q->fetch() ?: null;
    }
    public function byId(int $id, bool $lock = false): ?array
    {
        $q = $this->db->prepare('SELECT u.*, s.nome AS setor_nome, e.nome AS empresa_nome FROM usuarios u JOIN empresas e ON e.id = u.empresa_id LEFT JOIN setores s ON s.id = u.setor_id WHERE u.id = ?' . ($lock ? ' FOR UPDATE' : ''));
        $q->execute([$id]);
        return $q->fetch() ?: null;
    }
    /** Usuário da empresa informada; de outra empresa conta como inexistente. */
    public function inCompany(int $company, int $id, bool $lock = false): ?array
    {
        $user = $this->byId($id, $lock);
        return $user && (int) $user['empresa_id'] === $company ? $user : null;
    }
    public function list(int $company, int $limit, int $offset): array
    {
        $q = $this->db->prepare('SELECT u.id, u.empresa_id, u.nome, u.email, u.perfil, u.ativo, u.superadmin, u.setor_id, s.nome AS setor_nome FROM usuarios u LEFT JOIN setores s ON s.id = u.setor_id WHERE u.empresa_id = ? ORDER BY u.id LIMIT ? OFFSET ?');
        $q->bindValue(1, $company, PDO::PARAM_INT);
        $q->bindValue(2, $limit, PDO::PARAM_INT);
        $q->bindValue(3, $offset, PDO::PARAM_INT);
        $q->execute();
        return $q->fetchAll();
    }
    public function managementLock(): void { $this->db->query('SELECT id FROM user_management_lock WHERE id = 1 FOR UPDATE')->fetch(); }
    public function activeAdmins(int $company): int
    {
        $q = $this->db->prepare("SELECT COUNT(*) FROM usuarios WHERE perfil = 'admin' AND ativo = 1 AND empresa_id = ?");
        $q->execute([$company]);
        return (int) $q->fetchColumn();
    }
    public function create(array $data): int
    {
        // Empresa sempre explícita: sem padrão, para nunca cair na empresa errada.
        $q = $this->db->prepare('INSERT INTO usuarios (empresa_id, nome, email, senha_hash, perfil, ativo, setor_id, superadmin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $q->execute([$data['empresa_id'], $data['nome'], $data['email'], $data['senha_hash'], $data['perfil'], (int) $data['ativo'], $data['setor_id'] ?? null, (int) ($data['superadmin'] ?? false)]);
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
