# Roughly Chopped

**Live app:** https://glitch-industries.github.io/roughly-chopped/

A mobile-first progressive web app (PWA) for flexible weekly meal planning, without the calorie counting.

## What it does

- Pick a pool of meals for the week and generate a categorized shopping list
- Check off shopping items by store section (Produce, Refrigerated, Frozen, Pantry) as you go
- Log what you actually ate each day from your week's meal pool
- Track two simple daily habits: ate a vegetable, drank a glass of water
- Optional weekly weight check-in for spotting patterns over time
- Works offline via service worker
- Installable on iOS and Android as a home screen app

## Structure

```
index.html        — app shell
app.js            — full app (loads meal library from /data/meals.json)
sw.js             — service worker for offline support
data/
  meals.json      — personal meal library (name, tags, recipe steps, shopping items)
```

## Running locally

Serve the folder with any static file server:

```bash
python3 -m http.server 4321
```

Then open `http://localhost:4321` in a browser.

## Philosophy

No meal plans survive contact with the week. Roughly chopped is good enough.
