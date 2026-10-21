<?php
declare(strict_types=1);
namespace App\Models;
use App\Core\HttpException;

final class Resultado
{
    public const FIELDS = ['resultado','resumo_resultado','proximo_passo','data_retorno'];
    public static function day(mixed $value): string
    {
        $date=is_string($value)?\DateTimeImmutable::createFromFormat('!Y-m-d',$value,new \DateTimeZone('UTC')):false;
        if (!$date || $date->format('Y-m-d')!==$value || $date->format('Y')<'1000') { throw new HttpException(400,'Data inválida.',['data_retorno'=>'Use uma data válida YYYY-MM-DD, sem horário.']); }
        return $value;
    }
    public static function validate(array $input): array
    {
        if (($input['status']??null)!=='concluida') {
            if (array_intersect(array_keys($input), self::FIELDS)) { throw new HttpException(400,'Registre o resultado junto da conclusão.'); }
            return [];
        }
        $errors=[];
        if (!in_array($input['resultado']??null,['realizada','sem_contato','reagendar','cancelada'],true)) { $errors['resultado']='Selecione o resultado do encontro.'; }
        foreach (['resumo_resultado'=>true,'proximo_passo'=>false] as $key=>$required) {
            $value=$input[$key]??'';
            if (!is_string($value) || mb_strlen($value,'UTF-8')>10000 || ($required && trim($value)==='')) { $errors[$key]='Informe um texto de até 10000 caracteres.'; }
        }
        if ($errors) { throw new HttpException(400,'Dados inválidos.',$errors); }
        return ['resultado'=>$input['resultado'],'resumo_resultado'=>trim($input['resumo_resultado']),'proximo_passo'=>trim($input['proximo_passo']??''),'data_retorno'=>isset($input['data_retorno'])&&$input['data_retorno']!==''?self::day($input['data_retorno']):null];
    }
}
