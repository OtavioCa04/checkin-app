<?php
declare(strict_types=1);
namespace App\Models;
use App\Core\HttpException;

final class Visita
{
    public const TEXT = ['contato' => 150, 'empresa' => 180, 'assunto' => 200, 'descricao' => 10000];
    public static function validate(array $data, bool $creating): array
    {
        $allowed = $creating ? [...array_keys(self::TEXT), 'local', 'agendamento_id', 'cliente_id', 'contato_id'] : [...array_keys(self::TEXT), 'status', ...Resultado::FIELDS];
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
            Cliente::links($data);
            if (array_key_exists('agendamento_id', $data) && (!is_int($data['agendamento_id']) || $data['agendamento_id'] < 1 || $data['agendamento_id'] > 4294967295)) { $errors['agendamento_id'] = 'Agendamento inválido.'; }
            // Local digitado pelo funcionário (endereço ou referência); substitui as coordenadas de GPS.
            if (!is_string($data['local'] ?? null) || trim($data['local']) === '' || mb_strlen($data['local'], 'UTF-8') > 255) { $errors['local'] = 'Informe o local da visita, até 255 caracteres.'; }
            else { $data['local'] = trim($data['local']); }
        }
        if (isset($data['status']) && !in_array($data['status'], ['em_andamento', 'concluida'], true)) { $errors['status'] = 'Status inválido.'; }
        if (array_key_exists('status', $data) && $data['status'] === null) { $errors['status'] = 'Status inválido.'; }
        if ($errors) { throw new HttpException(400, 'Dados inválidos.', $errors); }
        if (!$creating) { $data = [...$data, ...Resultado::validate($data)]; }
        return $data;
    }

    // Regra central de leitura de visitas, agendamentos e retornos:
    // nunca atravessa empresas, admin vê tudo da própria empresa e os demais só o que é deles.
    public static function canRead(array $user, array $visit): bool
    {
        if (!self::sameCompany($user, $visit)) { return false; }
        return $user['perfil'] === 'admin' || (int) $visit['usuario_id'] === (int) $user['id'];
    }
    public static function sameCompany(array $user, array $row): bool
    {
        return isset($user['empresa_id'], $row['empresa_id']) && (int) $user['empresa_id'] === (int) $row['empresa_id'];
    }
    /** Admin também vai a campo: faz check-in e recebe agendamentos. */
    public const PERFIS_CAMPO = ['funcionario', 'admin'];
}
