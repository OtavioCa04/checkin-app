-- Check-in passa a registrar o local digitado. Coordenadas antigas ficam como histórico.
ALTER TABLE visitas
    ADD COLUMN local VARCHAR(255) NULL AFTER precisao_gps,
    MODIFY latitude DECIMAL(10,7) NULL,
    MODIFY longitude DECIMAL(10,7) NULL,
    MODIFY precisao_gps DECIMAL(8,2) NULL;

-- Uma foto opcional por visita, guardada fora da pasta pública.
CREATE TABLE visita_fotos (
    visita_id INT UNSIGNED PRIMARY KEY,
    arquivo VARCHAR(80) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    tamanho INT UNSIGNED NOT NULL,
    enviado_por INT UNSIGNED NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_foto_visita FOREIGN KEY (visita_id) REFERENCES visitas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_foto_autor FOREIGN KEY (enviado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
    UNIQUE KEY uk_foto_arquivo (arquivo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
