<?php
declare(strict_types=1);
namespace App\Models;

final class Usuario
{
    public const PERFIS = ['funcionario', 'responsavel', 'admin'];
    public static function publicData(array $row): array
    {
        return ['id' => (int) $row['id'], 'nome' => $row['nome'], 'email' => $row['email'], 'perfil' => $row['perfil'], 'ativo' => (bool) $row['ativo']];
    }
}
