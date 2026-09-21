import json,re,copy,html

FR_ID=10
EN_ID=9968

fr=json.load(open("fr.json",encoding="utf-8"))
en=json.load(open("en-before.json",encoding="utf-8"))
raw=(fr.get("meta") or {}).get("_elementor_data")
if not isinstance(raw,str):
    raise SystemExit("Safety stop: French Elementor data unavailable")
data=json.loads(raw)

def walk(nodes):
    for n in nodes or []:
        yield n
        yield from walk(n.get("elements") or [])

idx={n.get("id"):n for n in walk(data) if n.get("id")}

def need(eid, widget=None):
    n=idx.get(eid)
    if not n:
        raise SystemExit(f"Safety stop: missing element {eid}")
    if widget and n.get("widgetType")!=widget:
        raise SystemExit(f"Safety stop: {eid} expected {widget}, got {n.get('widgetType')}")
    return n

# Adapt page-specific Elementor CSS selectors from French page to English page.
def rec_replace(obj):
    if isinstance(obj,dict):
        return {k:rec_replace(v) for k,v in obj.items()}
    if isinstance(obj,list):
        return [rec_replace(v) for v in obj]
    if isinstance(obj,str):
        return obj.replace(".elementor-10", ".elementor-9968")
    return obj
data=rec_replace(data)
idx={n.get("id"):n for n in walk(data) if n.get("id")}

# Hero: same current presentation as French, fully translated and English destinations.
hero=need("1271118","html")
hero_html=hero["settings"]["html"]
repls=[
("ROAD TO P1 · L’association","ROAD TO P1 · The association"),
("Lara et Aaron FELIX,<br>pilotes de karting.","Lara and Aaron FELIX,<br>karting drivers."),
("ROAD TO P1 accompagne leur progression et défend l’égalité des chances entre filles et garçons dans le sport automobile.","ROAD TO P1 supports their development and promotes equal opportunities for girls and boys in motorsport."),
("En partenariat avec EMOS — ESTACA Motorsport.","In partnership with EMOS — ESTACA Motorsport."),
(">Devenir partenaire<",">Become a partner<"),
(">Flyer ROAD TO P1 2027 (PDF)<",">ROAD TO P1 2027 flyer (PDF)<"),
(">Découvrir Lara<",">Discover Lara<"),
(">Découvrir Aaron<",">Discover Aaron<"),
("https://road-to-p1.com/partenaires/","https://road-to-p1.com/en/our-partners/"),
("https://road-to-p1.com/lara-felix-pilote-kart/","https://road-to-p1.com/en/lara-felix-karting-driver/"),
("https://road-to-p1.com/aaron-felix/","https://road-to-p1.com/en/aaron-felix-karting-driver/")
]
for a,b in repls:
    hero_html=hero_html.replace(a,b)
hero["settings"]["html"]=hero_html

# Association section.
need("a1ee02a","heading")["settings"]["title"]="The ROAD TO P1 association"
need("9ac37a6","text-editor")["settings"]["editor"]=(
    "<p><strong>ROAD TO P1</strong> is a non-profit association built around three ambitions:</p>"
    "<p><strong>Equal opportunities to progress:</strong> supporting girls and boys in their sporting and technical development.</p>"
    "<p><strong>Learning in the field:</strong> giving students, particularly from ESTACA, hands-on experience in mechanics and data analysis in competition.</p>"
    "<p><strong>Sharing the passion:</strong> helping people discover karting and sharing track experience through sporting, technical and organisational support.</p>"
)
a=need("a84b4aa","button")
a["settings"]["text"]="Read more"
a["settings"]["link"]["url"]="https://road-to-p1.com/en/road-to-p1-association/"

# Association values/info boxes.
for eid,title in {
    "8a0bb66":"equity",
    "8c6bee4":"sportsmanship",
    "3232d75":"sharing",
    "cce129d":"passion"
}.items():
    need(eid,"eael-info-box")["settings"]["eael_infobox_title"]=title

# Drivers.
need("6e92675","heading")["settings"]["title"]="The drivers"
need("fbc3960","text-editor")["settings"]["editor"]=(
    "<p>After 4 podium finishes, 2 pole positions and 3rd place in the championship across 5 races in her first competition season in 2024, "
    "Lara was among the four fastest drivers of the 2025 season in the youth category. In 2026, she competes against the best in the FFSA Île-de-France league.</p>"
)
b=need("daaf513","button"); b["settings"]["text"]="Read more about Lara"; b["settings"]["link"]["url"]="https://road-to-p1.com/en/lara-felix-karting-driver/"
need("315f515","text-editor")["settings"]["editor"]=(
    "<p>Eager to drive since the age of 3, Aaron, 8 years old, achieved a podium finish in his very first Mini race in 2025. "
    "In 2026, Aaron competes in the FFSA Île-de-France league championship.</p>"
)
b=need("38874a5","button"); b["settings"]["text"]="Read more about Aaron"; b["settings"]["link"]["url"]="https://road-to-p1.com/en/aaron-felix-karting-driver/"

# Calendar: use the same current 2026 documents as French.
need("91d948f","heading")["settings"]["title"]="Calendar"
need("6fb5a95","heading")["settings"]["title"]="Lara"
b=need("7384b8e","button"); b["settings"]["text"]="2026 SEASON"; b["settings"]["link"]["url"]="https://road-to-p1.com/wp-content/uploads/2026/01/calendar-lara.png"
need("fc368e1","heading")["settings"]["title"]="Calendar"
need("6edc539","heading")["settings"]["title"]="Aaron"
b=need("93173e4","button"); b["settings"]["text"]="2026 SEASON"; b["settings"]["link"]["url"]="https://road-to-p1.com/wp-content/uploads/2026/01/calendar-aaron.png"

