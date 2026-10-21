<?php
declare(strict_types=1);
namespace App\Repositories;
use PDO;

final class AgendamentoRepository
{
    public function __construct(private PDO $db) {}
    private const SELECT = 'SELECT a.*, u.nome AS funcionario_nome, r.nome AS responsavel_nome, v.id AS visita_id FROM agendamentos a JOIN usuarios u ON u.id=a.usuario_id JOIN usuarios r ON r.id=a.responsavel_id LEFT JOIN visitas v ON v.agendamento_id=a.id';
    public function find(int $id, bool $lock = false): ?array
    {
        if ($lock) {
            $q = $this->db->prepare('SELECT id FROM agendamentos WHERE id=? FOR UPDATE'); $q->execute([$id]);
            if (!$q->fetch()) { return null; }
        }
        $q = $this->db->prepare(self::SELECT . ' WHERE a.id=?'); $q->execute([$id]);
        return $q->fetch() ?: null;
    }
    public function events(int $id): array
    {
        $q = $this->db->prepare('SELECT e.*, u.nome AS autor_nome FROM agendamento_eventos e JOIN usuarios u ON u.id=e.autor_id WHERE e.agendamento_id=? ORDER BY e.id'); $q->execute([$id]); return $q->fetchAll();
    }
    public function list(?string $column, int $userId, int $limit, int $offset, array $filters): array
    {
        if (!in_array($column, [null, 'usuario_id', 'responsavel_id'], true)) { throw new \InvalidArgumentException(); }
        $where = []; $values = [];
        if ($column) { $where[] = "a.{$column}=?"; $values[] = $userId; }
        foreach (['inicio' => 'a.data_hora_prevista>=?', 'fim' => 'a.data_hora_prevista<?', 'funcionario_id' => 'a.usuario_id=?'] as $key => $clause) {
            if (isset($filters[$key])) { $where[] = $clause; $values[] = $filters[$key]; }
        }
        if (($filters['status'] ?? '') === 'atrasado') { $where[] = "a.status='pendente' AND a.data_hora_prevista<UTC_TIMESTAMP()"; }
        elseif (isset($filters['status'])) { $where[] = 'a.status=?'; $values[] = $filters['status']; }
        $q = $this->db->prepare(self::SELECT . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY a.data_hora_prevista, a.id LIMIT ? OFFSET ?');
        $i = 1;
        foreach ($values as $v) { $q->bindValue($i++, $v, is_int($v) ? PDO::PARAM_INT : PDO::PARAM_STR); }
        $q->bindValue($i++, $limit, PDO::PARAM_INT); $q->bindValue($i, $offset, PDO::PARAM_INT); $q->execute(); return $q->fetchAll();
    }
    public function create(array $data): int
    {
        $keys = ['usuario_id', 'responsavel_id', 'criado_por', 'empresa', 'contato', 'assunto', 'observacoes', 'data_hora_prevista', 'cliente_id', 'contato_id', 'cadastro_snapshot'];
        $q = $this->db->prepare('INSERT INTO agendamentos (' . implode(',', $keys) . ') VALUES ('.implode(',',array_fill(0,count($keys),'?')).')');
        $q->execute(array_map(static fn ($key) => $data[$key] ?? null, $keys)); return (int) $this->db->lastInsertId();
    }
    public function change(int $id, string $status, string $date): void
    {
        $q = $this->db->prepare('UPDATE agendamentos SET status=?, data_hora_prevista=? WHERE id=?'); $q->execute([$status, $date, $id]);
    }
    public function changeResponsible(int $id, int $responsibleId): void
    {
        $q = $this->db->prepare('UPDATE agendamentos SET responsavel_id=? WHERE id=?'); $q->execute([$responsibleId, $id]);
    }
    public function event(int $id, int $author, string $action, string $reason, ?string $old, ?string $new): void
    {
        $q = $this->db->prepare('INSERT INTO agendamento_eventos (agendamento_id,autor_id,acao,motivo,data_anterior,data_nova,criado_em) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP())');
        $q->execute([$id, $author, $action, $reason, $old, $new]);
    }
    public function people(string $role): array
    {
        $q = $this->db->prepare('SELECT id,nome FROM usuarios WHERE perfil=? AND ativo=1 ORDER BY nome,id'); $q->execute([$role]);
        return array_map(static fn ($u) => ['id' => (int) $u['id'], 'nome' => $u['nome']], $q->fetchAll());
    }
    public function linkReturn(int $id,int $returnId): void
    {
        $q=$this->db->prepare('UPDATE agendamentos SET retorno_id=? WHERE id=?');$q->execute([$returnId,$id]);
    }
}
