<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\{Controller, Response};
use App\Middleware\AuthMiddleware;
use App\Services\EmpresaService;

final class EmpresaController extends Controller
{
    public function __construct(private EmpresaService $companies, private AuthMiddleware $auth) {}
    public function index(): void { Response::success(['items' => $this->companies->list($this->auth->user())]); }
    public function create(): void { Response::success($this->companies->create($this->auth->user(), $this->input()), 'Empresa criada.', 201); }
    public function update(int $id): void { Response::success($this->companies->update($this->auth->user(), $id, $this->input()), 'Empresa atualizada.'); }
}
