<?php
declare(strict_types=1);
require dirname(__DIR__).'/bootstrap.php';
use App\Config\App;
use App\Core\{Database,HttpException};
use App\Repositories\{UsuarioRepository,VisitaRepository};
use App\Services\{VisitaService,UsuarioService,LoginLimiter};

// Cria um banco NOVO de teste. Nunca executa migrações ou fixtures no DB_DATABASE atual.
$target=getenv('TEST_DB_DATABASE');
if (!$target || !preg_match('/^visitas_test_[a-z0-9_]+$/D',$target) || $target===App::env('DB_DATABASE')) { fwrite(STDERR,"Defina TEST_DB_DATABASE com nome novo visitas_test_<sufixo>.\n");exit(2); }
$created=false;$passed=0;$failed=0;
function check(bool $value):void{if(!$value){throw new RuntimeException('Asserção falhou.');}}
function rejects(callable $call,int $status):void{try{$call();}catch(HttpException $e){check($e->status===$status);return;}throw new RuntimeException('Exceção esperada.');}
function test(string $name,callable $call):void{global $passed,$failed;try{$call();$passed++;echo "PASS $name\n";}catch(Throwable $e){$failed++;echo "FAIL $name: ".get_class($e).' em '.basename($e->getFile()).':'.$e->getLine()."\n";}}
function concurrent(array $jobs):array{
    $processes=[];$start=microtime(true)+1;
    foreach($jobs as $job){
        $command=[PHP_BINARY,'-n','-d','extension_dir='.ini_get('extension_dir'),'-d','extension=pdo_mysql','-d','extension=mbstring',__DIR__.'/mysql-worker.php'];
        $pipes=[];$process=proc_open($command,[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
        if(!is_resource($process)){throw new RuntimeException('Não foi possível iniciar worker.');}
        fwrite($pipes[0],json_encode([...$job,'start'=>$start],JSON_THROW_ON_ERROR));fclose($pipes[0]);$processes[]=[$process,$pipes];
    }
    $results=[];
    foreach($processes as [$process,$pipes]){$out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$exit=proc_close($process);if($exit!==0||$err){throw new RuntimeException('Worker falhou.');}$results[]=json_decode($out,true,32,JSON_THROW_ON_ERROR);}
    return $results;
}
try{
    $server=new PDO('mysql:host='.App::env('DB_HOST','127.0.0.1').';port='.App::env('DB_PORT','3306').';charset=utf8mb4',App::env('DB_USERNAME'),App::env('DB_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    echo 'Servidor de integração: '.$server->getAttribute(PDO::ATTR_SERVER_VERSION)."\n";
    // CREATE sem IF NOT EXISTS: recusa reutilizar qualquer banco existente.
    $server->exec("CREATE DATABASE `$target` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");$created=true;
    $_ENV['DB_DATABASE']=$target;
    require dirname(__DIR__).'/bin/migrate.php';
    $db=Database::connection();$users=new UsuarioRepository($db);$visits=new VisitaService($db,new VisitaRepository($db),$users);$management=new UsuarioService($db,$users);
    $ids=[];
    foreach(['admin','admin','funcionario','funcionario','responsavel'] as $i=>$role){$ids[]=$users->create(['nome'=>'Usuário '.$i,'email'=>"teste$i@example.test",'senha_hash'=>password_hash('senha-teste-123',PASSWORD_DEFAULT),'perfil'=>$role,'ativo'=>true]);}
    $actor=$users->byId($ids[2]);$other=$users->byId($ids[3]);$resp=$users->byId($ids[4]);$admin=$users->byId($ids[0]);
    $data=['contato'=>'Contato','empresa'=>'Empresa Teste','assunto'=>'Assunto','descricao'=>'Descrição','responsavel_id'=>$ids[4],'latitude'=>-23.5,'longitude'=>-46.6,'precisao_gps'=>10,'gps_capturado_em'=>(int)floor(microtime(true)*1000)];
    test('idempotência repete snapshot, conflito e isolamento por funcionário',function()use($visits,$actor,$other,$data){
        $key=str_repeat('a',32);$first=$visits->create($actor,$data,$key);$visits->update($actor,(int)$first['id'],['assunto'=>'Atualizado']);
        check($visits->create($actor,$data,$key)==$first);rejects(fn()=>$visits->create($actor,[...$data,'empresa'=>'Outra'],$key),409);
        check($visits->create($other,$data,$key)['id']!==$first['id']);
    });
    test('criações simultâneas com mesma chave criam uma visita',function()use($ids,$data,$db){
        $key=str_repeat('b',32);$job=['action'=>'create','actor'=>$ids[2],'key'=>$key,'data'=>$data];$result=concurrent([$job,$job]);
        check($result[0]['status']===201&&$result[1]['status']===201&&$result[0]['id']===$result[1]['id']);
        check((int)$db->query('SELECT COUNT(*) FROM visitas')->fetchColumn()===3);
    });
    test('GPS vencido não cria, mas recuperação devolve snapshot já salvo',function()use($actor,$data,$visits){
        rejects(fn()=>$visits->create($actor,[...$data,'gps_capturado_em'=>$data['gps_capturado_em']-121000],str_repeat('c',32)),400);
        $expired=$data;$expired['gps_capturado_em']-=1000;
        $_ENV['GPS_MAX_AGE_SECONDS']='120';$first=$visits->create($actor,$expired,str_repeat('d',32));$_ENV['GPS_MAX_AGE_SECONDS']='1';
        check($visits->create($actor,$expired,str_repeat('d',32))==$first);$_ENV['GPS_MAX_AGE_SECONDS']='120';
    });
    test('filtros mantêm escopos e limites inclusivo/exclusivo',function()use($visits,$actor,$other,$resp,$admin,$db,$ids){
        $db->exec("UPDATE visitas SET data_hora_checkin='2026-10-10 12:00:00'");
        $filter=['inicio'=>'2026-10-10T12:00:00Z','fim'=>'2026-10-10T12:00:01Z','empresa'=>'Empresa','status'=>'em_andamento'];
        foreach($visits->list($actor,100,0,$filter) as $v){check((int)$v['usuario_id']===$ids[2]&&$v['funcionario_nome']==='Usuário 2'&&$v['responsavel_nome']==='Usuário 4'&&!isset($v['senha_hash']));}
        check(count($visits->list($other,100,0,$filter))===1);check(count($visits->list($resp,100,0,$filter))===4);
        check(count($visits->list($admin,100,0,[...$filter,'funcionario_id'=>$ids[3]]))===1);
        check($visits->list($actor,100,0,['fim'=>'2026-10-10T12:00:00Z'])===[]);
        rejects(fn()=>$visits->list($actor,100,0,['funcionario_id'=>$ids[3]]),403);
    });
    test('mesma chave concorrente com dados diferentes retorna conflito',function()use($ids,$data){
        $job=['action'=>'create','actor'=>$ids[3],'key'=>str_repeat('e',32),'data'=>$data];
        $other=[...$job,'data'=>[...$data,'empresa'=>'Empresa diferente']];
        $statuses=array_column(concurrent([$job,$other]),'status');sort($statuses);check($statuses===[201,409]);
    });
    test('limites de login compartilhados por IP e conta expiram',function()use($db){
        $_ENV['LOGIN_IP_LIMIT']='2';$_ENV['LOGIN_ACCOUNT_LIMIT']='2';$_ENV['LOGIN_WINDOW_SECONDS']='60';
        $limiter=new LoginLimiter($db);$limiter->consume('192.0.2.1','inexistente@example.test');$limiter->consume('192.0.2.2','INEXISTENTE@example.test');
        try{$limiter->consume('192.0.2.3','inexistente@example.test');throw new RuntimeException('Deveria limitar.');}catch(HttpException $e){check($e->status===429&&(int)$e->headers['Retry-After']>0);}
        $limiter->consume('192.0.2.4','a@example.test');$limiter->consume('192.0.2.4','b@example.test');rejects(fn()=>$limiter->consume('192.0.2.4','c@example.test'),429);
        $db->exec('UPDATE login_limits SET inicio = inicio - 61');$limiter->consume('192.0.2.4','c@example.test');
        $result=concurrent([['action'=>'limit','origin'=>'192.0.2.8','identifier'=>'concurrent@example.test'],['action'=>'limit','origin'=>'192.0.2.9','identifier'=>'concurrent@example.test']]);$statuses=array_column($result,'status');sort($statuses);check($statuses===[200,429]);
    });
    test('login correto não consome cota de conta nem de origem',function()use($db){
        $limiter=new LoginLimiter($db);
        foreach(range(1,4)as$i){$limiter->consume('192.0.2.20','Correto@example.test');$limiter->success('192.0.2.20','correto@example.test');}
        $limiter->consume('192.0.2.20','correto@example.test');$limiter->consume('192.0.2.21','correto@example.test');
        rejects(fn()=>$limiter->consume('192.0.2.22','correto@example.test'),429);
    });
    test('desativar ou trocar perfil revoga tokens e reativação não os restaura',function()use($management,$admin,$users){
        $tokens=new \App\Repositories\TokenRepository($db=Database::connection());$future=gmdate('Y-m-d H:i:s',time()+3600);
        $id=$users->create(['nome'=>'Sessão Revogada','email'=>'revoga@example.test','senha_hash'=>password_hash('senha-teste-123',PASSWORD_DEFAULT),'perfil'=>'funcionario','ativo'=>true]);
        $tokens->create($id,str_repeat('1',64),$future);$tokens->create($id,str_repeat('2',64),gmdate('Y-m-d H:i:s',time()-60));
        $management->save($admin,['nome'=>'Sessão Mantida'],$id);check($tokens->user(str_repeat('1',64))!==null);
        $management->save($admin,['ativo'=>false],$id);$management->save($admin,['ativo'=>true],$id);check($tokens->user(str_repeat('1',64))===null);
        $tokens->create($id,str_repeat('3',64),$future);$management->save($admin,['perfil'=>'responsavel'],$id);check($tokens->user(str_repeat('3',64))===null);
        $tokens->create($id,str_repeat('4',64),$future);$tokens->create($id,str_repeat('5',64),$future);
        $q=$db->prepare('SELECT COUNT(*) FROM auth_tokens WHERE usuario_id=? AND expira_em<=UTC_TIMESTAMP()');$q->execute([$id]);check((int)$q->fetchColumn()===0);
    });
    require __DIR__.'/agenda-mysql.php';
    require __DIR__.'/clientes-mysql.php';
    require __DIR__.'/audit-mysql.php';
    test('gestão administrativa protege permissões e não expõe hashes',function()use($management,$admin,$actor,$ids,$visits){
        rejects(fn()=>$management->save($actor,['ativo'=>false],$ids[0]),403);
        $u=$management->save($admin,['nome'=>'Criado','email'=>'novo@example.test','perfil'=>'funcionario','ativo'=>true,'senha'=>'senha-teste-123']);check(!isset($u['senha_hash']));
        $u=$management->save($admin,['nome'=>'Editado','email'=>'editado@example.test','ativo'=>false],$u['id']);check(!$u['ativo']&&$u['nome']==='Editado');
        rejects(fn()=>$management->save($admin,['nome'=>'Duplicado','email'=>'editado@example.test','perfil'=>'funcionario','senha'=>'senha-teste-123']),409);
        $management->save($admin,['perfil'=>'responsavel'],$ids[2]);check($visits->list(['id'=>$ids[2],'perfil'=>'responsavel'],100,0)===[]);
    });
    test('admins concorrentes nunca removem último administrador ativo',function()use($ids,$db,$users,$management){
        $result=concurrent([['action'=>'user','actor'=>$ids[0],'target'=>$ids[1]],['action'=>'user','actor'=>$ids[1],'target'=>$ids[0]]]);
        check($users->activeAdmins()===1);check(count(array_filter($result,fn($r)=>$r['status']===200))===1);
        $remaining=$db->query("SELECT * FROM usuarios WHERE perfil='admin' AND ativo=1")->fetch();rejects(fn()=>$management->save($remaining,['perfil'=>'funcionario'],(int)$remaining['id']),409);
    });
    test('remoção concorrente de perfil mantém um administrador ativo',function()use($db,$users){
        $remaining=(int)$db->query("SELECT id FROM usuarios WHERE perfil='admin' AND ativo=1")->fetchColumn();
        $second=$users->create(['nome'=>'Administrador concorrente fictício','email'=>'admin-concorrente@example.test','senha_hash'=>password_hash('somente-testes-2026',PASSWORD_DEFAULT),'perfil'=>'admin','ativo'=>true]);
        $jobs=[];foreach([$remaining,$second]as$id){$jobs[]=['action'=>'user','actor'=>$id,'target'=>$id,'data'=>['perfil'=>'funcionario']];}
        $statuses=array_column(concurrent($jobs),'status');sort($statuses);check($statuses===[200,409]&&$users->activeAdmins()===1);
    });
}catch(Throwable $e){
    echo 'Integração indisponível/falhou: '.get_class($e).' (código '.(int)$e->getCode()."). Nenhuma credencial foi exibida.\n";$failed++;
}finally{
    if($created){$server->exec("DROP DATABASE `$target`");echo "Banco dedicado criado por este teste foi removido.\n";}
}
echo "MySQL: $passed passaram, $failed falharam.\n";exit($failed?1:0);
