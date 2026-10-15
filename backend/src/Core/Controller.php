<?php
declare(strict_types=1);
namespace App\Core;

abstract class Controller
{
    protected function input(): array
    {
        $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
        if ($type !== 'application/json') { throw new HttpException(415, 'Envie application/json.'); }
        $raw = file_get_contents('php://input', false, null, 0, 65537);
        if ($raw === false || strlen($raw) > 65536) { throw new HttpException(413, 'Corpo da requisição muito grande.'); }
        try { $data = json_decode($raw, false, 32, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { throw new HttpException(400, 'JSON inválido.'); }
        if (!$data instanceof \stdClass) { throw new HttpException(400, 'Envie um objeto JSON.'); }
        return (array) $data;
    }
}
