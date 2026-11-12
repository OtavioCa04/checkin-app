-- Perfis passam a ser admin e funcionario: contas de responsável viram administradores.
UPDATE usuarios SET perfil = 'admin' WHERE perfil = 'responsavel';
ALTER TABLE usuarios MODIFY perfil ENUM('funcionario','admin') NOT NULL;

-- Novos registros não têm responsável, e os antigos mantêm o valor como histórico.
-- Não use ponto e vírgula em comentários: o runner divide o arquivo nesse caractere.
ALTER TABLE visitas MODIFY responsavel_id INT UNSIGNED NULL;
ALTER TABLE agendamentos MODIFY responsavel_id INT UNSIGNED NULL;
