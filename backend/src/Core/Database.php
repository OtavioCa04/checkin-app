<?php
declare(strict_types=1);
namespace App\Core;
use App\Config\App;
use PDO;

final class Database
{
    private static ?PDO $connection = null;
    public static function connection(): PDO
    {
        if (self::$connection === null) {
            self::$connection = new PDO(
                'mysql:host=' . App::env('DB_HOST', '127.0.0.1') . ';port=' . App::env('DB_PORT', '3306') . ';dbname=' . App::env('DB_DATABASE') . ';charset=utf8mb4',
                App::env('DB_USERNAME'), App::env('DB_PASSWORD'),
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
            );
            self::$connection->exec("SET time_zone = '+00:00'");
        }
        return self::$connection;
    }
}
