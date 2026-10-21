<?php
declare(strict_types=1);
require dirname(__DIR__).'/bootstrap.php';
use App\Config\App;
use App\Core\Database;
use App\Repositories\UsuarioRepository;

$target=getenv('TEST_DB_DATABASE');$password=getenv('TEST_BROWSER_PASSWORD');
if(!$target||!preg_match('/^visitas_test_[a-z0-9_]+$/D',$target)||$target===App::env('DB_DATABASE')||!$password||strlen($password)<12||strlen($password)>72){
    fwrite(STDERR,"Defina TEST_DB_DATABASE novo (visitas_test_*) e TEST_BROWSER_PASSWORD fictícia de 12 a 72 bytes.\n");exit(2);
}
$created=false;
try{
    $server=new PDO('mysql:host='.App::env('DB_HOST','127.0.0.1').';port='.App::env('DB_PORT','3306').';charset=utf8mb4',App::env('DB_USERNAME'),App::env('DB_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $server->exec("CREATE DATABASE `$target` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");$created=true;
    $_ENV['DB_DATABASE']=$target;require dirname(__DIR__).'/bin/migrate.php';
    $users=new UsuarioRepository(Database::connection());
    foreach(['admin','admin','funcionario','funcionario','responsavel','responsavel']as$i=>$role){
        $users->create(['nome'=>'Teste '.ucfirst($role).' '.($i+1),'email'=>'audit'.($i+1).'@example.test','senha_hash'=>password_hash($password,PASSWORD_DEFAULT),'perfil'=>$role,'ativo'=>true]);
    }
    echo "Banco novo de navegador preparado com seis identidades fictícias. Mantido para teste manual; encerre o servidor antes de removê-lo.\n";
}catch(Throwable $e){
    if($created){$server->exec("DROP DATABASE `$target`");}
    fwrite(STDERR,'Falha na preparação: '.get_class($e).". Configuração e credenciais omitidas.\n");exit(1);
}
