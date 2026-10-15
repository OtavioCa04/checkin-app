<?php
declare(strict_types=1);
$agendaRepo = new \App\Repositories\AgendamentoRepository($db);
$agenda = new \App\Services\AgendamentoService($db, $agendaRepo, $users);
$planned = ['usuario_id'=>(int)$actor['id'],'responsavel_id'=>(int)$resp['id'],'empresa'=>'Empresa Agenda','contato'=>'Contato Agenda','assunto'=>'Planejamento','observacoes'=>'Observações','data_hora_prevista'=>gmdate('Y-m-d\TH:i:s\Z',time()+86400)];
test('agenda cria, filtra, restringe perfis e expõe somente opções mínimas',function()use($agenda,$planned,$actor,$other,$resp,$admin,$users,$db){
    $item=$agenda->create($admin,$planned);$id=(int)$item['id'];
    check($agenda->find($actor,$id)['id']===$item['id']);check($agenda->find($resp,$id)['id']===$item['id']);
    rejects(fn()=>$agenda->find($other,$id),404);rejects(fn()=>$agenda->create($other,$planned),403);rejects(fn()=>$agenda->create($resp,$planned),403);
    rejects(fn()=>$agenda->update($resp,$id,['acao'=>'cancelar','motivo'=>'Teste']),403);
    rejects(fn()=>$agenda->update($other,$id,['acao'=>'cancelar','motivo'=>'Teste']),404);
    check(count($agenda->list($other,100,0,[]))===0);check(count($agenda->list($resp,100,0,[]))===1);
    rejects(fn()=>$agenda->list($actor,100,0,['funcionario_id'=>$other['id']]),403);
    check(count($agenda->list($admin,100,0,['funcionario_id'=>$actor['id'],'inicio'=>$planned['data_hora_prevista'],'fim'=>gmdate('Y-m-d\TH:i:s\Z',time()+86401)]))===1);
    check($agenda->list($admin,100,0,['fim'=>$planned['data_hora_prevista']])===[]);
    $options=$agenda->options($actor);check(count($options['funcionarios'])===1&&array_keys($options['responsaveis'][0])===['id','nome']);rejects(fn()=>$agenda->options($resp),403);
    $users->update((int)$other['id'],['ativo'=>false]);rejects(fn()=>$agenda->create($admin,[...$planned,'usuario_id'=>(int)$other['id']]),400);$users->update((int)$other['id'],['ativo'=>true]);
    rejects(fn()=>$agenda->create($admin,[...$planned,'responsavel_id'=>(int)$actor['id']]),400);
});
test('reagendamento e cancelamento auditam autor, horário e motivo; vencimento não cancela',function()use($agenda,$planned,$actor,$admin,$db,$visits,$data){
    $item=$agenda->create($actor,$planned);$id=(int)$item['id'];
    $date=gmdate('Y-m-d\TH:i:s\Z',time()+172800);
    $updated=$agenda->update($actor,$id,['acao'=>'reagendar','motivo'=>'Contato indisponível','data_hora_prevista'=>$date]);
    check($updated['data_hora_prevista']===str_replace(['T','Z'],[' ',''],$date));
    $event=$updated['eventos'][1];check((int)$event['autor_id']===(int)$actor['id']&&$event['motivo']==='Contato indisponível'&&abs(time()-strtotime($event['criado_em'].' UTC'))<10);
    rejects(fn()=>$agenda->update($actor,$id,['acao'=>'reagendar','motivo'=>'Teste','data_hora_prevista'=>'2020-01-01T00:00:00Z']),400);
    $db->prepare("UPDATE agendamentos SET data_hora_prevista='2020-01-01 00:00:00' WHERE id=?")->execute([$id]);
    check($agenda->find($actor,$id)['status']==='pendente');check(count($agenda->list($actor,100,0,['status'=>'atrasado']))===1);
    $canceled=$agenda->update($admin,$id,['acao'=>'cancelar','motivo'=>'Cliente cancelou']);check($canceled['status']==='cancelado'&&count($canceled['eventos'])===3);
    rejects(fn()=>$agenda->update($actor,$id,['acao'=>'reagendar','motivo'=>'Teste','data_hora_prevista'=>$date]),409);
    rejects(fn()=>$visits->create($actor,[...$data,'agendamento_id'=>$id],bin2hex(random_bytes(16))),409);
    check($agenda->find($actor,$id)['visita_id']===null);
});
test('check-in agenda mantém GPS, autorização, UTC e rollback sem realização prematura',function()use($agenda,$planned,$actor,$other,$admin,$visits,$data,$db){
    $item=$agenda->create($actor,$planned);$id=(int)$item['id'];$payload=[...$data,'agendamento_id'=>$id,'gps_capturado_em'=>(int)floor(microtime(true)*1000)];
    rejects(fn()=>$visits->create($other,$payload,bin2hex(random_bytes(16))),404);
    rejects(fn()=>$visits->create($admin,$payload,bin2hex(random_bytes(16))),403);
    rejects(fn()=>$visits->create($actor,[...$payload,'gps_capturado_em'=>1],bin2hex(random_bytes(16))),400);
    rejects(fn()=>$visits->create($actor,[...$payload,'responsavel_id'=>(int)$other['id']],bin2hex(random_bytes(16))),400);
    check($agenda->find($actor,$id)['status']==='pendente');
    // Falha depois do INSERT da visita deve desfazer também o vínculo e o estado.
    $db->exec("CREATE TRIGGER agenda_test_failure BEFORE INSERT ON agendamento_eventos FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test rollback'");
    try {try{$visits->create($actor,$payload,bin2hex(random_bytes(16)));throw new RuntimeException('Esperava falha SQL');}catch(PDOException $e){check($e->getCode()==='45000');}}finally{$db->exec('DROP TRIGGER agenda_test_failure');}
    check($agenda->find($actor,$id)['status']==='pendente'&&$agenda->find($actor,$id)['visita_id']===null);
    $key=bin2hex(random_bytes(16));$v=$visits->create($actor,$payload,$key);
    check((int)$v['agendamento_id']===$id&&abs(time()-strtotime($v['data_hora_checkin'].' UTC'))<10);
    check($agenda->find($actor,$id)['status']==='realizado');check($visits->create($actor,$payload,$key)==$v);
    rejects(fn()=>$visits->create($actor,$payload,bin2hex(random_bytes(16))),409);
    rejects(fn()=>$agenda->update($actor,$id,['acao'=>'cancelar','motivo'=>'Teste']),409);
    $unique=false;try{$db->exec('INSERT INTO visitas (usuario_id,responsavel_id,latitude,longitude,precisao_gps,contato,empresa,assunto,descricao,data_hora_checkin,agendamento_id) SELECT usuario_id,responsavel_id,latitude,longitude,precisao_gps,contato,empresa,assunto,descricao,UTC_TIMESTAMP(),agendamento_id FROM visitas WHERE id='.(int)$v['id']);}catch(PDOException $e){$unique=(int)($e->errorInfo[1]??0)===1062;}check($unique);
});
test('dois check-ins simultâneos com chaves diferentes realizam uma única agenda',function()use($agenda,$planned,$actor,$data,$db){
    $item=$agenda->create($actor,$planned);$id=(int)$item['id'];
    $job=['action'=>'create','actor'=>(int)$actor['id'],'data'=>[...$data,'agendamento_id'=>$id,'gps_capturado_em'=>(int)floor(microtime(true)*1000)],'key'=>bin2hex(random_bytes(16))];
    $statuses=array_column(concurrent([$job,[...$job,'key'=>bin2hex(random_bytes(16))]]),'status');sort($statuses);check($statuses===[201,409]);
    check((int)$db->query('SELECT COUNT(*) FROM visitas WHERE agendamento_id='.$id)->fetchColumn()===1);
    $item=$agenda->find($actor,$id);check($item['status']==='realizado'&&count($item['eventos'])===2);
});
test('cancelamento concorrente com início mantém estado e vínculo consistentes',function()use($agenda,$planned,$actor,$data){
    $item=$agenda->create($actor,$planned);$id=(int)$item['id'];
    $jobs=[['action'=>'create','actor'=>(int)$actor['id'],'data'=>[...$data,'agendamento_id'=>$id,'gps_capturado_em'=>(int)floor(microtime(true)*1000)],'key'=>bin2hex(random_bytes(16))],['action'=>'agenda_cancel','actor'=>(int)$actor['id'],'target'=>$id]];
    $results=concurrent($jobs);$item=$agenda->find($actor,$id);
    check(($results[0]['status']===201&&$results[1]['status']===409&&$item['status']==='realizado'&&$item['visita_id']!==null)||($results[0]['status']===409&&$results[1]['status']===200&&$item['status']==='cancelado'&&$item['visita_id']===null));
});
