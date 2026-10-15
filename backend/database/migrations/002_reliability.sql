CREATE TABLE visita_requests (
    usuario_id INT UNSIGNED NOT NULL,
    chave VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    resposta JSON NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, chave),
    CONSTRAINT fk_request_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE login_limits (
    chave CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    tentativas INT UNSIGNED NOT NULL DEFAULT 0,
    inicio BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB;

CREATE TABLE user_management_lock (
    id TINYINT UNSIGNED PRIMARY KEY
) ENGINE=InnoDB;
INSERT INTO user_management_lock (id) VALUES (1);
