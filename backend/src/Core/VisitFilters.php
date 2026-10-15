<?php
declare(strict_types=1);
namespace App\Core;

final class VisitFilters
{
    public static function read(array $query, string $role): array
    {
        $data = array_diff_key($query, array_flip(['limit', 'offset']));
        $allowed = ['inicio', 'fim', 'status', 'empresa', 'funcionario_id'];
        if (array_diff(array_keys($data), $allowed)) { throw new HttpException(400, 'Filtro desconhecido.'); }
        foreach (['inicio', 'fim'] as $key) {
            if (!isset($data[$key]) || $data[$key] === '') { unset($data[$key]); continue; }
            $date = is_string($data[$key]) ? \DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z', $data[$key], new \DateTimeZone('UTC')) : false;
            if (!$date || $date->format('Y-m-d\TH:i:s\Z') !== $data[$key]) { throw new HttpException(400, 'Período inválido. Use instantes UTC no formato YYYY-MM-DDTHH:mm:ssZ.'); }
            $data[$key] = $date->format('Y-m-d H:i:s');
        }
        if (isset($data['inicio'], $data['fim']) && $data['inicio'] >= $data['fim']) { throw new HttpException(400, 'O fim deve ser posterior ao início.'); }
        foreach (['status', 'empresa', 'funcionario_id'] as $key) { if (($data[$key] ?? null) === '') { unset($data[$key]); } }
        if (isset($data['status']) && !in_array($data['status'], ['em_andamento', 'concluida'], true)) { throw new HttpException(400, 'Status inválido.'); }
        if (isset($data['empresa'])) {
            if (!is_string($data['empresa']) || mb_strlen($data['empresa'], 'UTF-8') > 180) { throw new HttpException(400, 'Empresa inválida.'); }
            $data['empresa'] = trim($data['empresa']);
        }
        if (array_key_exists('funcionario_id', $data)) {
            if ($role !== 'admin') { throw new HttpException(403, 'Filtro por funcionário disponível apenas para administradores.'); }
            $id = filter_var($data['funcionario_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 4294967295]]);
            if ($id === false) { throw new HttpException(400, 'Funcionário inválido.'); }
            $data['funcionario_id'] = $id;
        }
        return $data;
    }
}
