<?php
declare(strict_types=1);
namespace App\Repositories;
use App\Models\Cliente;
use PDO;

final class ClienteRepository
{
    public function __construct(private PDO $db) {}
    private function scope(?string $column, int $userId): array
    {
        if ($column===null) { return ['1=1',[]]; }
        if (!in_array($column,['usuario_id','responsavel_id'],true)) { throw new \InvalidArgumentException(); }
        $parts=[]; $values=[];
        if ($column==='usuario_id') { $parts[]='EXISTS (SELECT 1 FROM cliente_funcionarios cf WHERE cf.cliente_id=c.id AND cf.usuario_id=?)'; $values[]=$userId; }
        foreach (['visitas','agendamentos'] as $table) { $parts[]="EXISTS (SELECT 1 FROM {$table} h WHERE h.cliente_id=c.id AND h.{$column}=?)"; $values[]=$userId; }
        return ['('.implode(' OR ',$parts).')',$values];
    }
    public function lock(int $id): bool
    {
        $q=$this->db->prepare('SELECT id FROM clientes WHERE id=? FOR UPDATE');$q->execute([$id]);return (bool)$q->fetch();
    }
    public function find(int $id, ?string $column, int $userId, bool $current = false): ?array
    {
        [$scope,$values]=$this->scope($column,$userId);
        $q=$this->db->prepare('SELECT c.* FROM clientes c WHERE c.id=? AND '.$scope.($current?' FOR UPDATE':''));$q->execute([$id,...$values]);return $q->fetch()?:null;
    }
    public function list(?string $column, int $userId, int $limit, int $offset, string $search, ?bool $active): array
    {
        [$scope,$values]=$this->scope($column,$userId);$where=[$scope];
        if ($active!==null) { $where[]='c.ativo=?';$values[]=(int)$active; }
        if ($search!=='') { $where[]="(c.nome_empresa LIKE ? ESCAPE '!' OR c.nome_fantasia LIKE ? ESCAPE '!' OR CONVERT(c.cnpj USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ? ESCAPE '!')";$term='%'.str_replace(['!','%','_'],['!!','!%','!_'],$search).'%';array_push($values,$term,$term,$term); }
        $q=$this->db->prepare('SELECT c.* FROM clientes c WHERE '.implode(' AND ',$where).' ORDER BY c.nome_empresa,c.id LIMIT ? OFFSET ?');$i=1;
        foreach($values as $value){$q->bindValue($i++,$value,is_int($value)?PDO::PARAM_INT:PDO::PARAM_STR);}$q->bindValue($i++,$limit,PDO::PARAM_INT);$q->bindValue($i,$offset,PDO::PARAM_INT);$q->execute();return $q->fetchAll();
    }
    public function hasAccess(int $client, int $user): bool
    {
        $q=$this->db->prepare('SELECT 1 FROM cliente_funcionarios WHERE cliente_id=? AND usuario_id=? FOR UPDATE');$q->execute([$client,$user]);return (bool)$q->fetchColumn();
    }
    public function access(int $client): array
    {
        $q=$this->db->prepare('SELECT cf.usuario_id, u.nome, u.ativo, u.perfil FROM cliente_funcionarios cf JOIN usuarios u ON u.id=cf.usuario_id WHERE cf.cliente_id=? ORDER BY cf.usuario_id');$q->execute([$client]);return $q->fetchAll();
    }
    public function replaceAccess(int $client, array $ids, int $author): void
    {
        $q=$this->db->prepare('DELETE FROM cliente_funcionarios WHERE cliente_id=?');$q->execute([$client]);
        $q=$this->db->prepare('INSERT INTO cliente_funcionarios (cliente_id,usuario_id,atribuido_por) VALUES (?,?,?)');foreach($ids as $id){$q->execute([$client,$id,$author]);}
    }
    public function create(array $data): int
    {
        $keys=[...array_keys(Cliente::TEXT),'cnpj','ativo','criado_por'];
        $q=$this->db->prepare('INSERT INTO clientes ('.implode(',',$keys).') VALUES ('.implode(',',array_fill(0,count($keys),'?')).')');
        $q->execute(array_map(static fn($key)=>is_bool($data[$key])?(int)$data[$key]:$data[$key],$keys));return (int)$this->db->lastInsertId();
    }
    public function update(int $id, array $data): void
    {
        $parts=[];$values=[];foreach($data as $key=>$value){if(!in_array($key,[...array_keys(Cliente::TEXT),'cnpj','ativo'],true)){throw new \InvalidArgumentException();}$parts[]="$key=?";$values[]=is_bool($value)?(int)$value:$value;}
        $q=$this->db->prepare('UPDATE clientes SET '.implode(',',$parts).' WHERE id=?');$q->execute([...$values,$id]);
    }
    public function contact(int $id): ?array
    {
        $q=$this->db->prepare('SELECT id,cliente_id,nome,cargo,email,telefone,principal,ativo,criado_por,criado_em,atualizado_em FROM contatos WHERE id=?'.($this->db->inTransaction()?' FOR UPDATE':''));$q->execute([$id]);return $q->fetch()?:null;
    }
    public function contacts(int $client, int $limit, int $offset, ?bool $active, ?string $column=null, int $userId=0): array
    {
        if(!in_array($column,[null,'usuario_id','responsavel_id'],true)){throw new \InvalidArgumentException();}
        $scope=$column?" AND (EXISTS (SELECT 1 FROM visitas h WHERE h.contato_id=contatos.id AND h.{$column}=?) OR EXISTS (SELECT 1 FROM agendamentos h WHERE h.contato_id=contatos.id AND h.{$column}=?))":'';
        $q=$this->db->prepare('SELECT id,cliente_id,nome,cargo,email,telefone,principal,ativo,criado_por,criado_em,atualizado_em FROM contatos WHERE cliente_id=?'.($active===null?'':' AND ativo=?').$scope.' ORDER BY principal DESC,nome,id LIMIT ? OFFSET ?');$i=1;$q->bindValue($i++,$client,PDO::PARAM_INT);if($active!==null){$q->bindValue($i++,(int)$active,PDO::PARAM_INT);}if($column){$q->bindValue($i++,$userId,PDO::PARAM_INT);$q->bindValue($i++,$userId,PDO::PARAM_INT);}$q->bindValue($i++,$limit,PDO::PARAM_INT);$q->bindValue($i,$offset,PDO::PARAM_INT);$q->execute();return $q->fetchAll();
    }
    public function saveContact(int $client, array $data, ?int $id): int
    {
        if (($data['principal']??false)&&($data['ativo']??true)) { $q=$this->db->prepare('UPDATE contatos SET principal=0 WHERE cliente_id=?');$q->execute([$client]); }
        $values=array_map(static fn($v)=>is_bool($v)?(int)$v:$v,array_values($data));
        $allowed=['nome','cargo','email','telefone','principal','ativo','criado_por'];if(array_diff(array_keys($data),$allowed)){throw new \InvalidArgumentException();}
        if($id===null){$q=$this->db->prepare('INSERT INTO contatos (cliente_id,'.implode(',',array_keys($data)).') VALUES ('.implode(',',array_fill(0,count($data)+1,'?')).')');$q->execute([$client,...$values]);return (int)$this->db->lastInsertId();}
        $parts=array_map(static fn($key)=>"$key=?",array_keys($data));$q=$this->db->prepare('UPDATE contatos SET '.implode(',',$parts).' WHERE id=? AND cliente_id=?');$q->execute([...$values,$id,$client]);return $id;
    }
    public function history(int $client, string $kind, ?string $column, int $userId, int $limit, int $offset): array
    {
        if(!in_array($kind,['visitas','agendamentos'],true)||!in_array($column,[null,'usuario_id','responsavel_id'],true)){throw new \InvalidArgumentException();}
        $q=$this->db->prepare("SELECT h.*,u.nome AS funcionario_nome,r.nome AS responsavel_nome FROM {$kind} h JOIN usuarios u ON u.id=h.usuario_id JOIN usuarios r ON r.id=h.responsavel_id WHERE h.cliente_id=?".($column?" AND h.{$column}=?":'').' ORDER BY h.id DESC LIMIT ? OFFSET ?');$i=1;$q->bindValue($i++,$client,PDO::PARAM_INT);if($column){$q->bindValue($i++,$userId,PDO::PARAM_INT);}$q->bindValue($i++,$limit,PDO::PARAM_INT);$q->bindValue($i,$offset,PDO::PARAM_INT);$q->execute();return $q->fetchAll();
    }
}
