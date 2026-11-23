<?php
declare(strict_types=1);

// Entrada da API quando o app e a API ficam no mesmo endereço (https://seudominio/api).
// Esta pasta vai para public_html/api; o backend fica fora da pasta pública, ao lado de public_html:
//   domains/seudominio/public_html/api/index.php  ->  domains/seudominio/backend/public/index.php
require dirname(__DIR__, 2) . '/backend/public/index.php';
