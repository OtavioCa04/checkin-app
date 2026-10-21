<?php
declare(strict_types=1);
namespace App\Repositories;
use PDO;

final class RetornoRepository
{
    public function __construct(private PDO $db){}
    private const SELECT='SELECT t.*,v.usuario_id,v.responsavel_id,v.cliente_id,v.contato_id,v.empresa,v.contato,v.assunto,v.proximo_passo,v.resumo_resultado,v.cadastro_snapshot,u.nome AS funcionario_nome,r.nome AS responsavel_nome,e.nome AS encerrado_por_nome,a.id AS agendamento_id FROM retornos t JOIN visitas v ON v.id=t.visita_id JOIN usuarios u ON u.id=v.usuario_id JOIN usuarios r ON r.id=v.responsavel_id LEFT JOIN usuarios e ON e.id=t.encerrado_por LEFT JOIN agendamentos a ON a.retorno_id=t.id';
    public function create(int $visit,string $date): int{$q=$this->db->prepare('INSERT INTO retornos (visita_id,data_prevista) VALUES (?,?)');$q->execute([$visit,$date]);return (int)$this->db->lastInsertId();}
    public function find(int $id,bool $lock=false):?array
    {
        if($lock){$q=$this->db->prepare('SELECT id FROM retornos WHERE id=? FOR UPDATE');$q->execute([$id]);if(!$q->fetch()){return null;}}
        $q=$this->db->prepare(self::SELECT.' WHERE t.id=?'.($lock?' FOR UPDATE':''));$q->execute([$id]);return $q->fetch()?:null;
    }
    public function list(?string $column,int $user,int $limit,int $offset,array $filters):array
    {
        if(!in_array($column,[null,'usuario_id','responsavel_id'],true)){throw new \InvalidArgumentException();}$where=[];$values=[];
        if($column){$where[]="v.{$column}=?";$values[]=$user;}
        foreach(['inicio'=>'t.data_prevista>=?','fim'=>'t.data_prevista<?','funcionario_id'=>'v.usuario_id=?'] as $key=>$clause){if(isset($filters[$key])){$where[]=$clause;$values[]=$filters[$key];}}
        if(isset($filters['status'])){
            if(in_array($filters['status'],['atrasado','hoje'],true)){$where[]="t.status='pendente' AND t.data_prevista".($filters['status']==='hoje'?'=?':'<?');$values[]=$filters['referencia'];}
            else{$where[]='t.status=?';$values[]=$filters['status'];}
        }
        $q=$this->db->prepare(self::SELECT.($where?' WHERE '.implode(' AND ',$where):'').' ORDER BY t.data_prevista,t.id LIMIT ? OFFSET ?');$i=1;foreach($values as $v){$q->bindValue($i++,$v,is_int($v)?PDO::PARAM_INT:PDO::PARAM_STR);}$q->bindValue($i++,$limit,PDO::PARAM_INT);$q->bindValue($i,$offset,PDO::PARAM_INT);$q->execute();return $q->fetchAll();
    }
    public function finish(int $id,int $author,string $status,string $note):void{$q=$this->db->prepare('UPDATE retornos SET status=?,encerrado_por=?,encerrado_em=UTC_TIMESTAMP(),observacao=? WHERE id=?');$q->execute([$status,$author,$note,$id]);}
    public function generated(int $id,string $hash):void{$q=$this->db->prepare('UPDATE retornos SET agendamento_hash=? WHERE id=?');$q->execute([$hash,$id]);}
}
