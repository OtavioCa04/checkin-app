<?php
declare(strict_types=1);
// Multiempresa: duas empresas reais no banco. Nada de uma pode ser lido, listado ou alterado pela outra.
test('superadmin cria empresa e só ele administra empresas',function()use($db,$admin,$actor){
    $companies=new \App\Services\EmpresaService($db);
    rejects(fn()=>$companies->list($admin),403);
    rejects(fn()=>$companies->create($actor,['nome'=>'X','admin_nome'=>'G','admin_email'=>'g@x.test','admin_senha'=>'12345678']),403);
    $db->prepare('UPDATE usuarios SET superadmin=1 WHERE id=?')->execute([(int)$admin['id']]);
    $super=[...$admin,'superadmin'=>1];
    $b=$companies->create($super,['nome'=>'Empresa B','admin_nome'=>'Gestor B','admin_email'=>'gestor-b@example.test','admin_senha'=>'senha-b-123']);
    check($b['nome']==='Empresa B'&&$b['ativo']===true&&$b['usuarios']===1&&$b['admins']===1);
    rejects(fn()=>$companies->create($super,['nome'=>'empresa b','admin_nome'=>'G','admin_email'=>'outro@example.test','admin_senha'=>'12345678']),409);
    rejects(fn()=>$companies->create($super,['nome'=>'Empresa C','admin_nome'=>'G','admin_email'=>'gestor-b@example.test','admin_senha'=>'12345678']),409);
    check(!in_array('Empresa C',array_column($companies->list($super),'nome'),true));
    rejects(fn()=>$companies->create($super,['nome'=>'','admin_nome'=>'G','admin_email'=>'x','admin_senha'=>'1']),400);
    rejects(fn()=>$companies->update($super,1,['ativo'=>false]),409);
    rejects(fn()=>$companies->update($super,999999,['nome'=>'Nada']),404);
    check($companies->update($super,(int)$b['id'],['nome'=>'Empresa Beta'])['nome']==='Empresa Beta');
});
test('isolamento: admin de outra empresa não lê, não lista e não altera nada',function()use($db,$users,$management,$agenda,$visits,$actor,$admin,$data){
    $auth=new \App\Services\AuthService($users,new \App\Repositories\TokenRepository($db));
    $login=$auth->login(['email'=>'gestor-b@example.test','senha'=>'senha-b-123']);
    check($login['usuario']['empresa_nome']==='Empresa Beta'&&$login['usuario']['superadmin']===false);
    $adminB=$auth->authenticate($login['access_token']);$companyB=(int)$adminB['empresa_id'];check($companyB!==1);
    $customers=new \App\Services\ClienteService($db);$sectors=new \App\Services\SetorService($db);$returns=new \App\Services\RetornoService($db);
    // Dados da empresa A (empresa 1).
    $clientA=$customers->save($admin,['nome_empresa'=>'Cliente A','cnpj'=>'11444777000161']);
    $customers->access($admin,(int)$clientA['id'],['funcionarios_ids'=>[(int)$actor['id']]]);
    $visitA=$visits->create($actor,[...$data,'cliente_id'=>(int)$clientA['id']],bin2hex(random_bytes(16)));
    $visits->update($actor,(int)$visitA['id'],['status'=>'concluida','resultado'=>'realizada','resumo_resultado'=>'Ok','data_retorno'=>gmdate('Y-m-d',time()+3*86400)]);
    $returnA=$returns->list($admin,100,0,[])[0];
    $agendaA=$agenda->create($admin,['usuario_id'=>(int)$actor['id'],'empresa'=>'E','contato'=>'C','assunto'=>'A','observacoes'=>'','data_hora_prevista'=>gmdate('Y-m-d\TH:i:s\Z',time()+86400)]);
    $sectorA=$sectors->list($admin,[])[0];
    // Empresa B monta os próprios dados, com nomes e CNPJ iguais aos da A.
    $employeeB=$management->save($adminB,['nome'=>'Funcionário B','email'=>'func-b@example.test','perfil'=>'funcionario','senha'=>'senha-b-123']);
    check($employeeB['empresa_id']===$companyB);
    $sectorB=$sectors->save($adminB,['nome'=>$sectorA['nome']]);
    $clientB=$customers->save($adminB,['nome_empresa'=>'Cliente B','cnpj'=>'11444777000161']);
    // Leitura direta por id: 404, como se não existisse.
    rejects(fn()=>$visits->find($adminB,(int)$visitA['id']),404);
    rejects(fn()=>$visits->photo($adminB,(int)$visitA['id']),404);
    rejects(fn()=>$agenda->find($adminB,(int)$agendaA['id']),404);
    rejects(fn()=>$customers->find($adminB,(int)$clientA['id']),404);
    rejects(fn()=>$customers->history($adminB,(int)$clientA['id'],'visitas',20,0),404);
    rejects(fn()=>$customers->contacts($adminB,(int)$clientA['id'],20,0,[]),404);
    rejects(fn()=>$returns->find($adminB,(int)$returnA['id']),404);
    // Listagens: só dados da própria empresa.
    check($visits->list($adminB,100,0)===[]);
    check($agenda->list($adminB,100,0,[])===[]);
    check($returns->list($adminB,100,0,[])===[]);
    check(array_column($customers->list($adminB,100,0,[]),'id')===[(int)$clientB['id']]);
    check(array_column($sectors->list($adminB,[]),'id')===[$sectorB['id']]);
    check(array_map('intval',array_column($users->list($companyB,100,0),'id'))===[(int)$adminB['id'],$employeeB['id']]);
    check(!in_array($employeeB['id'],array_map('intval',array_column($users->list(1,100,0),'id')),true));
    check(!in_array($employeeB['id'],array_column($agenda->options($admin)['funcionarios'],'id'),true));
    check(array_column($agenda->options($adminB)['funcionarios'],'id')===[$employeeB['id'],(int)$adminB['id']]||array_column($agenda->options($adminB)['funcionarios'],'id')===[(int)$adminB['id'],$employeeB['id']]);
    // Alterações cruzadas: recusadas.
    rejects(fn()=>$management->save($adminB,['ativo'=>false],(int)$actor['id']),404);
    rejects(fn()=>$management->save($adminB,['setor_id'=>$sectorA['id']],$employeeB['id']),400);
    rejects(fn()=>$sectors->save($adminB,['nome'=>'Roubado'],$sectorA['id']),404);
    rejects(fn()=>$visits->update($adminB,(int)$visitA['id'],['contato'=>'X']),404);
    rejects(fn()=>$agenda->update($adminB,(int)$agendaA['id'],['acao'=>'cancelar','motivo'=>'X']),404);
    rejects(fn()=>$customers->save($adminB,['nome_fantasia'=>'X'],(int)$clientA['id']),404);
    rejects(fn()=>$customers->access($adminB,(int)$clientB['id'],['funcionarios_ids'=>[(int)$actor['id']]]),400);
    rejects(fn()=>$returns->update($adminB,(int)$returnA['id'],['status'=>'cancelado','observacao'=>'X']),404);
    // Criar registros apontando para gente ou clientes da outra empresa: recusado.
    rejects(fn()=>$agenda->create($adminB,['usuario_id'=>(int)$actor['id'],'empresa'=>'E','contato'=>'C','assunto'=>'A','observacoes'=>'','data_hora_prevista'=>gmdate('Y-m-d\TH:i:s\Z',time()+86400)]),400);
    rejects(fn()=>$agenda->create($adminB,['usuario_id'=>$employeeB['id'],'cliente_id'=>(int)$clientA['id'],'empresa'=>'E','contato'=>'C','assunto'=>'A','observacoes'=>'','data_hora_prevista'=>gmdate('Y-m-d\TH:i:s\Z',time()+86400)]),404);
    rejects(fn()=>$visits->create($adminB,[...$data,'cliente_id'=>(int)$clientA['id']],bin2hex(random_bytes(16))),404);
    rejects(fn()=>$visits->create($adminB,[...$data,'agendamento_id'=>(int)$agendaA['id']],bin2hex(random_bytes(16))),404);
    // O banco também barra: visita da empresa B não pode apontar para usuário da A.
    $blocked=false;try{$db->prepare('INSERT INTO visitas (empresa_id,usuario_id,local,contato,empresa,assunto,descricao,data_hora_checkin) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP())')->execute([$companyB,(int)$actor['id'],'L','C','E','A','D']);}catch(PDOException){$blocked=true;}check($blocked);
    // Admin também vai a campo: check-in próprio e cliente da empresa sem vínculo explícito.
    $own=$visits->create($adminB,[...$data,'cliente_id'=>(int)$clientB['id']],bin2hex(random_bytes(16)));
    check((int)$own['usuario_id']===(int)$adminB['id']&&(int)$own['empresa_id']===$companyB);
    check(count($visits->list($adminB,100,0))===1&&!in_array((int)$own['id'],array_map('intval',array_column($visits->list($admin,100,0),'id')),true));
    // Empresa desativada: sessão encerrada e login recusado.
    $super=[...$admin,'superadmin'=>1];
    (new \App\Services\EmpresaService($db))->update($super,$companyB,['ativo'=>false]);
    rejects(fn()=>$auth->authenticate($login['access_token']),401);
    rejects(fn()=>$auth->login(['email'=>'gestor-b@example.test','senha'=>'senha-b-123']),401);
    (new \App\Services\EmpresaService($db))->update($super,$companyB,['ativo'=>true]);
    check($auth->login(['email'=>'gestor-b@example.test','senha'=>'senha-b-123'])['usuario']['empresa_id']===$companyB);
});
