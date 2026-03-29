# Korean Art Lexicon

An open-source authority file for Korean contemporary art names and exhibition titles.

## What This Is

This is **not a dictionary**. It is an infrastructure for naming Korean contemporary art reliably across languages.

### Scope (Phase 1)
- **Personal names**: Artists, curators, writers, editors, critics
- **Exhibition titles**: Solo shows, group exhibitions, biennales

### What We Provide
- Preferred romanizations
- Known variants
- Verifiable sources

---

## Data Structure

```
data/
├── persons/          # One YAML file per person
│   ├── kim-sooja.yaml
│   └── lee-ufan.yaml
└── exhibitions/      # One YAML file per exhibition
    └── korean-pavilion-venice-2024.yaml
```

### Person Entry Example

```yaml
id: person.kim-sooja
name_ko: 김수자
name_latn:
  preferred: Kimsooja
  variants:
    - Kim Sooja
    - Kim Soo-ja
roles:
  - artist
sources:
  - https://www.kimsooja.com
status: stable
```

### Exhibition Entry Example

```yaml
id: exhibition.korean-pavilion-venice-2024
title:
  ko: "나무, 흔적, 그리고 (보이지 않는) 파빌리온"
  en: "TREES & TRACES: An (in)visible pavilion"
venue: Korean Pavilion, Giardini
dates:
  start: 2024-04-20
  end: 2024-11-24
sources:
  - https://venicebiennale.kr
status: stable
```

---

## Contributing

### Requirements
1. **One verifiable source** minimum per entry
2. **File name must match ID**: `kim-sooja.yaml` → `person.kim-sooja`
3. **Preferred vs variants**: Distinguish the most common usage from alternatives

### Process
1. Fork this repository
2. Add or edit YAML files in `data/`
3. Run validation: `npm run validate`
4. Submit a Pull Request

### Entry Status
- `draft`: New entry, needs review
- `review`: Under discussion
- `stable`: Verified and accepted

---

## Validation

```bash
npm install
npm run validate
```

All YAML files are validated against JSON schemas in `schema/`.

---

## Governance

- Pull Request–based contributions only
- Maintainer group reviews all changes
- Parallel variants allowed where consensus is absent

**Principle**: This archive documents practice and consensus, not absolute truth.

---

## License

Data: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)
Code: MIT

---

## Related

This project is independent infrastructure. It may be used by translation tools, research databases, or any project requiring consistent Korean art terminology.
