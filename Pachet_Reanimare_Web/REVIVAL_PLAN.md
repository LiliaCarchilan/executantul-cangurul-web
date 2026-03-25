# Plan de reanimare pentru Executantul Cangurul

## Obiectiv

O singura aplicatie moderna care:

- deschide exercitiile vechi `.cng`
- ruleaza pe telefon, tableta si desktop
- poate fi folosita la clasa fara instalare clasica
- pastreaza logica didactica a aplicatiei originale

## Directia recomandata

Aplicatia trebuie evoluata intr-un produs web modern, apoi publicata ca PWA.

PWA inseamna:

- ruleaza in browser
- poate fi instalata pe ecranul principal
- poate functiona offline dupa prima incarcare
- foloseste acelasi cod pe Windows, Android si iPad

## Arhitectura propusa

### 1. Strat de compatibilitate legacy

Rol:

- citeste fisierele `.cng`
- parseaza comenzile vechi
- le transpileaza intr-o forma executabila de browser

Status actual in proiect:

- exista un parser nou in `js/cng_parser.js`
- incarcarea din UI poate detecta fisiere `.cng`
- programele legacy sunt transformate in JavaScript pentru motorul actual

### 2. Motor de executie

Rol:

- tine starea cangurului
- executa `PAS`, `SALT`, `ROTIRE`
- verifica senzorii `E_LINIE` si `E_MARGINE`
- deseneaza traseul pe canvas

Status actual:

- exista deja in `js/drawer.js` si `js/drwblocks.js`

### 3. Interfata moderna pentru clasa

Rol:

- butoane mari pentru touch
- canvas responsive
- zone de lucru simplificate
- incarcare rapida a exercitiilor

Urmatoarele imbunatatiri recomandate:

- bara de actiuni fixa pe mobil
- comutare intre "Executie", "Blocuri" si "Cod" prin tab-uri
- mod "Elev" si mod "Profesor"

### 4. Persistenta si continut

Rol:

- salveaza progresul local
- incarca lectii si exemple
- exporta programe in format modern si legacy

Recomandare:

- pastram `.cng` pentru arhiva istorica
- introducem si un format `json` pentru lectii moderne

### 5. PWA si distributie

Rol:

- ofera acces simplu prin link
- permite instalare usoara
- asigura functionare offline

Etape:

- `manifest.webmanifest`
- `service worker`
- cache pentru `js`, `css`, `Media`, exemple si lectii

## Etapele proiectului

### Etapa 1. Compatibilitate minima

- import `.cng`
- rulare in browser
- validare pe exemplele istorice

### Etapa 2. Experienta touch

- optimizare telefon/tableta
- butoane mai mari
- layout vertical si tab-uri

### Etapa 3. Continut didactic

- biblioteca de exercitii
- descriere pentru fiecare nivel
- mod ghidat pentru elev

### Etapa 4. Publicare

- PWA
- hosting static
- eventual ambalare cu Capacitor pentru magazine mobile

## Recomandare de produs

Produsul final ar trebui impartit in trei moduri:

- `Exerseaza`: rulare rapida a exercitiilor vechi
- `Construieste`: programare cu blocuri si, optional, text
- `Preda`: colectie de lectii si demonstratii pentru profesor

## Criteriu de succes

Putem considera aplicatia "reanimata" cand:

- un fisier `.cng` vechi se deschide direct in browser
- ruleaza corect pe telefon si tableta
- poate fi adaugata pe ecranul principal
- un profesor poate incepe ora doar trimitand un link