# News.
need("f546d8d","heading")["settings"]["title"]="Latest news"
pg=need("f1e0a95","eael-post-grid")
pg["settings"]["read_more_button_text"]="Read more"
pg["settings"]["eael_read_more_text"]="Read more"
pg["settings"]["show_load_more_text"]="Load more"
news=need("70abbdd","text-editor")
e=news["settings"]["editor"]
e=e.replace("Voir les articles plus anciens","See older articles")
e=e.replace("https://road-to-p1.com/actualites/","https://road-to-p1.com/en/news/")
news["settings"]["editor"]=e

# Updated photo accordion from French, translated.
acc=need("5895775","eael-image-accordion")
caps=[
    "<p>Aaron Felix 2026</p>",
    "<p>Aaron Felix late at night preparing his kart for a weekend in south-west France ©Road To P1</p>",
    "<p>Lara FELIX training at Witry-lès-Reims, winter 2024 © Road to P1</p>",
    "<p>Lara FELIX, FFSA competition karting driver, 2026</p>",
    "<p>Lara FÉLIX learning how to maintain an engine</p>",
    "<p>Aaron FELIX - 1st podium in 2025</p>",
    "<p>Lara FELIX - 2026 FFSA season</p>"
]
items=acc["settings"].get("eael_img_accordions") or []
if len(items)!=len(caps):
    raise SystemExit(f"Safety stop: expected {len(caps)} gallery items, found {len(items)}")
for item,cap in zip(items,caps):
    item["eael_accordion_content"]=cap
    bg=item.get("eael_accordion_bg")
    if isinstance(bg,dict) and bg.get("alt"):
        bg["alt"]=re.sub(r"\b(tard dans la nuit|prepare son kart|weekend dans le sud ouest)\b","",bg["alt"],flags=re.I).strip()

# Partners.
need("84d10be","heading")["settings"]["title"]="Our partners"
p=need("fc835ed","text-editor")
e=p["settings"]["editor"].replace("Voir tous les partenaires","See all partners")
e=e.replace("https://road-to-p1.com/partenaires/","https://road-to-p1.com/en/our-partners/")
p["settings"]["editor"]=e

# Closing CTA/current French structure, English wording, English form.
need("498a6d3","heading")["settings"]["title"]="Let's build the next chapter together"
b=need("c6a96a9","button"); b["settings"]["text"]="Support the drivers"
need("5b1960c","text-editor")["settings"]["editor"]=(
    "<p>Would you like to become a partner of Lara and Aaron, support the association or learn more about <strong>ROAD TO P1</strong>? "
    "Introduce yourself and share your idea in the form. Let's discuss your project and how we can move this adventure forward together.</p>"
    "<p>Prefer to write to us directly? <a href=\"mailto:contact@road-to-p1.com\">contact@road-to-p1.com</a></p>"
)
need("bfb6dcb","fluent-form-widget")["settings"]["form_list"]="3"

# Translate a few accessibility-visible strings that may live in content settings.
def translate_strings(obj):
    if isinstance(obj,dict):
        for k,v in list(obj.items()):
            obj[k]=translate_strings(v)
        return obj
    if isinstance(obj,list):
        return [translate_strings(v) for v in obj]
    if isinstance(obj,str):
        pairs=[
            ("équité","equity"),("sportivité","sportsmanship"),("partage","sharing"),
            ("Lire la suite","Read more"),("Saison 2026","2026 SEASON"),("SAISON 2026","2026 SEASON"),
            ("Calendrier","Calendar"),("Les dernières actualités","Latest news"),("Nos partenaires","Our partners"),
        ]
        for a,b in pairs: obj=obj.replace(a,b)
        return obj
    return obj
data=translate_strings(data)

# Safety checks.
serialized=json.dumps(data,ensure_ascii=False)
blocked=[
    "Calandrier-UFOLEP-KART-2025.png",
    "jsprt_achv_season/lara-2025",
    "jsprt_achv_season/aaron-2025",
    "https://road-to-p1.com/actualites/",
    "https://road-to-p1.com/partenaires/",
    "https://road-to-p1.com/lara-felix-pilote-kart/",
    "https://road-to-p1.com/aaron-felix/",
]
for x in blocked:
    if x in serialized:
        raise SystemExit("Safety stop: outdated/French destination remains: "+x)
for required in [
    "https://road-to-p1.com/en/our-partners/",
    "https://road-to-p1.com/en/news/",
    "https://road-to-p1.com/en/lara-felix-karting-driver/",
    "https://road-to-p1.com/en/aaron-felix-karting-driver/",
    "calendar-lara.png","calendar-aaron.png","Flyer-ROAD-TO-P1-2027.pdf",
    ".elementor-9968"
]:
    if required not in serialized:
        raise SystemExit("Safety stop: required aligned content missing: "+required)
if '"8aa1197"' in serialized or '"b0bbcad"' in serialized:
    raise SystemExit("Safety stop: obsolete ranking sections unexpectedly remain")
if need("bfb6dcb","fluent-form-widget")["settings"]["form_list"]!="3":
    raise SystemExit("Safety stop: English Fluent Form was not preserved")

payload={"meta":{"_elementor_data":json.dumps(data,ensure_ascii=False,separators=(",",":"))}}
json.dump(payload,open("en-update.json","w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
print("Prepared English homepage from current French structure.")
print("Removed obsolete ranking blocks by structural parity with French.")
print("Aligned 2026 calendars, 2027 flyer, English destinations and English form.")
