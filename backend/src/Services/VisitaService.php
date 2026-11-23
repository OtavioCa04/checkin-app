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
    public const FOTO_MAX_BYTES = 5 * 1024 * 1024;
    private const FOTO_TIPOS = [IMAGETYPE_JPEG => ['image/jpeg', 'jpg'], IMAGETYPE_PNG => ['image/png', 'png'], IMAGETYPE_WEBP => ['image/webp', 'webp']];
    public static function requestHash(array $data): string
    {
        ksort($data);
        return hash('sha256', json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    }
    public function create(array $user, array $input, string $key): array
    {
        if (!in_array($user['perfil'], Visita::PERFIS_CAMPO, true)) { throw new HttpException(403, 'Seu perfil não faz check-in.'); }
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
            $agenda = new \App\Repositories\AgendamentoRepository($this->db);
            $scheduled = null;
            if (isset($data['agendamento_id'])) {
                $scheduled = $agenda->find($data['agendamento_id'], true);
                if (!$scheduled || (int) $scheduled['usuario_id'] !== (int) $user['id']) { throw new HttpException(404, 'Agendamento não encontrado.'); }
                if ($scheduled['status'] !== 'pendente' || $scheduled['visita_id'] !== null) { throw new HttpException(409, 'Agendamento cancelado ou já realizado. Consulte a agenda.'); }
                if($scheduled['cliente_id']!==null && ((int)$scheduled['cliente_id']!==($data['cliente_id']??null) || (int)($scheduled['contato_id']??0)!==(int)($data['contato_id']??0))){throw new HttpException(400,'Mantenha o cliente e o contato vinculados ao agendamento.');}
            }
            $data=(new ClienteService($this->db))->snapshot($user,$data);
            $data['usuario_id'] = (int) $user['id'];
            $data['empresa_id'] = (int) $user['empresa_id'];
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
        $column = $user['perfil'] === 'admin' ? null : 'usuario_id';
        $filters = \App\Core\VisitFilters::read($query, $user['perfil']);
        return $this->visits->list((int) $user['empresa_id'], $column, (int) $user['id'], $limit, $offset, $filters);
    }
    public function update(array $user, int $id, array $input): array
    {
        $this->db->beginTransaction();
        try {
            $visit = $this->visits->find($id, true);
            if (!$visit || !Visita::canRead($user, $visit)) { throw new HttpException(404, 'Visita não encontrada.'); }
            if ($user['perfil'] !== 'admin' && (int) $visit['usuario_id'] !== (int) $user['id']) { throw new HttpException(403, 'Sem permissão para editar.'); }
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
    public static function photoDir(): string { return dirname(__DIR__, 2) . '/storage/uploads/visitas'; }
    // Uma foto opcional por visita, enviada pelo próprio funcionário enquanto a visita está em andamento.
    public function savePhoto(array $user, int $id, string $tmpPath, int $size): array
    {
        if ($size < 1) { throw new HttpException(400, 'Envie uma foto.', ['foto' => 'Arquivo vazio ou ausente.']); }
        if ($size > self::FOTO_MAX_BYTES) { throw new HttpException(413, 'Foto muito grande.', ['foto' => 'Envie uma foto de até 5 MB.']); }
        $info = @getimagesize($tmpPath);
        $type = self::FOTO_TIPOS[$info[2] ?? 0] ?? null;
        if (!$type) { throw new HttpException(400, 'Formato de foto inválido.', ['foto' => 'Envie JPG, PNG ou WebP.']); }
        $dir = self::photoDir();
        if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) { throw new \RuntimeException('Pasta de fotos indisponível.'); }
        $name = bin2hex(random_bytes(16)) . '.' . $type[1];
        $target = $dir . '/' . $name;
        $this->db->beginTransaction();
        try {
            $visit = $this->visits->find($id, true);
            if (!$visit || !Visita::canRead($user, $visit)) { throw new HttpException(404, 'Visita não encontrada.'); }
            if ((int) $visit['usuario_id'] !== (int) $user['id']) { throw new HttpException(403, 'Somente quem fez a visita envia a foto.'); }
            if ($visit['status'] === 'concluida') { throw new HttpException(409, 'Visita concluída não recebe foto.'); }
            if ($visit['tem_foto']) { throw new HttpException(409, 'Esta visita já tem foto.'); }
            if (!@copy($tmpPath, $target)) { throw new \RuntimeException('Falha ao gravar a foto.'); }
            $this->visits->addPhoto($id, $name, $type[0], $size, (int) $user['id']);
            $result = $this->visits->find($id);
            $this->db->commit(); return $result;
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) { $this->db->rollBack(); }
            if (is_file($target)) { @unlink($target); }
            throw $e;
        }
    }
    public function photo(array $user, int $id): array
    {
        $this->find($user, $id);
        $photo = $this->visits->photo($id);
        $path = $photo ? self::photoDir() . '/' . basename($photo['arquivo']) : null;
        if (!$path || !is_file($path)) { throw new HttpException(404, 'Visita sem foto.'); }
        return ['path' => $path, 'tipo' => $photo['tipo']];
    }
}
