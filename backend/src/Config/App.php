<?php
declare(strict_types=1);
namespace App\Config;

final class App
{
    public static function env(string $key, string $default = ''): string
    {
        return (string) ($_ENV[$key] ?? getenv($key) ?: $default);
    }

    public static function cors(): void
    {
        $origins = array_values(array_filter(array_map('trim', explode(',', self::env('CORS_ORIGINS')))));
        if (in_array('*', $origins, true)) { throw new \RuntimeException('CORS exige origens explícitas.'); }
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        header('Vary: Origin');
        if ($origin !== '' && !in_array($origin, $origins, true)) {
            throw new \App\Core\HttpException(403, 'Origem não permitida.');
        }
        if ($origin !== '') {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
            header('Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key');
            header('Access-Control-Expose-Headers: Retry-After');
        }
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
    }
}
