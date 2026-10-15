<?php
declare(strict_types=1);

use App\Config\App;
use App\Core\{Router, Response, HttpException};

// O servidor embutido sempre encaminha para este arquivo; não serve arquivos privados.
try {
    require dirname(__DIR__) . '/bootstrap.php';
    App::cors();
    $router = new Router();
    (require dirname(__DIR__) . '/routes/api.php')($router);
    $router->dispatch($_SERVER['REQUEST_METHOD'], parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
} catch (HttpException $e) {
    foreach ($e->headers as $name => $value) { header($name . ': ' . $value); }
    Response::error($e->getMessage(), $e->status, $e->errors);
} catch (Throwable $e) {
    // Não registra corpo, cabeçalhos, SQL ou mensagem de exceção com possíveis segredos.
    @error_log('Falha interna: ' . get_class($e) . ' em ' . basename($e->getFile()) . ':' . $e->getLine());
    if (class_exists(Response::class)) { Response::error('Erro interno do servidor.', 500); }
    else {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo '{"success":false,"message":"Backend indisponível. Instale as dependências.","errors":{}}';
    }
}
