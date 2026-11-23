<?php
declare(strict_types=1);
// Setores: cadastro pelo admin, vínculo no usuário e filtros de agenda e visitas.
test('setores: admin cria e renomeia, nome único, usuário recebe setor e filtros funcionam',function()use($db,$users,$management,$agenda,$visits,$actor,$other,$admin,$data){
    $sectors=new \App\Services\SetorService($db);
    rejects(fn()=>$sectors->save($actor,['nome'=>'Vendas']),403);
    rejects(fn()=>$sectors->list($actor,[]),403);
    rejects(fn()=>$sectors->save($admin,['nome'=>'  ']),400);
    rejects(fn()=>$sectors->save($admin,['nome'=>str_repeat('a',81)]),400);
    $sales=$sectors->save($admin,['nome'=>' Vendas ']);check($sales['nome']==='Vendas'&&$sales['ativo']===true&&$sales['usuarios']===0);
    rejects(fn()=>$sectors->save($admin,['nome'=>'vendas']),409);
    $logistics=$sectors->save($admin,['nome'=>'Logística']);
    check($sectors->save($admin,['nome'=>'Logística e Frota'],$logistics['id'])['nome']==='Logística e Frota');
    rejects(fn()=>$sectors->save($admin,['nome'=>'X'],999999),404);
    $user=$management->save($admin,['setor_id'=>$sales['id']],(int)$actor['id']);
    check($user['setor_id']===$sales['id']&&$user['setor_nome']==='Vendas');
    check($sectors->list($admin,[])[array_search($sales['id'],array_column($sectors->list($admin,[]),'id'))]['usuarios']===1);
    rejects(fn()=>$management->save($admin,['setor_id'=>'1'],(int)$actor['id']),400);
    rejects(fn()=>$management->save($admin,['setor_id'=>999999],(int)$actor['id']),400);
    $sectors->save($admin,['ativo'=>false],$logistics['id']);
    rejects(fn()=>$management->save($admin,['setor_id'=>$logistics['id']],(int)$other['id']),400);
    check(count($sectors->list($admin,['ativo'=>'1']))===1);
    // Setor inativo continua no usuário que já o tinha.
    $sectors->save($admin,['ativo'=>false],$sales['id']);
    check($management->save($admin,['nome'=>$actor['nome']],(int)$actor['id'])['setor_id']===$sales['id']);
    $sectors->save($admin,['ativo'=>true],$sales['id']);
    $options=$agenda->options($admin);
    check(array_column($options['setores'],'nome')===['Vendas']);
    $row=$options['funcionarios'][array_search((int)$actor['id'],array_column($options['funcionarios'],'id'))];
    check($row['setor_id']===$sales['id']&&$row['setor_nome']==='Vendas');
    $planned=['usuario_id'=>(int)$actor['id'],'empresa'=>'Empresa Setor','contato'=>'C','assunto'=>'A','observacoes'=>'','data_hora_prevista'=>gmdate('Y-m-d\TH:i:s\Z',time()+90000)];
    $item=$agenda->create($admin,$planned);
    check(in_array((int)$item['id'],array_map('intval',array_column($agenda->list($admin,100,0,['setor_id'=>(string)$sales['id']]),'id')),true));
    check($agenda->list($admin,100,0,['setor_id'=>(string)$logistics['id']])===[]);
    rejects(fn()=>$agenda->list($actor,100,0,['setor_id'=>(string)$sales['id']]),403);
    rejects(fn()=>$agenda->list($admin,100,0,['setor_id'=>'abc']),400);
    check($visits->list($admin,100,0,['setor_id'=>(string)$logistics['id']])===[]);
    rejects(fn()=>$visits->list($actor,100,0,['setor_id'=>(string)$sales['id']]),403);
    $management->save($admin,['setor_id'=>null],(int)$actor['id']);
    check($users->byId((int)$actor['id'])['setor_id']===null);
});
