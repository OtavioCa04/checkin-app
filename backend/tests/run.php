<?php
declare(strict_types=1);
ob_start();

// Testes unitários também rodam antes do composer install, sem carregar .env.
if (is_file(dirname(__DIR__) . '/vendor/autoload.php')) {
    require dirname(__DIR__) . '/bootstrap.php';
} else {
    spl_autoload_register(static function (string $class): void {
        if (str_starts_with($class, 'App\\')) {
            require dirname(__DIR__) . '/src/' . str_replace('\\', '/', substr($class, 4)) . '.php';
        }
    });
}
use App\Core\{HttpException, Router, Pagination, Database};
use App\Models\{Visita, Usuario};
use App\Repositories\{UsuarioRepository, TokenRepository, VisitaRepository};
use App\Services\{AuthService, VisitaService};

$passed = 0;
$failed = 0;
function check(bool $condition): void { if (!$condition) { throw new RuntimeException('Asserção falhou.'); } }
function rejects(callable $call, int $status): void
{
    try { $call(); } catch (HttpException $e) { check($e->status === $status); return; }
    throw new RuntimeException('Exceção esperada não ocorreu.');
}
function test(string $name, callable $call): void
{
    global $passed, $failed;
    try { $call(); $passed++; echo "PASS {$name}\n"; }
    catch (Throwable $e) { $failed++; echo "FAIL {$name}: " . get_class($e) . "\n"; }
}
$input = ['local' => 'Av. Paulista, 1000 - São Paulo', 'contato' => 'Contato', 'empresa' => 'Empresa', 'assunto' => 'Reunião', 'descricao' => 'Descrição'];
test('validação de criação válida', fn () => check(Visita::validate($input, true) === $input));
test('local obrigatório, até 255 caracteres, sem coordenadas', function () use ($input): void {
    rejects(fn () => Visita::validate([...$input, 'local' => ''], true), 400);
    rejects(fn () => Visita::validate([...$input, 'local' => str_repeat('a', 256)], true), 400);
    check(Visita::validate([...$input, 'local' => str_repeat('é', 255)], true)['local'] === str_repeat('é', 255));
    foreach (['latitude' => -23.5, 'longitude' => -46.6, 'precisao_gps' => 10, 'gps_capturado_em' => 1] as $k => $v) { rejects(fn () => Visita::validate([...$input, $k => $v], true), 400); }
});
test('campos obrigatórios', fn () => rejects(fn () => Visita::validate([], true), 400));
test('identidade não pode vir do cliente', fn () => rejects(fn () => Visita::validate([...$input, 'usuario_id' => 9], true), 400));
test('check-in não pode vir do cliente', fn () => rejects(fn () => Visita::validate([...$input, 'data_hora_checkin' => '2020-01-01'], true), 400));
test('PATCH não altera coordenadas', fn () => rejects(fn () => Visita::validate(['latitude' => 1], false), 400));
test('PATCH vazio e status nulo', function (): void { rejects(fn () => Visita::validate([], false), 400); rejects(fn () => Visita::validate(['status' => null], false), 400); });
test('autorização por proprietário; admin vê tudo', function (): void {
    $v = ['empresa_id' => 1, 'usuario_id' => 1, 'responsavel_id' => 3];
    check(Visita::canRead(['id' => 1, 'empresa_id' => 1, 'perfil' => 'funcionario'], $v));
    check(!Visita::canRead(['id' => 2, 'empresa_id' => 1, 'perfil' => 'funcionario'], $v));
    check(!Visita::canRead(['id' => 3, 'empresa_id' => 1, 'perfil' => 'responsavel'], $v));
    check(Visita::canRead(['id' => 4, 'empresa_id' => 1, 'perfil' => 'admin'], $v));
});
test('isolamento por empresa: nada atravessa empresas, nem para admin nem para o dono', function (): void {
    $v = ['empresa_id' => 1, 'usuario_id' => 1];
    check(!Visita::canRead(['id' => 4, 'empresa_id' => 2, 'perfil' => 'admin'], $v));
    check(!Visita::canRead(['id' => 1, 'empresa_id' => 2, 'perfil' => 'funcionario'], $v));
    check(!Visita::canRead(['id' => 4, 'perfil' => 'admin'], $v));
    check(!Visita::canRead(['id' => 4, 'empresa_id' => 1, 'perfil' => 'admin'], ['usuario_id' => 1]));
    check(Visita::PERFIS_CAMPO === ['funcionario', 'admin']);
});
test('empresa nova: nome e administrador validados juntos', function (): void {
    $ok = App\Services\EmpresaService::validate(['nome' => ' ACME ', 'admin_nome' => 'Gestor', 'admin_email' => 'g@acme.test', 'admin_senha' => '12345678'], true);
    check($ok['nome'] === 'ACME' && $ok['admin']['perfil'] === 'admin' && $ok['admin']['email'] === 'g@acme.test');
    try { App\Services\EmpresaService::validate(['nome' => '', 'admin_nome' => 'G', 'admin_email' => 'x', 'admin_senha' => '123'], true); throw new RuntimeException('deveria falhar'); }
    catch (HttpException $e) { check($e->status === 400 && isset($e->errors['nome'], $e->errors['admin_email'], $e->errors['admin_senha'])); }
    rejects(fn () => App\Services\EmpresaService::validate(['nome' => 'X', 'extra' => 1], false), 400);
    rejects(fn () => App\Services\EmpresaService::validate(['ativo' => 'sim'], false), 400);
    rejects(fn () => (new ReflectionClass(App\Services\EmpresaService::class))->newInstanceWithoutConstructor()->list(['perfil' => 'admin', 'superadmin' => false]), 403);
});
test('check-in não aceita responsável', fn () => rejects(fn () => Visita::validate([...$input, 'responsavel_id' => 2], true), 400));
test('senha de usuário: mínimo 8 e máximo 72 bytes', function (): void {
    $base = ['nome' => 'Teste', 'email' => 'a@example.test', 'perfil' => 'funcionario'];
    rejects(fn () => App\Services\UsuarioService::validate([...$base, 'senha' => '1234567'], true), 400);
    check(App\Services\UsuarioService::validate([...$base, 'senha' => '12345678'], true)['senha'] === '12345678');
    rejects(fn () => App\Services\UsuarioService::validate([...$base, 'senha' => str_repeat('a', 73)], true), 400);
});
test('setor: nome obrigatório até 80 e setor do usuário opcional', function (): void {
    check(App\Services\SetorService::validate(['nome' => ' Vendas '], true)['nome'] === 'Vendas');
    rejects(fn () => App\Services\SetorService::validate(['nome' => ''], true), 400);
    rejects(fn () => App\Services\SetorService::validate(['nome' => str_repeat('a', 81)], true), 400);
    rejects(fn () => App\Services\SetorService::validate(['nome' => 'X', 'ativo' => false], true), 400);
    rejects(fn () => App\Services\SetorService::validate([], false), 400);
    rejects(fn () => App\Services\SetorService::validate(['ativo' => 1], false), 400);
    check(App\Services\UsuarioService::validate(['setor_id' => null], false) === ['setor_id' => null]);
    check(App\Services\UsuarioService::validate(['setor_id' => 3], false) === ['setor_id' => 3]);
    rejects(fn () => App\Services\UsuarioService::validate(['setor_id' => '3'], false), 400);
    rejects(fn () => App\Services\UsuarioService::validate(['setor_id' => 0], false), 400);
    check(Usuario::publicData(['id' => 1, 'nome' => 'T', 'email' => 'a@b.test', 'perfil' => 'admin', 'ativo' => 1, 'setor_id' => '2', 'setor_nome' => 'Vendas'])['setor_id'] === 2);
});
test('somente perfis admin e funcionário', function (): void {
    check(Usuario::PERFIS === ['funcionario', 'admin']);
    rejects(fn () => App\Services\UsuarioService::validate(['nome' => 'Teste', 'email' => 'a@example.test', 'perfil' => 'responsavel', 'senha' => 'senha-de-teste-123'], true), 400);
});
test('serialização não expõe hash', fn () => check(!isset(Usuario::publicData(['id' => 1, 'nome' => 'Teste', 'email' => 'a@example.test', 'perfil' => 'admin', 'ativo' => 1, 'senha_hash' => 'segredo'])['senha_hash'])));
test('hash e verificação de senha', function (): void { $hash = password_hash('senha-de-teste', PASSWORD_DEFAULT); check(password_verify('senha-de-teste', $hash)); check(!password_verify('incorreta', $hash)); });
test('router captura id', function (): void { $r = new Router(); $id = null; $r->add('GET', '/api/v1/visitas/{id}', function (int $value) use (&$id): void { $id = $value; }); $r->dispatch('GET', '/api/v1/visitas/42'); check($id === 42); });
test('router distingue 404 de 405', function (): void { $r = new Router(); $r->add('GET', '/x', fn () => null); rejects(fn () => $r->dispatch('POST', '/x'), 405); rejects(fn () => $r->dispatch('GET', '/y'), 404); });
test('paginação limitada', function (): void { check(Pagination::read([]) === [20, 0]); rejects(fn () => Pagination::read(['limit' => 101]), 400); });

