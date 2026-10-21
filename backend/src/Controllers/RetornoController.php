<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Core\{Controller,Response,Pagination};
use App\Middleware\AuthMiddleware;
use App\Services\RetornoService;

final class RetornoController extends Controller
{
    public function __construct(private RetornoService $items,private AuthMiddleware $auth){}
    public function index():void{$u=$this->auth->user();[$l,$o]=Pagination::read($_GET);Response::success(['items'=>$this->items->list($u,$l,$o,$_GET),'limit'=>$l,'offset'=>$o]);}
    public function show(int $id):void{Response::success($this->items->find($this->auth->user(),$id));}
    public function update(int $id):void{Response::success($this->items->update($this->auth->user(),$id,$this->input()),'Retorno encerrado.');}
    public function schedule(int $id):void{Response::success($this->items->schedule($this->auth->user(),$id,$this->input()),'Agendamento do retorno disponível.',201);}
}
