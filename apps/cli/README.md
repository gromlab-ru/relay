# Relay CLI

`@gromlab/relay-cli` — терминальный клиент Relay. Команда: `relay-cli`.
Требуется Node.js 22+.

```bash
npx @gromlab/relay-cli init
npx @gromlab/relay-cli create "Первая задача" --actor human
npx @gromlab/relay-cli list
```

`.relay/config.json` выбирает local: прямой Core либо HTTP по `server.url`.
`relay.workspace.json` выбирает workspace: общий сервер и явный проект.

```bash
npx @gromlab/relay-cli a list
npx @gromlab/relay-cli --project b get 1
npx @gromlab/relay-cli --server-url http://127.0.0.1:3000 --project a get 1
```

`--config` переопределяет `RELAY_CONFIG` и поиск вверх. `--server-url` переопределяет
`RELAY_SERVER_URL` и конфиг. `--local` доступен для прямой работы с одним проектом.
Автор мутации: `--actor` или `RELAY_ACTOR`.

Сервер с Web запускается отдельным пакетом `@gromlab/relay-server`.

Исходники: <https://github.com/gromlab-ru/relay>.
Разработка: `pnpm run build:cli`, `pnpm run test:cli`, `pnpm run package:check` из корня.
