ALTER TABLE agendamento_eventos MODIFY acao ENUM('criado', 'reagendado', 'cancelado', 'realizado', 'responsavel_alterado') NOT NULL;
