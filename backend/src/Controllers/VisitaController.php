<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\{Controller, Response, Pagination};
use App\Middleware\AuthMiddleware;
use App\Models\Visita;
use App\Services\VisitaService;

final class VisitaController extends Controller
{
    public function __construct(private VisitaService $visits, private AuthMiddleware $auth) {}
    public function create(): void
    {
        $user = $this->auth->user(Visita::PERFIS_CAMPO);
        Response::success($this->visits->create($user, $this->input(), $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? ''), 'Visita criada com sucesso.', 201);
    }
    public function index(): void
    {
        $user = $this->auth->user();
        [$limit, $offset] = Pagination::read($_GET);
        Response::success(['items' => $this->visits->list($user, $limit, $offset, $_GET), 'limit' => $limit, 'offset' => $offset]);
    }
    public function show(int $id): void { Response::success($this->visits->find($this->auth->user(), $id)); }
    public function update(int $id): void
    {
        $user = $this->auth->user();
        Response::success($this->visits->update($user, $id, $this->input()), 'Visita atualizada.');
    }
    public function uploadPhoto(int $id): void
    {
        $user = $this->auth->user(Visita::PERFIS_CAMPO);
        $file = $_FILES['foto'] ?? null;
        // Corpo acima de post_max_size chega sem $_FILES: trata como foto grande demais.
        if ($file === null && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) { throw new \App\Core\HttpException(413, 'Foto muito grande.', ['foto' => 'Envie uma foto de até 5 MB.']); }
        $error = is_array($file) ? (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) : UPLOAD_ERR_NO_FILE;
        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) { throw new \App\Core\HttpException(413, 'Foto muito grande.', ['foto' => 'Envie uma foto de até 5 MB.']); }
        if ($error !== UPLOAD_ERR_OK || !is_string($file['tmp_name'] ?? null) || !is_uploaded_file($file['tmp_name'])) { throw new \App\Core\HttpException(400, 'Envie uma foto.', ['foto' => 'Campo foto ausente ou inválido.']); }
        Response::success($this->visits->savePhoto($user, $id, $file['tmp_name'], (int) $file['size']), 'Foto enviada.', 201);
    }
    public function photo(int $id): void
    {
        $photo = $this->visits->photo($this->auth->user(), $id);
        Response::file($photo['path'], $photo['tipo']);
    }
}
