<?php
declare(strict_types=1);
namespace App\Services;
use App\Core\HttpException;
use App\Models\Agendamento;
use App\Repositories\{AgendamentoRepository, UsuarioRepository};
use PDO;

final class AgendamentoService
{
    public function __construct(private PDO $db, private AgendamentoRepository $items, private UsuarioRepository $users) {}
    public function options(array $user): array
    {
        if (!in_array($user['perfil'], ['admin', 'funcionario'], true)) { throw new HttpException(403, 'Sem permissão para agendar.'); }
        return ['funcionarios' => $user['perfil'] === 'admin' ? $this->items->people('funcionario') : [['id' => (int) $user['id'], 'nome' => $user['nome']]], 'responsaveis' => $this->items->people('responsavel')];
    }
    public function find(array $user, int $id): array
    {
        $item = $this->items->find($id);
        if (!$item || !Agendamento::canRead($user, $item)) { throw new HttpException(404, 'Agendamento não encontrado.'); }
        $item['eventos'] = $this->items->events($id); return $item;
    }
    public function list(array $user, int $limit, int $offset, array $query): array
    {
        $filters = [];
        if (array_diff(array_keys($query), ['limit', 'offset', 'inicio', 'fim', 'status', 'funcionario_id'])) { throw new HttpException(400, 'Filtro inválido.'); }
        foreach (['inicio', 'fim'] as $key) { if (isset($query[$key])) { $filters[$key] = Agendamento::date($query[$key]); } }
        if (isset($filters['inicio'], $filters['fim']) && $filters['inicio'] >= $filters['fim']) { throw new HttpException(400, 'Fim deve ser posterior ao início.'); }
        if (isset($query['status'])) {
            if (!in_array($query['status'], ['pendente', 'realizado', 'cancelado', 'atrasado'], true)) { throw new HttpException(400, 'Situação inválida.'); }
            $filters['status'] = $query['status'];
        }
        if (isset($query['funcionario_id'])) {
            if ($user['perfil'] !== 'admin') { throw new HttpException(403, 'Filtro exclusivo do administrador.'); }
            $id = filter_var($query['funcionario_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 4294967295]]);
            if (!$id) { throw new HttpException(400, 'Funcionário inválido.'); } $filters['funcionario_id'] = $id;
        }
        $column = match ($user['perfil']) { 'admin' => null, 'responsavel' => 'responsavel_id', default => 'usuario_id' };
        return $this->items->list($column, (int) $user['id'], $limit, $offset, $filters);
    }
    public function create(array $user, array $input): array
    {
        if (!in_array($user['perfil'], ['admin', 'funcionario'], true)) { throw new HttpException(403, 'Sem permissão para agendar.'); }
        if ($user['perfil'] === 'funcionario') {
            if (isset($input['usuario_id']) && $input['usuario_id'] !== (int) $user['id']) { throw new HttpException(403, 'Agende somente para você.'); }
            $input['usuario_id'] = (int) $user['id'];
        }
        $data = Agendamento::create($input);
        $ownsTransaction=!$this->db->inTransaction();
        if($ownsTransaction){$this->db->beginTransaction();}
        try {
            $data=(new ClienteService($this->db))->snapshot($user,$data,$data['usuario_id']);
            // Ordem de bloqueio estável também quando funcionário e responsável coincidem.
            $ids = array_unique([$data['usuario_id'], $data['responsavel_id']]); sort($ids);
            $people = []; foreach ($ids as $id) { $people[$id] = $this->users->byId($id, true); }
            foreach (['usuario_id' => 'funcionario', 'responsavel_id' => 'responsavel'] as $key => $role) {
                $person = $people[$data[$key]];
                if (!$person || !$person['ativo'] || $person['perfil'] !== $role) { throw new HttpException(400, 'Dados inválidos.', [$key => 'Selecione uma pessoa ativa com o perfil adequado.']); }
            }
            $data['criado_por'] = (int) $user['id']; $id = $this->items->create($data);
            $this->items->event($id, (int) $user['id'], 'criado', '', null, $data['data_hora_prevista']);
            $result = $this->find($user, $id); if($ownsTransaction){$this->db->commit();} return $result;
        } catch (\Throwable $e) { if ($ownsTransaction && $this->db->inTransaction()) { $this->db->rollBack(); } throw $e; }
    }
    public function update(array $user, int $id, array $input): array
    {
        $this->db->beginTransaction();
        try {
            $item = $this->items->find($id, true);
            if (!$item || !Agendamento::canRead($user, $item)) { throw new HttpException(404, 'Agendamento não encontrado.'); }
            if (!Agendamento::canManage($user, $item)) { throw new HttpException(403, 'Sem permissão para alterar.'); }
            if ($item['status'] !== 'pendente') { throw new HttpException(409, 'Somente agendamentos pendentes podem ser alterados.'); }
            $data = Agendamento::change($input);
            if ($data['acao'] === 'trocar_responsavel') {
                // Permite seguir com o agendamento quando o responsável original foi desativado ou mudou.
                if ($data['responsavel_id'] === (int) $item['responsavel_id']) { throw new HttpException(400, 'Escolha outro responsável.'); }
                $person = $this->users->byId($data['responsavel_id'], true);
                if (!$person || !$person['ativo'] || $person['perfil'] !== 'responsavel') { throw new HttpException(400, 'Dados inválidos.', ['responsavel_id' => 'Selecione uma pessoa ativa com o perfil adequado.']); }
                $this->items->changeResponsible($id, $data['responsavel_id']);
                $reason = mb_substr($data['motivo'] . ' (anterior: ' . $item['responsavel_nome'] . ' #' . $item['responsavel_id'] . ')', 0, 1000, 'UTF-8');
                $this->items->event($id, (int) $user['id'], 'responsavel_alterado', $reason, null, null);
                $result = $this->find($user, $id); $this->db->commit(); return $result;
            }
            $date = $data['data_hora_prevista'] ?? $item['data_hora_prevista'];
            if ($data['acao'] === 'reagendar' && $date === $item['data_hora_prevista']) { throw new HttpException(400, 'Escolha um novo horário.'); }
            $this->items->change($id, $data['acao'] === 'cancelar' ? 'cancelado' : 'pendente', $date);
            $this->items->event($id, (int) $user['id'], $data['acao'] === 'cancelar' ? 'cancelado' : 'reagendado', $data['motivo'], $item['data_hora_prevista'], $date);
            $result = $this->find($user, $id); $this->db->commit(); return $result;
        } catch (\Throwable $e) { if ($this->db->inTransaction()) { $this->db->rollBack(); } throw $e; }
    }
}
