CREATE TABLE clientes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome_empresa VARCHAR(180) NOT NULL,
    nome_fantasia VARCHAR(180) NOT NULL DEFAULT '',
    cnpj CHAR(14) CHARACTER SET ascii COLLATE ascii_bin NULL,
    cep VARCHAR(8) NOT NULL DEFAULT '',
    logradouro VARCHAR(200) NOT NULL DEFAULT '',
    numero VARCHAR(30) NOT NULL DEFAULT '',
    complemento VARCHAR(150) NOT NULL DEFAULT '',
    bairro VARCHAR(100) NOT NULL DEFAULT '',
    cidade VARCHAR(100) NOT NULL DEFAULT '',
    uf VARCHAR(2) NOT NULL DEFAULT '',
    pais VARCHAR(100) NOT NULL DEFAULT '',
    observacoes TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_por INT UNSIGNED NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_cliente_cnpj UNIQUE (cnpj),
    CONSTRAINT chk_cliente_ativo CHECK (ativo IN (0,1)),
    FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
    INDEX idx_cliente_nome (nome_empresa),
    INDEX idx_cliente_situacao (ativo,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cliente_funcionarios (
    cliente_id INT UNSIGNED NOT NULL,
    usuario_id INT UNSIGNED NOT NULL,
    atribuido_por INT UNSIGNED NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cliente_id,usuario_id),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    FOREIGN KEY (atribuido_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
    INDEX idx_acesso_funcionario (usuario_id,cliente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contatos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT UNSIGNED NOT NULL,
    nome VARCHAR(150) NOT NULL,
    cargo VARCHAR(120) NOT NULL DEFAULT '',
    email VARCHAR(190) NOT NULL DEFAULT '',
    telefone VARCHAR(40) NOT NULL DEFAULT '',
    principal BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_por INT UNSIGNED NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    principal_cliente_id INT UNSIGNED GENERATED ALWAYS AS (CASE WHEN principal=1 AND ativo=1 THEN cliente_id ELSE NULL END) STORED,
    UNIQUE KEY uq_contato_principal (principal_cliente_id),
    UNIQUE KEY uq_contato_cliente (cliente_id,id),
    CONSTRAINT chk_contato_ativo CHECK (ativo IN (0,1)),
    CONSTRAINT chk_contato_principal CHECK (principal IN (0,1)),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
    FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
    INDEX idx_contato_cliente (cliente_id,ativo,nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE visitas
    ADD COLUMN cliente_id INT UNSIGNED NULL,
    ADD COLUMN contato_id INT UNSIGNED NULL,
    ADD COLUMN cadastro_snapshot JSON NULL,
    ADD COLUMN resultado ENUM('realizada','sem_contato','reagendar','cancelada') NULL,
    ADD COLUMN resumo_resultado TEXT NULL,
    ADD COLUMN proximo_passo TEXT NULL,
    ADD COLUMN data_retorno DATE NULL,
    ADD FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
    ADD FOREIGN KEY (contato_id) REFERENCES contatos(id) ON DELETE RESTRICT,
    ADD FOREIGN KEY (cliente_id,contato_id) REFERENCES contatos(cliente_id,id) ON DELETE RESTRICT,
    ADD CONSTRAINT chk_visita_contato_cliente CHECK (contato_id IS NULL OR cliente_id IS NOT NULL),
    ADD INDEX idx_visita_cliente_usuario (cliente_id,usuario_id),
    ADD INDEX idx_visita_cliente_responsavel (cliente_id,responsavel_id);

ALTER TABLE agendamentos
    ADD COLUMN cliente_id INT UNSIGNED NULL,
    ADD COLUMN contato_id INT UNSIGNED NULL,
    ADD COLUMN cadastro_snapshot JSON NULL,
    ADD FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
    ADD FOREIGN KEY (contato_id) REFERENCES contatos(id) ON DELETE RESTRICT,
    ADD FOREIGN KEY (cliente_id,contato_id) REFERENCES contatos(cliente_id,id) ON DELETE RESTRICT,
    ADD CONSTRAINT chk_agenda_contato_cliente CHECK (contato_id IS NULL OR cliente_id IS NOT NULL),
    ADD INDEX idx_agenda_cliente_usuario (cliente_id,usuario_id),
    ADD INDEX idx_agenda_cliente_responsavel (cliente_id,responsavel_id);

CREATE TABLE retornos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    visita_id INT UNSIGNED NOT NULL,
    data_prevista DATE NOT NULL,
    status ENUM('pendente','realizado','cancelado') NOT NULL DEFAULT 'pendente',
    encerrado_por INT UNSIGNED NULL,
    encerrado_em DATETIME NULL,
    observacao TEXT NULL,
    agendamento_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_retorno_visita (visita_id),
    CONSTRAINT chk_retorno_encerramento CHECK ((status='pendente' AND encerrado_por IS NULL AND encerrado_em IS NULL) OR (status<>'pendente' AND encerrado_por IS NOT NULL AND encerrado_em IS NOT NULL AND observacao IS NOT NULL)),
    FOREIGN KEY (visita_id) REFERENCES visitas(id) ON DELETE RESTRICT,
    FOREIGN KEY (encerrado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
    INDEX idx_retorno_data_status (data_prevista,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE agendamentos ADD COLUMN retorno_id INT UNSIGNED NULL,
    ADD UNIQUE KEY uq_agenda_retorno (retorno_id),
    ADD FOREIGN KEY (retorno_id) REFERENCES retornos(id) ON DELETE RESTRICT;
