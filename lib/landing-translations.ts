export type Lang = "en" | "th";

export const t = {
  en: {
    nav: {
      logo: "Conjuncture",
      features: "Features",
      simulator: "Simulator",
      caseStudy: "Case Study",
      pricing: "Pricing",
      requestDemo: "Request Demo",
    },
    hero: {
      badge: "Real Data from Thai Government Procurement Registry · FY2561–2568",
      headline: "Bid Smarter.\nWin More.\nProtect Margins.",
      subheadline:
        "Conjuncture benchmarks your bid against 153,685 real Thai government procurement projects — so you know exactly what discount wins, before you submit.",
      ctaPrimary: "Start Free Trial",
      ctaSecondary: "Watch 2-min Demo",
      stat1Value: "153,685",
      stat1Label: "Projects in database",
      stat2Value: "฿1.09T",
      stat2Label: "Total procurement budget tracked",
      stat3Value: "386",
      stat3Label: "Agencies benchmarked",
    },
    simulator: {
      title: "Interactive Bid Optimizer",
      subtitle:
        "Adjust the parameters below to see how Conjuncture calculates your optimal bid position in real time.",
      competitorCount: "Competitor Count",
      projectScope: "Project Scope (฿M)",
      materialVolatility: "Material Volatility",
      laborCost: "Labor Cost Index",
      winProbability: "Win Probability",
      optimalBid: "Optimal Bid",
      marginProtected: "Margin Protected",
      riskLevel: "Risk Level",
      low: "Low",
      medium: "Medium",
      high: "High",
      competitors: "competitors",
      chartTitle: "Bid Win Probability Curve",
      chartDesc: "Probability of winning at each bid price point vs. estimated project cost",
    },
    features: {
      title: "Everything You Need to Dominate Competitive Bidding",
      subtitle:
        "From predictive analytics to real-time cost management, Conjuncture is the operating system for modern suppliers.",
      items: [
        {
          title: "Smart Bidding Analytics",
          description:
            "Our ML engine analyzes 10,000+ historical tender outcomes to predict exactly what price wins your next bid. Understand competitor patterns before they bid.",
          tag: "Predictive AI",
        },
        {
          title: "Cost & Margin Guardrails",
          description:
            "Real-time expense tracking ensures you never accept a project at a loss. Set margin floors, track actual vs. estimated costs, and get alerts before you're underwater.",
          tag: "Cost Control",
        },
        {
          title: "Financing & Loan Tracker",
          description:
            "Track borrowed capital, interest accrual, and repayment schedules directly in your project dashboard. Know your true cost of capital on every job.",
          tag: "Cash Flow",
        },
        {
          title: "Inventory & Supplier POS",
          description:
            "A full procurement and inventory management module. Compare supplier quotes, track material deliveries, and manage your supply chain like a modern operation.",
          tag: "Operations",
        },
      ],
    },
    caseStudy: {
      tag: "Case Study",
      company: "Pranakon Construction Co., Ltd.",
      industry: "Civil Engineering & Infrastructure",
      quote:
        "Before Conjuncture, we were guessing on nearly every bid. We'd either overbid and lose, or underbid and bleed money on the project. Now we have a data-backed strategy that's transformed how we compete.",
      author: "Somchai Wiriyapong",
      role: "CEO & Founder",
      stats: [
        { value: "+35%", label: "Tender Win Rate" },
        { value: "-28%", label: "Cost Overruns" },
        { value: "฿12M", label: "Revenue Unlocked" },
        { value: "6 mo.", label: "Time to ROI" },
      ],
      chartTitle: "Win Rate Before vs. After Conjuncture",
    },
    footer: {
      tagline: "The competitive edge for modern suppliers.",
      product: "Product",
      productLinks: ["Features", "Pricing", "Integrations", "Changelog"],
      company: "Company",
      companyLinks: ["About", "Blog", "Careers", "Press"],
      legal: "Legal",
      legalLinks: ["Privacy Policy", "Terms of Service", "Data Security"],
      copyright: "© 2025 Conjuncture. All rights reserved.",
    },
  },
  th: {
    nav: {
      logo: "Conjuncture",
      features: "ฟีเจอร์",
      simulator: "ทดสอบราคา",
      caseStudy: "กรณีศึกษา",
      pricing: "ราคา",
      requestDemo: "ขอทดลองใช้",
    },
    hero: {
      badge: "ข้อมูลจริงจากระบบจัดซื้อจัดจ้างภาครัฐ · ปีงบประมาณ 2561–2568",
      headline: "ประมูลชนะ\nด้วยข้อมูลจริง\nไม่ต้องเดา",
      subheadline:
        "Conjuncture เปรียบเทียบราคาเสนอของคุณกับโครงการจัดซื้อจัดจ้างภาครัฐจริง 153,685 โครงการ — รู้ว่าต้องเสนอส่วนลดเท่าไรจึงชนะ ก่อนยื่นราคา",
      ctaPrimary: "ทดลองใช้ฟรี",
      ctaSecondary: "ดูวิดีโอสาธิต 2 นาที",
      stat1Value: "153,685",
      stat1Label: "โครงการในฐานข้อมูล",
      stat2Value: "฿1.09T",
      stat2Label: "มูลค่าตลาดจัดซื้อจัดจ้างรวม",
      stat3Value: "386",
      stat3Label: "หน่วยงานที่มีข้อมูลเปรียบเทียบ",
    },
    simulator: {
      title: "เครื่องมือปรับแต่งราคาเสนอ",
      subtitle:
        "ปรับค่าพารามิเตอร์ด้านล่างเพื่อดูว่า Conjuncture คำนวณตำแหน่งราคาเสนอที่เหมาะสมของคุณอย่างไรในเวลาจริง",
      competitorCount: "จำนวนคู่แข่ง",
      projectScope: "ขอบเขตโครงการ (ล้านบาท)",
      materialVolatility: "ความผันผวนของวัสดุ",
      laborCost: "ดัชนีค่าแรง",
      winProbability: "ความน่าจะเป็นในการชนะ",
      optimalBid: "ราคาเสนอที่เหมาะสม",
      marginProtected: "กำไรที่ได้รับการปกป้อง",
      riskLevel: "ระดับความเสี่ยง",
      low: "ต่ำ",
      medium: "ปานกลาง",
      high: "สูง",
      competitors: "คู่แข่ง",
      chartTitle: "กราฟความน่าจะเป็นในการชนะ",
      chartDesc: "ความน่าจะเป็นในการชนะที่จุดราคาเสนอแต่ละจุด เทียบกับต้นทุนโครงการที่ประเมินไว้",
    },
    features: {
      title: "ทุกสิ่งที่คุณต้องการเพื่อครองการประมูลแบบแข่งขัน",
      subtitle:
        "ตั้งแต่การวิเคราะห์เชิงพยากรณ์ไปจนถึงการจัดการต้นทุนแบบเรียลไทม์ Conjuncture คือระบบปฏิบัติการสำหรับผู้รับเหมายุคใหม่",
      items: [
        {
          title: "การวิเคราะห์การเสนอราคาอัจฉริยะ",
          description:
            "เครื่องมือ ML ของเราวิเคราะห์ผลการประมูลกว่า 10,000 รายการเพื่อทำนายราคาที่จะชนะการประมูลครั้งถัดไป พร้อมเข้าใจรูปแบบของคู่แข่งก่อนที่พวกเขาจะยื่นราคา",
          tag: "AI เชิงพยากรณ์",
        },
        {
          title: "การควบคุมต้นทุนและกำไร",
          description:
            "การติดตามค่าใช้จ่ายแบบเรียลไทม์ช่วยให้คุณไม่รับโครงการที่ขาดทุน ตั้งเพดานกำไร ติดตามต้นทุนจริงกับที่ประมาณการ และรับการแจ้งเตือนก่อนที่จะขาดทุน",
          tag: "ควบคุมต้นทุน",
        },
        {
          title: "ติดตามสินเชื่อและเงินกู้",
          description:
            "ติดตามเงินกู้ การสะสมดอกเบี้ย และกำหนดการชำระคืนโดยตรงในแดชบอร์ดโครงการ รู้ต้นทุนเงินทุนที่แท้จริงของคุณในทุกงาน",
          tag: "กระแสเงินสด",
        },
        {
          title: "การจัดการสินค้าคงคลังและซัพพลายเออร์",
          description:
            "โมดูลการจัดซื้อและจัดการสินค้าคงคลังครบวงจร เปรียบเทียบใบเสนอราคาซัพพลายเออร์ ติดตามการจัดส่งวัสดุ และจัดการซัพพลายเชนอย่างมืออาชีพ",
          tag: "ปฏิบัติการ",
        },
      ],
    },
    caseStudy: {
      tag: "กรณีศึกษา",
      company: "บริษัท ประนคร ก่อสร้าง จำกัด",
      industry: "วิศวกรรมโยธาและโครงสร้างพื้นฐาน",
      quote:
        "ก่อนใช้ Conjuncture เราต้องเดาราคาในการประมูลเกือบทุกครั้ง บางครั้งเสนอสูงเกินไปแล้วแพ้ หรือเสนอต่ำเกินไปแล้วขาดทุนในโครงการ ตอนนี้เรามีกลยุทธ์ที่อ้างอิงข้อมูลซึ่งเปลี่ยนวิธีการแข่งขันของเราไปอย่างสิ้นเชิง",
      author: "สมชาย วิริยะพงศ์",
      role: "ประธานเจ้าหน้าที่บริหาร",
      stats: [
        { value: "+35%", label: "อัตราชนะการประมูล" },
        { value: "-28%", label: "ต้นทุนเกินงบประมาณ" },
        { value: "฿12M", label: "รายได้ที่ปลดล็อก" },
        { value: "6 เดือน", label: "ระยะเวลาคืนทุน" },
      ],
      chartTitle: "อัตราชนะก่อนและหลังใช้ Conjuncture",
    },
    footer: {
      tagline: "ความได้เปรียบเชิงแข่งขันสำหรับผู้รับเหมายุคใหม่",
      product: "ผลิตภัณฑ์",
      productLinks: ["ฟีเจอร์", "ราคา", "การเชื่อมต่อ", "การเปลี่ยนแปลง"],
      company: "บริษัท",
      companyLinks: ["เกี่ยวกับเรา", "บล็อก", "ร่วมงานกับเรา", "ข่าวสาร"],
      legal: "กฎหมาย",
      legalLinks: ["นโยบายความเป็นส่วนตัว", "ข้อกำหนดการใช้งาน", "ความปลอดภัยของข้อมูล"],
      copyright: "© 2025 Conjuncture สงวนลิขสิทธิ์ทุกประการ",
    },
  },
} as const;

export type Translations = typeof t.en;
