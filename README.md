# Долг → 0 — Android v1.0

Мобильное приложение для контроля погашения долгов. React + Vite + Capacitor.

## Вариант A — собрать APK автоматически через GitHub Actions

1. Создай новый GitHub repository.
2. Загрузи **все файлы этого проекта** в него.
3. Открой вкладку **Actions**.
4. Запусти workflow **Build Android APK** через **Run workflow**.
5. После окончания открой завершившийся workflow → **Artifacts** → `dolg-0-debug-apk`.
6. Внутри будет `app-debug.apk`.

Workflow сам:
- ставит Node.js 22;
- ставит JDK 17;
- настраивает Android SDK;
- устанавливает npm-зависимости;
- собирает React;
- создаёт Android-проект Capacitor;
- синхронизирует web assets;
- собирает APK;
- прикладывает APK как готовый artifact.

## Вариант B — один файл на Windows

Нужны Node.js LTS и Android Studio с Android SDK/JDK 17.

Двойной клик по:

`build-apk.cmd`

Или PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\build-apk.cmd
```

Готовый APK появится здесь:

`android\app\build\outputs\apk\debug\app-debug.apk`

## Технологии

- React 19
- Vite 7
- Capacitor 7
- Capacitor Preferences — постоянное локальное хранение
- Capacitor Haptics — тактильный отклик
- Android APK

## Данные

Приложение работает офлайн. Данные долгов и платежей хранятся локально на устройстве и не требуют браузерного кэша.

В настройках есть экспорт JSON-резервной копии.

## Release APK

Текущий автоматический workflow собирает debug APK, чтобы его можно было сразу установить для тестирования. Для публичного релиза потребуется отдельная подпись APK keystore-ключом. Ключ не следует хранить в репозитории.

## v1.1 — уведомления и быстрый платёж

- Главная кнопка «Внести платёж» открывает выбор конкретного долга, затем ввод суммы.
- Локальные Android-уведомления без сервера:
  - вечернее напоминание в 20:00;
  - уведомления при прохождении рубежей 400/300/200/100/50 тыс. и 0 ₽.
- Настройки уведомлений находятся в меню `⋯`.
- Данные по долгам, платежам и настройкам уведомлений хранятся локально через Capacitor Preferences.
