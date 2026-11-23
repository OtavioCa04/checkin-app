<?php
declare(strict_types=1);
namespace App\Models;

final class Usuario
{
    public const PERFIS = ['funcionario', 'admin'];
    public static function publicData(array $row): array
    {
        $setor = isset($row['setor_id']) ? (int) $row['setor_id'] : null;
        return ['id' => (int) $row['id'], 'nome' => $row['nome'], 'email' => $row['email'], 'perfil' => $row['perfil'], 'ativo' => (bool) $row['ativo'], 'setor_id' => $setor, 'setor_nome' => $setor === null ? null : ($row['setor_nome'] ?? null)];
    }
}
