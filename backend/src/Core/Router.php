<?php
declare(strict_types=1);
namespace App\Core;

final class Router
{
    private array $routes = [];
    public function add(string $method, string $path, callable $handler): void
    {
        $pattern = '#^' . str_replace('\\{id\\}', '([1-9][0-9]{0,9})', preg_quote($path, '#')) . '$#';
        $this->routes[] = [$method, $pattern, $handler];
    }

    public function dispatch(string $method, string $path): void
    {
        $allowed = [];
        foreach ($this->routes as [$verb, $pattern, $handler]) {
            if (!preg_match($pattern, $path, $matches)) { continue; }
            $allowed[] = $verb;
            if ($method === $verb) {
                $handler(...array_map('intval', array_slice($matches, 1)));
                return;
            }
        }
        if ($allowed) { header('Allow: ' . implode(', ', array_unique($allowed))); }
        throw new HttpException($allowed ? 405 : 404, $allowed ? 'Método não permitido.' : 'Rota não encontrada.');
    }
}
