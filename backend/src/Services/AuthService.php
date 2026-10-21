<?php
declare(strict_types=1);
namespace App\Services;
use App\Config\App;
use App\Core\HttpException;
use App\Models\Usuario;
use App\Repositories\{UsuarioRepository, TokenRepository};

final class AuthService
{
    public function __construct(private UsuarioRepository $users, private TokenRepository $tokens, private ?LoginLimiter $limiter = null) {}
    public function login(array $input, string $origin = 'unknown'): array
    {
        $this->limiter?->consume($origin, is_string($input['email'] ?? null) ? $input['email'] : 'invalid');
        if (array_diff(array_keys($input), ['email', 'senha']) || !is_string($input['email'] ?? null) || strlen($input['email']) > 190 || !filter_var($input['email'], FILTER_VALIDATE_EMAIL)
            || !is_string($input['senha'] ?? null) || strlen($input['senha']) < 1 || strlen($input['senha']) > 72) {
            throw new HttpException(400, 'Informe e-mail e senha válidos.');
        }
        // Usa o custo padrão desta instalação, sem pular password_verify para contas inexistentes.
        $dummyHash = password_hash('credencial-interna-sem-conta', PASSWORD_DEFAULT);
        $user = $this->users->byEmail($input['email']);
        $hash = $user['senha_hash'] ?? $dummyHash;
        $valid = password_verify($input['senha'], $hash);
        if (!$user || !$valid || !(bool) $user['ativo']) { throw new HttpException(401, 'Credenciais inválidas.'); }
        $this->limiter?->success($origin, $input['email']);
        $ttl = (int) App::env('TOKEN_TTL_SECONDS', '28800');
        if ($ttl < 60 || $ttl > 86400) { throw new \RuntimeException('TTL inválido.'); }
        $token = bin2hex(random_bytes(32));
        $expires = gmdate('Y-m-d H:i:s', time() + $ttl);
        $this->tokens->create((int) $user['id'], hash('sha256', $token), $expires);
        return ['access_token' => $token, 'token_type' => 'Bearer', 'expires_in' => $ttl, 'usuario' => Usuario::publicData($user)];
    }
    public function authenticate(string $token): array
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $token)) { throw new HttpException(401, 'Autenticação necessária.'); }
        return $this->tokens->user(hash('sha256', $token)) ?? throw new HttpException(401, 'Token inválido ou expirado.');
    }
    public function logout(string $token): void { $this->tokens->revoke(hash('sha256', $token)); }
}
