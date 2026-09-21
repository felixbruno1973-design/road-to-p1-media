import json,re

FR_ID=11
EN_ID=10517

fr=json.load(open("fr.json",encoding="utf-8"))
raw=(fr.get("meta") or {}).get("_elementor_data")
if not isinstance(raw,str):
    raise SystemExit("Safety stop: French Elementor data unavailable")
data=json.loads(raw)

def walk(nodes):
    for n in nodes or []:
        yield n
        yield from walk(n.get("elements") or [])

def index():
    return {n.get("id"):n for n in walk(data) if n.get("id")}

def need(eid, widget=None):
    n=index().get(eid)
    if not n:
        raise SystemExit(f"Safety stop: missing {eid}")
    if widget and n.get("widgetType")!=widget:
        raise SystemExit(f"Safety stop: {eid} expected {widget}, got {n.get('widgetType')}")
    return n

# Adapt any page-specific selector copied from French page.
def replace_page_selector(obj):
    if isinstance(obj,dict):
        return {k:replace_page_selector(v) for k,v in obj.items()}
    if isinstance(obj,list):
        return [replace_page_selector(v) for v in obj]
    if isinstance(obj,str):
        return obj.replace(".elementor-11", ".elementor-10517")
    return obj

data=replace_page_selector(data)

# Headings.
need("a923818","heading")["settings"]["title"]="Become a partner!"
need("7518a68","heading")["settings"]["title"]="With you, everything is possible"
need("412d480","heading")["settings"]["title"]="Your support makes a tangible difference"

# Main text: same content and HTML structure as French, translated only.
en_main = """<p>Competition karting requires much more than the driver's commitment. Each season requires track time, race entries, tyres, equipment, maintenance, travel and regular technical support.</p>
<p>By supporting <strong>ROAD TO P1</strong>, your company directly helps give Lara and Aaron, as well as ESTACA students, the means to progress, complete more kilometres on track, develop their experience of motorsport competition and pursue their sporting journey or training in the best possible conditions.</p>
<h2>What are contributions used for?</h2>
<p>The support we receive helps finance, in particular, training and track days, competition entries, tyres and consumables, maintenance and parts, travel and accommodation, as well as the work carried out with ESTACA students on technical matters and data analysis.</p>
<p>ROAD TO P1 is committed to using the contributions received directly for the sporting project, the drivers' development and the development of activities carried out with students.</p>
<h2>A partnership that should also be useful to you</h2>
<p>We are not simply looking for funding. We want to build a useful, visible and lasting relationship with each partner.</p>
<div style="display: flex; flex-wrap: wrap; gap: 18px; margin: 28px 0;">
  <div style="flex: 1 1 220px; padding: 22px; border: 1px solid rgba(128,128,128,.35); border-radius: 14px;">
    <h3>Visibility</h3>
    <p>Your company can be featured on the ROAD TO P1 website, social media, communication materials and, depending on the partnership, on equipment or materials linked to the project.</p>
  </div>
  <div style="flex: 1 1 220px; padding: 22px; border: 1px solid rgba(128,128,128,.35); border-radius: 14px;">
    <h3>Content</h3>
    <p>Photos, videos, publications and season content can showcase the partner's involvement and tell the story of the project in a concrete way.</p>
  </div>
  <div style="flex: 1 1 220px; padding: 22px; border: 1px solid rgba(128,128,128,.35); border-radius: 14px;">
    <h3>Meetings</h3>
    <p>Kart presentations, meetings with Lara and Aaron, discovery of the world of competition or activities organised with the company, depending on the opportunities available.</p>
  </div>
  <div style="flex: 1 1 220px; padding: 22px; border: 1px solid rgba(128,128,128,.35); border-radius: 14px;">
    <h3>Season follow-up</h3>
    <p>Results, progress, key moments and project news so that each partner can follow the adventure they are helping to make possible.</p>
  </div>
</div>
<h2>Your partnership, built with you</h2>
<p>A local SME, a large company and a technical partner do not have the same expectations. We therefore prefer to build each collaboration around your objectives, your business and the level of involvement envisaged.</p>
<p>Would you like to develop your visibility, create content, associate your company with a sporting project, or contribute directly to the development of young drivers and the training of students?</p>
<p><strong>Let's build a partnership together that makes sense for both sides.</strong></p>
<h2>They support ROAD TO P1</h2>
<p>Discover the people and organisations that share the values of the ROAD TO P1 association and support us. Through their passion and involvement, they help make this human and sporting adventure possible.</p>"""

