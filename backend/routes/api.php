<?php
declare(strict_types=1);
use App\Core\{Database, Response, Router};
use App\Controllers\{AuthController, UsuarioController, VisitaController};
use App\Repositories\{UsuarioRepository, TokenRepository, VisitaRepository};
use App\Services\{AuthService, VisitaService, UsuarioService, LoginLimiter};
use App\Middleware\AuthMiddleware;

return static function (Router $router): void {
    // Construção tardia: health e rotas inexistentes não dependem do MySQL.
    $controllers = static function (): array {
        $db = Database::connection();
        $users = new UsuarioRepository($db);
        $auth = new AuthService($users, new TokenRepository($db), new LoginLimiter($db));
        $middleware = new AuthMiddleware($auth);
        return [new AuthController($auth, $middleware), new VisitaController(new VisitaService($db, new VisitaRepository($db), $users), $middleware), new UsuarioController($users, $middleware, new UsuarioService($db, $users)), new \App\Controllers\AgendamentoController(new \App\Services\AgendamentoService($db, new \App\Repositories\AgendamentoRepository($db), $users), $middleware)];
    };
    foreach ([['GET', '/agendamentos', 'index'], ['POST', '/agendamentos', 'create'], ['GET', '/agendamentos/opcoes', 'options'], ['GET', '/agendamentos/{id}', 'show'], ['PATCH', '/agendamentos/{id}', 'update']] as [$method, $path, $action]) {
        $router->add($method, '/api/v1' . $path, static fn (...$args) => $controllers()[3]->$action(...$args));
    }
    $router->add('POST', '/api/v1/usuarios', static fn () => $controllers()[2]->create());
    $router->add('PATCH', '/api/v1/usuarios/{id}', static fn (int $id) => $controllers()[2]->update($id));
    $router->add('GET', '/api/v1/health', static fn () => Response::success(['status' => 'ok', 'time' => gmdate('c')]));
    foreach ([['POST', '/auth/login', 0, 'login'], ['GET', '/auth/me', 0, 'me'], ['POST', '/auth/logout', 0, 'logout'], ['POST', '/visitas', 1, 'create'], ['GET', '/visitas', 1, 'index'], ['GET', '/visitas/{id}', 1, 'show'], ['PATCH', '/visitas/{id}', 1, 'update'], ['GET', '/usuarios', 2, 'index'], ['GET', '/responsaveis', 2, 'responsaveis']] as [$method, $path, $controller, $action]) {
        $router->add($method, '/api/v1' . $path, static function (...$args) use ($controllers, $controller, $action): void { $controllers()[$controller]->$action(...$args); });
    }
};
