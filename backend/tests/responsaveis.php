<?php
declare(strict_types=1);

// Dobles de PDO para testar a rota nova sem tocar nos dados do banco.
final class ResponsibleTestStatement extends PDOStatement
{
    public function __construct(private string $sql, private array $user) {}
    public function execute(?array $params = null): bool
    {
        if (str_contains($this->sql, 'SELECT id, nome')) {
            check(str_contains($this->sql, 'ativo = 1') && str_contains($this->sql, 'perfil = ?'));
            check($params === ['responsavel']);
        }
        return true;
    }
    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursorOrientation = PDO::FETCH_ORI_NEXT, int $cursorOffset = 0): mixed { return $this->user; }
    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array { return [['id' => '3', 'nome' => 'Responsável Teste']]; }
}
final class ResponsibleTestDatabase extends PDO
{
    public function __construct(private array $user) {}
    public function prepare(string $query, array $options = []): PDOStatement|false { return new ResponsibleTestStatement($query, $this->user); }
}
test('responsáveis retornam apenas ID numérico e nome com filtro ativo', function (): void {
    $db = new ResponsibleTestDatabase([]);
    check((new App\Repositories\UsuarioRepository($db))->activeResponsibles() === [['id' => 3, 'nome' => 'Responsável Teste']]);
});
test('rota de responsáveis exige funcionário e preserva usuários admin-only', function (): void {
    $old = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
    try {
        $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . str_repeat('a', 64);
        foreach (['funcionario', 'responsavel', 'admin'] as $role) {
            $db = new ResponsibleTestDatabase(['id' => 2, 'nome' => 'Teste', 'email' => 'teste@example.test', 'perfil' => $role, 'ativo' => 1]);
            $users = new App\Repositories\UsuarioRepository($db);
            $middleware = new App\Middleware\AuthMiddleware(new App\Services\AuthService($users, new App\Repositories\TokenRepository($db)));
            $controller = new App\Controllers\UsuarioController($users, $middleware);
            if ($role !== 'funcionario') { rejects(fn () => $controller->responsaveis(), 403); }
            else {
                ob_start(); $controller->responsaveis(); $body = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
                check($body['success'] && $body['data'] === [['id' => 3, 'nome' => 'Responsável Teste']]);
            }
            if ($role !== 'admin') { rejects(fn () => $controller->index(), 403); rejects(fn () => $controller->create(), 403); rejects(fn () => $controller->update(2), 403); }
        }
        unset($_SERVER['HTTP_AUTHORIZATION']);
        rejects(fn () => $controller->responsaveis(), 401);
    } finally {
        if ($old === null) { unset($_SERVER['HTTP_AUTHORIZATION']); } else { $_SERVER['HTTP_AUTHORIZATION'] = $old; }
    }
});
