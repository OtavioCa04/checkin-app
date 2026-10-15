CREATE TABLE agendamentos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT UNSIGNED NOT NULL,
    responsavel_id INT UNSIGNED NOT NULL,
    criado_por INT UNSIGNED NOT NULL,
    empresa VARCHAR(180) NOT NULL,
    contato VARCHAR(150) NOT NULL,
    assunto VARCHAR(200) NOT NULL,
    observacoes TEXT NOT NULL,
    data_hora_prevista DATETIME NOT NULL,
    status ENUM('pendente', 'realizado', 'cancelado') NOT NULL DEFAULT 'pendente',
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    FOREIGN KEY (responsavel_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
    INDEX idx_agenda_usuario_data (usuario_id, data_hora_prevista),
    INDEX idx_agenda_responsavel_data (responsavel_id, data_hora_prevista),
    INDEX idx_agenda_data_status (data_hora_prevista, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE agendamento_eventos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agendamento_id INT UNSIGNED NOT NULL,
    autor_id INT UNSIGNED NOT NULL,
    acao ENUM('criado', 'reagendado', 'cancelado', 'realizado') NOT NULL,
    motivo VARCHAR(1000) NOT NULL,
    data_anterior DATETIME NULL,
    data_nova DATETIME NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE RESTRICT,
    FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    INDEX idx_agenda_eventos (agendamento_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE visitas ADD COLUMN agendamento_id INT UNSIGNED NULL,
    ADD CONSTRAINT uq_visita_agendamento UNIQUE (agendamento_id),
    ADD CONSTRAINT fk_visita_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE RESTRICT;
