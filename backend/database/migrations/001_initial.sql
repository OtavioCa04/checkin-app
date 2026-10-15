CREATE TABLE usuarios (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(190) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    perfil ENUM('funcionario','responsavel','admin') NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_usuarios_email (email),
    CONSTRAINT chk_usuarios_ativo CHECK (ativo IN (0,1)),
    INDEX idx_usuarios_perfil_ativo (perfil, ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE visitas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT UNSIGNED NOT NULL,
    responsavel_id INT UNSIGNED NOT NULL,
    data_hora_checkin DATETIME NOT NULL,
    data_hora_checkout DATETIME NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    precisao_gps DECIMAL(8,2) NOT NULL,
    contato VARCHAR(150) NOT NULL,
    empresa VARCHAR(180) NOT NULL,
    assunto VARCHAR(200) NOT NULL,
    descricao TEXT NOT NULL,
    status ENUM('em_andamento','concluida') NOT NULL DEFAULT 'em_andamento',
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_visitas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT fk_visitas_responsavel FOREIGN KEY (responsavel_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_longitude CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_precisao CHECK (precisao_gps >= 0),
    CONSTRAINT chk_checkout CHECK ((status = 'em_andamento' AND data_hora_checkout IS NULL) OR (status = 'concluida' AND data_hora_checkout IS NOT NULL AND data_hora_checkout >= data_hora_checkin)),
    INDEX idx_visitas_usuario_checkin (usuario_id, data_hora_checkin),
    INDEX idx_visitas_responsavel_checkin (responsavel_id, data_hora_checkin),
    INDEX idx_visitas_status_checkin (status, data_hora_checkin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT UNSIGNED NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expira_em DATETIME NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_token_hash (token_hash),
    INDEX idx_token_expira (expira_em),
    CONSTRAINT fk_token_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
