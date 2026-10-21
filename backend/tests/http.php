<?php
declare(strict_types=1);

// Integração HTTP real: cria um banco novo e o remove ao terminar, inclusive em falhas.
require dirname(__DIR__).'/bootstrap.php';
use App\Config\App;
use App\Core\Database;
use App\Repositories\UsuarioRepository;

$target=getenv('TEST_DB_DATABASE');
if(!$target||!preg_match('/^visitas_test_[a-z0-9_]+$/D',$target)||$target===App::env('DB_DATABASE')){fwrite(STDERR,"Use um TEST_DB_DATABASE novo com prefixo visitas_test_.\n");exit(2);}
$port=(int)(getenv('TEST_HTTP_PORT')?:8003);
if($port<1024||$port>65535){exit(2);}
$probe=@stream_socket_client("tcp://127.0.0.1:$port",$errno,$errstr,0.3);
if($probe){fclose($probe);fwrite(STDERR,"Porta de teste ocupada; escolha TEST_HTTP_PORT.\n");exit(2);}
$created=false;$process=null;$passed=0;$failed=0;$log=tempnam(sys_get_temp_dir(),'visitas_http_');
function ensure(bool $ok):void{if(!$ok){throw new RuntimeException('Asserção de integração.');}}
function scenario(string $name,callable $call):void{global $passed,$failed;try{$call();++$passed;echo "PASS $name\n";}catch(Throwable $e){++$failed;echo 'FAIL '.$name.': '.get_class($e).' linha '.$e->getLine()."\n";}}
function request(string $method,string $path,?string $token=null,?array $data=null,array $headers=[]):array{
    global $port;
    $headers[]='Content-Type: application/json';
    if($token!==null){$headers[]='Authorization: Bearer '.$token;}
    $context=stream_context_create(['http'=>['method'=>$method,'header'=>implode("\r\n",$headers),'content'=>$data===null?'':json_encode($data,JSON_THROW_ON_ERROR),'ignore_errors'=>true,'timeout'=>10]]);
    $body=@file_get_contents("http://127.0.0.1:$port/api/v1$path",false,$context);
    $responseHeaders=$http_response_header??[];
    preg_match('/\s(\d{3})\s/',$responseHeaders[0]??'',$m);
    return ['status'=>(int)($m[1]??0),'body'=>$body===false?'':$body,'json'=>json_decode($body?:'{}',true),'headers'=>implode("\n",$responseHeaders)];
}
function callApi(string $method,string $path,int $expected,?string $token=null,?array $data=null,array $headers=[]):mixed{
    $r=request($method,$path,$token,$data,$headers);ensure($r['status']===$expected);ensure(is_array($r['json'])&&$r['json']['success']===($expected<400));
    ensure(!str_contains($r['body'],'senha_hash')&&!str_contains($r['body'],'SQLSTATE'));
    return $r['json']['data']??null;
}
try{
    $host=App::env('DB_HOST','127.0.0.1');$dbPort=App::env('DB_PORT','3306');$username=App::env('DB_USERNAME');$password=App::env('DB_PASSWORD');
    $server=new PDO("mysql:host=$host;port=$dbPort;charset=utf8mb4",$username,$password,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $server->exec("CREATE DATABASE `$target` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");$created=true;
    $_ENV['DB_DATABASE']=$target;require dirname(__DIR__).'/bin/migrate.php';$db=Database::connection();$users=new UsuarioRepository($db);
    $credentials=bin2hex(random_bytes(18));$identities=[];
    foreach(['admin','admin','funcionario','funcionario','responsavel','responsavel'] as $i=>$role){$identities[]=$users->create(['nome'=>'HTTP Fictício '.$i,'email'=>"http$i@example.test",'senha_hash'=>password_hash($credentials,PASSWORD_DEFAULT),'perfil'=>$role,'ativo'=>true]);}
    $environment=[...getenv(),'DB_HOST'=>$host,'DB_PORT'=>$dbPort,'DB_DATABASE'=>$target,'DB_USERNAME'=>$username,'DB_PASSWORD'=>$password,'LOGIN_IP_LIMIT'=>'100','LOGIN_ACCOUNT_LIMIT'=>'10','CORS_ORIGINS'=>'http://localhost:4202','TRUSTED_PROXIES'=>''];
    $process=proc_open([PHP_BINARY,'-d','variables_order=EGPCS','-S',"127.0.0.1:$port",'-t','public','public/index.php'],[0=>['pipe','r'],1=>['file',$log,'a'],2=>['file',$log,'a']],$pipes,dirname(__DIR__),$environment);
    if(!is_resource($process)){throw new RuntimeException('Servidor não iniciou.');}fclose($pipes[0]);
    for($i=0;$i<50;$i++){if(request('GET','/health')['status']===200){break;}usleep(100000);}
    $tokens=[];
    scenario('login real de seis usuários e me sem hashes',function()use($credentials,&$tokens){
        foreach(range(0,5)as$i){$result=callApi('POST','/auth/login',200,null,['email'=>"http$i@example.test",'senha'=>$credentials]);$tokens[$i]=$result['access_token'];$me=callApi('GET','/auth/me',200,$tokens[$i]);ensure($me['id']===$i+1);}
        callApi('POST','/auth/login',401,null,['email'=>'http2@example.test','senha'=>'incorreta']);
        callApi('GET','/auth/me',401);
    });
    $client=null;$contact=null;$scheduled=null;$visit=null;$return=null;$payload=null;$key=bin2hex(random_bytes(16));
    scenario('HTTP cliente, contato, agenda e check-in com GPS simulado',function()use(&$client,&$contact,&$scheduled,&$visit,&$payload,$key,$tokens,$identities,$db){
        $client=callApi('POST','/clientes',201,$tokens[2],['nome_empresa'=>'Empresa HTTP 😀','logradouro'=>'Rua original']);
        ensure(count(callApi('GET','/clientes?q='.rawurlencode('😀'),200,$tokens[2])['items'])===1);
        $contact=callApi('POST',"/clientes/{$client['id']}/contatos",201,$tokens[2],['nome'=>'Contato fictício','principal'=>true]);
        $scheduled=callApi('POST','/agendamentos',201,$tokens[2],['empresa'=>'Texto','contato'=>'Texto','assunto'=>'Reunião HTTP','observacoes'=>'Observação','responsavel_id'=>$identities[4],'data_hora_prevista'=>gmdate('Y-m-d\TH:i:s\Z',time()+86400),'cliente_id'=>(int)$client['id'],'contato_id'=>(int)$contact['id']]);
        $payload=['empresa'=>'Texto','contato'=>'Texto','assunto'=>'Reunião HTTP','descricao'=>'Descrição com acentos 😀','responsavel_id'=>$identities[4],'latitude'=>-23.55,'longitude'=>-46.63,'precisao_gps'=>15,'gps_capturado_em'=>(int)floor(microtime(true)*1000),'cliente_id'=>(int)$client['id'],'contato_id'=>(int)$contact['id'],'agendamento_id'=>(int)$scheduled['id']];
        $visit=callApi('POST','/visitas',201,$tokens[2],$payload,['Idempotency-Key: '.$key]);
        ensure($visit['empresa']==='Empresa HTTP 😀'&&(int)$visit['usuario_id']===$identities[2]);
        ensure(abs(time()-strtotime($visit['data_hora_checkin'].' UTC'))<10);
        ensure(callApi('GET',"/agendamentos/{$scheduled['id']}",200,$tokens[2])['status']==='realizado');
        ensure((int)$db->query('SELECT COUNT(*) FROM visitas')->fetchColumn()===1);
    });
    scenario('resposta perdida e repetida não duplica; chave divergente conflita',function()use($tokens,&$visit,&$payload,$key,$db){
        ensure(callApi('POST','/visitas',201,$tokens[2],$payload,['Idempotency-Key: '.$key])===$visit);
        callApi('POST','/visitas',409,$tokens[2],[...$payload,'descricao'=>'Diferente'],['Idempotency-Key: '.$key]);
        callApi('POST','/visitas',409,$tokens[2],$payload,['Idempotency-Key: '.bin2hex(random_bytes(16))]);
        ensure((int)$db->query('SELECT COUNT(*) FROM visitas')->fetchColumn()===1);
    });
    scenario('dois funcionários e dois responsáveis isolados inclusive consultas diretas',function()use($tokens,&$client,&$contact,&$scheduled,&$visit){
        foreach([3,5]as$i){foreach(["/clientes/{$client['id']}","/clientes/{$client['id']}/contatos","/visitas/{$visit['id']}","/agendamentos/{$scheduled['id']}"]as$path){callApi('GET',$path,404,$tokens[$i]);}
            foreach(['/clientes?q=Empresa','/visitas?empresa=Empresa','/agendamentos']as$path){ensure(callApi('GET',$path,200,$tokens[$i])['items']===[]);}
            callApi('PATCH',"/visitas/{$visit['id']}",404,$tokens[$i],['descricao'=>'Intrusão']);
            callApi('GET','/usuarios',403,$tokens[$i]);
        }
        callApi('GET',"/visitas/{$visit['id']}",200,$tokens[4]);callApi('GET','/usuarios',200,$tokens[0]);
        callApi('PATCH',"/visitas/{$visit['id']}",403,$tokens[4],['descricao'=>'Intrusão']);
        callApi('GET','/visitas?funcionario_id=4',403,$tokens[2]);
        callApi('PATCH',"/contatos/{$contact['id']}",404,$tokens[3],['nome'=>'Intrusão']);
    });
    scenario('edição, conclusão com retorno e imutabilidade',function()use($tokens,&$visit,&$return,$db){
        $visit=callApi('PATCH',"/visitas/{$visit['id']}",200,$tokens[2],['descricao'=>'Editada']);
        callApi('PATCH',"/visitas/{$visit['id']}",400,$tokens[2],['status'=>'concluida']);
        $visit=callApi('PATCH',"/visitas/{$visit['id']}",200,$tokens[2],['status'=>'concluida','resultado'=>'reagendar','resumo_resultado'=>'Resumo','proximo_passo'=>'Nova conversa','data_retorno'=>'2028-01-02']);
        ensure($visit['data_retorno']==='2028-01-02'&&$visit['data_hora_checkout']!==null);
        callApi('PATCH',"/visitas/{$visit['id']}",409,$tokens[2],['status'=>'em_andamento']);
        $return=callApi('GET','/retornos',200,$tokens[2])['items'][0];
        ensure((int)$return['visita_id']===(int)$visit['id']&&(int)$db->query('SELECT COUNT(*) FROM retornos')->fetchColumn()===1);
        foreach([3,5]as$i){callApi('GET',"/retornos/{$return['id']}",404,$tokens[$i]);}
    });
    scenario('histórico preserva snapshot e retorno gera uma agenda só',function()use($tokens,&$client,&$visit,&$return,$db){
        callApi('PATCH',"/clientes/{$client['id']}",200,$tokens[2],['nome_empresa'=>'Nome novo','logradouro'=>'Rua nova']);
        ensure(callApi('GET',"/visitas/{$visit['id']}",200,$tokens[2])['cadastro_snapshot']===$visit['cadastro_snapshot']);
        ensure(count(callApi('GET',"/clientes/{$client['id']}/visitas",200,$tokens[2])['items'])===1);
        $date=['data_hora_prevista'=>gmdate('Y-m-d\TH:i:s\Z',time()+172800)];
        $a=callApi('POST',"/retornos/{$return['id']}/agendamento",201,$tokens[2],$date);
        $b=callApi('POST',"/retornos/{$return['id']}/agendamento",201,$tokens[2],$date);ensure($a['id']===$b['id']);
        ensure((int)$db->query('SELECT COUNT(*) FROM agendamentos WHERE retorno_id IS NOT NULL')->fetchColumn()===1);
        callApi('PATCH',"/retornos/{$return['id']}",200,$tokens[2],['status'=>'realizado','observacao'=>'Contato feito']);
    });
    scenario('validações HTTP de IDs, campos, paginação, Unicode e CNPJ',function()use($tokens){
        ensure(count(callApi('GET','/clientes?q='.rawurlencode('😀'),200,$tokens[2])['items'])===0);
        ensure(count(callApi('GET','/clientes?q='.rawurlencode('Nome novo'),200,$tokens[2])['items'])===1);
        foreach([['nome_empresa'=>'   '],['nome_empresa'=>str_repeat('😀',181)],['nome_empresa'=>'Teste','cnpj'=>'123'],['nome_empresa'=>'Teste','campo_desconhecido'=>1]]as$data){callApi('POST','/clientes',400,$tokens[2],$data);}
        callApi('POST','/clientes',201,$tokens[2],['nome_empresa'=>'CNPJ teste','cnpj'=>'11222333000181']);
        callApi('POST','/clientes',409,$tokens[2],['nome_empresa'=>'Duplicado','cnpj'=>'11222333000181']);
        ensure(count(callApi('GET','/clientes?q=11222333000181',200,$tokens[2])['items'])===1);
        callApi('GET','/clientes/4294967295',404,$tokens[2]);callApi('GET','/clientes?limit=101',400,$tokens[2]);
        ensure(count(callApi('GET','/clientes?limit=1&offset=1',200,$tokens[2])['items'])===1);
    });
    scenario('CORS, preflight e métodos são verificados no HTTP real',function()use($tokens){
        $r=request('OPTIONS','/visitas',null,null,['Origin: http://localhost:4202','Access-Control-Request-Method: POST','Access-Control-Request-Headers: Authorization, Idempotency-Key']);
        ensure($r['status']===204&&str_contains($r['headers'],'http://localhost:4202'));
        $r=request('GET','/health',null,null,['Origin: https://externo.example.test']);ensure(!str_contains($r['headers'],'Access-Control-Allow-Origin: https://externo.example.test'));
        callApi('DELETE','/visitas',405,$tokens[2]);callApi('GET','/inexistente',404,$tokens[2]);
    });
    scenario('período UTC em torno da meia-noite local e retorno sem conversão de dia',function()use($tokens,$db,&$visit,&$return){
        $db->prepare('UPDATE visitas SET data_hora_checkin=?,data_hora_checkout=? WHERE id=?')->execute(['2026-10-21 02:59:00','2026-10-21 03:01:00',$visit['id']]);
        ensure(count(callApi('GET','/visitas?inicio=2026-10-20T03:00:00Z&fim=2026-10-21T03:00:00Z',200,$tokens[2])['items'])===1);
        ensure(callApi('GET','/visitas?inicio=2026-10-21T03:00:00Z',200,$tokens[2])['items']===[]);
        ensure(callApi('GET',"/retornos/{$return['id']}",200,$tokens[2])['data_prevista']==='2028-01-02');
    });
    scenario('sessão aberta respeita desativação, perfil atual, expiração e logout',function()use($tokens,$identities,$users,$db){
        $users->update($identities[3],['ativo'=>false]);callApi('GET','/auth/me',401,$tokens[3]);$users->update($identities[3],['ativo'=>true]);
        $users->update($identities[2],['perfil'=>'responsavel']);callApi('GET','/responsaveis',403,$tokens[2]);ensure(callApi('GET','/auth/me',200,$tokens[2])['perfil']==='responsavel');$users->update($identities[2],['perfil'=>'funcionario']);
        $db->prepare('UPDATE auth_tokens SET expira_em=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE token_hash=?')->execute([hash('sha256',$tokens[5])]);callApi('GET','/auth/me',401,$tokens[5]);
        callApi('POST','/auth/logout',200,$tokens[4],[]);callApi('GET','/auth/me',401,$tokens[4]);
    });
    scenario('429 inclui Retry-After e CORS expõe o cabeçalho',function()use($credentials){
        for($i=0;$i<10;$i++){callApi('POST','/auth/login',401,null,['email'=>'bloqueado@example.test','senha'=>$credentials]);}
        $r=request('POST','/auth/login',null,['email'=>'bloqueado@example.test','senha'=>$credentials],['Origin: http://localhost:4202']);
        ensure($r['status']===429&&preg_match('/Retry-After: [1-9]\d*/i',$r['headers'])===1&&str_contains(strtolower($r['headers']),'access-control-expose-headers: retry-after'));
    });
    scenario('logs do servidor não contêm senhas ou tokens do teste',function()use($log,$tokens,$credentials){
        $text=file_get_contents($log);ensure(!str_contains($text,$credentials));foreach($tokens as$token){ensure(!str_contains($text,$token));}
    });
    if(getenv('MYSQL_BIN')){require __DIR__.'/backup.php';}
    else{echo "SKIP backup/restauração: defina MYSQL_BIN com a pasta de mysql e mysqldump.\n";}
}catch(Throwable $e){++$failed;echo 'FAIL preparação/execução: '.get_class($e).' linha '.$e->getLine()." (sem detalhes sensíveis).\n";}
finally{
    if(is_resource($process)){proc_terminate($process);proc_close($process);}
    if($created){$server->exec("DROP DATABASE `$target`");echo "Banco descartável removido.\n";}
    if(is_file($log)){unlink($log);}
}
echo "HTTP real: $passed passaram, $failed falharam.\n";exit($failed?1:0);
