<?php
declare(strict_types=1);
require dirname(__DIR__).'/bootstrap.php';
use App\Core\{Database, HttpException};
use App\Repositories\{UsuarioRepository, VisitaRepository};
use App\Services\{VisitaService, UsuarioService, LoginLimiter};

$target=getenv('TEST_DB_DATABASE');
if (!$target || !preg_match('/^visitas_test_[a-z0-9_]+$/D',$target) || $target===App\Config\App::env('DB_DATABASE')) { exit(2); }
$_ENV['DB_DATABASE']=$target;
$job=json_decode(stream_get_contents(STDIN),true,32,JSON_THROW_ON_ERROR);
while (microtime(true)<$job['start']) { usleep(1000); }
try {
    $db=Database::connection();$users=new UsuarioRepository($db);
    if ($job['action']==='create') {
        $result=(new VisitaService($db,new VisitaRepository($db),$users))->create($users->byId($job['actor']),$job['data'],$job['key']);
        echo json_encode(['status'=>201,'id'=>(int)$result['id']]);
    } elseif ($job['action']==='agenda_cancel') {
        (new \App\Services\AgendamentoService($db,new \App\Repositories\AgendamentoRepository($db),$users))->update($users->byId($job['actor']),$job['target'],['acao'=>'cancelar','motivo'=>'Cancelamento concorrente']);echo '{"status":200}';
    } elseif ($job['action']==='user') {
        (new UsuarioService($db,$users))->save($users->byId($job['actor']),['ativo'=>false],$job['target']);echo '{"status":200}';
    } else {
        $_ENV['LOGIN_IP_LIMIT']='100';$_ENV['LOGIN_ACCOUNT_LIMIT']='1';$_ENV['LOGIN_WINDOW_SECONDS']='60';
        (new LoginLimiter($db))->consume($job['origin'],$job['identifier']);echo '{"status":200}';
    }
} catch(HttpException $e){echo json_encode(['status'=>$e->status]);}
catch(Throwable $e){echo json_encode(['status'=>500,'exception'=>get_class($e)]);exit(1);}
