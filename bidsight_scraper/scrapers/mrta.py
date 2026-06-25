"""
Group C — MRTA (Mass Rapid Transit Authority of Thailand).

Site: https://www.mrta.co.th
Procurement listing: /th/news/procurement?category_id=<cat>&page=<n>

Plain HTTP requests work fine — Cloudflare does not block curl/requests on this
site (playwright-stealth was added based on a false assumption; verified 2026-06-23
that plain requests return full HTML with tender data).

Table structure per page: <table class="table table-date"> with <tr> rows, each
containing a <th> with two <label> elements (day + "มิ.ย. 69" abbreviated month
+ 2-digit BE year) and a <td> with an <a> anchor to the detail page.

10 items per page; paginate via rel="next" until page is fully outside the cutoff
window or no next page exists.
"""
from __future__ import annotations

import re
import sys
import os
from datetime import date, timedelta
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from base_scraper import BaseScraper, TenderRecord

# Abbreviated Thai months → month int
_TH_ABBR = {
    "ม.ค.": 1,  "ก.พ.": 2,  "มี.ค.": 3, "เม.ย.": 4,
    "พ.ค.": 5,  "มิ.ย.": 6, "ก.ค.": 7,  "ส.ค.": 8,
    "ก.ย.": 9,  "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
}

# Categories to scrape
_CATEGORIES = {
    126: "e-bidding",
    37:  "e-market",
    39:  "consulting",
    125: "specific",
}

_BASE = "https://www.mrta.co.th"


def _parse_mrta_date(day_text: str, month_year_text: str) -> Optional[date]:
    """Parse '19' + 'มิ.ย. 69' → date(2026, 6, 19)."""
    try:
        day = int(day_text.strip())
    except (ValueError, AttributeError):
        return None
    mt = month_year_text.strip()
    for abbr, mo in _TH_ABBR.items():
        if abbr in mt:
            yr_m = re.search(r"(\d{2,4})\s*$", mt)
            if not yr_m:
                return None
            yr = int(yr_m.group(1))
            if yr < 100:
                yr += 2500       # 2-digit BE → full BE
            yr -= 543            # BE → CE
            try:
                return date(yr, mo, day)
            except ValueError:
                return None
    return None


class MRTAScraper(BaseScraper):
    def __init__(self, days_back: int = 30):
        super().__init__("MRTA", _BASE)
        self.days_back = days_back
        self.cutoff = date.today() - timedelta(days=days_back)

    def scrape(self) -> list[TenderRecord]:
        records: list[TenderRecord] = []
        seen: set[str] = set()

        for cat_id, method_label in _CATEGORIES.items():
            page = 1
            while True:
                resp = self.fetch(
                    f"{_BASE}/th/news/procurement",
                    params={"category_id": str(cat_id), "page": str(page)},
                )
                if resp is None:
                    self.log.warning(f"MRTA: category {cat_id} page {page} failed")
                    break

                html = resp.text
                rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL | re.IGNORECASE)
                in_window = 0

                for row in rows:
                    # Date from <th> → two <label> elements
                    th_m = re.search(r'<th[^>]*>(.*?)</th>', row, re.DOTALL | re.IGNORECASE)
                    td_m = re.search(r'<td[^>]*>(.*?)</td>', row, re.DOTALL | re.IGNORECASE)
                    if not th_m or not td_m:
                        continue

                    labels = re.findall(r'<label[^>]*>(.*?)</label>', th_m.group(1), re.DOTALL)
                    if len(labels) < 2:
                        continue

                    ann_date = _parse_mrta_date(labels[0], labels[1])
                    if ann_date is None or ann_date < self.cutoff:
                        continue
                    in_window += 1

                    # Title and URL from <td>
                    link_m = re.search(r'href="(/th/[^"]+)"[^>]*>.*?<span>(.*?)</span>',
                                       td_m.group(1), re.DOTALL | re.IGNORECASE)
                    if not link_m:
                        continue

                    href = link_m.group(1)
                    title = re.sub(r'<[^>]+>', '', link_m.group(2)).strip()
                    if not title:
                        continue

                    # ID from URL path: /th/e-bidding/35553
                    id_m = re.search(r'/(\d+)$', href)
                    tender_id = f"MRTA-{id_m.group(1)}" if id_m else f"MRTA-{cat_id}-{hash(href)}"

                    if tender_id in seen:
                        continue
                    seen.add(tender_id)

                    records.append(TenderRecord(
                        source="MRTA",
                        tender_id=tender_id,
                        title=title,
                        department="การรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย",
                        method=method_label,
                        category=_infer_category(title),
                        announcement_date=ann_date.isoformat(),
                        status="open",
                        announcement_url=_BASE + href,
                    ))

                if in_window == 0:
                    break   # entire page is outside cutoff window

                if 'rel="next"' not in html:
                    break
                page += 1

        self.log.info(f"MRTA: {len(records)} records scraped")
        return records


def _infer_category(title: str) -> str:
    if any(k in title for k in ["ก่อสร้าง", "ปรับปรุง", "ซ่อมแซม", "ติดตั้ง"]):
        return "works"
    if any(k in title for k in ["ที่ปรึกษา", "ออกแบบ"]):
        return "consulting"
    if any(k in title for k in ["บริการ", "บำรุงรักษา", "จ้างเหมา"]):
        return "services"
    return "goods"
