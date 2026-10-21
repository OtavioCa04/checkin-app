<?php
declare(strict_types=1);
namespace App\Services;
use App\Core\HttpException;
use App\Models\{Visita,Agendamento,Resultado};
use App\Repositories\{RetornoRepository,AgendamentoRepository,UsuarioRepository};
use PDO;

final class RetornoService
{
    private RetornoRepository $items;
    public function __construct(private PDO $db){$this->items=new RetornoRepository($db);}
    public function find(array $user,int $id,bool $lock=false):array
    {
        $item=$this->items->find($id,$lock);if(!$item||!Visita::canRead($user,$item)){throw new HttpException(404,'Retorno não encontrado.');}return $item;
    }
    private function manage(array $user,int $id):array
    {
        $item=$this->find($user,$id,true);if($user['perfil']!=='admin'&&$user['perfil']!=='funcionario'){throw new HttpException(403,'Acesso somente para consulta.');}if($item['status']!=='pendente'){throw new HttpException(409,'Retorno já encerrado.');}return $item;
    }
    public function list(array $user,int $limit,int $offset,array $query):array
    {
        if(array_diff(array_keys($query),['limit','offset','inicio','fim','status','funcionario_id','referencia'])){throw new HttpException(400,'Filtro inválido.');}$filters=[];
        foreach(['inicio','fim','referencia'] as $key){if(isset($query[$key])){$filters[$key]=Resultado::day($query[$key]);}}
        if(isset($filters['inicio'],$filters['fim'])&&$filters['inicio']>=$filters['fim']){throw new HttpException(400,'Fim deve ser posterior ao início.');}$filters['referencia']??=gmdate('Y-m-d');
        if(isset($query['status'])){if(!in_array($query['status'],['pendente','realizado','cancelado','atrasado','hoje'],true)){throw new HttpException(400,'Situação inválida.');}$filters['status']=$query['status'];}
        if(isset($query['funcionario_id'])){if($user['perfil']!=='admin'){throw new HttpException(403,'Filtro exclusivo do administrador.');}$id=filter_var($query['funcionario_id'],FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>4294967295]]);if(!$id){throw new HttpException(400,'Funcionário inválido.');}$filters['funcionario_id']=$id;}
        $column=match($user['perfil']){'admin'=>null,'responsavel'=>'responsavel_id',default=>'usuario_id'};return $this->items->list($column,(int)$user['id'],$limit,$offset,$filters);
    }
    public function update(array $user,int $id,array $input):array
    {
        if(array_diff(array_keys($input),['status','observacao'])||!in_array($input['status']??null,['realizado','cancelado'],true)||!is_string($input['observacao']??null)||trim($input['observacao'])===''||mb_strlen($input['observacao'],'UTF-8')>1000){throw new HttpException(400,'Informe situação e observação obrigatória de até 1000 caracteres.');}
        $this->db->beginTransaction();try{$this->manage($user,$id);$this->items->finish($id,(int)$user['id'],$input['status'],trim($input['observacao']));$result=$this->find($user,$id);$this->db->commit();return $result;}catch(\Throwable $e){if($this->db->inTransaction()){$this->db->rollBack();}throw $e;}
    }
    public function schedule(array $user,int $id,array $input):array
    {
        if(array_diff(array_keys($input),['data_hora_prevista'])){throw new HttpException(400,'Campo não permitido.');}$date=Agendamento::date($input['data_hora_prevista']??null);$hash=hash('sha256',$date);
        $this->db->beginTransaction();try{
            $item=$this->find($user,$id,true);if(!in_array($user['perfil'],['admin','funcionario'],true)){throw new HttpException(403,'Acesso somente para consulta.');}
            $repo=new AgendamentoRepository($this->db);$agenda=new AgendamentoService($this->db,$repo,new UsuarioRepository($this->db));
            if($item['agendamento_id']!==null){if(!hash_equals($item['agendamento_hash'],$hash)){throw new HttpException(409,'Este retorno já gerou um agendamento. Consulte a agenda.');}$result=$agenda->find($user,(int)$item['agendamento_id']);$this->db->commit();return $result;}
            if($item['status']!=='pendente'){throw new HttpException(409,'Retorno já encerrado.');}
            $data=['usuario_id'=>(int)$item['usuario_id'],'responsavel_id'=>(int)$item['responsavel_id'],'empresa'=>$item['empresa'],'contato'=>$item['contato'],'assunto'=>$item['assunto'],'observacoes'=>$item['proximo_passo']?:($item['resumo_resultado']??''),'data_hora_prevista'=>$input['data_hora_prevista']];
            foreach(['cliente_id','contato_id'] as $key){if($item[$key]!==null){$data[$key]=(int)$item[$key];}}
            $result=$agenda->create($user,$data);$repo->linkReturn((int)$result['id'],$id);$this->items->generated($id,$hash);$result=$agenda->find($user,(int)$result['id']);$this->db->commit();return $result;
        }catch(\Throwable $e){if($this->db->inTransaction()){$this->db->rollBack();}throw $e;}
    }
}
