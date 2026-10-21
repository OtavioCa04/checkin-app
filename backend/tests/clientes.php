<?php
declare(strict_types=1);
use App\Models\{Cliente,Resultado};
test('CNPJ opcional, numérico e alfanumérico normalizados',function():void{
    check(Cliente::cnpj(null)===null&&Cliente::cnpj('')===null);
    check(Cliente::cnpj('11.222.333/0001-81')==='11222333000181');
    check(Cliente::cnpj('12.abc.345/01de-35')==='12ABC34501DE35');
});
test('CNPJ rejeita DV, repetição e símbolos desconhecidos',function():void{foreach(['11222333000180','11111111111111','11222333000181!','12ABC34501DE34',123,[],true] as $cnpj){rejects(fn()=>Cliente::cnpj($cnpj),400);}});
test('cliente valida endereço, textos e situação sem coerção',function():void{
    $c=Cliente::validate(['nome_empresa'=>' Empresa ','uf'=>'sp'],true);check($c['nome_empresa']==='Empresa'&&$c['uf']==='SP'&&$c['cnpj']===null&&$c['ativo']===true);
    foreach([['nome_empresa'=>''],['ativo'=>1],['cep'=>'123'],['uf'=>'SPX'],['criado_por'=>4]] as $input){rejects(fn()=>Cliente::validate($input,false),400);}
});
test('contato valida nome, e-mail e booleanos sem exigir unicidade de pessoas',function():void{check(Cliente::validate(['nome'=>'Contato','email'=>'teste@example.test','telefone'=>'123'],true,true)['telefone']==='123');rejects(fn()=>Cliente::validate(['nome'=>'Contato','email'=>'inválido'],true,true),400);rejects(fn()=>Cliente::validate(['principal'=>'1'],false,true),400);});
test('vínculos cadastrais exigem IDs numéricos e cliente do contato',function():void{Cliente::links(['cliente_id'=>1,'contato_id'=>2]);rejects(fn()=>Cliente::links(['contato_id'=>2]),400);rejects(fn()=>Cliente::links(['cliente_id'=>'1']),400);});
test('resultado e resumo obrigatórios apenas junto da conclusão',function():void{
    check(Resultado::validate(['descricao'=>'Descrição'])===[]);rejects(fn()=>Resultado::validate(['status'=>'concluida']),400);rejects(fn()=>Resultado::validate(['resultado'=>'realizada']),400);rejects(fn()=>Resultado::validate(['status'=>'concluida','resultado'=>'outro','resumo_resultado'=>'Resumo']),400);
    $r=Resultado::validate(['status'=>'concluida','resultado'=>'sem_contato','resumo_resultado'=>' Resumo ']);check($r['resumo_resultado']==='Resumo'&&$r['data_retorno']===null);
});
test('dia de retorno é data sem horário e não sofre conversão UTC',function():void{check(Resultado::day('2028-02-29')==='2028-02-29');foreach(['2027-02-29','2026-10-16T00:00:00Z','16/10/2026',null] as $d){rejects(fn()=>Resultado::day($d),400);}});
