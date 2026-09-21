import json,re,html

def load(pid):
    p=json.load(open(f"page-{pid}.json",encoding="utf-8"))
    raw=(p.get("meta") or {}).get("_elementor_data")
    data=json.loads(raw) if isinstance(raw,str) else raw
    return p,data

def strip_text(x):
    if not isinstance(x,str): return ""
    x=re.sub(r"<style.*?</style>"," ",x,flags=re.I|re.S)
    x=re.sub(r"<script.*?</script>"," ",x,flags=re.I|re.S)
    x=re.sub(r"<[^>]+>"," ",x)
    x=html.unescape(x)
    return re.sub(r"\s+"," ",x).strip()

def walk(nodes,parent=""):
    for n in nodes or []:
        yield parent,n
        yield from walk(n.get("elements") or [], n.get("id",""))

for pid,label in [(11,"FR"),(10517,"EN")]:
    p,d=load(pid)
    print(f"=== {label} PAGE {pid} title={(p.get('title') or {}).get('raw')} slug={p.get('slug')} ===")
    for parent,n in walk(d):
        st=n.get("settings") or {}
        vals={}
        for k in ("title","title_text","text","editor","html","description_text"):
            if st.get(k):
                vals[k]=strip_text(st[k])[:1200]
        if isinstance(st.get("link"),dict) and st["link"].get("url"):
            vals["link"]=st["link"]["url"]
        if st.get("background_slideshow_gallery"):
            vals["slideshow_urls"]=[x.get("url") for x in st["background_slideshow_gallery"]]
        if st.get("image"):
            vals["image"]=st["image"].get("url") if isinstance(st["image"],dict) else st["image"]
        if vals:
            print(json.dumps({
                "id":n.get("id"),"parent":parent,"elType":n.get("elType"),"widgetType":n.get("widgetType"),
                "values":vals
            },ensure_ascii=False))
