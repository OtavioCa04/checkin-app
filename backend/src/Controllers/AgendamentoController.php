<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\{Controller, Response, Pagination};
use App\Middleware\AuthMiddleware;
use App\Services\AgendamentoService;

final class AgendamentoController extends Controller
{
    public function __construct(private AgendamentoService $items, private AuthMiddleware $auth) {}
    public function index(): void
    {
        $user = $this->auth->user(); [$limit, $offset] = Pagination::read($_GET);
        Response::success(['items' => $this->items->list($user, $limit, $offset, $_GET), 'limit' => $limit, 'offset' => $offset]);
    }
    public function show(int $id): void { Response::success($this->items->find($this->auth->user(), $id)); }
    public function options(): void { Response::success($this->items->options($this->auth->user())); }
    public function create(): void { Response::success($this->items->create($this->auth->user(), $this->input()), 'Agendamento criado.', 201); }
    public function update(int $id): void { Response::success($this->items->update($this->auth->user(), $id, $this->input()), 'Agendamento atualizado.'); }
}