# Reproduce the CSS rules currently used on the French page, but scoped to English page 10517.
# This keeps desktop image framing and the mobile text correction aligned between languages.
parity_css = """<style>
@media (min-width:1025px){
  .elementor-10517 .elementor-element.elementor-element-49caa96 .elementor-image-box-img,
  .elementor-10517 .elementor-element.elementor-element-5eb18ed .elementor-image-box-img,
  .elementor-10517 .elementor-element.elementor-element-2394503 .elementor-image-box-img,
  .elementor-10517 .elementor-element.elementor-element-3458751 .elementor-image-box-img,
  .elementor-10517 .elementor-element.elementor-element-da8e127 .elementor-image-box-img{
    height:150px;display:flex;align-items:center;justify-content:center;
    overflow:hidden;margin-bottom:20px!important;
  }
  .elementor-10517 .elementor-element.elementor-element-49caa96 .elementor-image-box-img img,
  .elementor-10517 .elementor-element.elementor-element-5eb18ed .elementor-image-box-img img,
  .elementor-10517 .elementor-element.elementor-element-2394503 .elementor-image-box-img img,
  .elementor-10517 .elementor-element.elementor-element-3458751 .elementor-image-box-img img,
  .elementor-10517 .elementor-element.elementor-element-da8e127 .elementor-image-box-img img{
    display:block;width:auto!important;height:auto!important;
    max-width:220px!important;max-height:130px!important;
    object-fit:contain!important;object-position:center center!important;
  }
  .elementor-10517 .elementor-element.elementor-element-bb25799{
    width:100%!important;min-height:520px!important;margin:0!important;background-color:#000;
  }
  .elementor-10517 .elementor-element.elementor-element-bb25799 .elementor-background-slideshow__slide__image{
    background-size:contain!important;background-position:center center!important;background-repeat:no-repeat!important;
  }
}
@media (max-width:767px){
  .elementor-10517 .elementor-element.elementor-element-2f26c83{
    width:100%!important;max-width:100%!important;margin:0!important;
    left:auto!important;right:auto!important;transform:none!important;box-sizing:border-box!important;
  }
}
</style>"""
need("c63e02a","text-editor")["settings"]["editor"]=parity_css+en_main

# Buttons and internal destinations.
b=need("0763037","button")
b["settings"]["text"]="Contact the association"
b["settings"].setdefault("link",{})["url"]="https://road-to-p1.com/en/home/#contact"

b=need("e9a3cf6","button")
b["settings"]["text"]="Support our fundraiser"

# Partner cards: identical images/order/settings/links to French, translated descriptions only.
translations={
"49caa96": {
    "description_text":"Workshop for the sale of parts, engines or complete packages, maintenance of your equipment, chassis setup, and engine tuning and optimisation. DG Kart can also welcome you under its structure at Regional and National races, IAME Series, NSK and Minarelli events."
},
"da8e127": {
    "description_text":"The Philippe Hautem Champagne House, located in the heart of Champagne, supports our project as an official partner. Their commitment helps us develop our initiatives and share our passion with our community.<br>Alcohol abuse is dangerous for your health. Drink responsibly."
},
"5eb18ed": {
    "description_text":"Whether in France or at the factory in Belgium, knowledgeable and available people are there to meet your needs. Alfano France offers local, French-speaking support to help you feel confident with the product in your hands."
},
"2394503": {
    "description_text":"With the support of EMOS (ESTACA MOTORSPORT) students, Lara and Aaron FELIX enter a new era in 2026, where data analysis and a scientific approach to the sport are developed to the standards of leading motorsport teams."
},
"3458751": {
    "title_text":"KART RACE<br>WITRY-LÈS-REIMS",
    "description_text":"Located at the Witry-lès-Reims track, the fantastic KART’RACE team welcomes you to discover karting, individually or as a group. True enthusiasts, they will always share valuable advice in a friendly atmosphere to help you progress in the discipline."
}}
for eid,changes in translations.items():
    n=need(eid,"image-box")
    for k,v in changes.items():
        n["settings"][k]=v

# English Instagram locale where an English locale parameter exists.
emos=need("2394503","image-box")
url=(emos["settings"].get("link") or {}).get("url","")
if "hl=fr" in url:
    emos["settings"]["link"]["url"]=url.replace("hl=fr","hl=en")

# Final CTA.
need("69af66f","text-editor")["settings"]["editor"]="<h2>Want to join the adventure?</h2><p>Let's discuss your objectives and imagine a collaboration tailored to your company.</p>"
b=need("7bc94b4","button")
b["settings"]["text"]="Contact us!"
b["settings"].setdefault("link",{})["url"]="https://road-to-p1.com/en/home/#contact"

# Safety: exact French structure means the same number/order of top-level elements and same images.
# No obsolete English-only Pressbook/UFOLEP/Trophée Aquitaine blocks should survive because data was cloned from FR.
serialized=json.dumps(data,ensure_ascii=False)
for forbidden in ["Pressbook","logo-UFOLEP.jpg","logo-UFOLEP-kart-Aquitaine.jpg","Trophée Aquitaine"]:
    if forbidden in serialized:
        raise SystemExit("Safety stop: obsolete English-only content remains: "+forbidden)

for required in [
    "Image9.png","logo-hautem.jpg","Image10.png","Image1.png","LOGO-KART-RACE.png",
    "Screenshot-2026-01-03-at-10-24-52-Instagram-1.png",
    "Your support makes a tangible difference",
    "What are contributions used for?",
    "A partnership that should also be useful to you",
    "They support ROAD TO P1",
    "https://road-to-p1.com/en/home/#contact"
]:
    if required not in serialized:
        raise SystemExit("Safety stop: required aligned content missing: "+required)

payload={"meta":{"_elementor_data":json.dumps(data,ensure_ascii=False,separators=(",",":"))}}
json.dump(payload,open("en-partners-update.json","w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
print("Prepared English partners page as a strict structural/photo clone of French page 11.")
print("Translated all visible page copy and partner descriptions.")
print("English internal destinations and mobile/desktop parity CSS applied.")
