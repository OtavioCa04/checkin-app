-- EXEMPLO para primeira instalacao, em um banco novo e exclusivo.
-- Antes de executar no phpMyAdmin, substitua SUBSTITUA_A_SENHA_DO_BANCO.
-- Use a mesma senha no DB_PASSWORD do arquivo backend/.env.
-- Nao apaga nem substitui bancos ou usuarios existentes.
CREATE DATABASE visitas_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'visitas_local'@'127.0.0.1' IDENTIFIED BY 'SUBSTITUA_A_SENHA_DO_BANCO';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON visitas_local.* TO 'visitas_local'@'127.0.0.1';
