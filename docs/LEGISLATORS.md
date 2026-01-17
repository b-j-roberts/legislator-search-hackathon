# US Legislators Data

Machine-readable data for US Congress members, sourced from the community-maintained [unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators) repository.

## Data Files

| File | Description |
|------|-------------|
| `legislators-current.yaml` | Current members - bio, DC office address, phone, fax, contact form |
| `legislators-district-offices.yaml` | Home district/state office locations |
| `legislators-social-media.yaml` | Official Twitter, Facebook, Instagram, YouTube accounts |
| `legislators-historical.yaml` | All members since 1789 |

**Direct downloads:**
```
https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml
https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-district-offices.yaml
https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-social-media.yaml
```

JSON/CSV formats available - replace `.yaml` with `.json` or `.csv`.

## Filtering for Current Legislators

Each legislator has an array of **all terms served**. To find active members, check if the **last term's `end` date** is after today.

- `end: 2025-01-03` = no longer serving
- `end: 2027-01-03+` = currently serving

## Contact Information

### What's Available
- DC office address, phone, fax
- District office addresses and phones
- Official contact form URL (`contact_form` field)
- Social media accounts

### Why No Email Addresses?
Legislators use contact forms instead of public emails for:
- Constituent verification (ZIP code matching)
- Volume management and spam control
- Tracking and response workflows

### Alternatives for Outreach

| Tool | Type | Description |
|------|------|-------------|
| [Democracy.io](https://democracy.io) | Free | Open-source, submits via official contact forms |
| [Resistbot](https://resist.bot) | Free | Text 50409 - converts messages to faxes/letters |
| [Quorum](https://www.quorum.us) | Paid | Enterprise advocacy platform |
| [Phone2Action](https://phone2action.com) | Paid | Organizational outreach tools |

## Related Data

| File | Contents |
|------|----------|
| `committees-current.yaml` | Active House/Senate/Joint committees |
| `committee-membership-current.yaml` | Committee assignments |
| `executive.yaml` | Presidents and Vice Presidents |
