# Builds two versions from src.html:
#   artifact.html -> claude.ai artifact (uses the platform's Claude access)
#   index.html    -> standalone website for GitHub Pages (uses your own API key)
import re,pathlib
d=pathlib.Path(__file__).parent
src=(d/"src.html").read_text()
def js(path): return "<script>"+(d/path).read_text().replace("</script","<\\/script")+"\n</script>"
def inline(s): return re.sub(r'<script src="(vendor/[^"]+)"(?: async)?></script>',lambda m:js(m.group(1)),s)

art=inline(src)
(d/"artifact.html").write_text(art)

MAIN='<script>\n(function(){\n"use strict";'
assert src.count(MAIN)==1
site=src.replace('<meta name="claude:viewport-fit-sides" content="cover">\n','')
site=site.replace(MAIN,'<script src="vendor/anthropic.min.js"></script>\n<script src="standalone/shim.js"></script>\n'+MAIN)
site=inline(site).replace('<script src="standalone/shim.js"></script>',js("standalone/shim.js"))
head='''<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#2457d6">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Prof Ingé">
<meta name="description" content="Tuteur IA pour le cycle ingénieur : cours expliqués, exercices résolus, fiches et QCM.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%232457d6'/%3E%3Ctext x='32' y='42' font-family='monospace' font-size='28' font-weight='700' fill='white' text-anchor='middle'%3E%E2%88%82x%3C/text%3E%3C/svg%3E">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>
'''
(d/"index.html").write_text(head+site+"\n</body></html>\n")
print("artifact.html",len(art.encode())//1024,"KB · index.html",(d/"index.html").stat().st_size//1024,"KB")
