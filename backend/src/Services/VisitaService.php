<?php
declare(strict_types=1);
namespace App\Services;
use App\Core\HttpException;
use App\Models\Visita;
use App\Repositories\{VisitaRepository, UsuarioRepository};
use PDO;

final class VisitaService
{
    public function __construct(private PDO $db, private VisitaRepository $visits, private UsuarioRepository $users) {}
    public static function requestHash(array $data): string
    {
        foreach (['latitude', 'longitude', 'precisao_gps'] as $key) { $data[$key] = (float) $data[$key]; }
        ksort($data);
        return hash('sha256', json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    }
    public function create(array $user, array $input, string $key): array
    {
        if ($user['perfil'] !== 'funcionario') { throw new HttpException(403, 'Somente funcionários podem fazer check-in.'); }
        if (!preg_match('/^[A-Za-z0-9_-]{16,80}$/D', $key)) { throw new HttpException(400, 'Envie Idempotency-Key com 16 a 80 caracteres alfanuméricos, hífen ou sublinhado.'); }
        $data = Visita::validate($input, true);
        $requests = new \App\Repositories\VisitaRequestRepository($this->db);
        $this->db->beginTransaction();
        try {
            $record = $requests->claim((int) $user['id'], $key, self::requestHash($data));
            if (!hash_equals($record['payload_hash'], self::requestHash($data))) { throw new HttpException(409, 'Chave de idempotência já utilizada com outros dados.'); }
            if ($record['resposta'] !== null) {
                $result = json_decode($record['resposta'], true, 32, JSON_THROW_ON_ERROR);
                $this->db->commit(); return $result;
            }
            $ttl = min(120, max(1, (int) \App\Config\App::env('GPS_MAX_AGE_SECONDS', '120')));
            $age = (int) floor(microtime(true) * 1000) - $data['gps_capturado_em'];
            if ($age < -5000 || $age > $ttl * 1000) { throw new HttpException(400, 'Capture uma localização atual.', ['gps_capturado_em' => 'A localização expirou ou tem horário inválido. Faça nova captura.']); }
            $agenda = new \App\Repositories\AgendamentoRepository($this->db);
            $scheduled = null;
            if (isset($data['agendamento_id'])) {
                $scheduled = $agenda->find($data['agendamento_id'], true);
                if (!$scheduled || (int) $scheduled['usuario_id'] !== (int) $user['id']) { throw new HttpException(404, 'Agendamento não encontrado.'); }
                if ($scheduled['status'] !== 'pendente' || $scheduled['visita_id'] !== null) { throw new HttpException(409, 'Agendamento cancelado ou já realizado. Consulte a agenda.'); }
                if ((int) $scheduled['responsavel_id'] !== $data['responsavel_id']) { throw new HttpException(400, 'Use o responsável do agendamento.', ['responsavel_id' => 'O responsável deve ser o do agendamento.']); }
                if($scheduled['cliente_id']!==null && ((int)$scheduled['cliente_id']!==($data['cliente_id']??null) || (int)($scheduled['contato_id']??0)!==(int)($data['contato_id']??0))){throw new HttpException(400,'Mantenha o cliente e o contato vinculados ao agendamento.');}
            }
            $data=(new ClienteService($this->db))->snapshot($user,$data);
            $responsible = $this->users->byId($data['responsavel_id'], true);
            if (!$responsible || !$responsible['ativo'] || $responsible['perfil'] !== 'responsavel') {
                throw new HttpException(400, 'Dados inválidos.', ['responsavel_id' => 'Responsável inexistente, inativo ou sem perfil adequado.']);
            }
            $data['usuario_id'] = (int) $user['id'];
            $result = $this->find($user, $this->visits->create($data));
            if ($scheduled) {
                $agenda->change((int) $scheduled['id'], 'realizado', $scheduled['data_hora_prevista']);
                $agenda->event((int) $scheduled['id'], (int) $user['id'], 'realizado', 'Check-in criado.', $scheduled['data_hora_prevista'], $scheduled['data_hora_prevista']);
            }
            $requests->complete((int) $user['id'], $key, $result);
            $this->db->commit(); return $result;
        } catch (\Throwable $e) { if ($this->db->inTransaction()) { $this->db->rollBack(); } throw $e; }
    }
    public function find(array $user, int $id): array
    {
        $visit = $this->visits->find($id);
        if (!$visit || !Visita::canRead($user, $visit)) { throw new HttpException(404, 'Visita não encontrada.'); }
        return $visit;
    }
    public function list(array $user, int $limit, int $offset, array $query = []): array
    {
        $column = match ($user['perfil']) { 'admin' => null, 'responsavel' => 'responsavel_id', default => 'usuario_id' };
        $filters = \App\Core\VisitFilters::read($query, $user['perfil']);
        return $this->visits->list($column, (int) $user['id'], $limit, $offset, $filters);
    }
    public function update(array $user, int $id, array $input): array
    {
        $this->db->beginTransaction();
        try {
            $visit = $this->visits->find($id, true);
            if (!$visit || !Visita::canRead($user, $visit)) { throw new HttpException(404, 'Visita não encontrada.'); }
            if ($user['perfil'] !== 'admin' && !($user['perfil'] === 'funcionario' && (int) $visit['usuario_id'] === (int) $user['id'])) { throw new HttpException(403, 'Sem permissão para editar.'); }
            if ($visit['status'] === 'concluida') { throw new HttpException(409, 'Visita concluída não pode ser editada.'); }
            $data = Visita::validate($input, false);
            foreach(['empresa'=>'cliente_id','contato'=>'contato_id'] as $field=>$link){if($visit[$link]!==null && isset($data[$field]) && $data[$field]!==$visit[$field]){throw new HttpException(400,'O retrato cadastral da visita não pode ser alterado.',[$field=>'Campo vinculado ao cadastro no momento do check-in.']);}}
            $this->visits->update($id, $data);
            if(($data['status']??'')==='concluida' && $data['data_retorno']!==null){(new \App\Repositories\RetornoRepository($this->db))->create($id,$data['data_retorno']);}
            $result = $this->visits->find($id);
            $this->db->commit();
            return $result;
        } catch (\Throwable $e) { $this->db->rollBack(); throw $e; }
    }
}
