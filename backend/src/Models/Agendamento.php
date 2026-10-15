<?php
declare(strict_types=1);
namespace App\Models;
use App\Core\HttpException;

final class Agendamento
{
    public static function date(mixed $value, bool $future = false): string
    {
        $date = is_string($value) ? \DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z', $value, new \DateTimeZone('UTC')) : false;
        if (!$date || $date->format('Y-m-d\TH:i:s\Z') !== $value || $date->format('Y') < '1000' || ($future && $date->getTimestamp() <= time())) {
            throw new HttpException(400, 'Data inválida.', ['data_hora_prevista' => $future ? 'Informe uma data futura em UTC (YYYY-MM-DDTHH:mm:ssZ).' : 'Use UTC no formato YYYY-MM-DDTHH:mm:ssZ.']);
        }
        return $date->format('Y-m-d H:i:s');
    }
    public static function create(array $input): array
    {
        $allowed = ['empresa', 'contato', 'assunto', 'observacoes', 'usuario_id', 'responsavel_id', 'data_hora_prevista'];
        $errors = [];
        foreach (array_diff(array_keys($input), $allowed) as $key) { $errors[$key] = 'Campo não permitido.'; }
        foreach (['empresa' => 180, 'contato' => 150, 'assunto' => 200, 'observacoes' => 10000] as $key => $max) {
            $value = $input[$key] ?? ($key === 'observacoes' ? '' : null);
            if (!is_string($value) || mb_strlen($value, 'UTF-8') > $max || ($key !== 'observacoes' && trim($value) === '')) { $errors[$key] = "Informe texto de até {$max} caracteres."; }
            else { $input[$key] = trim($value); }
        }
        foreach (['usuario_id', 'responsavel_id'] as $key) {
            if (!is_int($input[$key] ?? null) || $input[$key] < 1 || $input[$key] > 4294967295) { $errors[$key] = 'Informe um identificador numérico válido.'; }
        }
        if ($errors) { throw new HttpException(400, 'Dados inválidos.', $errors); }
        $input['data_hora_prevista'] = self::date($input['data_hora_prevista'] ?? null, true);
        return $input;
    }
    public static function change(array $input): array
    {
        $action = $input['acao'] ?? null;
        $allowed = $action === 'reagendar' ? ['acao', 'motivo', 'data_hora_prevista'] : ['acao', 'motivo'];
        if (!in_array($action, ['reagendar', 'cancelar'], true) || array_diff(array_keys($input), $allowed)) { throw new HttpException(400, 'Ação ou campos inválidos.'); }
        if (!is_string($input['motivo'] ?? null) || trim($input['motivo']) === '' || mb_strlen($input['motivo'], 'UTF-8') > 1000) { throw new HttpException(400, 'Informe o motivo.', ['motivo' => 'Motivo obrigatório, até 1000 caracteres.']); }
        $input['motivo'] = trim($input['motivo']);
        if ($action === 'reagendar') { $input['data_hora_prevista'] = self::date($input['data_hora_prevista'] ?? null, true); }
        return $input;
    }
    public static function canRead(array $user, array $item): bool { return Visita::canRead($user, $item); }
    public static function canManage(array $user, array $item): bool
    {
        return $user['perfil'] === 'admin' || ($user['perfil'] === 'funcionario' && (int) $user['id'] === (int) $item['usuario_id']);
    }
}
