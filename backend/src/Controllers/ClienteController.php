<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\{Controller,Response,Pagination};
use App\Middleware\AuthMiddleware;
use App\Services\ClienteService;

final class ClienteController extends Controller
{
    public function __construct(private ClienteService $clients,private AuthMiddleware $auth){}
    public function index():void{$u=$this->auth->user();[$l,$o]=Pagination::read($_GET);Response::success(['items'=>$this->clients->list($u,$l,$o,$_GET),'limit'=>$l,'offset'=>$o]);}
    public function show(int $id):void{Response::success($this->clients->find($this->auth->user(),$id));}
    public function create():void{Response::success($this->clients->save($this->auth->user(),$this->input()),'Cliente cadastrado.',201);}
    public function update(int $id):void{Response::success($this->clients->save($this->auth->user(),$this->input(),$id),'Cliente atualizado.');}
    public function access(int $id):void{Response::success($this->clients->access($this->auth->user(),$id,$this->input()),'Acesso atualizado.');}
    public function contacts(int $id):void{$u=$this->auth->user();[$l,$o]=Pagination::read($_GET);Response::success(['items'=>$this->clients->contacts($u,$id,$l,$o,$_GET),'limit'=>$l,'offset'=>$o]);}
    public function createContact(int $id):void{Response::success($this->clients->saveContact($this->auth->user(),$this->input(),$id),'Contato cadastrado.',201);}
    public function updateContact(int $id):void{Response::success($this->clients->saveContact($this->auth->user(),$this->input(),null,$id),'Contato atualizado.');}
    public function visits(int $id):void{$this->history($id,'visitas');}
    public function agenda(int $id):void{$this->history($id,'agendamentos');}
    private function history(int $id,string $kind):void{$u=$this->auth->user();[$l,$o]=Pagination::read($_GET);Response::success(['items'=>$this->clients->history($u,$id,$kind,$l,$o),'limit'=>$l,'offset'=>$o]);}
}
