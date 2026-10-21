<?php
declare(strict_types=1);
test('segundo responsável não acessa cliente, contato, visita, agenda ou retorno atribuídos ao primeiro',function()use($users,$customers,$actor,$resp,$visits,$agenda,$returns,$data,$planned){
    $id=$users->create(['nome'=>'Segundo responsável fictício','email'=>'responsavel2@example.test','senha_hash'=>password_hash('somente-testes-2026',PASSWORD_DEFAULT),'perfil'=>'responsavel','ativo'=>true]);
    $second=$users->byId($id);
    $client=$customers->save($actor,['nome_empresa'=>'Isolamento responsável']);
    $contact=$customers->saveContact($actor,['nome'=>'Contato isolado'],(int)$client['id']);
    $links=['cliente_id'=>(int)$client['id'],'contato_id'=>(int)$contact['id']];
    $visit=$visits->create($actor,[...$data,...$links,'gps_capturado_em'=>(int)floor(microtime(true)*1000)],bin2hex(random_bytes(16)));
    $item=$agenda->create($actor,[...$planned,...$links]);
    $visits->update($actor,(int)$visit['id'],['status'=>'concluida','resultado'=>'realizada','resumo_resultado'=>'Resumo','data_retorno'=>'2028-01-01']);
    $return=array_values(array_filter($returns->list($actor,100,0,[]),fn($r)=>(int)$r['visita_id']===(int)$visit['id']))[0];
    foreach([$second] as $reader){
        rejects(fn()=>$customers->find($reader,(int)$client['id']),404);
        rejects(fn()=>$customers->contacts($reader,(int)$client['id'],20,0,[]),404);
        rejects(fn()=>$visits->find($reader,(int)$visit['id']),404);
        rejects(fn()=>$agenda->find($reader,(int)$item['id']),404);
        rejects(fn()=>$returns->find($reader,(int)$return['id']),404);
        check($customers->list($reader,100,0,['q'=>'Isolamento responsável'])===[]);
        check($visits->list($reader,100,0,['empresa'=>'Isolamento responsável'])===[]);
        check($agenda->list($reader,100,0,[])===[] && $returns->list($reader,100,0,[])===[]);
    }
    check((int)$visits->find($resp,(int)$visit['id'])['responsavel_id']===(int)$resp['id']);
    $own=$visits->create($actor,[...$data,'responsavel_id'=>$id,'gps_capturado_em'=>(int)floor(microtime(true)*1000)],bin2hex(random_bytes(16)));
    check((int)$visits->find($second,(int)$own['id'])['responsavel_id']===$id);
    rejects(fn()=>$visits->find($resp,(int)$own['id']),404);
});
test('conclusões simultâneas de duas abas gravam um checkout e um retorno',function()use($actor,$data,$visits,$db){
    $v=$visits->create($actor,[...$data,'gps_capturado_em'=>(int)floor(microtime(true)*1000)],bin2hex(random_bytes(16)));
    $job=['action'=>'conclude','actor'=>(int)$actor['id'],'target'=>(int)$v['id'],'data'=>['status'=>'concluida','resultado'=>'realizada','resumo_resultado'=>'Concorrente','data_retorno'=>'2028-01-01']];
    $statuses=array_column(concurrent([$job,$job]),'status');sort($statuses);check($statuses===[200,409]);
    $row=$visits->find($actor,(int)$v['id']);check($row['status']==='concluida'&&$row['data_hora_checkout']!==null);
    $q=$db->prepare('SELECT COUNT(*) FROM retornos WHERE visita_id=?');$q->execute([$v['id']]);check((int)$q->fetchColumn()===1);
});
