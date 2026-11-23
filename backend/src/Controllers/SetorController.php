<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\{Controller, Response};
use App\Middleware\AuthMiddleware;
use App\Services\SetorService;

final class SetorController extends Controller
{
    public function __construct(private SetorService $sectors, private AuthMiddleware $auth) {}
    public function index(): void { Response::success(['items' => $this->sectors->list($this->auth->user(['admin']), $_GET)]); }
    public function create(): void { Response::success($this->sectors->save($this->auth->user(['admin']), $this->input()), 'Setor criado.', 201); }
    public function update(int $id): void { Response::success($this->sectors->save($this->auth->user(['admin']), $this->input(), $id), 'Setor atualizado.'); }
}
