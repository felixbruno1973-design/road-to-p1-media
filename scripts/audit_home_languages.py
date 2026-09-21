import json,re,html
from urllib.parse import urlparse

def page(pid):
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
    x=re.sub(r"\s+"," ",x).strip()
    return x

def links_from_text(s):
    if not isinstance(s,str): return []
    return re.findall(r'href=["\']([^"\']+)["\']',s,re.I)

def walk(nodes,out,parent=""):
    for n in nodes or []:
        st=n.get("settings") or {}
        rec={"id":n.get("id"),"elType":n.get("elType"),"widgetType":n.get("widgetType"),"parent":parent}
        vals=[]
        for k in ("title","title_text","text","editor","html","description_text","button_text"):
            if st.get(k):
                vals.append((k,strip_text(st[k])[:1000]))
        if isinstance(st.get("link"),dict) and st["link"].get("url"):
            vals.append(("link",st["link"]["url"]))
        hrefs=[]
        for k in ("editor","html"):
            hrefs += links_from_text(st.get(k))
        if hrefs:
            vals.append(("hrefs",hrefs))
        if vals:
            rec["values"]=vals
            out.append(rec)
        walk(n.get("elements") or [],out,n.get("id",""))

for pid,label in [(10,"FR"),(9968,"EN")]:
    p,d=page(pid)
    print(f"=== {label} PAGE {pid} title={(p.get('title') or {}).get('raw')} slug={p.get('slug')} ===")
    out=[]
    walk(d,out)
    for r in out:
        print(json.dumps(r,ensure_ascii=False))

print("=== PAGE DIRECTORY MATCHES ===")
pages=json.load(open("pages.json",encoding="utf-8"))
for p in pages.get("pages",[]):
    link=p.get("link","")
    title=p.get("title","")
    path=urlparse(link).path
    low=(str(title)+" "+path).lower()
    if any(k in low for k in ["home","accueil","lara","aaron","partenaire","partner","calend","classe","rank","result","saison","season"]):
        print(json.dumps({"id":p.get("id"),"title":title,"link":link,"path":path},ensure_ascii=False))

for fn in ("media-flyer.json","media-2027.json"):
    print("===",fn,"===")
    try:
        data=json.load(open(fn,encoding="utf-8"))
    except Exception as e:
        print("ERR",e); continue
    if isinstance(data,list):
        for m in data:
            print(json.dumps({
                "id":m.get("id"),
                "date":m.get("date"),
                "slug":m.get("slug"),
                "title":(m.get("title") or {}).get("rendered"),
                "source_url":m.get("source_url"),
                "mime_type":m.get("mime_type")
            },ensure_ascii=False))
    else:
        print(json.dumps(data,ensure_ascii=False)[:3000])

print("=== ALL ENGLISH PAGES ===")
for p in pages.get("pages",[]):
    link=p.get("link","")
    if "/en/" in urlparse(link).path:
        print(json.dumps({"id":p.get("id"),"title":p.get("title",""),"link":link,"path":urlparse(link).path},ensure_ascii=False))
