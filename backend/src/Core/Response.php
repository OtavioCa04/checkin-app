<?php
declare(strict_types=1);
namespace App\Core;

final class Response
{
    public static function success(mixed $data = null, string $message = 'Operação realizada.', int $status = 200): void
    {
        self::send(['success' => true, 'message' => $message, 'data' => $data], $status);
    }

    public static function error(string $message, int $status, array $errors = []): void
    {
        self::send(['success' => false, 'message' => $message, 'errors' => (object) $errors], $status);
    }

    private static function send(array $body, int $status): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}
