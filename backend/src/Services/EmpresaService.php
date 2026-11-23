<?php
declare(strict_types=1);
namespace App\Services;
use App\Core\HttpException;
use App\Repositories\{TokenRepository, UsuarioRepository};
use PDO;

// Área do superadmin (dono do Na Rua): cria empresas clientes e o primeiro administrador de cada uma.
// Não dá acesso às visitas, clientes ou agenda das empresas.
final class EmpresaService
{
    public function __construct(private PDO $db) {}
    public static function validate(array $data, bool $creating): array
    {
        $allowed = $creating ? ['nome', 'admin_nome', 'admin_email', 'admin_senha'] : ['nome', 'ativo'];
        $errors = [];
        foreach (array_diff(array_keys($data), $allowed) as $key) { $errors[$key] = 'Campo não permitido.'; }
        if (!$creating && !$data) { $errors['body'] = 'Informe ao menos um campo.'; }
        if ($creating || array_key_exists('nome', $data)) {
            $nome = is_string($data['nome'] ?? null) ? trim($data['nome']) : '';
            if ($nome === '' || mb_strlen($nome, 'UTF-8') > 150) { $errors['nome'] = 'Nome da empresa obrigatório, até 150 caracteres.'; }
            $data['nome'] = $nome;
        }
        if (array_key_exists('ativo', $data) && !is_bool($data['ativo'])) { $errors['ativo'] = 'Envie um booleano.'; }
        if ($creating) {
            // Reaproveita a validação de usuário e devolve os erros com os nomes de campo deste formulário.
            $admin = null;
            try { $admin = UsuarioService::validate(['nome' => $data['admin_nome'] ?? null, 'email' => $data['admin_email'] ?? null, 'perfil' => 'admin', 'senha' => $data['admin_senha'] ?? null], true); }
            catch (HttpException $e) { foreach ($e->errors as $key => $message) { $errors['admin_' . $key] = $message; } }
            $data = ['nome' => $data['nome'] ?? '', 'admin' => $admin];
        }
        if ($errors) { throw new HttpException(400, 'Dados inválidos.', $errors); }
        return $data;
    }
    public function list(array $actor): array
    {
        self::superadmin($actor);
        return $this->rows();
    }
    public function create(array $actor, array $input): array
    {
        self::superadmin($actor);
        $data = self::validate($input, true);
        $this->db->beginTransaction();
        try {
            $q = $this->db->prepare('INSERT INTO empresas (nome) VALUES (?)');
            $q->execute([$data['nome']]);
            $company = (int) $this->db->lastInsertId();
            $admin = $data['admin'];
            (new UsuarioRepository($this->db))->create(['empresa_id' => $company, 'nome' => $admin['nome'], 'email' => $admin['email'], 'senha_hash' => password_hash($admin['senha'], PASSWORD_DEFAULT), 'perfil' => 'admin', 'ativo' => true]);
            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) { $this->db->rollBack(); }
            if ($e instanceof \PDOException && (int) ($e->errorInfo[1] ?? 0) === 1062) {
                $email = str_contains($e->getMessage(), 'uk_usuarios_email');
                throw new HttpException(409, $email ? 'E-mail do administrador já utilizado.' : 'Já existe uma empresa com esse nome.', [$email ? 'admin_email' : 'nome' => $email ? 'E-mail já cadastrado.' : 'Nome já cadastrado.']);
            }
            throw $e;
        }
        return $this->find($company);
    }
    public function update(array $actor, int $id, array $input): array
    {
        self::superadmin($actor);
        $data = self::validate($input, false);
        if (!$this->find($id, false)) { throw new HttpException(404, 'Empresa não encontrada.'); }
        if (array_key_exists('ativo', $data) && !$data['ativo'] && $id === (int) $actor['empresa_id']) { throw new HttpException(409, 'Você não pode desativar a sua própria empresa.'); }
        $this->db->beginTransaction();
        try {
            $parts = []; $values = [];
            foreach ($data as $key => $value) { $parts[] = "{$key} = ?"; $values[] = is_bool($value) ? (int) $value : $value; }
            $q = $this->db->prepare('UPDATE empresas SET ' . implode(', ', $parts) . ' WHERE id = ?');
            $q->execute([...$values, $id]);
            // Desativar a empresa encerra na hora as sessões de todos os usuários dela.
            if (array_key_exists('ativo', $data) && !$data['ativo']) {
                $q = $this->db->prepare('DELETE t FROM auth_tokens t JOIN usuarios u ON u.id = t.usuario_id WHERE u.empresa_id = ?');
                $q->execute([$id]);
            }
            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) { $this->db->rollBack(); }
            if ($e instanceof \PDOException && (int) ($e->errorInfo[1] ?? 0) === 1062) { throw new HttpException(409, 'Já existe uma empresa com esse nome.', ['nome' => 'Nome já cadastrado.']); }
            throw $e;
        }
        return $this->find($id);
    }
    private function find(int $id, bool $required = true): ?array
    {
        $row = $this->rows($id)[0] ?? null;
        if (!$row && $required) { throw new HttpException(404, 'Empresa não encontrada.'); }
        return $row;
    }
    private function rows(?int $id = null): array
    {
        $q = $this->db->prepare("SELECT e.id, e.nome, e.ativo, e.criado_em,
            (SELECT COUNT(*) FROM usuarios u WHERE u.empresa_id = e.id AND u.ativo = 1) AS usuarios,
            (SELECT COUNT(*) FROM usuarios u WHERE u.empresa_id = e.id AND u.ativo = 1 AND u.perfil = 'admin') AS admins,
            (SELECT COUNT(*) FROM visitas v WHERE v.empresa_id = e.id AND v.data_hora_checkin >= UTC_TIMESTAMP() - INTERVAL 30 DAY) AS visitas_30d
            FROM empresas e" . ($id === null ? '' : ' WHERE e.id = ?') . ' ORDER BY e.nome, e.id');
        $q->execute($id === null ? [] : [$id]);
        return array_map(self::row(...), $q->fetchAll());
    }
    private static function row(array $r): array
    {
        return ['id' => (int) $r['id'], 'nome' => $r['nome'], 'ativo' => (bool) $r['ativo'], 'criado_em' => $r['criado_em'], 'usuarios' => (int) $r['usuarios'], 'admins' => (int) $r['admins'], 'visitas_30d' => (int) $r['visitas_30d']];
    }
    private static function superadmin(array $actor): void
    {
        if (empty($actor['superadmin'])) { throw new HttpException(403, 'Acesso exclusivo do superadmin.'); }
    }
}
