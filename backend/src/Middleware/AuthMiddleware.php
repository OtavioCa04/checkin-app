<?php
declare(strict_types=1);
namespace App\Middleware;
use App\Core\HttpException;
use App\Services\AuthService;

final class AuthMiddleware
{
    public function __construct(private AuthService $auth) {}
    public function token(): string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (!preg_match('/^Bearer ([a-f0-9]{64})$/D', $header, $matches)) { throw new HttpException(401, 'Autenticação necessária.'); }
        return $matches[1];
    }
    public function user(array $roles = []): array
    {
        $user = $this->auth->authenticate($this->token());
        if ($roles && !in_array($user['perfil'], $roles, true)) { throw new HttpException(403, 'Acesso não permitido.'); }
        return $user;
    }
}
