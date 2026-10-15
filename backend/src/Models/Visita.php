<?php
declare(strict_types=1);
namespace App\Models;
use App\Core\HttpException;

final class Visita
{
    public const TEXT = ['contato' => 150, 'empresa' => 180, 'assunto' => 200, 'descricao' => 10000];
    public static function validate(array $data, bool $creating): array
    {
        $allowed = $creating ? [...array_keys(self::TEXT), 'latitude', 'longitude', 'precisao_gps', 'gps_capturado_em', 'responsavel_id', 'agendamento_id'] : [...array_keys(self::TEXT), 'status'];
        $errors = [];
        foreach (array_diff(array_keys($data), $allowed) as $key) { $errors[$key] = 'Campo não permitido.'; }
        if (!$creating && !$data) { $errors['body'] = 'Informe ao menos um campo.'; }
        foreach (self::TEXT as $field => $max) {
            if (!$creating && !array_key_exists($field, $data)) { continue; }
            if (!is_string($data[$field] ?? null) || trim($data[$field]) === '' || mb_strlen($data[$field], 'UTF-8') > $max) {
                $errors[$field] = "Informe um texto obrigatório de até {$max} caracteres.";
            } else { $data[$field] = trim($data[$field]); }
        }
        if ($creating) {
            if (array_key_exists('agendamento_id', $data) && (!is_int($data['agendamento_id']) || $data['agendamento_id'] < 1 || $data['agendamento_id'] > 4294967295)) { $errors['agendamento_id'] = 'Agendamento inválido.'; }
            if (!is_int($data['gps_capturado_em'] ?? null) || $data['gps_capturado_em'] < 1) { $errors['gps_capturado_em'] = 'Informe o timestamp de captura do GPS em milissegundos.'; }
            foreach (['latitude' => [-90, 90], 'longitude' => [-180, 180], 'precisao_gps' => [0, 999999.99]] as $field => [$min, $max]) {
                $value = $data[$field] ?? null;
                if ((!is_int($value) && !is_float($value)) || !is_finite((float) $value) || $value < $min || $value > $max) { $errors[$field] = 'Número fora do intervalo permitido.'; }
            }
            $id = $data['responsavel_id'] ?? null;
            if (!is_int($id) || $id < 1 || $id > 4294967295) { $errors['responsavel_id'] = 'Informe um responsável válido.'; }
        }
        if (isset($data['status']) && !in_array($data['status'], ['em_andamento', 'concluida'], true)) { $errors['status'] = 'Status inválido.'; }
        if (array_key_exists('status', $data) && $data['status'] === null) { $errors['status'] = 'Status inválido.'; }
        if ($errors) { throw new HttpException(400, 'Dados inválidos.', $errors); }
        return $data;
    }

    public static function canRead(array $user, array $visit): bool
    {
        return $user['perfil'] === 'admin'
            || ($user['perfil'] === 'funcionario' && (int) $visit['usuario_id'] === (int) $user['id'])
            || ($user['perfil'] === 'responsavel' && (int) $visit['responsavel_id'] === (int) $user['id']);
    }
}
