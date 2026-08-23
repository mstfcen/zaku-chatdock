# Zaku ChatDock — arkadaş kurulumu

Zaku ChatDock, ChatGPT konuşmalarına kalıcı terminal çalışma alanları
ekleyen açık kaynak bir projedir.

## Hedeflenen normal kurulum

Public sürüm tamamlandığında Firefox tarafı normal AMO eklentisi olarak
kurulacak ve Firefox tarafından otomatik güncellenecek.

Terminal erişimi için Linux'ta ayrıca tek seferlik **ChatDock
Companion** gerekir. Bunun nedeni Firefox/Chromium eklentilerinin Native
Messaging uygulamasını işletim sistemine kendilerinin kuramamasıdır.

## Şu anki geliştirme kurulumu

Kaynak koddan:

    git clone https://github.com/mstfcen/zaku-chatdock.git
    cd zaku-chatdock
    ./scripts/install-companion.sh
    ./scripts/build.sh

Firefox geliştirme XPI:

    dist/Zaku-ChatDock-Firefox-Dev-v<VERSION>.xpi

Chromium/Opera geliştirme klasörü:

    dist/unpacked/chromium/

Chromium/Opera da kullanılacaksa:

    ./scripts/install-companion.sh --all-browsers

## Neler var?

- konuşma başına kalıcı tmux terminali
- Local / Remote terminal
- Run + Send
- Mission Mode
- terminal session listesi
- Firefox
- Chromium/Opera geliştirme build'i

Public AMO/Opera Store yayınları henüz yapılmış sayılmamalıdır.
