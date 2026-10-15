<?php
declare(strict_types=1);
use App\Models\{Agendamento, Visita};

test('agenda aceita somente UTC exato e datas futuras válidas', function (): void {
    check(Agendamento::date('2028-02-29T12:30:00Z') === '2028-02-29 12:30:00');
    foreach (['2027-02-29T12:30:00Z', '2028-02-29T12:30:00-03:00', '2028-02-29 12:30:00', null, [], '0000-01-01T00:00:00Z'] as $date) { rejects(fn () => Agendamento::date($date), 400); }
    rejects(fn () => Agendamento::date('2000-01-01T00:00:00Z', true), 400);
});
test('agenda exige motivo e limita campos de alteração', function (): void {
    rejects(fn () => Agendamento::change(['acao' => 'cancelar', 'motivo' => ' ']), 400);
    rejects(fn () => Agendamento::change(['acao' => 'cancelar', 'motivo' => 'Teste', 'usuario_id' => 2]), 400);
    rejects(fn () => Agendamento::change(['acao' => 'realizado', 'motivo' => 'Teste']), 400);
    check(Agendamento::change(['acao' => 'cancelar', 'motivo' => ' Motivo '])['motivo'] === 'Motivo');
});
test('agenda separa leitura de gestão conforme identidade e perfil', function (): void {
    $item = ['usuario_id' => 2, 'responsavel_id' => 3];
    foreach ([['id'=>1,'perfil'=>'admin'],['id'=>2,'perfil'=>'funcionario']] as $user) { check(Agendamento::canManage($user, $item)); check(Agendamento::canRead($user, $item)); }
    check(Agendamento::canRead(['id'=>3,'perfil'=>'responsavel'], $item));
    check(!Agendamento::canManage(['id'=>3,'perfil'=>'responsavel'], $item));
    check(!Agendamento::canRead(['id'=>4,'perfil'=>'funcionario'], $item));
});
test('visita permite vínculo numérico na criação e não permite alterar vínculo', function () use ($input): void {
    check(Visita::validate([...$input,'agendamento_id'=>2], true)['agendamento_id'] === 2);
    rejects(fn () => Visita::validate([...$input,'agendamento_id'=>'2'], true), 400);
    rejects(fn () => Visita::validate(['agendamento_id'=>2], false), 400);
});
