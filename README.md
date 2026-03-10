# Whatsapp Browser

Navega por el internet usando Whatsapp para aprovechar los datos gratis para redes sociales.

El bot necesita una cuenta de Whatsapp propia para funcionar.

> [!WARNING]
> El bot asume que solo una persona lo está usando a la vez.

## Dependencias
- Node 20+
- yt-dlp - opcional

## Como installar
```
$ npm install
$ npx playwright install --with-deps
```

## Como utilizar
```
$ npm run start
```

## Ayuda
```
go <url> - Navegar a URL
goh <url> - Navegar a URL y resalta los elementos
reload - Refrescar la pagina
google <query> - Buscar en Google
duck <query> - Buscar en DuckDuckGo
screenshot - Captura de pantalla
highlight | hg - Resaltar elementos
click <n> - Click en elemento n
write <n> <texto> - Escribir en elemento n
pageup - Scroll arriba
pagedown - Scroll abajo
text - Texto de la pagina
download [video|audio] [worst|normal|best] [url]
```
