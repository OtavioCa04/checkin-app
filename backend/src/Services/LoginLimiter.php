<?php
declare(strict_types=1);
namespace App\Services;
use App\Config\App;
use App\Core\HttpException;
use PDO;

final class LoginLimiter
{
    public function __construct(private PDO $db) {}
    public static function origin(array $server): string
    {
        $remote = $server['REMOTE_ADDR'] ?? '';
        if (!filter_var($remote, FILTER_VALIDATE_IP)) { return 'unknown'; }
        $trusted = array_filter(array_map('trim', explode(',', App::env('TRUSTED_PROXIES'))));
        if (!in_array($remote, $trusted, true) || empty($server['HTTP_X_FORWARDED_FOR'])) { return $remote; }
        $chain = array_map('trim', explode(',', $server['HTTP_X_FORWARDED_FOR']));
        foreach ($chain as $ip) { if (!filter_var($ip, FILTER_VALIDATE_IP)) { return $remote; } }
        $chain[] = $remote;
        for ($i = count($chain) - 1; $i > 0; $i--) { if (!in_array($chain[$i], $trusted, true)) { return $chain[$i]; } }
        return $chain[0];
    }
    public function consume(string $origin, string $identifier): void
    {
        $window = (int) App::env('LOGIN_WINDOW_SECONDS', '900');
        $ipLimit = (int) App::env('LOGIN_IP_LIMIT', '30');
        $accountLimit = (int) App::env('LOGIN_ACCOUNT_LIMIT', '10');
        if ($window < 1 || $window > 86400 || $ipLimit < 1 || $accountLimit < 1) { throw new \RuntimeException('Limites inválidos.'); }
        $buckets = [self::ipKey($origin) => $ipLimit, self::accountKey($identifier) => $accountLimit];
        ksort($buckets);
        $now = time(); $retry = 0; $rows = [];
        $this->db->beginTransaction();
        try {
            foreach ($buckets as $key => $limit) {
                $q = $this->db->prepare('INSERT INTO login_limits (chave, inicio) VALUES (?, ?) ON DUPLICATE KEY UPDATE chave = chave');
                $q->execute([$key, $now]);
                $q = $this->db->prepare('SELECT tentativas, inicio FROM login_limits WHERE chave = ? FOR UPDATE');
                $q->execute([$key]); $row = $q->fetch();
                if ($now - (int) $row['inicio'] >= $window) { $row = ['tentativas' => 0, 'inicio' => $now]; }
                $rows[$key] = $row;
                if ((int) $row['tentativas'] >= $limit) { $retry = max($retry, $window - ($now - (int) $row['inicio'])); }
            }
            if (!$retry) {
                foreach ($rows as $key => $row) {
                    $q = $this->db->prepare('UPDATE login_limits SET tentativas = ?, inicio = ? WHERE chave = ?');
                    $q->execute([(int) $row['tentativas'] + 1, $row['inicio'], $key]);
                }
            }
            $this->db->commit();
        } catch (\Throwable $e) { if ($this->db->inTransaction()) { $this->db->rollBack(); } throw $e; }
        if ($retry) { throw new HttpException(429, 'Muitas tentativas. Aguarde antes de entrar novamente.', [], ['Retry-After' => (string) max(1, $retry)]); }
    }
    // Login correto não consome cota: zera a conta e devolve ao IP a tentativa contada em consume().
    public function success(string $origin, string $identifier): void
    {
        $q = $this->db->prepare('UPDATE login_limits SET tentativas = 0 WHERE chave = ?');
        $q->execute([self::accountKey($identifier)]);
        $q = $this->db->prepare('UPDATE login_limits SET tentativas = GREATEST(tentativas - 1, 0) WHERE chave = ?');
        $q->execute([self::ipKey($origin)]);
    }
    private static function ipKey(string $origin): string { return hash('sha256', 'ip:' . $origin); }
    private static function accountKey(string $identifier): string { return hash('sha256', 'account:' . mb_strtolower(trim($identifier), 'UTF-8')); }
}
