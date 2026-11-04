# Tasca Beach Club

Site do Tasca Beach Club, clube com quadras de areia para beach tennis, vôlei de praia e futevôlei em Sorocaba (SP).

O site apresenta o clube e tem um sistema próprio de reserva de quadras, com um painel para a equipe administrar a agenda.

## Funcionalidades

- **Reserva online:** o jogador escolhe esporte, dia, quadra e horário (até 4 horas seguidas) e informa nome e WhatsApp. O horário fica bloqueado na hora como pendente.
- **Aviso pelo WhatsApp:** após reservar, o jogador pode avisar o clube com a mensagem já pronta.
- **Painel do clube (`/admin`):** agenda do dia, confirmação e cancelamento de reservas, bloqueio de horários para torneios e aulas, e ajuste de preço, número de quadras e horário de funcionamento.
- **Modo demonstração:** sem banco configurado, as reservas ficam salvas no navegador, o que permite apresentar o site sem infraestrutura.
- **Leveza:** cerca de 1,8 MB no total, com imagens em WebP e fontes auto-hospedadas.

## Tecnologias

- HTML, CSS e JavaScript puro, sem framework e sem build.
- [Supabase](https://supabase.com) para o banco de reservas e o login do painel.
- Hospedagem na [Vercel](https://vercel.com).

## Estrutura

| Arquivo | Função |
|---|---|
| `index.html` | Página do clube |
| `admin.html` / `admin.js` | Painel do clube |
| `config.js` | Configuração: conexão com o Supabase, contatos, preço, quadras e horários |
| `booking.js` | Comunicação com o banco de reservas (ou com o navegador, no modo demonstração) |
| `app.js` / `styles.css` | Interface e animações |
| `supabase/schema.sql` | Tabelas, regras de acesso e funções do banco |
| `img/` | Fotos do clube e quadros da animação do topo |
