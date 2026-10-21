<?php
declare(strict_types=1);
namespace App\Services;
use App\Core\HttpException;
use App\Models\Usuario;
use App\Repositories\{TokenRepository, UsuarioRepository};
use PDO;

final class UsuarioService
{
    public function __construct(private PDO $db, private UsuarioRepository $users) {}
    public static function validate(array $data, bool $creating): array
    {
        $allowed = $creating ? ['nome', 'email', 'perfil', 'ativo', 'senha'] : ['nome', 'email', 'perfil', 'ativo'];
        $errors = [];
        foreach (array_diff(array_keys($data), $allowed) as $key) { $errors[$key] = 'Campo não permitido.'; }
        if (!$creating && !$data) { $errors['body'] = 'Informe ao menos um campo.'; }
        foreach (['nome', 'email', 'perfil'] as $field) {
            if (!$creating && !array_key_exists($field, $data)) { continue; }
            if (!is_string($data[$field] ?? null)) { $errors[$field] = 'Campo obrigatório.'; continue; }
            $data[$field] = trim($data[$field]);
            if ($field === 'nome' && ($data[$field] === '' || mb_strlen($data[$field], 'UTF-8') > 150)) { $errors[$field] = 'Nome obrigatório, até 150 caracteres.'; }
            if ($field === 'email' && (strlen($data[$field]) > 190 || !filter_var($data[$field], FILTER_VALIDATE_EMAIL))) { $errors[$field] = 'E-mail inválido.'; }
            if ($field === 'perfil' && !in_array($data[$field], Usuario::PERFIS, true)) { $errors[$field] = 'Perfil inválido.'; }
        }
        if (array_key_exists('ativo', $data) && !is_bool($data['ativo'])) { $errors['ativo'] = 'Envie um booleano.'; }
        if ($creating) {
            $data['ativo'] ??= true;
            if (!is_string($data['senha'] ?? null) || strlen($data['senha']) < 12 || strlen($data['senha']) > 72) { $errors['senha'] = 'Senha deve ter de 12 a 72 bytes.'; }
        }
        if ($errors) { throw new HttpException(400, 'Dados inválidos.', $errors); }
        return $data;
    }
    public static function protectLastAdmin(array $before, array $after, int $count): void
    {
        if ($before['perfil'] === 'admin' && $before['ativo'] && (!$after['ativo'] || $after['perfil'] !== 'admin') && $count <= 1) {
            throw new HttpException(409, 'O último administrador ativo não pode ser desativado ou perder o perfil.');
        }
    }
    public function save(array $actor, array $input, ?int $id = null): array
    {
        if ($actor['perfil'] !== 'admin') { throw new HttpException(403, 'Acesso não permitido.'); }
        $data = self::validate($input, $id === null);
        if ($id === null) { $data['senha_hash'] = password_hash($data['senha'], PASSWORD_DEFAULT); unset($data['senha']); }
        $this->db->beginTransaction();
        try {
            // Mutex único serializa todas as mudanças de perfil/ativo, inclusive de admins diferentes.
            $this->users->managementLock();
            $currentActor = $this->users->byId((int) $actor['id']);
            if (!$currentActor || !$currentActor['ativo'] || $currentActor['perfil'] !== 'admin') { throw new HttpException(403, 'Acesso não permitido.'); }
            if ($id !== null) {
                $before = $this->users->byId($id, true) ?? throw new HttpException(404, 'Usuário não encontrado.');
                self::protectLastAdmin($before, [...$before, ...$data], $this->users->activeAdmins());
                $this->users->update($id, $data);
                // Desativar ou trocar o perfil encerra as sessões; uma reativação exige novo login.
                if ((array_key_exists('ativo', $data) && !$data['ativo']) || (isset($data['perfil']) && $data['perfil'] !== $before['perfil'])) {
                    (new TokenRepository($this->db))->revokeUser($id);
                }
            } else { $id = $this->users->create($data); }
            $result = Usuario::publicData($this->users->byId($id));
            $this->db->commit(); return $result;
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) { $this->db->rollBack(); }
            if ($e instanceof \PDOException && (int) ($e->errorInfo[1] ?? 0) === 1062) { throw new HttpException(409, 'E-mail já utilizado.'); }
            throw $e;
        }
    }
}