require __DIR__ . '/reliability.php';
require __DIR__ . '/agenda.php';
require __DIR__ . '/clientes.php';

if (App\Config\App::env('RUN_DB_TESTS') === '1') {
    $target=getenv('TEST_DB_DATABASE');
    if (!$target || !preg_match('/^visitas_test_[a-z0-9_]+$/D',$target) || $target === App\Config\App::env('DB_DATABASE')) { fwrite(STDERR, 'Use TEST_DB_DATABASE dedicado, diferente do banco atual, com prefixo visitas_test_.'); exit(1); }
    $_ENV['DB_DATABASE']=$target;
    // Somente banco dedicado: cria dados temporários e remove-os no finally.
    test('integração MySQL, login, criação, autorização e logout', function () use ($input): void {
        $db = Database::connection();
        check((int) $db->query('SELECT 1')->fetchColumn() === 1);
        $ids = [];
        $suffix = bin2hex(random_bytes(6));
        $password = 'senha-integracao-123';
        try {
            foreach (['funcionario', 'funcionario', 'admin', 'admin'] as $i => $role) {
                $q = $db->prepare('INSERT INTO usuarios (empresa_id, nome, email, senha_hash, perfil) VALUES (1, ?, ?, ?, ?)');
                $q->execute(['Teste', "teste{$i}-{$suffix}@example.test", password_hash($password, PASSWORD_DEFAULT), $role]);
                $ids[] = (int) $db->lastInsertId();
            }
            $users = new UsuarioRepository($db);
            $tokens = new TokenRepository($db);
            $auth = new AuthService($users, $tokens);
            rejects(fn () => $auth->login(['email' => "teste0-{$suffix}@example.test", 'senha' => 'errada']), 401);
            $login = $auth->login(['email' => "teste0-{$suffix}@example.test", 'senha' => $password]);
            $u = $auth->authenticate($login['access_token']);
            check((int) $u['id'] === $ids[0]);
            $service = new VisitaService($db, new VisitaRepository($db), $users);
            $v = $service->create($u, $input, bin2hex(random_bytes(16)));
            check((int) $v['usuario_id'] === $ids[0] && $v['responsavel_id'] === null && $v['status'] === 'em_andamento' && $v['data_hora_checkout'] === null);
            check(abs(time() - strtotime($v['data_hora_checkin'] . ' UTC')) < 10);
            $id = (int) $v['id'];
            $other = $users->byId($ids[1]);
            rejects(fn () => $service->find($other, $id), 404);
            check($service->list($other, 100, 0) === []);
            foreach ([2, 3] as $i) { check((int) $service->find($users->byId($ids[$i]), $id)['id'] === $id); }
            rejects(fn () => $service->create($u, [...$input, 'responsavel_id' => $ids[2]], bin2hex(random_bytes(16))), 400);
            $closed = $service->update($u, $id, ['status' => 'concluida', 'resultado'=>'realizada', 'resumo_resultado'=>'Resumo da visita de teste.']);
            check($closed['data_hora_checkout'] !== null);
            rejects(fn () => $service->update($u, $id, ['contato' => 'Novo']), 409);
            $db->prepare('UPDATE usuarios SET ativo = 0 WHERE id = ?')->execute([$ids[0]]);
            rejects(fn () => $auth->authenticate($login['access_token']), 401);
            $db->prepare('UPDATE usuarios SET ativo = 1 WHERE id = ?')->execute([$ids[0]]);
            $db->prepare('UPDATE auth_tokens SET expira_em = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE usuario_id = ?')->execute([$ids[0]]);
            rejects(fn () => $auth->authenticate($login['access_token']), 401);
            $second = $auth->login(['email' => "teste0-{$suffix}@example.test", 'senha' => $password]);
            $auth->logout($second['access_token']);
            rejects(fn () => $auth->authenticate($second['access_token']), 401);
        } finally {
            foreach ($ids as $id) { $db->prepare('DELETE FROM visitas WHERE usuario_id = ?')->execute([$id]); }
            foreach ($ids as $id) { $db->prepare('DELETE FROM visita_requests WHERE usuario_id = ?')->execute([$id]); }
            foreach ($ids as $id) { $db->prepare('DELETE FROM usuarios WHERE id = ?')->execute([$id]); }
        }
    });
} else { echo "SKIP integração MySQL: defina RUN_DB_TESTS=1 em banco dedicado migrado.\n"; }
echo "Resultado: {$passed} passaram, {$failed} falharam.\n";
ob_end_flush();
exit($failed ? 1 : 0);
