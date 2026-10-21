<?php
declare(strict_types=1);
namespace App\Services;
use App\Core\HttpException;
use App\Models\Cliente;
use App\Repositories\{ClienteRepository,UsuarioRepository};
use PDO;

final class ClienteService
{
    private ClienteRepository $clients;
    public function __construct(private PDO $db) { $this->clients=new ClienteRepository($db); }
    private function column(array $user): ?string { return match($user['perfil']){'admin'=>null,'responsavel'=>'responsavel_id',default=>'usuario_id'}; }
    public static function active(array $query): ?bool
    {
        if(!isset($query['ativo'])||$query['ativo']===''){return null;}if(!in_array($query['ativo'],['0','1',0,1],true)){throw new HttpException(400,'Situação inválida.');}return (string)$query['ativo']==='1';
    }
    public function list(array $user,int $limit,int $offset,array $query): array
    {
        if(array_diff(array_keys($query),['limit','offset','q','ativo'])){throw new HttpException(400,'Filtro inválido.');}$search=$query['q']??'';if(!is_string($search)||mb_strlen($search,'UTF-8')>180){throw new HttpException(400,'Busca inválida.');}
        return array_map(fn($c)=>$this->publicClient($user,$c),$this->clients->list($this->column($user),(int)$user['id'],$limit,$offset,trim($search),self::active($query)));
    }
    private function publicClient(array $user,array $client): array
    {
        $client['ativo']=(bool)$client['ativo'];$client['pode_editar']=$user['perfil']==='admin'||($user['perfil']==='funcionario'&&$this->clients->hasAccess((int)$client['id'],(int)$user['id']));return $client;
    }
    public function find(array $user,int $id): array
    {
        $client=$this->clients->find($id,$this->column($user),(int)$user['id'],$this->db->inTransaction());if(!$client){throw new HttpException(404,'Cliente não encontrado.');}$client=$this->publicClient($user,$client);if($user['perfil']==='admin'){$client['funcionarios']=$this->clients->access($id);}return $client;
    }
    private function manage(array $user,int $id): array
    {
        $client=$this->find($user,$id);if(!$client['pode_editar']){throw new HttpException(403,'Sem permissão para alterar este cliente.');}return $client;
    }
    private function statusPermission(array $user,array $input,bool $creating): void
    {
        if($user['perfil']==='responsavel'){throw new HttpException(403,'Acesso somente para consulta.');}
        if($user['perfil']!=='admin'&&array_key_exists('ativo',$input)&&(!$creating||$input['ativo']!==true)){throw new HttpException(403,'Somente administrador altera a situação.');}
    }
    public function save(array $user,array $input,?int $id=null): array
    {
        $this->statusPermission($user,$input,$id===null);$data=Cliente::validate($input,$id===null);$this->db->beginTransaction();
        try{
            if($id!==null){$this->clients->lock($id);$this->manage($user,$id);$this->clients->update($id,$data);}
            else{$data['criado_por']=(int)$user['id'];$id=$this->clients->create($data);if($user['perfil']==='funcionario'){$this->clients->replaceAccess($id,[(int)$user['id']],(int)$user['id']);}}
            $result=$this->find($user,$id);$this->db->commit();return $result;
        }catch(\Throwable $e){if($this->db->inTransaction()){$this->db->rollBack();}if($e instanceof \PDOException&&(int)($e->errorInfo[1]??0)===1062){throw new HttpException(409,$user['perfil']==='admin'?'CNPJ já cadastrado.':'Não foi possível salvar o cadastro. Solicite apoio ao administrador.');}throw $e;}
    }
    public function access(array $user,int $id,array $input): array
    {
        if($user['perfil']!=='admin'){throw new HttpException(403,'Somente administrador atribui acesso.');}$ids=$input['funcionarios_ids']??null;
        if(array_diff(array_keys($input),['funcionarios_ids'])||!is_array($ids)||!array_is_list($ids)||count($ids)>1000){throw new HttpException(400,'Envie funcionarios_ids como lista de IDs.');}
        foreach($ids as $v){if(!is_int($v)||$v<1||$v>4294967295){throw new HttpException(400,'Funcionário inválido.');}}
        $ids=array_values(array_unique($ids));sort($ids);$this->db->beginTransaction();
        try{$this->clients->lock($id);$this->find($user,$id);$users=new UsuarioRepository($this->db);foreach($ids as $v){$u=$users->byId($v,true);if(!$u||!$u['ativo']||$u['perfil']!=='funcionario'){throw new HttpException(400,'Vincule somente funcionários ativos.');}}$this->clients->replaceAccess($id,$ids,(int)$user['id']);$result=$this->find($user,$id);$this->db->commit();return $result;}
        catch(\Throwable $e){if($this->db->inTransaction()){$this->db->rollBack();}throw $e;}
    }
    public function contacts(array $user,int $client,int $limit,int $offset,array $query): array
    {
        $item=$this->find($user,$client);if(array_diff(array_keys($query),['limit','offset','ativo'])){throw new HttpException(400,'Filtro inválido.');}$column=$item['pode_editar']?null:$this->column($user);return array_map(self::publicContact(...),$this->clients->contacts($client,$limit,$offset,self::active($query),$column,(int)$user['id']));
    }
    private static function publicContact(array $c): array {$c['ativo']=(bool)$c['ativo'];$c['principal']=(bool)$c['principal'];return $c;}
    public function saveContact(array $user,array $input,?int $client=null,?int $id=null): array
    {
        $this->statusPermission($user,$input,$id===null);$data=Cliente::validate($input,$id===null,true);
        if($id!==null){$old=$this->clients->contact($id);if(!$old){throw new HttpException(404,'Contato não encontrado.');}$client=(int)$old['cliente_id'];}
        $this->db->beginTransaction();
        try{$this->clients->lock($client);$this->manage($user,$client);if($id===null){$data['criado_por']=(int)$user['id'];}else{$old=$this->clients->contact($id);}
            if(!($data['ativo']??($old['ativo']??true))){$data['principal']=false;}
            $id=$this->clients->saveContact($client,$data,$id);$result=self::publicContact($this->clients->contact($id));$this->db->commit();return $result;
        }catch(\Throwable $e){if($this->db->inTransaction()){$this->db->rollBack();}throw $e;}
    }
    public function history(array $user,int $id,string $kind,int $limit,int $offset): array
    {
        $this->find($user,$id);return $this->clients->history($id,$kind,$this->column($user),(int)$user['id'],$limit,$offset);
    }
    // Chamado dentro da transação de criação, antes dos bloqueios de usuários.
    public function snapshot(array $user,array $data,?int $employee=null): array
    {
        Cliente::links($data);if(!isset($data['cliente_id'])){return $data;}$id=$data['cliente_id'];$this->clients->lock($id);$client=$this->find($user,$id);
        $employee??=(int)$user['id'];
        if($user['perfil']==='responsavel'||!$client['ativo']||!$this->clients->hasAccess($id,$employee)){throw new HttpException(400,'Cliente indisponível para novos registros ou funcionário sem vínculo de acesso.');}
        $contact=null;if(isset($data['contato_id'])){$contact=$this->clients->contact($data['contato_id']);if(!$contact||(int)$contact['cliente_id']!==$id||!$contact['ativo']){throw new HttpException(400,'Contato indisponível para este cliente.',['contato_id'=>'Selecione contato ativo do cliente escolhido.']);}}
        $data['empresa']=$client['nome_empresa'];if($contact){$data['contato']=$contact['nome'];}
        $clientSnapshot=array_intersect_key($client,array_flip(['id','nome_empresa','nome_fantasia','cnpj','cep','logradouro','numero','complemento','bairro','cidade','uf','pais']));
        $contactSnapshot=$contact?array_intersect_key($contact,array_flip(['id','nome','cargo','email','telefone'])):null;
        $data['cadastro_snapshot']=json_encode(['cliente'=>$clientSnapshot,'contato'=>$contactSnapshot],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);return $data;
    }
}
