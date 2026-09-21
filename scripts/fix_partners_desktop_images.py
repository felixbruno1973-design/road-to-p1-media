import json

p = json.load(open("before.json", encoding="utf-8"))
meta = (p.get("meta") or {}).get("_elementor_data")
if not isinstance(meta, str):
    raise SystemExit("Safety stop: Elementor data unavailable")
data = json.loads(meta)

intro_id = "c63e02a"
card_ids = ["49caa96", "5eb18ed", "2394503", "3458751", "da8e127"]
found = {}

def walk(nodes):
    for n in nodes or []:
        if n.get("id") in [intro_id, *card_ids]:
            found[n.get("id")] = n
        walk(n.get("elements") or [])

walk(data)
expected = {intro_id, *card_ids}
if set(found) != expected:
    raise SystemExit(f"Safety stop: missing expected elements: {expected - set(found)}")

for eid in card_ids:
    n = found[eid]
    if n.get("widgetType") != "image-box":
        raise SystemExit(f"Safety stop: {eid} is not image-box")

intro = found[intro_id]
if intro.get("widgetType") != "text-editor":
    raise SystemExit("Safety stop: intro target is not text-editor")
html = (intro.get("settings") or {}).get("editor", "")

marker = "/* RTP1_DESKTOP_PARTNER_IMAGES_V1 */"
css = """<style>
/* RTP1_DESKTOP_PARTNER_IMAGES_V1 */
@media (min-width:1025px){
  .elementor-11 .elementor-element.elementor-element-49caa96 .elementor-image-box-img,
  .elementor-11 .elementor-element.elementor-element-5eb18ed .elementor-image-box-img,
  .elementor-11 .elementor-element.elementor-element-2394503 .elementor-image-box-img,
  .elementor-11 .elementor-element.elementor-element-3458751 .elementor-image-box-img,
  .elementor-11 .elementor-element.elementor-element-da8e127 .elementor-image-box-img{
    height:150px;
    display:flex;
    align-items:center;
    justify-content:center;
    margin:0 0 20px!important;
    overflow:hidden;
  }
  .elementor-11 .elementor-element.elementor-element-49caa96 .elementor-image-box-img img,
  .elementor-11 .elementor-element.elementor-element-5eb18ed .elementor-image-box-img img,
  .elementor-11 .elementor-element.elementor-element-2394503 .elementor-image-box-img img,
  .elementor-11 .elementor-element.elementor-element-3458751 .elementor-image-box-img img,
  .elementor-11 .elementor-element.elementor-element-da8e127 .elementor-image-box-img img{
    display:block;
    width:auto!important;
    height:auto!important;
    max-width:220px!important;
    max-height:130px!important;
    object-fit:contain!important;
    object-position:center center!important;
  }
}
</style>"""

if marker in html:
    marker_pos = html.index(marker)
    start = html.rfind("<style>", 0, marker_pos + 1)
    end = html.find("</style>", marker_pos)
    if start < 0 or end < 0:
        raise SystemExit("Safety stop: existing desktop style marker is malformed")
    html = html[:start] + css + html[end + len("</style>"):]
else:
    html = css + "\n" + html

intro.setdefault("settings", {})["editor"] = html

for eid in card_ids:
    s = found[eid].setdefault("settings", {})
    s["_element_custom_width"] = {"unit": "px", "size": 290, "sizes": []}
    s["image_size"] = {"unit": "%", "size": 100, "sizes": []}

payload = {"meta": {"_elementor_data": json.dumps(data, ensure_ascii=False, separators=(",", ":"))}}
json.dump(payload, open("update.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("Prepared desktop-only framing CSS; mobile and tablet settings untouched.")
