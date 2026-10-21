<?php
declare(strict_types=1);
namespace App\Models;
use App\Core\HttpException;

final class Cliente
{
    public const TEXT = ['nome_empresa'=>180, 'nome_fantasia'=>180, 'cep'=>8, 'logradouro'=>200, 'numero'=>30, 'complemento'=>150, 'bairro'=>100, 'cidade'=>100, 'uf'=>2, 'pais'=>100, 'observacoes'=>10000];
    public static function cnpj(mixed $input): ?string
    {
        if ($input === null || $input === '') { return null; }
        if (!is_string($input)) { throw new HttpException(400, 'CNPJ inválido.', ['cnpj'=>'Informe CNPJ válido ou deixe vazio.']); }
        $value = strtoupper(trim($input));
        if ($value==='') { return null; }
        if (preg_match('/^[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-[0-9]{2}$/D', $value)) { $value = str_replace(['.','/','-'], '', $value); }
        $valid = (bool) preg_match('/^[A-Z0-9]{12}[0-9]{2}$/D', $value) && !preg_match('/^(\d)\1{13}$/D', $value);
        if ($valid) {
            for ($length=12; $length<=13; $length++) {
                $sum=0; $weight=2;
                for ($i=$length-1; $i>=0; $i--) { $sum+=(ord($value[$i])-48)*$weight; $weight=$weight===9?2:$weight+1; }
                $rest=$sum%11; $digit=$rest<2?0:11-$rest;
                if ((int)$value[$length] !== $digit) { $valid=false; break; }
            }
        }
        if (!$valid) { throw new HttpException(400, 'CNPJ inválido.', ['cnpj'=>'Verifique os 14 caracteres e os dígitos verificadores.']); }
        return $value;
    }
    public static function validate(array $data, bool $creating, bool $contact = false): array
    {
        $text = $contact ? ['nome'=>150,'cargo'=>120,'email'=>190,'telefone'=>40] : self::TEXT;
        $allowed = [...array_keys($text), 'ativo', ...($contact?['principal']:['cnpj'])]; $errors=[];
        foreach (array_diff(array_keys($data), $allowed) as $key) { $errors[$key]='Campo não permitido.'; }
        if (!$creating && !$data) { $errors['body']='Informe ao menos um campo.'; }
        foreach ($text as $key=>$max) {
            if (!$creating && !array_key_exists($key,$data)) { continue; }
            $value=$data[$key]??'';
            if (!is_string($value) || mb_strlen($value,'UTF-8')>$max || (in_array($key,['nome','nome_empresa'],true)&&trim($value)==='')) { $errors[$key]="Informe texto de até {$max} caracteres."; }
            else { $data[$key]=trim($value); }
        }
        foreach ($contact?['ativo'=>true,'principal'=>false]:['ativo'=>true] as $key=>$default) {
            if ($creating && !array_key_exists($key,$data)) { $data[$key]=$default; }
            if (array_key_exists($key,$data) && !is_bool($data[$key])) { $errors[$key]='Informe verdadeiro ou falso.'; }
        }
        if (isset($data['email']) && $data['email']!=='' && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) { $errors['email']='E-mail inválido.'; }
        if (isset($data['cep']) && $data['cep']!=='' && !preg_match('/^[0-9]{8}$/D',$data['cep'])) { $errors['cep']='Informe 8 dígitos, sem máscara.'; }
        if (isset($data['uf']) && $data['uf']!=='' && !preg_match('/^[A-Za-z]{2}$/D',$data['uf'])) { $errors['uf']='Informe uma UF com duas letras.'; }
        if ($errors) { throw new HttpException(400,'Dados inválidos.',$errors); }
        if (isset($data['uf'])) { $data['uf']=strtoupper($data['uf']); }
        if (!$contact && ($creating || array_key_exists('cnpj',$data))) { $data['cnpj']=self::cnpj($data['cnpj']??null); }
        return $data;
    }
    public static function links(array $data): void
    {
        foreach (['cliente_id','contato_id'] as $key) {
            if (array_key_exists($key,$data) && (!is_int($data[$key]) || $data[$key]<1 || $data[$key]>4294967295)) { throw new HttpException(400,'Vínculo inválido.',[$key=>'Informe um ID numérico positivo.']); }
        }
        if (isset($data['contato_id']) && !isset($data['cliente_id'])) { throw new HttpException(400,'Selecione o cliente do contato.'); }
    }
}
