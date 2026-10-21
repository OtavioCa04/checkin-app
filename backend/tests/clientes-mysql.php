<?php
declare(strict_types=1);
$customers=new \App\Services\ClienteService($db);$returns=new \App\Services\RetornoService($db);
$crm=[];
test('clientes isolam busca, detalhes, contatos, criação e atribuição explícita',function()use($customers,$actor,$other,$resp,$admin,&$crm){
    $crm['client']=$customers->save($actor,['nome_empresa'=>'Empresa CRM','cnpj'=>'11.222.333/0001-81','cidade'=>'Cidade']);$id=(int)$crm['client']['id'];
    check($customers->find($actor,$id)['pode_editar']);check(count($customers->list($actor,20,0,['q'=>'Empresa CRM']))===1);
    check($customers->list($other,20,0,['q'=>'Empresa CRM'])===[]);rejects(fn()=>$customers->find($other,$id),404);rejects(fn()=>$customers->contacts($other,$id,20,0,[]),404);rejects(fn()=>$customers->find($resp,$id),404);
    rejects(fn()=>$customers->save($resp,['nome_empresa'=>'Não permitido']),403);rejects(fn()=>$customers->save($actor,['ativo'=>false],$id),403);rejects(fn()=>$customers->access($actor,$id,['funcionarios_ids'=>[(int)$other['id']]]),403);
    $customers->access($admin,$id,['funcionarios_ids'=>[(int)$actor['id'],(int)$other['id']]]);check($customers->find($other,$id)['pode_editar']);
    $customers->access($admin,$id,['funcionarios_ids'=>[(int)$actor['id']]]);rejects(fn()=>$customers->find($other,$id),404);
    $crm['contact']=$customers->saveContact($actor,['nome'=>'Contato CRM','email'=>'comum@example.test','telefone'=>'11999999999','principal'=>true],$id);
    rejects(fn()=>$customers->saveContact($other,['nome'=>'Intruso'],$id),404);rejects(fn()=>$customers->saveContact($resp,['nome'=>'Intruso'],$id),403);
    try{$customers->save($other,['nome_empresa'=>'Outra empresa','cnpj'=>'11222333000181']);throw new RuntimeException();}catch(\App\Core\HttpException $e){check($e->status===409&&!str_contains($e->getMessage(),'Empresa CRM')&&$e->errors===[]);}
});
test('unicidade CNPJ concorrente e múltiplos cadastros sem CNPJ',function()use($customers,$actor,$other){
    $customers->save($actor,['nome_empresa'=>'Sem documento A']);$customers->save($actor,['nome_empresa'=>'Sem documento B','cnpj'=>'']);
    $job=['action'=>'cliente','actor'=>(int)$actor['id'],'data'=>['nome_empresa'=>'Concorrente','cnpj'=>'12ABC34501DE35']];$otherJob=[...$job,'actor'=>(int)$other['id']];
    $statuses=array_column(concurrent([$job,$otherJob]),'status');sort($statuses);check($statuses===[201,409]);
});
test('contatos simultâneos compartilham e-mail/telefone e mantêm um principal ativo',function()use($crm,$actor,$db){
    $job=['action'=>'contato','actor'=>(int)$actor['id'],'target'=>(int)$crm['client']['id'],'data'=>['nome'=>'Contato adicional','email'=>'comum@example.test','telefone'=>'11999999999','principal'=>true]];
    $result=concurrent([$job,$job]);check($result[0]['status']===201&&$result[1]['status']===201);
    $q=$db->prepare('SELECT COUNT(*) FROM contatos WHERE cliente_id=? AND principal=1 AND ativo=1');$q->execute([$crm['client']['id']]);check((int)$q->fetchColumn()===1);
});
test('vínculos exigem cliente e contato ativos e impedem ID de outro cliente',function()use($customers,$actor,$other,$admin,$visits,$data,&$crm,$agenda,$planned){
    $c2=$customers->save($actor,['nome_empresa'=>'Outro cliente']);$contact2=$customers->saveContact($actor,['nome'=>'Outro contato'],(int)$c2['id']);
    $payload=[...$data,'cliente_id'=>(int)$crm['client']['id'],'contato_id'=>(int)$contact2['id'],'gps_capturado_em'=>(int)floor(microtime(true)*1000)];
    rejects(fn()=>$visits->create($actor,$payload,bin2hex(random_bytes(16))),400);rejects(fn()=>$visits->create($other,[...$payload,'contato_id'=>(int)$crm['contact']['id']],bin2hex(random_bytes(16))),404);
    $customers->saveContact($admin,['ativo'=>false],null,(int)$crm['contact']['id']);rejects(fn()=>$visits->create($actor,[...$payload,'contato_id'=>(int)$crm['contact']['id']],bin2hex(random_bytes(16))),400);
    $customers->saveContact($admin,['ativo'=>true],null,(int)$crm['contact']['id']);$customers->save($admin,['ativo'=>false],(int)$crm['client']['id']);
    rejects(fn()=>$visits->create($actor,[...$payload,'contato_id'=>(int)$crm['contact']['id']],bin2hex(random_bytes(16))),400);
    rejects(fn()=>$agenda->create($actor,[...$planned,'cliente_id'=>(int)$crm['client']['id'],'contato_id'=>(int)$crm['contact']['id']]),400);
    check($customers->find($actor,(int)$crm['client']['id'])['ativo']===false);$customers->save($admin,['ativo'=>true],(int)$crm['client']['id']);
});
test('retratos históricos e resposta idempotente sobrevivem a alterações cadastrais',function()use($customers,$actor,$other,$resp,$admin,$visits,$data,$agenda,$planned,&$crm){
    $crm['payload']=[...$data,'empresa'=>'Texto enviado','contato'=>'Texto enviado','cliente_id'=>(int)$crm['client']['id'],'contato_id'=>(int)$crm['contact']['id'],'gps_capturado_em'=>(int)floor(microtime(true)*1000)];$key=bin2hex(random_bytes(16));
    $crm['visit']=$visits->create($actor,$crm['payload'],$key);check($crm['visit']['empresa']==='Empresa CRM'&&$crm['visit']['contato']==='Contato CRM');
    $crm['agenda']=$agenda->create($actor,[...$planned,'cliente_id'=>(int)$crm['client']['id'],'contato_id'=>(int)$crm['contact']['id']]);
    $customers->save($actor,['nome_empresa'=>'Empresa Renomeada','logradouro'=>'Rua Nova'],(int)$crm['client']['id']);$customers->saveContact($actor,['nome'=>'Contato Renomeado'],null,(int)$crm['contact']['id']);
    check($visits->find($actor,(int)$crm['visit']['id'])['cadastro_snapshot']===$crm['visit']['cadastro_snapshot']);check($visits->create($actor,$crm['payload'],$key)==$crm['visit']);
    check($agenda->find($actor,(int)$crm['agenda']['id'])['empresa']==='Empresa CRM');rejects(fn()=>$visits->update($actor,(int)$crm['visit']['id'],['empresa'=>'Reescrever história']),400);
    check($customers->find($resp,(int)$crm['client']['id'])['nome_empresa']==='Empresa Renomeada');rejects(fn()=>$customers->save($resp,['nome_empresa'=>'Intruso'],(int)$crm['client']['id']),403);
    check(count($customers->contacts($resp,(int)$crm['client']['id'],100,0,[]))===1);
    $customers->access($admin,(int)$crm['client']['id'],['funcionarios_ids'=>[(int)$actor['id'],(int)$other['id']]]);
    $v=$visits->create($other,[...$crm['payload'],'gps_capturado_em'=>(int)floor(microtime(true)*1000)],bin2hex(random_bytes(16)));check($v['empresa']==='Empresa Renomeada');
    check(count($customers->history($actor,(int)$crm['client']['id'],'visitas',100,0))===1);check(count($customers->history($other,(int)$crm['client']['id'],'visitas',100,0))===1);check(count($customers->history($admin,(int)$crm['client']['id'],'visitas',100,0))===2);
    $customers->access($admin,(int)$crm['client']['id'],['funcionarios_ids'=>[(int)$actor['id']]]);check(!$customers->find($other,(int)$crm['client']['id'])['pode_editar']);rejects(fn()=>$visits->create($other,$crm['payload'],bin2hex(random_bytes(16))),400);
});
test('check-in da agenda cadastrada valida vínculos e captura novo retrato sem alterar planejamento',function()use($agenda,$visits,$actor,$other,&$crm){
    $id=(int)$crm['agenda']['id'];$payload=[...$crm['payload'],'agendamento_id'=>$id,'gps_capturado_em'=>(int)floor(microtime(true)*1000)];
    rejects(fn()=>$visits->create($actor,[...$payload,'cliente_id'=>999999],bin2hex(random_bytes(16))),400);
    rejects(fn()=>$visits->create($other,$payload,bin2hex(random_bytes(16))),404);
    $v=$visits->create($actor,$payload,bin2hex(random_bytes(16)));check($v['empresa']==='Empresa Renomeada');check($agenda->find($actor,$id)['empresa']==='Empresa CRM');check($agenda->find($actor,$id)['status']==='realizado');
});
test('conclusão exige resultado, preserva legado e faz rollback de resultado/checkout/retorno',function()use($actor,$resp,$other,$visits,$returns,$data,$db,&$crm){
    $id=(int)$crm['visit']['id'];rejects(fn()=>$visits->update($actor,$id,['status'=>'concluida']),400);rejects(fn()=>$visits->update($resp,$id,['status'=>'concluida','resultado'=>'realizada','resumo_resultado'=>'Resumo']),403);
    $legacy=$visits->create($actor,[...$data,'gps_capturado_em'=>(int)floor(microtime(true)*1000)],bin2hex(random_bytes(16)));
    $db->prepare("UPDATE visitas SET status='concluida',data_hora_checkout=UTC_TIMESTAMP() WHERE id=?")->execute([$legacy['id']]);check($visits->find($actor,(int)$legacy['id'])['resultado']===null);rejects(fn()=>$visits->update($actor,(int)$legacy['id'],['resultado'=>'realizada','resumo_resultado'=>'Retroativo','status'=>'concluida']),409);
    $conclusion=['status'=>'concluida','resultado'=>'reagendar','resumo_resultado'=>'Encontro realizado','proximo_passo'=>'Retornar contato','data_retorno'=>'2026-10-15'];
    $db->exec("CREATE TRIGGER crm_test_failure BEFORE INSERT ON retornos FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='rollback test'");
    try{try{$visits->update($actor,$id,$conclusion);throw new RuntimeException();}catch(PDOException $e){check($e->getCode()==='45000');}}finally{$db->exec('DROP TRIGGER crm_test_failure');}
    $before=$visits->find($actor,$id);check($before['status']==='em_andamento'&&$before['resultado']===null&&$before['data_hora_checkout']===null);
    $closed=$visits->update($actor,$id,$conclusion);check($closed['resultado']==='reagendar'&&abs(time()-strtotime($closed['data_hora_checkout'].' UTC'))<10);
    rejects(fn()=>$visits->update($actor,$id,['descricao'=>'Outra']),409);$list=$returns->list($actor,100,0,[]);check(count($list)===1);$crm['return']=$list[0];$crm['closed']=$closed;
    rejects(fn()=>$returns->find($other,(int)$crm['return']['id']),404);check($returns->find($resp,(int)$crm['return']['id'])['data_prevista']==='2026-10-15');
});
test('retornos isolam filtros, vencimento, realização e cancelamento sem editar visita',function()use($returns,$visits,$actor,$other,$resp,$admin,$data,&$crm){
    $id=(int)$crm['return']['id'];check(count($returns->list($actor,100,0,['status'=>'atrasado','referencia'=>'2026-10-16']))===1);check(count($returns->list($actor,100,0,['status'=>'hoje','referencia'=>'2026-10-15']))===1);check($returns->list($actor,100,0,['fim'=>'2026-10-15'])===[]);
    rejects(fn()=>$returns->list($actor,100,0,['funcionario_id'=>$other['id']]),403);rejects(fn()=>$returns->update($resp,$id,['status'=>'realizado','observacao'=>'Teste']),403);rejects(fn()=>$returns->update($other,$id,['status'=>'realizado','observacao'=>'Teste']),404);
    $done=$returns->update($actor,$id,['status'=>'realizado','observacao'=>'Contato concluído']);check($done['status']==='realizado'&&(int)$done['encerrado_por']===(int)$actor['id']&&$done['encerrado_em']!==null);check($visits->find($actor,(int)$crm['closed']['id'])==$crm['closed']);
    rejects(fn()=>$returns->update($actor,$id,['status'=>'cancelado','observacao'=>'Mudar']),409);
    rejects(fn()=>$returns->schedule($actor,$id,['data_hora_prevista'=>gmdate('Y-m-d\TH:i:s\Z',time()+86400)]),409);
    $v=$visits->create($actor,[...$data,'gps_capturado_em'=>(int)floor(microtime(true)*1000)],bin2hex(random_bytes(16)));$visits->update($actor,(int)$v['id'],['status'=>'concluida','resultado'=>'sem_contato','resumo_resultado'=>'Sem contato','data_retorno'=>'2026-10-16']);
    $all=$returns->list($admin,100,0,['funcionario_id'=>$actor['id'],'status'=>'pendente']);$cancel=$returns->update($admin,(int)$all[0]['id'],['status'=>'cancelado','observacao'=>'Sem necessidade']);check($cancel['status']==='cancelado');check(count($returns->list($actor,100,0,['status'=>'cancelado']))===1);
});
test('geração explícita e concorrente cria uma agenda e mantém retorno pendente',function()use($returns,$visits,$customers,$actor,$other,$resp,$admin,$data,$db,&$crm){
    $v=$visits->create($actor,[...$crm['payload'],'gps_capturado_em'=>(int)floor(microtime(true)*1000)],bin2hex(random_bytes(16)));$visits->update($actor,(int)$v['id'],['status'=>'concluida','resultado'=>'realizada','resumo_resultado'=>'Conversar novamente','proximo_passo'=>'Nova reunião','data_retorno'=>'2026-10-17']);$r=$returns->list($actor,100,0,['status'=>'pendente'])[0];$id=(int)$r['id'];$crm['pending_return']=$id;
    $body=['data_hora_prevista'=>gmdate('Y-m-d\TH:i:s\Z',time()+86400)];check($r['agendamento_id']===null);rejects(fn()=>$returns->schedule($resp,$id,$body),403);rejects(fn()=>$returns->schedule($other,$id,$body),404);rejects(fn()=>$returns->schedule($actor,$id,['data_hora_prevista'=>'2000-01-01T00:00:00Z']),400);
    $customers->save($admin,['ativo'=>false],(int)$crm['client']['id']);rejects(fn()=>$returns->schedule($actor,$id,$body),400);check($returns->find($actor,$id)['agendamento_id']===null);$customers->save($admin,['ativo'=>true],(int)$crm['client']['id']);
    $job=['action'=>'retorno_schedule','actor'=>(int)$actor['id'],'target'=>$id,'data'=>$body];$result=concurrent([$job,$job]);check($result[0]['status']===201&&$result[1]['status']===201&&$result[0]['id']===$result[1]['id']);
    check($returns->find($actor,$id)['status']==='pendente');check((int)$db->query('SELECT COUNT(*) FROM agendamentos WHERE retorno_id='.$id)->fetchColumn()===1);check((int)$returns->schedule($actor,$id,$body)['id']===$result[0]['id']);rejects(fn()=>$returns->schedule($actor,$id,['data_hora_prevista'=>gmdate('Y-m-d\TH:i:s\Z',time()+172800)]),409);
});
