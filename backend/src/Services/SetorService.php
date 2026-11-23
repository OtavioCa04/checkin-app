<?php
declare(strict_types=1);
namespace App\Services;
use App\Core\HttpException;
use App\Repositories\SetorRepository;
use PDO;

final class SetorService
{
    private SetorRepository $sectors;
    public function __construct(private PDO $db) { $this->sectors = new SetorRepository($db); }
    public static function validate(array $data, bool $creating): array
    {
        $errors = [];
        foreach (array_diff(array_keys($data), ['nome', 'ativo']) as $key) { $errors[$key] = 'Campo não permitido.'; }
        if (!$creating && !$data) { $errors['body'] = 'Informe ao menos um campo.'; }
        if ($creating || array_key_exists('nome', $data)) {
            $nome = is_string($data['nome'] ?? null) ? trim($data['nome']) : '';
            if ($nome === '' || mb_strlen($nome, 'UTF-8') > 80) { $errors['nome'] = 'Nome obrigatório, até 80 caracteres.'; }
            $data['nome'] = $nome;
        }
        if (array_key_exists('ativo', $data) && !is_bool($data['ativo'])) { $errors['ativo'] = 'Envie um booleano.'; }
        if ($creating && array_key_exists('ativo', $data)) { $errors['ativo'] = 'Setor novo começa ativo.'; }
        if ($errors) { throw new HttpException(400, 'Dados inválidos.', $errors); }
        return $data;
    }
    public function list(array $actor, array $query): array
    {
        self::admin($actor);
        if (array_diff(array_keys($query), ['ativo'])) { throw new HttpException(400, 'Filtro inválido.'); }
        return $this->sectors->list(ClienteService::active($query));
    }
    public function save(array $actor, array $input, ?int $id = null): array
    {
        self::admin($actor);
        $data = self::validate($input, $id === null);
        try {
            if ($id === null) { $id = $this->sectors->create($data['nome']); }
            else {
                if (!$this->sectors->find($id)) { throw new HttpException(404, 'Setor não encontrado.'); }
                $this->sectors->update($id, $data);
            }
        } catch (\PDOException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) === 1062) { throw new HttpException(409, 'Já existe um setor com esse nome.'); }
            throw $e;
        }
        return $this->sectors->find($id);
    }
    private static function admin(array $actor): void
    {
        if ($actor['perfil'] !== 'admin') { throw new HttpException(403, 'Acesso não permitido.'); }
    }
}
