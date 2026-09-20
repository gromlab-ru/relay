# Relay

**Рабочая память проекта для людей и AI-агентов.**

Relay связывает описание продукта, задачи и основания решений. Человек работает
через Web, агенты — через CLI/MCP; все интерфейсы используют одну модель и данные.

[![CLI в npm](https://img.shields.io/npm/v/%40gromlab%2Frelay-cli?label=CLI)](https://www.npmjs.com/package/@gromlab/relay-cli)
[![Server в npm](https://img.shields.io/npm/v/%40gromlab%2Frelay-server?label=Server)](https://www.npmjs.com/package/@gromlab/relay-server)
[![MCP в npm](https://img.shields.io/npm/v/%40gromlab%2Frelay-mcp?label=MCP)](https://www.npmjs.com/package/@gromlab/relay-mcp)

## Возможности

- **Продукт:** паспорт, фичи, сценарии, приложения, реализации и Markdown-документы.
- **Доски и задачи:** отдельные доски продукта, приложений и инфраструктуры; канбан,
  декомпозиция, зависимости и постоянные продуктовые цели.
- **Связи:** направленные отношения, обратное чтение и контекст с объясняющими путями.
- **Совместная работа:** ревизии, авторство, безопасные повторы, история действующих
  сущностей и обновления Web через SSE.
- **Local и workspace:** независимые проектные базы, общий сервер, CLI с прямым
  доступом к Core либо HTTP. Регистрации не объединяют данные проектов.

В текущих исходниках обзор, планы, релизы и история Web показывают «В разработке».
Прежняя доска и скрытые разделы старой модели удалены вместе с их контрактами.
[Карта возможностей](docs/product/CAPABILITIES.md), [состояние реализации](docs/engineering/implementation/README.md).

## Быстрый старт

В каталоге своего проекта:

```bash
npx @gromlab/relay-cli init
npx @gromlab/relay-server --open
```

Web/API по умолчанию: **http://127.0.0.1:4700**. Заполните продукт и создайте задачи
на его доске. Сервер уже включает готовый Web. Рекомендуется Node.js 24, пакеты требуют 22+.
CLI, Server и MCP обновляются согласованным комплектом; установленная версия может
отличаться от текущей ветки исходников. Проверяйте `--version` и доступные действия.

```bash
npx @gromlab/relay-cli task create --board product --title "Описать первый сценарий" --actor human
npx @gromlab/relay-cli task list
npx @gromlab/relay-cli task get PRODUCT-1
```

Используйте ключ или ID из ответа. Для автоматизации добавьте `--format json`.
Описание задачи принимает многострочный Markdown через `--description`.

## Подключение агентов

```bash
npx skills add gromlab-ru/relay --skill relay
npx @gromlab/relay-mcp --server-url http://127.0.0.1:4700
```

Подключите MCP-клиент к **http://127.0.0.1:4710/mcp** через Streamable HTTP.
Начните с `projects_list`, `entity_types`, `board_tasks_list` и `entity_context`.
В workspace передавайте project в каждом вызове. [Скилл](skills/relay/SKILL.md)
объясняет требования, ревизии, повторы, работу с задачами и достоверность результатов.

Оркестратор организует работу, исполнитель выполняет поручение и сохраняет результат.
Запуск агентов, Git, тесты и поставку выполняет внешняя среда; запись Relay не запускает их.

## Ваши данные

JSON хранится рядом с кодом в `.relay`: конфигурация, продукт, доски/задачи и отношения.
Данные можно резервировать и версионировать. Workspace объединяет регистрации независимых
проектов. Полные Markdown-тексты, ID, история ключей и квитанции принадлежат владельцам записей.

## Документация

- [Концепция](docs/product/README.md) · [Приложения](docs/product/applications/README.md).
- [Первый проект](docs/GETTING_STARTED.md) · [Web](docs/guides/WEB.md).
- [CLI](docs/reference/CLI.md) · [REST](docs/reference/API.md) · [MCP](docs/reference/MCP.md).
- [Конфигурация](docs/reference/CONFIGURATION.md) · [Оркестрация](docs/guides/ORCHESTRATION.md).
- [Библиотека](docs/README.md) · [Разработка](docs/DEVELOPMENT.md).
- [Обязательный протокол](docs/development/PROTOCOL.md) · [Досье работ](docs/work/README.md).
