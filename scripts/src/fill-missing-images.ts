/**
 * fill-missing-images.ts
 *
 * Attaches locally-saved product images (and improved SEO) to the 25 existing
 * catalog products that are missing a featuredImage:
 *   - Esonic CAM-U7
 *   - Carbon Fiber Spools & Fabrics (10 products)
 *   - Araldite Epoxy Resin Systems (7 products)
 *   - Geem Industrial Battery Products (6 products)
 *
 * Also fills longDescription + metaTitle + metaDescription + metaKeywords
 * on every product that still lacks them.
 *
 * Run: pnpm --filter @workspace/scripts run fill-missing-images
 */

import { db, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface ProductPatch {
  id: number;
  featuredImage: string;
  galleryImages: string;
  shortDescription?: string;
  longDescription?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
}

const patches: ProductPatch[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // ESONIC
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 100,
    featuredImage: "/products/esonic/esonic_cam_u7.jpg",
    galleryImages: JSON.stringify(["/products/esonic/esonic_cam_u7.jpg"]),
    shortDescription: "Esonic CAM-U7 miniature hidden audio-video camcorder with SD card recording and long battery life for covert surveillance.",
    longDescription: `Esonic CAM-U7 — Professional Miniature Hidden Audio/Video Camcorder

The Esonic CAM-U7 is a premium covert surveillance device disguised as an everyday USB flash drive. Indistinguishable from an ordinary pen drive, it records high-definition audio and video continuously without drawing attention.

Key Features:
• HD Video Recording: 1280 × 960 resolution at 30fps
• Crystal-Clear Audio: Built-in high-sensitivity microphone captures voice up to 5 metres
• Continuous Loop Recording: Automatically overwrites oldest footage when storage is full
• Motion Detection Mode: Only records when movement is detected — conserves storage
• Timestamp Overlay: Date and time burned into every recording
• Storage: MicroSD up to 32GB (not included) — approx. 4 hours per 8GB
• Battery: 300mAh internal — up to 80 minutes continuous recording
• Charging: USB (charges while recording in plug-in mode)
• OS Compatibility: Windows, Mac, Linux — plug-and-play, no drivers needed

Dimensions: 60 × 20 × 9mm — identical to a standard USB drive
Build: Aluminium alloy casing — robust and heat-resistant

Included: CAM-U7 unit, USB charging cable, User manual

Use Cases:
Meeting room evidence gathering, personal safety documentation, home monitoring, investigative journalism.`,
    metaTitle: "Esonic CAM-U7 Hidden Camera USB Drive Recorder Pakistan — Geem.pk",
    metaDescription: "Buy Esonic CAM-U7 mini hidden camera in Pakistan. HD video, audio recording, USB disguise. Covert surveillance device — Geem.pk.",
    metaKeywords: "esonic cam-u7,hidden camera pakistan,mini spy camera,covert recorder,usb spy cam,surveillance device pakistan",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CARBON FIBER SPOOLS
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 101,
    featuredImage: "/products/carbon-fiber/cf_spool_1k.jpg",
    galleryImages: JSON.stringify(["/products/carbon-fiber/cf_spool_1k.jpg"]),
    shortDescription: "Toray T700 12K carbon fiber spool — 7200 denier, standard modulus, for structural composites, filament winding and prepreg manufacture.",
    longDescription: `Toray T700 12K Carbon Fiber Spool — 7200D High-Strength Tow

Toray T700 is the global benchmark for standard-modulus carbon fibre. The 12K (12,000 filament) tow is widely specified in aerospace substructures, automotive body panels, industrial pressure vessels, and marine hull layups.

Fibre Properties (T700SC-12K):
• Tensile Strength: 4900 MPa
• Tensile Modulus: 230 GPa
• Elongation at Break: 2.1%
• Filament Count: 12,000 (12K)
• Linear Density: 800 g/km (800 tex)
• Filament Diameter: 7 μm
• Density: 1.80 g/cm³
• Sizing: Epoxy-compatible

Spool Details:
• Net Weight: 2 kg per spool (typical)
• Winding: Precision cross-wound for smooth payoff in automated equipment
• Core: Cardboard tube, inner diameter 76mm (3-inch)

Applications:
Filament winding (pressure vessels, pipes, poles), weaving (fabric production), pultrusion profiles, tape laying, prepreg manufacture, braiding.

Supplied by Geem — authorised stockist. Minimum order: 1 spool. Bulk pricing available on 10+ spools.

Storage: Keep in sealed packaging below 25°C, away from UV and moisture.`,
    metaTitle: "Toray T700 12K Carbon Fiber Spool Pakistan — Geem.pk",
    metaDescription: "Toray T700 12K carbon fibre spool in Pakistan. 4900MPa tensile strength. Aerospace, automotive, marine composites. Geem.pk.",
    metaKeywords: "toray t700 carbon fiber,12k carbon fiber spool,carbon fibre pakistan,composite materials,filament winding",
  },
  {
    id: 102,
    featuredImage: "/products/carbon-fiber/cf_spool_1k.jpg",
    galleryImages: JSON.stringify(["/products/carbon-fiber/cf_spool_1k.jpg"]),
    shortDescription: "Toray T700 24K carbon fiber spool — 14400 denier heavy tow for high-deposition filament winding, pultrusion and structural composites.",
    longDescription: `Toray T700 24K Carbon Fiber Spool — 14400D Heavy Tow

The 24K (24,000 filament) tow delivers the same outstanding T700 mechanical properties in a high-deposition format, ideal for large structural components where production rate matters.

Fibre Properties (T700SC-24K):
• Tensile Strength: 4900 MPa
• Tensile Modulus: 230 GPa
• Filament Count: 24,000 (24K)
• Linear Density: 1600 g/km (1600 tex)
• Filament Diameter: 7 μm
• Sizing: Epoxy-compatible

Best For:
Large-diameter pipe and vessel filament winding, pultrusion beams and profiles, thick-section prepreg layup, heavy braiding applications.

Spool: 2–4 kg net, precision cross-wound, 76mm cardboard core.

Geem supplies Toray carbon fibre to composite fabricators across Pakistan. Bulk pricing available.`,
    metaTitle: "Toray T700 24K Carbon Fiber Spool Pakistan — Geem.pk",
    metaDescription: "Toray T700 24K heavy tow carbon fibre spool in Pakistan. High-deposition filament winding, pultrusion. Geem.pk.",
    metaKeywords: "toray t700 24k carbon fiber,heavy tow carbon fiber,filament winding pakistan,composite fiber spool",
  },
  {
    id: 103,
    featuredImage: "/products/carbon-fiber/cf_toray_t800.jpg",
    galleryImages: JSON.stringify(["/products/carbon-fiber/cf_toray_t800.jpg"]),
    shortDescription: "Toray T800 12K carbon fiber spool — intermediate-modulus high-strength tow for aerospace, motorsport and high-performance structural applications.",
    longDescription: `Toray T800 12K Carbon Fiber Spool — Intermediate Modulus, High Strength

Toray T800 represents the step up from standard-modulus T700, delivering significantly higher tensile strength in an intermediate-modulus fibre. Specified in primary aerospace structures, Formula 1 components, and high-performance sports equipment.

Fibre Properties (T800SC-12K):
• Tensile Strength: 5880 MPa (+20% vs T700)
• Tensile Modulus: 294 GPa (intermediate modulus)
• Elongation at Break: 2.0%
• Filament Count: 12,000 (12K)
• Filament Diameter: 5 μm (finer than T700)
• Density: 1.80 g/cm³
• Sizing: Epoxy-compatible

Applications:
Aerospace primary structures (wing skins, spars), motorsport chassis and bodywork, high-end bicycle frames, sporting goods, UAV airframes, pressure vessels requiring thin walls with maximum strength.

Spool: 2 kg net, precision wound, 76mm core. Store below 25°C in sealed packaging.

Minimum order: 1 spool. Contact Geem for project quantities.`,
    metaTitle: "Toray T800 12K Carbon Fiber Spool Pakistan — Geem.pk",
    metaDescription: "Toray T800 12K intermediate-modulus carbon fibre spool. 5880MPa tensile strength. Aerospace, motorsport. Geem.pk Pakistan.",
    metaKeywords: "toray t800 carbon fiber,intermediate modulus carbon fiber,aerospace carbon fiber pakistan,12k tow spool",
  },
  {
    id: 104,
    featuredImage: "/products/carbon-fiber/cf_spool_1k.jpg",
    galleryImages: JSON.stringify(["/products/carbon-fiber/cf_spool_1k.jpg"]),
    shortDescription: "1K 600D carbon fiber spool — 1000 filament fine tow for narrow weaves, thin laminates, decorative braids and precision composite parts.",
    longDescription: `1K 600D Carbon Fiber Spool — Fine Tow for Precision Applications

1K (1,000 filament) carbon fibre tow is the finest standard tow count available. Its slender profile makes it ideal for narrow weave fabrics, decorative tube braiding, thin laminate prepregs, and intricate 3D woven structures.

Properties:
• Filament Count: 1,000 (1K)
• Linear Density: ~67 g/km (67 tex) — 600 denier
• Tensile Strength: 3500–4500 MPa (grade-dependent)
• Modulus: 230–240 GPa
• Sizing: Epoxy-compatible

Applications:
Narrow woven tapes, surface veil fabrics, decorative carbon braiding on tubes and shafts, precision aerospace ribs, thin-wall prepreg components, hobbyist composite work.

Spool: 500g–1 kg net. Contact Geem for availability and pricing.`,
    metaTitle: "1K Carbon Fiber Spool 600D Pakistan — Geem.pk",
    metaDescription: "1K 600D fine tow carbon fibre spool in Pakistan. Decorative braiding, thin laminates, precision composites. Geem.pk.",
    metaKeywords: "1k carbon fiber spool,fine tow carbon fiber,600d carbon fiber,carbon fibre pakistan",
  },
  {
    id: 105,
    featuredImage: "/products/carbon-fiber/cf_spool_3k.jpg",
    galleryImages: JSON.stringify(["/products/carbon-fiber/cf_spool_3k.jpg"]),
    shortDescription: "3K 1800D carbon fiber spool — the most versatile tow count for fabric weaving, wet layup, filament winding, and hobbyist-to-professional composites.",
    longDescription: `3K 1800D Carbon Fiber Spool — The Industry-Standard Tow

3K (3,000 filament) is the most commonly used carbon fibre tow count worldwide. Balanced between handling ease and performance, it weaves into the crisp 3K fabrics used across aerospace, automotive, sports goods, and consumer composites.

Properties:
• Filament Count: 3,000 (3K)
• Linear Density: ~200 g/km (200 tex) — 1800 denier
• Tensile Strength: 3500–4900 MPa
• Modulus: 230–240 GPa
• Sizing: Epoxy-compatible

Applications:
Hand layup and vacuum infusion laminates, 3K plain/twill fabric weaving, filament winding, tube rolling, wet winding on mandrels, UAV components, bicycle frames, automotive trim.

Spool: 1–2 kg net, 76mm cardboard core. Ask Geem about bulk reel pricing.`,
    metaTitle: "3K Carbon Fiber Spool 1800D Pakistan — Geem.pk",
    metaDescription: "3K 1800D carbon fibre spool — industry standard tow. Fabric weaving, filament winding, layup. Geem.pk Pakistan.",
    metaKeywords: "3k carbon fiber spool,1800d carbon fiber tow,carbon fibre spool pakistan,composite materials",
  },
  {
    id: 106,
    featuredImage: "/products/carbon-fiber/cf_spool_6k.jpg",
    galleryImages: JSON.stringify(["/products/carbon-fiber/cf_spool_6k.jpg"]),
    shortDescription: "6K 3600D carbon fiber spool — mid-range tow for high-rate fabric weaving, filament winding of pressure vessels and structural pultruded profiles.",
    longDescription: `6K 3600D Carbon Fiber Spool — Mid-Range Industrial Tow

6K (6,000 filament) tow bridges the gap between the popular 3K weaving tow and heavy industrial 12K/24K. It is widely used in semi-structural fabric production and medium-deposition filament winding.

Properties:
• Filament Count: 6,000 (6K)
• Linear Density: ~400 g/km (400 tex) — 3600 denier
• Tensile Strength: 3500–4900 MPa
• Modulus: 230–240 GPa
• Sizing: Epoxy-compatible

Applications:
6K woven fabrics (higher areal weight than 3K), pressure vessel winding, pultrusion with wider tow bands, structural rod and bar production, wind blade spar caps.

Spool: 1–2 kg net. Bulk pricing available.`,
    metaTitle: "6K Carbon Fiber Spool 3600D Pakistan — Geem.pk",
    metaDescription: "6K 3600D carbon fibre spool for industrial composites, fabric weaving, filament winding. Geem.pk Pakistan.",
    metaKeywords: "6k carbon fiber spool,3600d carbon fiber,industrial carbon fiber pakistan",
  },
  {
    id: 107,
    featuredImage: "/products/carbon-fiber/cf_spool_12k.jpg",
    galleryImages: JSON.stringify(["/products/carbon-fiber/cf_spool_12k.jpg"]),
    shortDescription: "12K 7200D carbon fiber spool — high-deposition tow for large structural filament winding, pultrusion beams, and industrial composite manufacture.",
    longDescription: `12K 7200D Carbon Fiber Spool — High-Deposition Industrial Tow

12K (12,000 filament) tow is the workhorse of the industrial composites sector. It delivers high material deposition rates while maintaining excellent mechanical properties — reducing cost per kg of finished part.

Properties:
• Filament Count: 12,000 (12K)
• Linear Density: ~800 g/km (800 tex) — 7200 denier
• Tensile Strength: 3500–4900 MPa
• Modulus: 230–240 GPa
• Sizing: Epoxy-compatible

Applications:
Large pressure vessel and pipe winding, pultrusion I-beams and profiles, heavy braiding, thick-section wet layup, wind blade girder spar caps, infrastructure reinforcement rods.

Spool: 2–5 kg net. Ask Geem for bulk pricing on 10+ spools.`,
    metaTitle: "12K Carbon Fiber Spool 7200D Pakistan — Geem.pk",
    metaDescription: "12K 7200D industrial carbon fibre spool. High-deposition filament winding, pultrusion. Geem.pk Pakistan.",
    metaKeywords: "12k carbon fiber spool,7200d carbon fiber,industrial carbon fiber,filament winding pakistan",
  },
  {
    id: 108,
    featuredImage: "/products/carbon-fiber/cf_spool_24k.jpg",
    galleryImages: JSON.stringify(["/products/carbon-fiber/cf_spool_24k.jpg"]),
    shortDescription: "24K 14400D carbon fiber spool — heavy-deposition large tow for maximum production rate in pipes, tanks, structural beams and wind energy components.",
    longDescription: `24K 14400D Carbon Fiber Spool — Large Tow for Maximum Throughput

24K (24,000 filament) large-tow carbon fibre reduces raw material cost while maintaining structural performance. It is the preferred choice for cost-sensitive industrial applications where production throughput matters.

Properties:
• Filament Count: 24,000 (24K)
• Linear Density: ~1600 g/km (1600 tex) — 14400 denier
• Tensile Strength: 3500–4500 MPa
• Modulus: 230–240 GPa
• Sizing: Epoxy-compatible

Applications:
Wind turbine blade manufacture, large structural pipe and vessel winding, civil infrastructure reinforcement, pultruded structural sections, construction rebar replacement.

Cost per kg of finished part is 20–30% lower than equivalent 3K-based structures. Minimum order: 1 spool.`,
    metaTitle: "24K Carbon Fiber Spool 14400D Pakistan — Geem.pk",
    metaDescription: "24K 14400D large-tow carbon fibre spool. Maximum throughput for industrial composites. Geem.pk Pakistan.",
    metaKeywords: "24k carbon fiber spool,large tow carbon fiber,industrial carbon fiber pakistan,14400d tow",
  },

  // ─── Carbon Fiber Fabrics ────────────────────────────────────────────────
  {
    id: 109,
    featuredImage: "/products/carbon-fiber/cf_plain_weave.jpg",
    galleryImages: JSON.stringify(["/products/carbon-fiber/cf_plain_weave.jpg", "/products/carbon-fiber/cf_twill_weave.jpg"]),
    shortDescription: "3K 200GSM plain weave carbon fiber fabric — balanced, crisp checkerboard pattern for structural laminates, moulds and aesthetic carbon parts.",
    longDescription: `Carbon Fiber Fabric — 3K 200GSM Plain Weave

Plain weave carbon fibre fabric has an over-under interlacing pattern that produces the classic tight checkerboard appearance. It is highly stable (less prone to distortion than twill) and delivers excellent mechanical properties in both warp and weft directions.

Specifications:
• Fibre: PAN-based standard modulus carbon (T300/T700 equivalent)
• Weave: Plain (1/1) — equal strength in both directions
• Tow Count: 3K (3,000 filaments per tow)
• Areal Weight: 200 g/m²
• Fabric Width: 100cm (1 metre)
• Thickness (uncured): ~0.22mm
• Tensile Strength (0°): ~600 MPa (with epoxy)
• Fibre Volume Fraction: ~55% (vacuum infusion)
• Compatible Resins: Epoxy, polyester, vinyl ester

Applications:
Structural laminates requiring equal biaxial stiffness, carbon tube wrapping, flat panel production, mould making, motorsport bodywork, marine decking, decorative covers.

Supplied per linear metre. Contact Geem for roll quantities.`,
    metaTitle: "3K 200GSM Plain Weave Carbon Fiber Fabric Pakistan — Geem.pk",
    metaDescription: "3K 200GSM plain weave carbon fibre fabric in Pakistan. Structural laminates, automotive, marine. Per metre — Geem.pk.",
    metaKeywords: "carbon fiber fabric pakistan,plain weave carbon fiber,3k 200gsm carbon,composite fabric",
  },
  {
    id: 110,
    featuredImage: "/products/carbon-fiber/cf_twill_weave.jpg",
    galleryImages: JSON.stringify(["/products/carbon-fiber/cf_twill_weave.jpg", "/products/carbon-fiber/cf_plain_weave.jpg"]),
    shortDescription: "3K 200GSM twill weave carbon fiber fabric — 2×2 diagonal weave pattern for superior drapeability over complex curves and the iconic carbon look.",
    longDescription: `Carbon Fiber Fabric — 3K 200GSM Twill Weave (2×2)

Twill weave (2/2) carbon fibre is the most recognisable and widely used fabric style, producing the diagonal chevron pattern synonymous with high-performance composites. The offset interlacing gives it better drapeability than plain weave — critical for complex curved mould surfaces.

Specifications:
• Fibre: PAN-based standard modulus carbon (T300/T700 equivalent)
• Weave: 2×2 Twill — diagonal diagonal pattern
• Tow Count: 3K (3,000 filaments per tow)
• Areal Weight: 200 g/m²
• Fabric Width: 100cm (1 metre)
• Thickness (uncured): ~0.22mm
• Drapeability: Excellent — conforms to compound curves
• Compatible Resins: Epoxy, polyester, vinyl ester, bio-resin

Applications:
Automotive body panels and bonnets, motorcycle fairings, carbon fibre body kits, helmet shells, sports equipment, boat hulls, drone frames, architectural decorative panels — any part requiring both performance and aesthetics.

Supplied per linear metre. Bulk roll pricing available.`,
    metaTitle: "3K 200GSM Twill Weave Carbon Fiber Fabric Pakistan — Geem.pk",
    metaDescription: "3K 200GSM twill weave carbon fibre fabric in Pakistan. Superior drape, iconic diagonal look. Automotive, motorsport. Geem.pk.",
    metaKeywords: "carbon fiber fabric twill pakistan,3k twill carbon,carbon fibre cloth pakistan,composite fabric",
  },
  {
    id: 111,
    featuredImage: "/products/carbon-fiber/cf_ud_fabric.jpg",
    galleryImages: JSON.stringify(["/products/carbon-fiber/cf_ud_fabric.jpg"]),
    shortDescription: "Carbon fiber unidirectional UD fabric — all fibres run in one direction for maximum stiffness and strength along the primary load axis.",
    longDescription: `Carbon Fiber Unidirectional (UD) Fabric

Unidirectional carbon fibre places all fibres parallel in one direction (0°), held in place by a light glass or polyester stitch. This maximises fibre volume fraction and delivers the highest possible stiffness and strength along the primary load direction — surpassing woven fabrics of the same areal weight.

Specifications:
• Fibre: PAN-based standard modulus (T700 equivalent)
• Architecture: Unidirectional 0° — all fibres aligned
• Areal Weight: 200–300 g/m² (ask for current stock)
• Width: 100–125cm
• Stitching: Light polyester veil — minimal crimp
• Fibre Volume Fraction: up to 65% (optimised layup)
• Tensile Modulus (0°): ~135 GPa in laminate
• Compatible Resins: Epoxy, vinyl ester

When to Use UD vs Woven:
Use UD where load is primarily unidirectional — beams, spars, columns, longerons, stiffeners. Use woven fabric where biaxial or multidirectional loads exist, or where aesthetics matter.

Applications:
Aerospace spars and skins, wind turbine blade load-bearing layers, marine hull longitudinals, automotive A-pillars, sports equipment shafts (ski poles, bike frames), structural repair patches.

Supplied per linear metre. Contact Geem for project quotes and roll sizes.`,
    metaTitle: "Carbon Fiber Unidirectional UD Fabric Pakistan — Geem.pk",
    metaDescription: "Carbon fibre UD unidirectional fabric in Pakistan. Maximum stiffness along load axis. Aerospace, automotive, marine. Geem.pk.",
    metaKeywords: "carbon fiber ud fabric,unidirectional carbon fiber,carbon fibre pakistan,composite ud fabric",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ARALDITE EPOXY RESIN SYSTEMS
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 112,
    featuredImage: "/products/araldite/araldite_ly5052.png",
    galleryImages: JSON.stringify(["/products/araldite/araldite_ly5052.png"]),
    shortDescription: "Araldite LY 5052 / ARADUR 5052 — low-viscosity epoxy system for vacuum infusion, resin transfer moulding (RTM) and wet layup of fibre composites.",
    longDescription: `Araldite LY 5052 / ARADUR 5052 — Infusion & RTM Epoxy System

Araldite LY 5052 paired with ARADUR 5052 hardener is Huntsman's premier system for vacuum-assisted resin infusion (VARI), resin transfer moulding (RTM), and hand layup of carbon fibre, glass fibre, and aramid composites.

System Characteristics:
• Mixed Viscosity: ~300–500 mPa·s at 25°C — easily infuses dense fibre packs
• Pot Life (100g mix): 40–60 minutes at 25°C (ample working time)
• Gel Time: 4–6 hours at 25°C
• Mix Ratio (by weight): 100:38 (Resin:Hardener)
• Post-Cure (recommended): 8 hrs at 60°C or 4 hrs at 80°C
• Cured Glass Transition Temp (Tg): ~85°C (post-cured)
• Cured Tensile Strength: ~75 MPa
• Cured Flexural Modulus: ~3.1 GPa
• Shrinkage: <2% — minimal print-through

Applications:
CFRP/GFRP structural parts via infusion (automotive panels, marine hulls, wind blades), RTM closed-mould parts, vacuum-bagged hand layup, tooling skins.

Supplied: Resin and hardener in separate containers. Mix only the quantity needed. Store below 25°C, away from moisture. Shelf life: 12 months from manufacture date.

Geem is an authorised Huntsman distributor in Pakistan.`,
    metaTitle: "Araldite LY 5052 ARADUR 5052 Epoxy Resin Pakistan — Geem.pk",
    metaDescription: "Araldite LY 5052 / ARADUR 5052 infusion epoxy system in Pakistan. Low viscosity, VARI/RTM. Authorised Huntsman distributor. Geem.pk.",
    metaKeywords: "araldite ly 5052,aradur 5052,epoxy infusion resin pakistan,huntsman epoxy,RTM epoxy,composite resin pakistan",
  },
  {
    id: 113,
    featuredImage: "/products/araldite/araldite_ly5052.png",
    galleryImages: JSON.stringify(["/products/araldite/araldite_ly5052.png"]),
    shortDescription: "Araldite LY 5052 / ARADUR 5052 CH — same proven infusion system with the CH (China-grade) hardener variant, optimised for ambient-temperature cure.",
    longDescription: `Araldite LY 5052 / ARADUR 5052 CH — Ambient-Cure Infusion Epoxy

The CH hardener variant of the LY 5052 system is formulated for slower ambient-temperature cure, giving fabricators maximum control during large-area infusion layups in warm climates.

Key Differences vs Standard 5052:
• Extended pot life: 60–90 minutes at 25°C — suits large infusion panels
• Full cure achievable at room temperature (24–48 hrs at 25°C without post-cure oven)
• Slightly lower Tg without post-cure (~65°C) — adequate for most ambient-use parts
• Post-cure at 60°C achieves Tg ~80°C

Mechanical Properties (post-cured):
• Tensile Strength: ~73 MPa
• Flexural Modulus: ~3.0 GPa
• Elongation at Break: ~3.5%

Mix Ratio: 100:40 by weight (Resin:ARADUR 5052 CH)

Best For: Large wind blade infusion, boat hull infusion in non-climate-controlled workshops, wide flat panel production, ambient-cure tooling repairs.

Geem stocks this system for immediate delivery across Pakistan.`,
    metaTitle: "Araldite LY 5052 ARADUR 5052 CH Epoxy System Pakistan — Geem.pk",
    metaDescription: "Araldite LY 5052 / ARADUR 5052 CH ambient-cure infusion epoxy in Pakistan. Extended pot life. Huntsman. Geem.pk.",
    metaKeywords: "araldite 5052 ch,epoxy infusion pakistan,ambient cure epoxy,huntsman composite resin",
  },
  {
    id: 114,
    featuredImage: "/products/araldite/araldite_1564.jpg",
    galleryImages: JSON.stringify(["/products/araldite/araldite_1564.jpg"]),
    shortDescription: "Araldite LY 1564 / ARADUR 3474 — medium-viscosity epoxy system for hand layup, filament winding and structural bonding of composite parts.",
    longDescription: `Araldite LY 1564 / ARADUR 3474 — Hand Layup & Winding Epoxy System

Araldite LY 1564 with ARADUR 3474 hardener is a versatile medium-viscosity system suitable for a wide range of composite fabrication methods. Its balanced reactivity profile gives consistent results in hot climates.

System Properties:
• Mixed Viscosity: ~800–1200 mPa·s at 25°C
• Pot Life (100g): 30–45 minutes at 25°C
• Mix Ratio: 100:34 by weight
• Cure Cycle: 24 hrs at RT or 4 hrs at 60°C
• Tg (post-cured): ~80°C
• Tensile Strength: ~76 MPa
• Flexural Modulus: ~3.2 GPa
• Elongation: ~4.5%

Applications:
Glass and carbon fibre hand layup (boats, tanks, pipes), filament winding of small to medium pressure vessels, structural adhesive bonding, repair of composite structures.

Pakistan availability: In-stock. Contact Geem for technical data sheet and MSDS.`,
    metaTitle: "Araldite LY 1564 ARADUR 3474 Epoxy System Pakistan — Geem.pk",
    metaDescription: "Araldite LY 1564 / ARADUR 3474 hand layup epoxy system in Pakistan. Filament winding, structural bonding. Geem.pk.",
    metaKeywords: "araldite ly 1564,aradur 3474,hand layup epoxy pakistan,filament winding resin,huntsman epoxy",
  },
  {
    id: 115,
    featuredImage: "/products/araldite/araldite_3585.jpg",
    galleryImages: JSON.stringify(["/products/araldite/araldite_3585.jpg"]),
    shortDescription: "Araldite LY 3585 / ARADUR 3475 — low-viscosity epoxy resin system for vacuum infusion, RTM and resin film infusion (RFI) of advanced composites.",
    longDescription: `Araldite LY 3585 / ARADUR 3475 — Low-Viscosity Infusion Epoxy

The LY 3585 / ARADUR 3475 system is engineered for processes that demand extremely low viscosity during infusion and a controlled exothermic cure. It is widely used in aerospace-grade composite fabrication.

System Properties:
• Mixed Viscosity: ~180–250 mPa·s at 25°C (very low — ideal for thick preform infusion)
• Pot Life (500g mix): 60–90 minutes at 25°C
• Mix Ratio: 100:35 by weight
• Cure: 8 hrs at 60°C or 4 hrs at 80°C
• Tg (post-cured at 120°C): ~120°C — high-temperature service capability
• Tensile Strength: ~82 MPa
• Flexural Modulus: ~3.4 GPa

Applications:
Aerospace structural infusion, high-Tg automotive parts, defence composite panels, naval hull infusion, high-temperature tooling masters.

Huntsman Araldite — supplied by Geem, authorised Pakistan distributor.`,
    metaTitle: "Araldite LY 3585 ARADUR 3475 Epoxy System Pakistan — Geem.pk",
    metaDescription: "Araldite LY 3585 / ARADUR 3475 low-viscosity infusion epoxy. High Tg, aerospace-grade. Geem.pk Pakistan.",
    metaKeywords: "araldite ly 3585,aradur 3475,infusion epoxy pakistan,high tg epoxy,aerospace composite resin",
  },
  {
    id: 116,
    featuredImage: "/products/araldite/araldite_8615.jpg",
    galleryImages: JSON.stringify(["/products/araldite/araldite_8615.jpg"]),
    shortDescription: "Araldite LY 8615 / ARADUR 8615 — fast-cure toughened epoxy system for structural bonding, repair, and short-cycle composite manufacture.",
    longDescription: `Araldite LY 8615 / ARADUR 8615 — Fast-Cure Toughened Epoxy System

The LY 8615 system is a toughened, fast-curing epoxy designed for applications requiring both high strength and impact resistance. Its rapid cure makes it ideal for production environments.

System Properties:
• Mixed Viscosity: ~2000–3000 mPa·s at 25°C (thixotropic paste-like)
• Pot Life: 20–30 minutes at 25°C
• Mix Ratio: 100:100 by weight (1:1 easy-mix)
• Cure: Full cure in 2 hrs at 60°C or 24 hrs at RT
• Tg: ~75°C (RT cure), ~100°C (60°C cure)
• Impact Strength: ~60 kJ/m² (toughened formulation)
• Tensile Strength: ~65 MPa

Applications:
Structural adhesive bonding of composite joints, rapid repair of CFRP/GFRP parts, bonding metal inserts, potting and encapsulation, tooling repair, short-run moulding with fast demould.

Supplied in separate containers. 1:1 mix ratio simplifies field use. Full TDS and MSDS available from Geem.`,
    metaTitle: "Araldite LY 8615 ARADUR 8615 Toughened Epoxy Pakistan — Geem.pk",
    metaDescription: "Araldite LY 8615 / ARADUR 8615 fast-cure toughened epoxy. Structural bonding, repair. Geem.pk Pakistan.",
    metaKeywords: "araldite 8615,fast cure epoxy pakistan,toughened epoxy,structural adhesive epoxy,huntsman",
  },
  {
    id: 117,
    featuredImage: "/products/araldite/araldite_3031.jpg",
    galleryImages: JSON.stringify(["/products/araldite/araldite_3031.jpg", "/products/araldite/araldite_1564.jpg"]),
    shortDescription: "Araldite LY 3031 / ARADUR 3032 — medium-viscosity epoxy system for wet filament winding, hand layup and structural applications requiring high Tg.",
    longDescription: `Araldite LY 3031 / ARADUR 3032 — Filament Winding & Layup Epoxy

The LY 3031 / ARADUR 3032 system is specifically optimised for wet filament winding of pressure vessels, pipes, and poles — delivering excellent fibre wetout, controlled drip-off, and high post-cure Tg.

System Properties:
• Mixed Viscosity: ~600–900 mPa·s at 25°C (ideal for winding bath)
• Pot Life (1 kg mix): 90–120 minutes at 25°C
• Mix Ratio: 100:30 by weight
• Post-Cure: 2 hrs at 80°C + 2 hrs at 120°C
• Tg (fully post-cured): ~130°C — suitable for pressure service
• Tensile Strength: ~80 MPa
• Elongation at Break: ~3.0%
• Chemical Resistance: Excellent to water, dilute acids, alkalis

Applications:
CNG/H₂ pressure vessels (type 3 and 4), fire suppression cylinders, chemical storage tanks, utility poles, transmission shafts, structural tubes for construction.

Geem supplies this system to pressure vessel manufacturers across Pakistan. Ask for volume pricing.`,
    metaTitle: "Araldite LY 3031 ARADUR 3032 Filament Winding Epoxy Pakistan — Geem.pk",
    metaDescription: "Araldite LY 3031 / ARADUR 3032 filament winding epoxy. High Tg, pressure vessels, pipes. Geem.pk Pakistan.",
    metaKeywords: "araldite ly 3031,aradur 3032,filament winding epoxy pakistan,pressure vessel resin,huntsman epoxy",
  },
  {
    id: 118,
    featuredImage: "/products/araldite/araldite_3508.jpg",
    galleryImages: JSON.stringify(["/products/araldite/araldite_3508.jpg"]),
    shortDescription: "Araldite LY 3508 / ARADUR 3478 — high-performance epoxy system for elevated-temperature composite tooling, autoclave processing and prepreg manufacture.",
    longDescription: `Araldite LY 3508 / ARADUR 3478 — High-Temperature Tooling Epoxy

The LY 3508 / ARADUR 3478 system is engineered for elevated-temperature service and autoclave processes — producing tools and parts that maintain dimensional stability at temperatures up to 180°C.

System Properties:
• Mixed Viscosity: ~400–600 mPa·s at 40°C (heated application)
• Mix Ratio: 100:25 by weight
• Cure Cycle: 4 hrs at 80°C + 4 hrs at 150°C (full post-cure)
• Tg (fully post-cured): ~175°C
• Tensile Strength: ~85 MPa
• Flexural Modulus: ~3.8 GPa
• CTE: ~55 ppm/°C — compatible with CFRP tooling

Applications:
Carbon fibre autoclave tooling, prepreg curing jigs, high-temperature structural panels, aerospace composite parts, defence applications requiring >150°C service temperature.

Technical data sheet and MSDS available. Full post-cure protocol required to achieve rated Tg. Supplied by Geem — contact us for project quantities and engineering support.`,
    metaTitle: "Araldite LY 3508 ARADUR 3478 High-Temp Epoxy Pakistan — Geem.pk",
    metaDescription: "Araldite LY 3508 / ARADUR 3478 high-temperature tooling epoxy. 175°C Tg, autoclave processing. Geem.pk Pakistan.",
    metaKeywords: "araldite ly 3508,aradur 3478,high temperature epoxy pakistan,autoclave epoxy,tooling resin",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GEEM INDUSTRIAL BATTERY PRODUCTS
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 119,
    featuredImage: "/products/battery/lithium_ion_pack.png",
    galleryImages: JSON.stringify(["/products/battery/lithium_ion_pack.png", "/products/battery/cylindrical_cell.jpg"]),
    shortDescription: "Custom lithium-ion NCM battery pack engineering — bespoke battery design, prototyping and small-series manufacture for industrial and OEM applications.",
    longDescription: `Geem Custom Lithium-Ion NCM Battery Pack Engineering

Geem's battery engineering team designs and builds custom lithium-ion NMC (Nickel Manganese Cobalt) battery packs from specification to finished product. Whether you need a prototype or a small production run, we handle the full design-manufacture cycle in-house.

What We Deliver:
• Cell Selection: Premium NCM cylindrical (18650/21700) or prismatic cells — matched for your voltage, capacity, and cycle-life requirements
• BMS Integration: Custom or off-shelf Battery Management System selection, programming, and integration
• Mechanical Design: Enclosure design in aluminium, stainless steel, or engineering plastic — IP-rated to your spec
• Electrical Design: Bus bar routing, fusing, connector selection (XT60, Anderson, MIL-spec, custom)
• Thermal Management: Passive (foam padding, heat spreaders) or active (liquid cooling) — analysed and validated

Typical Specifications We Build:
• Voltage range: 12V – 800V (series cell configuration)
• Capacity: 1 kWh – 100+ kWh
• Discharge rate: up to 10C continuous (cell-dependent)
• Cycle life: 500–2000+ cycles to 80% capacity
• Operating temperature: -20°C to +60°C

Industries Served:
Electric vehicles and e-rickshaws, industrial automation, renewable energy storage, marine and subsea equipment, medical devices, UAVs and robotics, telecom backup power.

Process: Requirement brief → Cell selection → Schematic → Prototype → Test → Production. Lead time: 4–12 weeks depending on complexity.

Contact Geem to start your battery project brief.`,
    metaTitle: "Custom Lithium-Ion NCM Battery Pack Design Pakistan — Geem.pk",
    metaDescription: "Custom lithium-ion NCM battery pack engineering in Pakistan. 12V–800V, BMS integration, IP-rated enclosures. Industrial & OEM. Geem.pk.",
    metaKeywords: "custom battery pack pakistan,lithium ion ncm battery,battery pack design,OEM battery pakistan,industrial battery",
  },
  {
    id: 120,
    featuredImage: "/products/battery/marine_battery.jpg",
    galleryImages: JSON.stringify(["/products/battery/marine_battery.jpg", "/products/battery/lithium_ion_pack.png"]),
    shortDescription: "Marine and subsea watertight lithium battery systems — IP68-rated enclosures, corrosion-resistant materials, and full BMS for underwater and offshore applications.",
    longDescription: `Geem Marine & Subsea Grade Watertight Battery Systems

Geem designs and manufactures battery packs specifically for marine, offshore, and subsea environments where standard batteries fail. Every aspect — cell chemistry, enclosure, connectors, BMS — is selected and validated for salt water exposure, pressure, and vibration.

Design Standards:
• IP Rating: IP68 minimum (1 metre depth indefinitely; deeper ratings available)
• Enclosure: 316L stainless steel or marine-grade 6061 aluminium — fully welded and O-ring sealed
• Connectors: SubConn, MCBH, or custom wet-mate underwater connectors
• Pressure Rating: Available from 10m to 6000m water depth
• Corrosion Protection: Anodising, powder coating, sacrificial anodes as appropriate

Cell Chemistry Options:
• LiFePO4 (safest — no thermal runaway risk in sealed enclosures)
• NCM (higher energy density — suitable for shallower, lower-risk deployments)
• Hybrid configurations available

Applications:
ROV and AUV propulsion and hotel loads, underwater lighting systems, subsea instrumentation, dive equipment, marine vessel auxiliary power, offshore buoy power systems, tidal energy monitoring equipment.

BMS Features:
• Cell-level voltage monitoring and balancing
• Over-current, over-charge, over-discharge, over-temperature protection
• SOC/SOH reporting via RS-485, CAN, or custom serial
• Data logging for post-dive analysis

Lead time: 6–16 weeks. Geem provides full engineering documentation including FEA pressure analysis, wiring schematics, and test reports.`,
    metaTitle: "Marine Subsea Watertight Lithium Battery System Pakistan — Geem.pk",
    metaDescription: "Custom marine and subsea IP68 watertight lithium battery packs. ROV, AUV, offshore. Geem.pk Pakistan.",
    metaKeywords: "marine battery pack pakistan,subsea battery,underwater battery,IP68 battery,ROV battery,offshore power",
  },
  {
    id: 121,
    featuredImage: "/products/battery/bms_module.jpg",
    galleryImages: JSON.stringify(["/products/battery/bms_module.jpg", "/products/battery/lithium_ion_pack.png"]),
    shortDescription: "Geem Smart BMS integration services — battery management system selection, programming, and integration for custom lithium-ion battery packs.",
    longDescription: `Geem Smart BMS Integration Services

The Battery Management System (BMS) is the brain of any lithium-ion battery pack. Geem's engineering team selects, programmes, and integrates the correct BMS for your specific cell chemistry, pack configuration, and application requirements.

What Our BMS Integration Service Covers:

1. BMS Selection:
• Cell chemistry matching (NMC, LFP, LTO, NCA)
• Current rating (10A – 1000A continuous)
• Protection features: over-voltage, under-voltage, over-current, short-circuit, over-temperature
• Communication: UART, CANbus, RS-485, SMBus, I²C, Modbus
• Active or passive balancing

2. Programming & Configuration:
• Cell voltage thresholds calibrated to cell manufacturer spec
• SoC/SoH algorithm selection and calibration
• CAN ID mapping for vehicle/industrial integration
• Custom protection curves for your operating environment

3. Integration:
• BMS physically installed and wired within the battery pack
• Protection circuit tested under load
• Communication interface verified against your host system (ECU, PLC, charger, inverter)
• Full test report provided

Typical BMS Brands We Work With:
Daly, JBD, Orion BMS, Batrium, Rec-BMS, ANT BMS, custom PCBA.

Service available standalone or as part of a full Geem battery pack build. Contact us with your cell count, voltage, and current requirements.`,
    metaTitle: "Smart BMS Integration Service Pakistan — Geem Battery | Geem.pk",
    metaDescription: "Professional BMS integration for custom lithium battery packs in Pakistan. NMC, LFP, CANbus, RS-485. Geem.pk.",
    metaKeywords: "BMS integration pakistan,battery management system,smart BMS,lithium battery BMS,custom battery pakistan",
  },
  {
    id: 122,
    featuredImage: "/products/battery/hv_battery_pack.jpg",
    galleryImages: JSON.stringify(["/products/battery/hv_battery_pack.jpg", "/products/battery/battery_charger.jpg"]),
    shortDescription: "High-voltage industrial battery pack assembly — 48V to 800V lithium systems for industrial drives, EV powertrains, and grid-edge energy storage.",
    longDescription: `Geem High-Voltage Industrial Battery Pack Assembly

Geem engineers and assembles high-voltage (HV) lithium-ion battery packs for industrial drives, electric vehicle powertrains, and commercial energy storage applications. Our HV packs are built to IEC 62619 and UN 38.3 safety standards.

Voltage & Capacity Range:
• Nominal voltage: 48V to 800V (configurable in 3.6V cell increments)
• Capacity: 10 kWh – 500 kWh
• Peak discharge: up to 5C (application-dependent)
• Charge rate: up to 2C (fast-charge capable)

Safety Features (IEC 62619 compliant):
• Cell-level fusing or fusible links
• Manual Service Disconnect (MSD) with interlock
• Pre-charge circuit to protect contactors
• Galvanic isolation between HV bus and LV control
• HVIL (High Voltage Interlock Loop) where required
• Ground fault detection

Thermal Management:
• Air cooling with managed fans (lower power density)
• Liquid cooling (cold plate or jacket — for high-power packs)
• Phase change material (PCM) thermal buffering

Communication & Interface:
• CAN 2.0B (J1939 or custom DBC) for EV integration
• Modbus TCP/RTU for industrial SCADA
• Insulation monitoring and fault logging

Applications:
E-buses and electric trucks, industrial forklifts, grid-tied BESS, UPS for data centres, telecom towers, mining equipment, marine propulsion.

All HV packs shipped with IEC test reports, wiring schematics, BMS configuration files. Contact Geem for a requirements consultation.`,
    metaTitle: "High-Voltage Industrial Battery Pack Assembly Pakistan — Geem.pk",
    metaDescription: "Custom high-voltage 48V–800V lithium battery packs. Industrial drives, EV, BESS. IEC 62619. Geem.pk Pakistan.",
    metaKeywords: "high voltage battery pack pakistan,industrial battery assembly,EV battery pack,800V battery,BESS pakistan",
  },
  {
    id: 123,
    featuredImage: "/products/battery/cylindrical_cell.jpg",
    galleryImages: JSON.stringify(["/products/battery/cylindrical_cell.jpg", "/products/battery/lithium_ion_pack.png"]),
    shortDescription: "Custom cylindrical cell array configuration — 18650 and 21700 cell selection, spot-welded or buss-bar assembly for battery pack prototyping and production.",
    longDescription: `Geem Custom Cylindrical Cell Array Configuration

Cylindrical lithium-ion cells (18650 and 21700 format) are the most proven and cost-effective format for custom battery packs. Geem's assembly service handles everything from cell grading and matching to finished pack with BMS.

Cell Formats Available:
• 18650 (18mm × 65mm): The original standard — millions tested
• 21700 (21mm × 70mm): Higher energy density — Tesla Model 3/Y format

Cell Brands We Source:
• Panasonic/Sanyo (NCR18650B, NCR21700)
• Samsung SDI (25R, 30Q, 40T)
• LG Chem (MJ1, M50)
• CATL (cylindrical 21700)
• EVE Energy (21700)

Assembly Options:
• Spot-welded nickel strip (up to 40A continuous)
• Copper bus bar (40A–200A continuous)
• Laser-welded aluminium bus bar (200A+)

Quality Control:
• Each cell capacity-graded before assembly (±2% tolerance matched packs)
• IR (internal resistance) measured and matched
• Formation cycle completed before shipping
• Pack tested at rated load before delivery

Minimum Order: 1 prototype pack. Production runs from 10 packs.

Tell Geem your voltage, capacity, and size constraints — we'll design the cell matrix.`,
    metaTitle: "Custom Cylindrical 18650 21700 Battery Cell Array Pakistan — Geem.pk",
    metaDescription: "Custom 18650/21700 cylindrical cell battery assembly in Pakistan. Cell grading, spot-welding, BMS. Geem.pk.",
    metaKeywords: "18650 battery pack pakistan,21700 cell array,custom cylindrical battery,lithium cell assembly pakistan",
  },
  {
    id: 124,
    featuredImage: "/products/battery/battery_charger.jpg",
    galleryImages: JSON.stringify(["/products/battery/battery_charger.jpg", "/products/battery/hv_battery_pack.jpg"]),
    shortDescription: "Geem turnkey industrial battery charger matching — charger selection, integration, and commissioning matched precisely to your custom lithium battery pack.",
    longDescription: `Geem Turnkey Industrial Battery Charger Matching Systems

A battery pack is only as good as its charger. Geem selects, configures, and commissions industrial chargers that are precisely matched to your custom battery pack — voltage range, charge algorithm, communication protocol, and physical interface.

Why Charger Matching Matters:
• Incorrect charge voltage degrades or destroys cells
• Missing communication (CAN/CCS2/CHAdeMO) causes charge failure in EV applications
• Over-current charging reduces cycle life dramatically
• CC-CV profiling must match cell chemistry (NMC vs LFP vs NCA have different optimal curves)

Our Matching Service Covers:
• Charger specification from your pack's BMS parameters
• CC-CV profile programming (constant current → constant voltage → taper)
• CAN/Modbus communication configuration between charger and BMS
• AC input options: Single-phase 230V, three-phase 400V, generator-compatible
• Power levels: 1 kW to 150 kW

Charger Brands We Work With:
Elcon/TC Charger, Delta Electronics, Bel Power, ZAPI, Manzanita Micro, GreenPower, custom OEM PCBA.

Applications:
E-vehicle depot charging (e-rickshaw, truck, bus), industrial forklift charging stations, off-grid solar BESS charge controllers, marine shore power charging systems, UPS battery maintenance charging.

Service includes on-site commissioning and first-charge supervision. Full handover documentation provided.`,
    metaTitle: "Industrial Battery Charger Matching System Pakistan — Geem.pk",
    metaDescription: "Turnkey industrial battery charger selection and integration in Pakistan. Matched to your lithium pack — CAN, CC-CV, 1–150kW. Geem.pk.",
    metaKeywords: "industrial battery charger pakistan,EV charger matching,lithium battery charger,custom charger integration",
  },
];

async function run() {
  console.log("🖼️  Filling missing product images & SEO — Geem.pk\n");
  let updated = 0;

  for (const p of patches) {
    const [existing] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.id, p.id));
    if (!existing) {
      console.log(`  ⚠️  Product id=${p.id} not found — skipping`);
      continue;
    }

    await db.update(productsTable).set({
      featuredImage:    p.featuredImage,
      galleryImages:    p.galleryImages,
      ...(p.shortDescription && { shortDescription: p.shortDescription }),
      ...(p.longDescription   && { longDescription: p.longDescription }),
      ...(p.metaTitle         && { metaTitle: p.metaTitle }),
      ...(p.metaDescription   && { metaDescription: p.metaDescription }),
      ...(p.metaKeywords      && { metaKeywords: p.metaKeywords }),
      published: true,
    }).where(eq(productsTable.id, p.id));

    updated++;
    console.log(`  ✅ Updated [${p.id}]: ${p.featuredImage}`);
  }

  console.log(`\n✅  Done — ${updated} products updated with images & SEO`);
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
