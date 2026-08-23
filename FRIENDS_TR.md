# Arkadaşa atmalık kısa açıklama

Selam, boş vakitte **Zaku ChatDock** diye ufak bir Firefox/Linux eklentisi
yaptım.

Mantığı şu: ChatGPT'nin yanına gerçek bir terminal koyuyor ve **her
ChatGPT konuşmasına ayrı bir tmux terminali bağlıyor**.

Yani bir projeyi konuştuğun chatte terminal o projede kalıyor; başka
chate geçince onun terminaline geçiyorsun. Geri dönünce de eski terminal
aynen duruyor.

Bir de ChatGPT'nin verdiği kod bloklarında **Run + Send** var. Basınca
komutu terminalde çalıştırıyor, çıktıyı gösteriyor ve iş bitince sonucu
aynı chate geri gönderiyor. Sürekli komut/çıktı kopyala-yapıştır yapmaya
gerek kalmıyor.

Şimdilik hobi projesi / alpha, Linux ve Firefox Developer Edition
üzerinde çalışıyor.

Ubuntu/Debian'daysan:

~~~bash
sudo apt install python3 tmux openssh-client curl
~~~

sonra:

~~~bash
curl -fsSL https://raw.githubusercontent.com/mstfcen/zaku-chatdock/main/scripts/bootstrap.sh | bash
~~~

Kurulum sonunda sana bir `.xpi` dosyasının yolunu yazacak.

Firefox Developer Edition'da:

~~~text
about:addons
→ sağ üstteki dişli
→ Install Add-on From File
→ çıkan XPI dosyasını seç
~~~

Sonra ChatGPT'yi yenilemen yeterli.

Repo:
https://github.com/mstfcen/zaku-chatdock

Bir şey patlarsa bana yazın, zaten biraz da arkadaşlarla kullanıp
nereleri saçmalıyor görmek için public yaptım :)
