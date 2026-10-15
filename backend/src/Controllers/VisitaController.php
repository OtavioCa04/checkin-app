<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\{Controller, Response, Pagination};
use App\Middleware\AuthMiddleware;
use App\Services\VisitaService;

final class VisitaController extends Controller
{
    public function __construct(private VisitaService $visits, private AuthMiddleware $auth) {}
    public function create(): void
    {
        $user = $this->auth->user(['funcionario']);
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
}
