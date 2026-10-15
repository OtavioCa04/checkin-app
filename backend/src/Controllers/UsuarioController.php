<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\{Controller, Response, Pagination};
use App\Middleware\AuthMiddleware;
use App\Models\Usuario;
use App\Repositories\UsuarioRepository;

final class UsuarioController extends Controller
{
    public function __construct(private UsuarioRepository $users, private AuthMiddleware $auth, private ?\App\Services\UsuarioService $service = null) {}
    public function index(): void
    {
        $this->auth->user(['admin']);
        [$limit, $offset] = Pagination::read($_GET);
        Response::success(['items' => array_map([Usuario::class, 'publicData'], $this->users->list($limit, $offset)), 'limit' => $limit, 'offset' => $offset]);
    }
    public function responsaveis(): void
    {
        $this->auth->user(['funcionario']);
        Response::success($this->users->activeResponsibles());
    }
    public function create(): void
    {
        $actor = $this->auth->user(['admin']);
        Response::success($this->service->save($actor, $this->input()), 'Usuário criado.', 201);
    }
    public function update(int $id): void
    {
        $actor = $this->auth->user(['admin']);
        Response::success($this->service->save($actor, $this->input(), $id), 'Usuário atualizado.');
    }
}
