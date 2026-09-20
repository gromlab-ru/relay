# Терминальное представление Relay

CLI по умолчанию предназначен человеку: собственные представления команд, таблицы,
карточки и Markdown. `--format json` даёт отдельный машинный контракт без ANSI.
Цвет дополняет ключи, названия и статусы, а не заменяет их.

## Цвет и ширина

`--color auto|always|never` управляет подсветкой; auto учитывает TTY, NO_COLOR и TERM.
Ширина терминала определяет переносы и переключение таблиц на карточки.
Unicode/ANSI учитываются библиотеками; управляющие последовательности пользовательского
текста экранируются. `COLUMNS` позволяет проверить узкий вывод.

## Чтение

```bash
relay-cli task list --completion unfinished
relay-cli task get PRODUCT-1
relay-cli task links PRODUCT-1
relay-cli product overview
relay-cli entities get FEATURE-1
relay-cli graph context PRODUCT-1
```

Пустые данные объясняются отдельно от ошибки. Большие списки имеют продолжение
с сохранением фильтров. Полное Markdown-содержание читается адресно; оно не заменяется
сводкой. Справка каждой команды содержит русские аргументы и примеры.

## Запись

```bash
relay-cli task create --board product --title "Первая задача" --actor human
relay-cli task move PRODUCT-1 --column in-progress --if-revision 1 --actor agent
```

Подставляйте актуальный ключ и ревизию из чтения. Человеческая квитанция объясняет
результат, машинный ответ сохраняет ID, ключ, ревизию и requestId.

[CLI](CLI.md) · [JSON и страницы](OUTPUT.md) · [Стандарт интерфейсов](../development/INTERFACE-STANDARD.md).
