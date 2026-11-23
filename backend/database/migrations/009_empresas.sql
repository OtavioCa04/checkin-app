-- Multiempresa: cada empresa cliente do Na Rua enxerga somente os proprios dados.
-- Os dados que ja existem passam para a empresa 1, que pode ser renomeada pelo superadmin.
CREATE TABLE empresas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_empresa_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO empresas (id, nome) VALUES (1, 'Empresa principal');

-- Usuarios: empresa obrigatoria e marca de superadmin (dono do Na Rua, acima das empresas).
ALTER TABLE usuarios
    ADD COLUMN empresa_id INT UNSIGNED NULL AFTER id,
    ADD COLUMN superadmin TINYINT(1) NOT NULL DEFAULT 0 AFTER perfil;
UPDATE usuarios SET empresa_id = 1;
ALTER TABLE usuarios
    MODIFY empresa_id INT UNSIGNED NOT NULL,
    ADD CONSTRAINT fk_usuario_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
    ADD UNIQUE KEY uk_usuario_empresa_id (empresa_id, id);
-- O primeiro administrador existente vira superadmin.
UPDATE usuarios u JOIN (SELECT MIN(id) AS id FROM usuarios WHERE perfil = 'admin') m ON m.id = u.id SET u.superadmin = 1;

-- Setores: nome unico dentro de cada empresa.
ALTER TABLE setores ADD COLUMN empresa_id INT UNSIGNED NULL AFTER id;
UPDATE setores SET empresa_id = 1;
ALTER TABLE setores
    MODIFY empresa_id INT UNSIGNED NOT NULL,
    DROP INDEX uk_setor_nome,
    ADD UNIQUE KEY uk_setor_empresa_nome (empresa_id, nome),
    ADD UNIQUE KEY uk_setor_empresa_id (empresa_id, id),
    ADD CONSTRAINT fk_setor_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT;
-- O setor do usuario precisa ser da mesma empresa do usuario.
ALTER TABLE usuarios
    DROP FOREIGN KEY fk_usuario_setor,
    ADD CONSTRAINT fk_usuario_setor_empresa FOREIGN KEY (empresa_id, setor_id) REFERENCES setores(empresa_id, id) ON DELETE RESTRICT;

-- Clientes: CNPJ unico dentro de cada empresa.
ALTER TABLE clientes ADD COLUMN empresa_id INT UNSIGNED NULL AFTER id;
UPDATE clientes SET empresa_id = 1;
ALTER TABLE clientes
    MODIFY empresa_id INT UNSIGNED NOT NULL,
    DROP INDEX uq_cliente_cnpj,
    ADD UNIQUE KEY uq_cliente_empresa_cnpj (empresa_id, cnpj),
    ADD UNIQUE KEY uk_cliente_empresa_id (empresa_id, id),
    ADD CONSTRAINT fk_cliente_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT;

-- Visitas e agendamentos: a pessoa e o cliente precisam ser da mesma empresa do registro.
ALTER TABLE visitas ADD COLUMN empresa_id INT UNSIGNED NULL AFTER id;
UPDATE visitas SET empresa_id = 1;
ALTER TABLE visitas
    MODIFY empresa_id INT UNSIGNED NOT NULL,
    ADD INDEX idx_visita_empresa (empresa_id, id),
    ADD CONSTRAINT fk_visita_empresa_usuario FOREIGN KEY (empresa_id, usuario_id) REFERENCES usuarios(empresa_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_visita_empresa_cliente FOREIGN KEY (empresa_id, cliente_id) REFERENCES clientes(empresa_id, id) ON DELETE RESTRICT;

ALTER TABLE agendamentos ADD COLUMN empresa_id INT UNSIGNED NULL AFTER id;
UPDATE agendamentos SET empresa_id = 1;
ALTER TABLE agendamentos
    MODIFY empresa_id INT UNSIGNED NOT NULL,
    ADD INDEX idx_agenda_empresa (empresa_id, data_hora_prevista),
    ADD CONSTRAINT fk_agenda_empresa_usuario FOREIGN KEY (empresa_id, usuario_id) REFERENCES usuarios(empresa_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_agenda_empresa_cliente FOREIGN KEY (empresa_id, cliente_id) REFERENCES clientes(empresa_id, id) ON DELETE RESTRICT;
