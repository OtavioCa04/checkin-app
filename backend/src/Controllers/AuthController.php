<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\{Controller, Response};
use App\Middleware\AuthMiddleware;
use App\Models\Usuario;
use App\Services\AuthService;

final class AuthController extends Controller
{
    public function __construct(private AuthService $auth, private AuthMiddleware $middleware) {}
    public function login(): void { Response::success($this->auth->login($this->input(), \App\Services\LoginLimiter::origin($_SERVER)), 'Autenticado.'); }
    public function me(): void { Response::success(Usuario::publicData($this->middleware->user())); }
    public function logout(): void
    {
        $this->middleware->user();
        $this->auth->logout($this->middleware->token());
        Response::success(null, 'Autenticação encerrada.');
    }
}
