"""IndexNow-автомат SeedWave.
Для каждого сайта из sites.txt берёт коммиты в main за окно (по умолчанию 75 мин),
собирает изменённые страницы и отправляет их одним POST в Bing (IndexNow).
Код ответа пишется в лог: 200/202 — принято; иначе шаг падает."""
import json, os, sys, urllib.request, urllib.error, datetime as dt

KEY = "3cd195d15377e831181771302e0f13e6"
OWNER = "ikartuzov-hub"
WINDOW = int(os.environ.get("WINDOW_MIN", "75"))
ONLY = os.environ.get("ONLY_REPO", "").strip()
FORCE = os.environ.get("FORCE_ROOT", "") == "1"
TOKEN = os.environ.get("GITHUB_TOKEN", "")

def gh(path):
    req = urllib.request.Request(f"https://api.github.com{path}",
        headers={"Accept": "application/vnd.github+json", "Authorization": f"Bearer {TOKEN}"} if TOKEN else {"Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def to_url(host, f):
    if f.startswith((".github/", "_archive/", "_src/")) or "/." in "/" + f:
        return None
    if f.endswith("index.html"):
        return f"https://{host}/" + f[: -len("index.html")]
    if f.endswith(".html"):
        return f"https://{host}/{f}"
    if f.endswith((".json", ".css", ".js", ".svg", ".png", ".jpg", ".webp")):
        d = f.rsplit("/", 1)[0] + "/" if "/" in f else ""
        if f.endswith((".png", ".jpg", ".webp", ".svg")) and not d:
            return f"https://{host}/"  # og-картинка/значки корня → главная
        return f"https://{host}/{d}"
    return None

def ping(host, urls):
    body = json.dumps({"host": host, "key": KEY, "keyLocation": f"https://{host}/{KEY}.txt",
                       "urlList": sorted(urls)[:10000]}).encode()
    req = urllib.request.Request("https://www.bing.com/indexnow", data=body, method="POST",
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code

since = (dt.datetime.utcnow() - dt.timedelta(minutes=WINDOW)).strftime("%Y-%m-%dT%H:%M:%SZ")
here = os.path.dirname(__file__)
sites = [l.split() for l in open(os.path.join(here, "sites.txt"), encoding="utf-8") if l.strip() and not l.startswith("#")]
bad = []
for repo, host in sites:
    if ONLY and repo != ONLY:
        continue
    urls = set()
    try:
        for c in gh(f"/repos/{OWNER}/{repo}/commits?sha=main&since={since}&per_page=50"):
            for f in gh(f"/repos/{OWNER}/{repo}/commits/{c['sha']}").get("files", []):
                u = to_url(host, f["filename"])
                if u: urls.add(u)
    except Exception as e:
        print(f"⚠️ {repo}: не прочитал коммиты — {e}")
        continue
    if FORCE:
        urls.add(f"https://{host}/")
    if not urls:
        print(f"· {host}: изменений нет")
        continue
    code = ping(host, urls)
    ok = code in (200, 202)
    print(f"{'✅' if ok else '❌'} {host}: {len(urls)} адр. → {code}")
    for u in sorted(urls): print("   ", u)
    if not ok: bad.append(f"{host}={code}")
if bad:
    print("Ошибки:", ", ".join(bad)); sys.exit(1)
