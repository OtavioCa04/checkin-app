-- Setores organizam os usuarios da empresa (Vendas, Logistica etc.) e nao mudam permissoes.
CREATE TABLE setores (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(80) NOT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_setor_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Setor opcional no usuario. Setores nao sao apagados, apenas desativados.
ALTER TABLE usuarios
    ADD COLUMN setor_id INT UNSIGNED NULL AFTER perfil,
    ADD CONSTRAINT fk_usuario_setor FOREIGN KEY (setor_id) REFERENCES setores(id) ON DELETE RESTRICT;
