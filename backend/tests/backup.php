<?php
declare(strict_types=1);
// Chamado somente depois da criação bem-sucedida do banco descartável em http.php.
scenario('backup e restauração em outro banco descartável preservam todas as tabelas e vínculos',function()use($target,$db,$server,$host,$dbPort,$username,$password){
    $binary=rtrim((string)getenv('MYSQL_BIN'),'/\\');$suffix=PHP_OS_FAMILY==='Windows'?'.exe':'';
    $restore=$target.'_restore';ensure(strlen($restore)<=64&&preg_match('/^visitas_test_[a-z0-9_]+$/D',$restore)===1);
    $dump=tempnam(sys_get_temp_dir(),'visitas_dump_');$error=tempnam(sys_get_temp_dir(),'visitas_dump_error_');$restoreCreated=false;
    $environment=[...getenv(),'MYSQL_PWD'=>$password];
    $connection=['--no-defaults','--host='.$host,'--port='.$dbPort,'--user='.$username,'--default-character-set=utf8mb4'];
    try{
        $p=proc_open([$binary.'/mysqldump'.$suffix,...$connection,'--single-transaction','--hex-blob','--skip-comments','--result-file='.$dump,$target],[0=>['pipe','r'],1=>['file',$error,'a'],2=>['file',$error,'a']],$pipes,null,$environment);
        ensure(is_resource($p));fclose($pipes[0]);ensure(proc_close($p)===0&&filesize($dump)>0);
        $server->exec("CREATE DATABASE `$restore` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");$restoreCreated=true;
        $p=proc_open([$binary.'/mysql'.$suffix,...$connection,$restore],[0=>['file',$dump,'r'],1=>['file',$error,'a'],2=>['file',$error,'a']],$pipes,null,$environment);ensure(is_resource($p));ensure(proc_close($p)===0);
        $other=new PDO("mysql:host=$host;port=$dbPort;dbname=$restore;charset=utf8mb4",$username,$password,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
        $tables=$db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);$rows=0;
        foreach($tables as$table){
            ensure(preg_match('/^[a-z_]+$/D',$table)===1);
            $before=$db->query("SELECT * FROM `$table`")->fetchAll();$after=$other->query("SELECT * FROM `$table`")->fetchAll();
            $canonical=static function(array $records):string{$encoded=array_map(static fn($r)=>json_encode($r,JSON_THROW_ON_ERROR),$records);sort($encoded);return hash('sha256',implode("\n",$encoded));};
            ensure(count($before)===count($after)&&$canonical($before)===$canonical($after));$rows+=count($before);
        }
        $count=$server->query("SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='$target'")->fetchColumn();
        $restoredCount=$server->query("SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='$restore'")->fetchColumn();ensure((int)$count>0&&$count===$restoredCount);
        ensure((int)$other->query('SELECT COUNT(*) FROM visitas v JOIN retornos r ON r.visita_id=v.id JOIN agendamentos a ON a.retorno_id=r.id')->fetchColumn()===1);
        echo 'Evidência backup: '.count($tables)." tabelas, $rows registros, $count chaves estrangeiras idênticas.\n";
    }finally{
        if($restoreCreated){$server->exec("DROP DATABASE `$restore`");}
        foreach([$dump,$error]as$file){if(is_file($file)){unlink($file);}}
    }
});
