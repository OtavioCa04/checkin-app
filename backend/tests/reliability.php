<?php
declare(strict_types=1);
use App\Core\VisitFilters;
use App\Services\{UsuarioService, VisitaService, LoginLimiter};

test('filtros validam período UTC e escopo por perfil', function (): void {
    check(VisitFilters::read(['inicio'=>'2026-10-01T00:00:00Z','fim'=>'2026-11-01T00:00:00Z'],'funcionario')['inicio']==='2026-10-01 00:00:00');
    rejects(fn()=>VisitFilters::read(['inicio'=>'2026-02-30T00:00:00Z'],'admin'),400);
    rejects(fn()=>VisitFilters::read(['inicio'=>'2026-10-02T00:00:00Z','fim'=>'2026-10-01T00:00:00Z'],'admin'),400);
    rejects(fn()=>VisitFilters::read(['funcionario_id'=>2],'funcionario'),403);
    rejects(fn()=>VisitFilters::read(['funcionario_id'=>2],'responsavel'),403);
    check(VisitFilters::read(['funcionario_id'=>'2'],'admin')['funcionario_id']===2);
    rejects(fn()=>VisitFilters::read(['empresa'=>[]],'admin'),400);
});
test('textos contam pontos Unicode incluindo emojis', function () use ($input): void {
    check(App\Models\Visita::validate([...$input,'contato'=>str_repeat('😀',150)],true)['contato']===str_repeat('😀',150));
    rejects(fn()=>App\Models\Visita::validate([...$input,'contato'=>str_repeat('😀',151)],true),400);
});
test('hash idempotente normaliza ordem e números', function () use ($input): void {
    check(VisitaService::requestHash($input)===VisitaService::requestHash(array_reverse($input,true)));
    check(VisitaService::requestHash($input)===VisitaService::requestHash([...$input,'precisao_gps'=>10.0]));
    check(VisitaService::requestHash($input)!==VisitaService::requestHash([...$input,'empresa'=>'Outra']));
});
test('gestão valida nome, senha em bytes e booleanos', function (): void {
    $data=['nome'=>str_repeat('😀',150),'email'=>'user@example.test','perfil'=>'admin','senha'=>'senha-longa-123','ativo'=>true];
    check(UsuarioService::validate($data,true)['nome']===$data['nome']);
    rejects(fn()=>UsuarioService::validate([...$data,'nome'=>str_repeat('😀',151)],true),400);
    rejects(fn()=>UsuarioService::validate([...$data,'ativo'=>'true'],true),400);
    rejects(fn()=>UsuarioService::validate([...$data,'senha'=>str_repeat('á',37)],true),400);
    rejects(fn()=>UsuarioService::validate(['senha'=>'alterar'],false),400);
});
test('último administrador ativo é protegido', function (): void {
    $before=['perfil'=>'admin','ativo'=>true];
    rejects(fn()=>UsuarioService::protectLastAdmin($before,['perfil'=>'admin','ativo'=>false],1),409);
    rejects(fn()=>UsuarioService::protectLastAdmin($before,['perfil'=>'funcionario','ativo'=>true],1),409);
    UsuarioService::protectLastAdmin($before,['perfil'=>'admin','ativo'=>false],2);
});
test('XFF ignorado sem proxy e cadeia confiável validada', function (): void {
    $old=$_ENV['TRUSTED_PROXIES']??null;
    try {
        $_ENV['TRUSTED_PROXIES']='';check(LoginLimiter::origin(['REMOTE_ADDR'=>'127.0.0.1','HTTP_X_FORWARDED_FOR'=>'203.0.113.5'])==='127.0.0.1');
        $_ENV['TRUSTED_PROXIES']='127.0.0.1,192.0.2.1';check(LoginLimiter::origin(['REMOTE_ADDR'=>'127.0.0.1','HTTP_X_FORWARDED_FOR'=>'203.0.113.5,192.0.2.1'])==='203.0.113.5');
        check(LoginLimiter::origin(['REMOTE_ADDR'=>'127.0.0.1','HTTP_X_FORWARDED_FOR'=>'malformado'])==='127.0.0.1');
    } finally { if($old===null){unset($_ENV['TRUSTED_PROXIES']);}else{$_ENV['TRUSTED_PROXIES']=$old;} }
});
final class QueryTestStatement extends PDOStatement
{
    public array $bindings=[];
    public function __construct(public string $sql) {}
    public function bindValue(string|int $param,mixed $value,int $type=PDO::PARAM_STR):bool{$this->bindings[$param]=$value;return true;}
    public function execute(?array $params=null):bool{return true;}
    public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args):array{return [];}
}
final class QueryTestDatabase extends PDO
{
    public ?QueryTestStatement $statement=null;
    public function __construct(){}
    public function prepare(string $query,array $options=[]):PDOStatement|false{return $this->statement=new QueryTestStatement($query);}
}
test('SQL dos filtros mantém escopo AND e JOIN sem N+1', function (): void {
    foreach(['usuario_id','responsavel_id'] as $column){
        $db=new QueryTestDatabase();$repository=new App\Repositories\VisitaRepository($db);
        $repository->list($column,7,20,0,['empresa'=>'%_!','status'=>'concluida','inicio'=>'2026-10-01 00:00:00']);
        check(str_contains($db->statement->sql,"WHERE v.{$column} = ? AND"));
        check(str_contains($db->statement->sql,'u.nome AS funcionario_nome')&&str_contains($db->statement->sql,'r.nome AS responsavel_nome'));
        check($db->statement->bindings[1]===7&&in_array('%!%!_!!%',$db->statement->bindings,true));
    }
});
