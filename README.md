<p align="center">
  <img src="hub/icon.svg" width="72" alt="SeedWave Hub">
</p>

<h1 align="center">SeedWave Hub</h1>

<p align="center">
  <em>The storefront of the SeedWave studio — every product on one map.</em><br>
  <a href="https://ikartuzov-hub.github.io/seedwave-catalog/hub/">Live demo</a> ·
  <a href="https://ikartuzov-hub.github.io/seedwave-catalog/hub">SeedWave Hub</a> ·
  <a href="https://www.linkedin.com/in/igor-kartuzov">Built by Igor Kartuzov</a>
</p>

---

## The problem
A studio that ships many small products has a discovery problem: a visitor lands on one of them and never learns the rest exist. Without a single place that shows the whole ecosystem, every product is an island.

## The build
The repository root is a language-preserving redirect into `/hub/` — the registry that shows every SeedWave project as a card. It is the one bridge in the ecosystem: products never link to each other directly, they meet through the Hub. Project cards are JSON-driven and multilingual, so adding a product is adding a card, and adding a language is adding a dictionary.

## Stack
`JavaScript redirect` · `JSON-driven cards (projects.{lang}.json)` · `GitHub Pages` · `multilingual (RU/EN/PT/ES/DE)`

## See it live
- **Demo:** https://ikartuzov-hub.github.io/seedwave-catalog/hub/
- Language is auto-detected and carried through every link as `?lang=`.

## Screenshots
<!-- TODO: add 1–3 clean screenshots of the Hub (project cards). Show the product, not the code.
<p align="center">
  <img src="screenshot-1.png" width="320" alt="SeedWave Hub — project cards">
</p>
-->

## What's reusable
- **Language-preserving redirect pattern** — `?lang=` and `?theme=` are passed straight through, so the whole ecosystem keeps one language across every hop.
- **JSON-driven multilingual catalog** — the card list is data, not markup. New project = new card; new language = new dictionary file. No rebuild.

## Status & next
- **Status:** live — the anchor of the ecosystem.
- **Next:** complete English card copy across all projects.

---

<p align="center">
  <sub>© Igor Kartuzov · <a href="https://ikartuzov-hub.github.io/seedwave-catalog/hub">SeedWave</a> — AI-first studio · Madeira, EU</sub>
</p>
