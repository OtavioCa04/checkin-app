<?php
declare(strict_types=1);
namespace App\Core;

final class Pagination
{
    public static function read(array $query): array
    {
        $limit = filter_var($query['limit'] ?? 20, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 100]]);
        $offset = filter_var($query['offset'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 1000000]]);
        if ($limit === false || $offset === false) { throw new HttpException(400, 'Paginação inválida.'); }
        return [$limit, $offset];
    }
}
