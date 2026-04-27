# PALIMPS Team v2 — Kurulum

**Paket:** `palimps-team-v2-updated.zip`
**İçerik:** 15 skill + QUALITY_FRAMEWORK 1.0.1 + AMND-2026-001
**Framework versiyonu:** 1.0.1 (AMND-2026-001 merge edildi)

---

## Ne değişti (v1 → v2 + AMND-2026-001)

- 15 orkestrasyonlu skill (v1'de 3 vardı: ios-developer, product-designer, code-reviewer)
- 5 katmanlı **QUALITY_FRAMEWORK** — ölçülebilir eşikler, standart referanslar, otomatik kapılar, kullanıcı sinyali, tat
- **AMENDMENTS/** klasörü — her retrospektif dosyaya yazılıyor, skill'ler oradan besleniyor
- **AMND-2026-001 (bugün merge edildi):** 50310→50314 süreci, Sentry karanlık kalma gapi, `eas.json` env drift'i. 3 yeni release kapısı + 1 yeni Layer 1 threshold.

---

## Kurulum (elle — dakikalar)

Claude Code'un yüklü skill klasörü **read-only**, ben oraya kopyalayamıyorum. Elle şu adımları izle:

### 1. Mevcut v1 skill'leri sil

Terminal'de:

```bash
cd ~/.claude/skills
rm -rf palimps-code-reviewer palimps-ios-developer palimps-product-designer
```

### 2. Zip'i aç

```bash
cd ~/Downloads   # veya zip nereye indiyse
unzip palimps-team-v2-updated.zip
```

Bu `palimps-team/` klasörü çıkarır.

### 3. Skill'leri `~/.claude/skills/` altına taşı

```bash
cd palimps-team
# 15 skill dizinini tek tek taşı:
mv palimps-* ~/.claude/skills/
```

### 4. Framework dosyalarını `~/.claude/skills/` köküne koy

Skill'ler `QUALITY_FRAMEWORK.md`'ye referans veriyor; aynı dizinde olması gerek:

```bash
mv QUALITY_FRAMEWORK.md CHANGELOG.md README.md AMENDMENTS ~/.claude/skills/
```

### 5. Doğrula

```bash
ls ~/.claude/skills/
```

Şunu görmeli (15 palimps-* dizini + framework dosyaları):

```
AMENDMENTS/
CHANGELOG.md
QUALITY_FRAMEWORK.md
README.md
consolidate-memory/        (built-in)
docx/                       (built-in)
palimps-accessibility-specialist/
palimps-analytics-specialist/
palimps-backend-engineer/
palimps-code-reviewer/
palimps-database-admin/
palimps-growth-marketer/
palimps-guardrails/
palimps-ios-developer/
palimps-localization-specialist/
palimps-observability-engineer/
palimps-product-designer/
palimps-product-manager/
palimps-qa-tester/
palimps-release-manager/
palimps-retrospective-engineer/
pdf/                        (built-in)
pptx/                       (built-in)
schedule/                   (built-in)
setup-cowork/               (built-in)
skill-creator/              (built-in)
xlsx/                       (built-in)
```

### 6. Claude Code'u yeniden başlat

Açık olan Claude Code session'ını kapat, yeniden aç. Yeni skill'ler description'larından algılanıp otomatik tetiklenecek.

---

## Doğrulama

Bir sonraki konuşmada şunları yazarsan v2 takımı devrede:

- "PALIMPS kod reviewını yap" → `palimps-code-reviewer` tetiklenmeli (v2 hali, L3 primary)
- "Bu crash neden oldu, retrospektif yapalım" → `palimps-retrospective-engineer` tetiklenmeli
- "50315 release için hazır mıyız" → `palimps-release-manager` tetiklenmeli, T-1 checklist'te **yeni 3 kapı** görünmeli:
  - `eas.json` env diff review
  - `// TEMP:` marker grep
  - Sentry pulse check

Bu 3 kapı görünmüyorsa AMND-2026-001 edit'leri yansımamış demektir — bana söyle, hemen bakarız.

---

## Sonraki adım — 50314 crash'i

Paket yüklenince `palimps-retrospective-engineer` + `palimps-ios-developer` ikilisini çağıracağız:

```
TypeError: undefined is not a function
    at t1 (main.jsbundle:184981:25)
    at commitHookEffectListMount (main.jsbundle:18901:36)
```

Bu muhtemelen bir React hook'un production bundle'da tree-shake sonrası `undefined` dönmesi (Reanimated veya expo-image türevi). Bir sonraki mesajında takım kurulu mu diye doğrulayıp crash'e girişeceğiz.
