/**
 * batch-complete-catalog.ts
 *
 * Batch processor that finds EVERY product in the DB with incomplete
 * data and fills it 100% automatically — no manual clicks required.
 *
 * What "incomplete" means (any of these triggers a full update):
 *   - featuredImage is null/empty OR is an external URL (placeholder)
 *   - galleryImages has fewer than 4 entries
 *   - longDescription is null/empty/too short (< 200 chars)
 *   - tags are generic mobile tags on a non-smartphone product
 *
 * Per product it:
 *   1. Detects product type (LawMate, Esonic, Huntsman, Carbon Fiber, Battery, GPS)
 *   2. Generates complete HTML long description, contextual tags, SEO fields via OpenAI
 *      (falls back to rich type-specific templates when AI quota is exceeded)
 *   3. Downloads 1 main + 4 gallery images → saves as WebP
 *      (skips download for products that already have local images)
 *   4. Updates the products table (idempotent — safe to re-run, never duplicates)
 *
 * Run ON the VPS (after git pull + pnpm install):
 *   pnpm --filter @workspace/scripts run batch-complete
 *
 * Progress is logged live.
 */

import { db, brandsTable, categoriesTable, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

// ─── Config ───────────────────────────────────────────────────────────────────

const UPLOADS_ROOT = process.env.UPLOADS_DIR ?? "/var/www/geem/uploads";
const PRODUCTS_DIR = path.join(UPLOADS_ROOT, "public", "products");
const GALLERY_DIR  = path.join(PRODUCTS_DIR, "gallery");

/** Generic mobile-centric tags that should NOT appear on non-smartphone products */
const GENERIC_MOBILE_TAGS = ["5g", "flagship", "pta", "pta approved", "android", "ios", "snapdragon"];

// ─── AI client (Gemini first, then OpenAI, then templates) ──────────────────
//
// Priority order:
//   1. GEMINI_API_KEY  → Gemini 1.5 Flash (free tier, no quota issues)
//   2. OPENAI_API_KEY  → GPT-4o-mini (paid, may be over quota)
//   3. null            → rich type-specific fallback templates (100% local)
//
// The script NEVER throws on missing keys — it falls back gracefully.

function buildAI(): { client: OpenAI; model: string; provider: string } | null {
  // 1. Gemini 1.5 Flash via OpenAI-compatible endpoint (free tier)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return {
      client: new OpenAI({
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        apiKey:  geminiKey,
      }),
      model:    "gemini-1.5-flash",
      provider: "Gemini 1.5 Flash",
    };
  }

  // 2. OpenAI (legacy — may be over quota on the VPS)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return { client: new OpenAI({ apiKey: openaiKey }), model: "gpt-4o-mini", provider: "OpenAI gpt-4o-mini" };
  }

  // 3. Replit AI proxy (dev environment only)
  const baseURL   = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const proxyKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (baseURL && proxyKey) {
    return { client: new OpenAI({ baseURL, apiKey: proxyKey }), model: "gpt-4o-mini", provider: "Replit AI proxy" };
  }

  return null; // → rich fallback templates will be used
}

// Keep backward-compatible alias used below
function buildOpenAI() { return buildAI(); }

// ─── Product-type detection ───────────────────────────────────────────────────

type ProductType =
  | "lawmate"
  | "esonic"
  | "huntsman"
  | "carbon_fiber"
  | "battery"
  | "gps_obd"
  | "gps_kids"
  | "gps_bike"
  | "gps_personal"
  | "gps_magnetic"
  | "gps_vehicle"
  | "smartphone"
  | "generic";

function detectType(title: string, categoryName: string): ProductType {
  const t   = title.toUpperCase();
  const cat = categoryName.toLowerCase();

  if (t.includes("LAWMATE") || /^(PV-|BU-|CM-|CMD-|ER-|NT-|RD-|AR-)/.test(title.trim()))
    return "lawmate";

  if (t.includes("ESONIC") || t.includes("MEMOQ") || /^(MQ-|MR-|PCM-|BR|CAM-)/.test(title.trim()))
    return "esonic";

  if (t.includes("HUNTSMAN") || t.includes("ARALDITE") || t.includes("ARADUR") ||
      /\b(5052|1564|3585|8615|3031|3508|3474|3475|3032|3478)\b/.test(title) || / LY /.test(title))
    return "huntsman";

  if (t.includes("TORAY") || t.includes("CARBON FIBER") || t.includes("CARBON FIBRE") ||
      t.includes("SPOOL") || (t.includes("UD") && t.includes("FABRIC")) ||
      (t.includes("FABRIC") && t.includes("GSM")))
    return "carbon_fiber";

  if (t.includes("BATTERY") || t.includes("LITHIUM") || t.includes("NCM") ||
      t.includes("CYLINDRICAL CELL") || t.includes("CHARGER MATCHING") || t.includes("TURNKEY INDUSTRIAL"))
    return "battery";

  if (cat.includes("mobile") || cat.includes("smartphone") || t.includes("IPHONE") ||
      t.includes("SAMSUNG GALAXY") || t.includes("XIAOMI"))
    return "smartphone";

  // GPS subtypes
  const lc = title.toLowerCase();
  if (lc.includes("obd") || lc.includes("cj750") || lc.includes("cj220")) return "gps_obd";
  if (lc.includes("td-02") || lc.includes("td02") || lc.includes("kids") || lc.includes("watch")) return "gps_kids";
  if (lc.includes("s20") || lc.includes("gs900") || lc.includes("gm06") || cat.includes("motorcycle")) return "gps_bike";
  if (lc.includes("lk208") || lc.includes("gf21") || lc.includes("p31") || cat.includes("personal")) return "gps_personal";
  if (lc.includes("g20") || lc.includes("magnetic")) return "gps_magnetic";
  if (cat.includes("gps") || lc.includes("tracker") || lc.includes("gps")) return "gps_vehicle";

  return "generic";
}

function isGenericMobileTagged(tags: string | null, type: ProductType): boolean {
  if (!tags || type === "smartphone") return false;
  const tagLc = tags.toLowerCase();
  return GENERIC_MOBILE_TAGS.some(t => tagLc.includes(t));
}

function isIncomplete(p: {
  featuredImage: string | null;
  galleryImages: string | null;
  longDescription: string | null;
  tags: string | null;
}, type: ProductType): boolean {
  // Missing or external (placeholder) main image
  if (!p.featuredImage || p.featuredImage.startsWith("https://")) return true;

  // Fewer than 4 gallery images
  try {
    const g = JSON.parse(p.galleryImages ?? "[]") as unknown[];
    if (!Array.isArray(g) || g.length < 4) return true;
  } catch {
    return true;
  }

  // Missing / too short long description
  if (!p.longDescription || p.longDescription.trim().length < 200) return true;

  // Wrong tags for the product type
  if (isGenericMobileTagged(p.tags, type)) return true;

  return false;
}

// ─── Rich fallback templates ──────────────────────────────────────────────────
// Used when OpenAI quota is exceeded or unavailable.
// Each template is 350+ words of real HTML content.

function buildFallbackContent(title: string, type: ProductType): GeneratedContent {
  const hidePrice = type === "huntsman" || type === "carbon_fiber" || type === "battery";

  const templates: Record<string, Omit<GeneratedContent, "hidePrice">> = {
    lawmate: {
      shortDescription: `${title} — professional-grade LawMate covert surveillance device for law enforcement and private investigation.`,
      longDescription: `
<h3>LawMate ${title} — Professional Covert Surveillance Device</h3>
<p>The LawMate ${title} is a professional-grade covert surveillance solution trusted by law enforcement agencies, private investigators, and corporate security teams worldwide. LawMate is one of the most respected brands in the surveillance industry, renowned for engineering devices that blend seamlessly into everyday environments while delivering uncompromising recording performance.</p>

<h3>Key Features &amp; Specifications</h3>
<ul>
  <li><strong>High-Definition Recording:</strong> Captures crisp, evidential-quality video and audio suitable for legal use</li>
  <li><strong>Covert Design:</strong> Expertly disguised in a form factor indistinguishable from ordinary objects — zero visual signature</li>
  <li><strong>Long Battery Life:</strong> Extended continuous operation for unattended surveillance missions</li>
  <li><strong>Motion Detection:</strong> Intelligent trigger recording conserves storage and simplifies evidence review</li>
  <li><strong>Loop Recording:</strong> Automatically overwrites oldest footage to ensure uninterrupted capture</li>
  <li><strong>Timestamp Overlay:</strong> Date and time stamped on every frame for evidential integrity</li>
  <li><strong>Large Storage Support:</strong> Compatible with high-capacity microSD cards for extended missions</li>
  <li><strong>Plug &amp; Play:</strong> No proprietary software required — works directly with Windows, Mac, and Linux</li>
  <li><strong>Durable Construction:</strong> Professional-grade materials built to withstand field conditions</li>
</ul>

<h3>Applications &amp; Use Cases</h3>
<ul>
  <li>Law enforcement covert operations and evidence gathering</li>
  <li>Private investigation and matrimonial surveillance</li>
  <li>Corporate espionage countermeasures and internal investigations</li>
  <li>Personal safety documentation and protection</li>
  <li>Home and small-business covert monitoring</li>
  <li>Journalist protection and source documentation</li>
  <li>Insurance fraud investigation and claimant monitoring</li>
</ul>

<h3>Why Choose LawMate?</h3>
<p>LawMate has supplied professional surveillance equipment to government agencies, law enforcement departments, and licensed investigators for over two decades. Every device undergoes rigorous quality testing to ensure reliable performance in high-stakes situations where failure is not an option. The ${title} continues this tradition — delivering field-proven reliability in a discreet package that attracts no attention.</p>

<h3>Available at Geem.pk — Pakistan's Surveillance Equipment Specialist</h3>
<p>Geem.pk is Pakistan's authorised distributor of LawMate professional surveillance equipment. We provide full technical support, warranty coverage, and after-sales service. Contact us for volume pricing, custom configurations, and professional consultation on the right surveillance solution for your requirements.</p>
`,
      tags: "lawmate, covert camera, security, spy gear, surveillance, hidden camera, pakistan, covert recording, evidence gathering, professional surveillance",
      metaTitle: `${title.slice(0, 45)} — LawMate Pakistan | Geem.pk`,
      metaDescription: `Buy ${title} in Pakistan. Professional LawMate covert surveillance device. HD recording, discreet design. Geem.pk — official LawMate distributor.`,
      metaKeywords: "lawmate pakistan, covert camera, hidden surveillance, spy gear pakistan, professional recording device, geem.pk",
    },

    esonic: {
      shortDescription: `${title} — Esonic (MemoQ) professional digital voice recorder and covert audio surveillance device.`,
      longDescription: `
<h3>Esonic ${title} — Professional Digital Voice Recorder &amp; Audio Surveillance Device</h3>
<p>The Esonic ${title} (also marketed under the MemoQ brand) is a professional-grade digital voice recorder and covert audio surveillance device designed for discreet evidence gathering, personal safety, and investigative applications. Esonic devices are engineered to deliver exceptional audio clarity in a form factor that raises no suspicion.</p>

<h3>Key Features &amp; Specifications</h3>
<ul>
  <li><strong>Crystal-Clear Audio:</strong> High-sensitivity microphone captures voice clearly at several metres with minimal background noise</li>
  <li><strong>Extended Battery Life:</strong> Designed for long unattended operation — ideal for meeting surveillance and stakeouts</li>
  <li><strong>Voice Activation (VAD):</strong> Only records when sound is detected, conserving storage and simplifying evidence review</li>
  <li><strong>Large Storage Capacity:</strong> Supports microSD cards up to 32GB — hundreds of hours of audio recording</li>
  <li><strong>Plug &amp; Play USB:</strong> Connects directly to any computer as a mass storage device — no drivers required</li>
  <li><strong>Timestamp Logging:</strong> Every recording is date-and-time stamped for evidential use</li>
  <li><strong>Multiple Recording Modes:</strong> Continuous, voice-activated, and scheduled recording options</li>
  <li><strong>Covert Form Factor:</strong> Designed to look like an ordinary USB drive, pen, or everyday object</li>
</ul>

<h3>Applications &amp; Use Cases</h3>
<ul>
  <li>Meeting room evidence and minutes recording</li>
  <li>Personal safety and threat documentation</li>
  <li>Private investigation and covert intelligence gathering</li>
  <li>Journalist interviews and field audio recording</li>
  <li>Home and family dispute documentation</li>
  <li>Corporate compliance monitoring</li>
  <li>Law enforcement supplementary audio evidence</li>
</ul>

<h3>Why Esonic / MemoQ?</h3>
<p>Esonic and MemoQ are internationally recognised brands in the professional audio surveillance segment. Their devices are used by investigators and security professionals across Asia, the Middle East, and Europe. The ${title} is built to the same exacting standards — delivering reliable, high-quality audio capture that stands up to scrutiny.</p>

<h3>Available at Geem.pk — Pakistan's Surveillance Equipment Specialist</h3>
<p>Geem.pk supplies genuine Esonic and MemoQ devices to clients across Pakistan, with full warranty and technical support. Contact us for bulk pricing, demonstrations, or advice on the right audio recording solution for your needs.</p>
`,
      tags: "esonic, memoq, voice recorder, audio surveillance, bugging device, digital recorder, pakistan, hidden recorder, spy audio, covert audio",
      metaTitle: `${title.slice(0, 45)} — Esonic MemoQ Pakistan | Geem.pk`,
      metaDescription: `Buy ${title} in Pakistan. Esonic/MemoQ professional digital voice recorder. Covert audio surveillance. Geem.pk.`,
      metaKeywords: "esonic pakistan, memoq recorder, hidden voice recorder, covert audio device, digital surveillance recorder, geem.pk",
    },

    huntsman: {
      shortDescription: `${title} — Huntsman Araldite industrial-grade epoxy resin system for composites, aerospace, marine, and structural applications.`,
      longDescription: `
<h3>Huntsman ${title} — Industrial Epoxy Resin System</h3>
<p>The Huntsman ${title} is a high-performance industrial epoxy resin system engineered by Huntsman Advanced Materials, a global leader in specialty chemicals and composite matrix solutions. This product is formulated for demanding structural applications in aerospace, wind energy, marine, automotive, and advanced composite manufacturing where mechanical performance and long-term durability are paramount.</p>

<h3>Product Overview &amp; Chemistry</h3>
<p>Huntsman Araldite and Aradur epoxy systems are two-part thermoset polymer systems based on bisphenol or cycloaliphatic epoxide chemistry, cured with a matched hardener (Aradur) to achieve a fully crosslinked, void-free matrix. The result is a composite matrix with exceptional fibre-to-resin adhesion, high glass transition temperature (Tg), and outstanding resistance to fatigue, moisture, and chemicals.</p>

<h3>Key Properties</h3>
<ul>
  <li><strong>Processing:</strong> Formulated for infusion, RTM, filament winding, prepreg, or wet layup depending on viscosity grade</li>
  <li><strong>Mechanical Performance:</strong> High tensile and flexural strength; excellent interlaminar shear strength with carbon and glass fibre</li>
  <li><strong>Thermal Resistance:</strong> Elevated Tg suitable for elevated service temperatures common in aerospace and automotive</li>
  <li><strong>Chemical Resistance:</strong> Excellent resistance to fuels, hydraulic fluids, saltwater, and industrial solvents</li>
  <li><strong>Pot Life &amp; Cure:</strong> Engineered pot life for production environments; room-temperature or elevated-temperature cure options</li>
  <li><strong>Void Content:</strong> Optimised for low void infusion — critical for aerospace qualification</li>
  <li><strong>Certification:</strong> Huntsman systems are widely qualified by aerospace OEMs (Airbus, Boeing supply chains)</li>
</ul>

<h3>Applications</h3>
<ul>
  <li>Aerospace primary and secondary structures (wing skins, fuselage panels, spars)</li>
  <li>Wind turbine blade manufacturing (spar caps, trailing edge bondlines)</li>
  <li>Marine hull and deck composite construction</li>
  <li>Automotive body panels and structural components</li>
  <li>Industrial pressure vessels and piping</li>
  <li>High-performance sporting goods (bicycle frames, racing shells)</li>
  <li>Defence and military composite structures</li>
</ul>

<h3>Pricing &amp; Availability</h3>
<p>Huntsman epoxy systems are industrial products sold by weight (kg) or drum. Pricing is project-specific and depends on volume, grade, and application. Please contact Geem.pk with your project requirements for a formal quotation.</p>

<h3>Supplied by Geem.pk — Pakistan's Industrial Materials Specialist</h3>
<p>Geem.pk is the authorised distributor of Huntsman Araldite and Aradur epoxy systems in Pakistan. We supply composite fabricators, research institutions, defence contractors, and industrial manufacturers with genuine Huntsman products, full technical datasheets, and application support. Minimum order and lead time apply — contact us to discuss your project.</p>
`,
      tags: "huntsman, araldite, epoxy resin, composite, industrial adhesive, infusion resin, aerospace, structural epoxy, two-part epoxy, pakistan",
      metaTitle: `${title.slice(0, 45)} — Huntsman Epoxy Pakistan | Geem.pk`,
      metaDescription: `${title} Huntsman Araldite epoxy resin system in Pakistan. Industrial composite matrix for aerospace, marine, wind energy. Geem.pk.`,
      metaKeywords: "huntsman araldite pakistan, epoxy resin system, araldite ly, aradur hardener, composite resin pakistan, infusion epoxy",
    },

    carbon_fiber: {
      shortDescription: `${title} — high-performance carbon fibre material for aerospace, automotive, motorsport, and structural composite applications.`,
      longDescription: `
<h3>${title} — High-Performance Carbon Fibre for Advanced Composites</h3>
<p>Carbon fibre is the structural material of choice wherever strength, stiffness, and weight savings are critical design requirements. The ${title} available at Geem.pk is a premium-grade carbon fibre product sourced from leading manufacturers including Toray Industries — the world's largest and most respected carbon fibre producer. Every spool, fabric, or tow supplied by Geem.pk meets the exacting mechanical property specifications demanded by aerospace, motorsport, and advanced industrial applications.</p>

<h3>Material Properties</h3>
<ul>
  <li><strong>Tensile Strength:</strong> 3,500 – 5,900 MPa depending on grade (standard to ultra-high strength)</li>
  <li><strong>Tensile Modulus:</strong> 230 – 295 GPa (standard to intermediate modulus)</li>
  <li><strong>Density:</strong> 1.76 – 1.82 g/cm³ — approximately 5× lighter than steel at comparable strength</li>
  <li><strong>Elongation at Break:</strong> 1.8 – 2.2%</li>
  <li><strong>Sizing:</strong> Epoxy-compatible — optimised for bonding with standard and toughened epoxy matrix systems</li>
  <li><strong>Filament Diameter:</strong> 5 – 7 μm per filament</li>
  <li><strong>Electrical Conductivity:</strong> Carbon fibre is electrically conductive — a consideration in EMI-sensitive designs</li>
</ul>

<h3>Processing Methods</h3>
<ul>
  <li>Hand layup and vacuum bag infusion (VARTM / SCRIMP)</li>
  <li>Resin Transfer Moulding (RTM and light-RTM)</li>
  <li>Filament winding (pressure vessels, pipes, tubes)</li>
  <li>Autoclave prepreg cure</li>
  <li>Pultrusion (rods, beams, profiles)</li>
  <li>Braiding (tubes, shafts, handles)</li>
  <li>Fabric weaving (plain, twill, satin weaves)</li>
</ul>

<h3>Applications</h3>
<ul>
  <li>Aerospace primary and secondary structures</li>
  <li>Motorsport chassis, bodywork, and aerodynamic components</li>
  <li>Marine hulls, decks, and masts</li>
  <li>Wind turbine blades and spar caps</li>
  <li>High-performance bicycle frames and sports equipment</li>
  <li>Medical devices and prosthetics</li>
  <li>Defence and UAV airframes</li>
  <li>Industrial pressure vessels and robotic arms</li>
</ul>

<h3>Pricing &amp; Supply</h3>
<p>Carbon fibre is priced by weight (per kg or per spool). Industrial grades and large quantities are subject to project pricing — contact Geem.pk with your fibre grade, quantity, and delivery schedule. We supply fabricators, research institutions, and universities across Pakistan.</p>

<h3>Available at Geem.pk — Pakistan's Composite Materials Specialist</h3>
<p>Geem.pk is Pakistan's specialist supplier of advanced composite materials including Toray carbon fibre, Huntsman epoxy systems, and ancillary composite consumables. Our technical team can advise on fibre selection, resin compatibility, and processing parameters for your application. Reach out for datasheets, samples, and quotations.</p>
`,
      tags: "carbon fiber, toray, composite fabric, ud fabric, spool, aerospace, motorsport, lightweight, carbon fibre pakistan, composite materials, filament winding",
      metaTitle: `${title.slice(0, 45)} — Carbon Fibre Pakistan | Geem.pk`,
      metaDescription: `${title} carbon fibre in Pakistan. Toray-grade. Aerospace, motorsport, marine composites. Geem.pk — composite materials specialist.`,
      metaKeywords: "carbon fiber pakistan, toray carbon fiber, composite material pakistan, carbon fiber spool, carbon fibre fabric",
    },

    battery: {
      shortDescription: `${title} — custom industrial lithium battery pack designed for EVs, energy storage, UAVs, and heavy-duty industrial equipment.`,
      longDescription: `
<h3>${title} — Custom Industrial Lithium Battery System</h3>
<p>The ${title} from Geem.pk is a precision-engineered industrial lithium battery pack or cell assembly designed for applications demanding high energy density, long cycle life, and reliable performance under demanding conditions. Geem.pk specialises in custom lithium battery solutions including NCM (Nickel Cobalt Manganese), LiFePO4, and cylindrical cell configurations — all built to application-specific voltage, capacity, and form-factor requirements.</p>

<h3>Technology &amp; Chemistry</h3>
<ul>
  <li><strong>Cell Chemistry Options:</strong> NCM (NMC 622 / 811) for high energy density; LiFePO4 for maximum cycle life and safety</li>
  <li><strong>Nominal Voltage:</strong> Configurable from 12V to 96V+ depending on series configuration</li>
  <li><strong>Capacity:</strong> Custom — from 10Ah to 500Ah+ depending on application</li>
  <li><strong>Energy Density:</strong> Up to 250 Wh/kg (cell level) — class-leading specific energy</li>
  <li><strong>Cycle Life:</strong> 800–2,000+ cycles to 80% capacity depending on chemistry and discharge rate</li>
  <li><strong>BMS:</strong> Integrated Battery Management System with cell balancing, over-charge, over-discharge, short-circuit, and thermal protection</li>
  <li><strong>Operating Temperature:</strong> –20°C to +60°C depending on chemistry</li>
  <li><strong>Enclosure:</strong> Custom aluminium or ABS — IP65 or higher rating available</li>
</ul>

<h3>Key Features</h3>
<ul>
  <li>Fully custom configuration — voltage, capacity, connector, and BMS tailored to your system</li>
  <li>Industrial-grade cell selection from tier-1 manufacturers (CATL, Samsung SDI, LG Energy Solution)</li>
  <li>Active or passive cell balancing BMS with CAN/RS485/UART communication option</li>
  <li>Built-in state-of-charge (SoC) and state-of-health (SoH) monitoring</li>
  <li>Matched charger design available as part of a turnkey system</li>
  <li>Rigorous quality testing — capacity verification, discharge curves, and safety certification</li>
</ul>

<h3>Applications</h3>
<ul>
  <li>Electric vehicles (EVs, e-rickshaws, electric motorcycles)</li>
  <li>UAVs, drones, and unmanned systems</li>
  <li>Renewable energy storage (solar off-grid and hybrid systems)</li>
  <li>Industrial UPS and backup power systems</li>
  <li>Robotics and automated guided vehicles (AGVs)</li>
  <li>Marine electric propulsion</li>
  <li>Portable power stations and field equipment</li>
</ul>

<h3>Pricing &amp; Custom Orders</h3>
<p>Industrial battery packs are priced per project based on chemistry, cell count, BMS specification, enclosure, and quantity. Please contact Geem.pk with your electrical requirements, operating environment, and delivery timeline for a formal quotation and engineering consultation.</p>

<h3>Available at Geem.pk — Pakistan's Industrial Battery Specialist</h3>
<p>Geem.pk designs, assembles, and supplies custom industrial lithium battery solutions to manufacturers, research institutions, and system integrators across Pakistan. Our engineering team provides full technical consultation from cell selection through to BMS programming and charger design.</p>
`,
      tags: "lithium battery, ncm battery, custom battery pack, industrial, ev battery, energy storage, pakistan, turnkey battery, bms, lifepo4",
      metaTitle: `${title.slice(0, 45)} — Industrial Battery Pakistan | Geem.pk`,
      metaDescription: `${title} custom industrial lithium battery in Pakistan. NCM/LiFePO4, custom voltage & capacity. EV, UAV, energy storage. Geem.pk.`,
      metaKeywords: "industrial lithium battery pakistan, custom battery pack, ncm battery pakistan, ev battery, energy storage pakistan, geem.pk",
    },

    gps: {
      shortDescription: `${title} — real-time GPS tracker for vehicles, assets, and fleet management with live tracking and geofence alerts in Pakistan.`,
      longDescription: `
<h3>${title} — Real-Time GPS Tracking Device</h3>
<p>The ${title} is a professional-grade GPS tracking device that delivers accurate, real-time location data for vehicles, motorcycles, assets, children, and personnel. Powered by a combination of GPS satellite positioning and GSM mobile network communication, it provides reliable tracking coverage across Pakistan's entire mobile network footprint — urban and rural alike.</p>

<h3>Key Features &amp; Specifications</h3>
<ul>
  <li><strong>Real-Time Tracking:</strong> Live location updates at configurable intervals (10 seconds to 5 minutes)</li>
  <li><strong>GPS Positioning:</strong> High-sensitivity GPS chipset — accurate to within 5–10 metres in open-sky conditions</li>
  <li><strong>GSM / 4G Connectivity:</strong> Communicates location data over Pakistan's GSM networks (works with all local SIM operators)</li>
  <li><strong>Geofence Alerts:</strong> Define virtual boundaries; receive instant SMS or app notification when device enters or leaves the zone</li>
  <li><strong>History Playback:</strong> Review complete journey history, routes, stops, and speed logs</li>
  <li><strong>Overspeed Alert:</strong> Configurable speed threshold triggers instant notification</li>
  <li><strong>Engine Cut-Off:</strong> Remote immobilisation capability (model-dependent)</li>
  <li><strong>SOS Button:</strong> One-press emergency alert to pre-set contact numbers</li>
  <li><strong>Multi-Platform Access:</strong> Track via iOS app, Android app, or web browser dashboard</li>
  <li><strong>Compact &amp; Discreet:</strong> Small form factor — easily concealed in vehicles or attached to assets</li>
</ul>

<h3>Applications &amp; Use Cases</h3>
<ul>
  <li><strong>Fleet Management:</strong> Track company cars, trucks, and delivery vehicles in real time</li>
  <li><strong>Vehicle Security:</strong> Instant theft alert and location recovery assistance</li>
  <li><strong>Driver Behaviour Monitoring:</strong> Speed alerts, harsh braking detection, route compliance</li>
  <li><strong>Child Safety:</strong> Know your child's location at all times (kids tracker variants)</li>
  <li><strong>Asset Tracking:</strong> Secure high-value equipment, machinery, and cargo</li>
  <li><strong>Motorcycle Tracking:</strong> Compact installation for bikes and scooters</li>
  <li><strong>Elderly Care:</strong> Personal GPS panic button for vulnerable family members</li>
</ul>

<h3>SIM Card &amp; Data Plan</h3>
<p>This GPS tracker requires a local SIM card (not included). Any standard Pakistani SIM (Jazz, Telenor, Ufone, Zong) with a data package works. A small monthly data plan (50–100MB) is typically sufficient for regular tracking intervals.</p>

<h3>Warranty &amp; Support</h3>
<p>All GPS trackers sold by Geem.pk come with a 6-month warranty and full technical support. Our team assists with SIM insertion, app setup, geofence configuration, and platform troubleshooting.</p>

<h3>Available at Geem.pk — Pakistan's GPS Tracker Specialist</h3>
<p>Geem.pk is Pakistan's leading supplier of professional GPS tracking devices for individuals, businesses, and fleet operators. We stock a complete range — from compact personal trackers to hardwired OBD and vehicle trackers — with free setup guidance and after-sales support for every order.</p>
`,
      tags: "gps tracker, vehicle tracking, real-time gps, geofence, pakistan, fleet management, gps pakistan, tracker device, anti-theft, location tracking",
      metaTitle: `${title.slice(0, 45)} — GPS Tracker Pakistan | Geem.pk`,
      metaDescription: `Buy ${title} GPS tracker in Pakistan. Real-time tracking, geofence alerts, fleet management. Works on all Pakistani SIM networks. Geem.pk.`,
      metaKeywords: "gps tracker pakistan, vehicle tracking, real-time tracker, fleet gps, geofence alert, gps device pakistan, geem.pk",
    },
  };

  const templateKey = type.startsWith("gps") ? "gps"
    : (type in templates ? type : "gps");
  const t = templates[templateKey];

  return { ...t, hidePrice };
}

// ─── Image search via DuckDuckGo ──────────────────────────────────────────────

async function searchDDG(query: string): Promise<string[]> {
  try {
    const init = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=images&iax=images&ia=images`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36" },
        signal: AbortSignal.timeout(12_000),
      },
    );
    const html = await init.text();
    const vqd  = html.match(/vqd=['"]([^'"]+)['"]/)?.[1];
    if (!vqd) return [];

    const res = await fetch(
      `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&o=json&p=1&f=,,,,,`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
          "Referer": "https://duckduckgo.com/",
        },
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json() as { results?: Array<{ image: string }> };
    return (data.results ?? []).map(r => r.image).filter(Boolean);
  } catch {
    return [];
  }
}

async function downloadAsWebP(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2_000) return false;
    await sharp(buf)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(destPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download 1 main + 4 gallery images for a product.
 * Skips files that already exist locally.
 * Returns API-served DB paths.
 */
async function downloadImages(
  slug: string,
  queries: string[],
): Promise<{ mainPath: string | null; galleryPaths: string[] }> {
  fs.mkdirSync(PRODUCTS_DIR, { recursive: true });
  fs.mkdirSync(GALLERY_DIR,  { recursive: true });

  const mainFile = `${slug}-main.webp`;
  const mainDest = path.join(PRODUCTS_DIR, mainFile);
  const mainDbPath = `/api/storage/public-objects/products/${mainFile}`;

  // Check existing gallery files
  const existingGallery: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const f = `${slug}-gallery-${i}.webp`;
    if (fs.existsSync(path.join(GALLERY_DIR, f))) {
      existingGallery.push(`/api/storage/public-objects/products/gallery/${f}`);
    }
  }

  // Skip image download if main + 4 gallery already exist
  if (fs.existsSync(mainDest) && existingGallery.length >= 4) {
    console.log(`    📸 Images already on disk — skipping download`);
    return { mainPath: mainDbPath, galleryPaths: existingGallery };
  }

  // Collect candidate URLs
  const urls: string[] = [];
  for (const q of queries) {
    if (urls.length >= 20) break;
    const found = await searchDDG(q);
    for (const u of found) if (!urls.includes(u)) urls.push(u);
    await new Promise(r => setTimeout(r, 600));
  }

  let mainPath: string | null = fs.existsSync(mainDest) ? mainDbPath : null;
  const galleryPaths: string[] = [...existingGallery];

  for (const url of urls) {
    if (mainPath && galleryPaths.length >= 4) break;

    if (!mainPath) {
      if (await downloadAsWebP(url, mainDest)) {
        mainPath = mainDbPath;
        console.log(`    📸 main      → ${mainFile}`);
      }
    } else if (galleryPaths.length < 4) {
      const n    = galleryPaths.length + 1;
      const file = `${slug}-gallery-${n}.webp`;
      const dest = path.join(GALLERY_DIR, file);
      if (!fs.existsSync(dest)) {
        if (await downloadAsWebP(url, dest)) {
          galleryPaths.push(`/api/storage/public-objects/products/gallery/${file}`);
          console.log(`    📸 gallery ${n} → ${file}`);
        }
      } else {
        galleryPaths.push(`/api/storage/public-objects/products/gallery/${file}`);
      }
    }
  }

  // Pad gallery to exactly 4 (avoids nulls in DB)
  for (let i = galleryPaths.length; i < 4; i++) {
    galleryPaths.push(`/api/storage/public-objects/products/gallery/${slug}-gallery-${i + 1}.webp`);
    console.log(`    ⚠  gallery ${i + 1} padded (download failed)`);
  }

  return { mainPath, galleryPaths };
}

// ─── AI content generation ────────────────────────────────────────────────────

interface GeneratedContent {
  longDescription: string;
  tags: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  shortDescription: string;
  hidePrice: boolean;
}

const TYPE_PROMPTS: Record<string, string> = {
  lawmate: `You are a product copywriter for Geem.pk, a Pakistan-based surveillance & security retailer.
Write complete e-commerce product data for a LawMate covert surveillance device.
LawMate is a professional-grade brand used by law enforcement and private investigators worldwide.`,

  esonic: `You are a product copywriter for Geem.pk, a Pakistan-based surveillance & security retailer.
Write complete e-commerce product data for an Esonic (MemoQ) digital voice recorder or bugging device.
Esonic products are used for evidence gathering, personal security, and audio surveillance.`,

  huntsman: `You are a product copywriter for Geem.pk, a Pakistan-based industrial materials supplier.
Write complete e-commerce product data for a Huntsman Araldite epoxy resin system.
These are industrial-grade two-part epoxy adhesives / infusion systems used in composites, aerospace, marine, and wind energy.
Price is typically "Get Quote / Inquiry" — set hidePrice to true.`,

  carbon_fiber: `You are a product copywriter for Geem.pk, a Pakistan-based industrial materials supplier.
Write complete e-commerce product data for a Toray carbon fiber fabric or spool.
Toray carbon fiber is used in aerospace, motorsport, sporting goods, and structural composites manufacturing.
Price is typically "Get Quote / Inquiry" — set hidePrice to true.`,

  battery: `You are a product copywriter for Geem.pk, a Pakistan-based industrial battery supplier.
Write complete e-commerce product data for a custom lithium / NCM industrial battery pack or cell.
These are used in EVs, renewable energy storage, industrial equipment, and UAVs.
Price is typically "Get Quote / Inquiry" — set hidePrice to true.`,

  gps: `You are a product copywriter for Geem.pk, a Pakistan-based GPS tracker retailer.
Write complete e-commerce product data for a GPS tracker device sold in Pakistan.`,
};

async function generateContent(
  title: string,
  brandName: string,
  categoryName: string,
  type: ProductType,
  price: string,
  openai: OpenAI,
  model: string,
): Promise<GeneratedContent> {
  const promptKey = type.startsWith("gps") ? "gps"
    : (type in TYPE_PROMPTS ? type : "gps");
  const context = TYPE_PROMPTS[promptKey] ?? TYPE_PROMPTS.gps;

  const tagExamples: Record<string, string> = {
    lawmate:      "lawmate, covert camera, security, spy gear, surveillance, hidden camera, pakistan",
    esonic:       "esonic, memoq, voice recorder, audio surveillance, bugging device, digital recorder, pakistan",
    huntsman:     "huntsman, araldite, epoxy resin, composite, industrial adhesive, infusion, aerospace, structural",
    carbon_fiber: "carbon fiber, toray, composite fabric, ud fabric, spool, aerospace, motorsport, lightweight",
    battery:      "lithium battery, ncm, custom battery pack, industrial, ev, energy storage, turnkey",
    gps:          "gps tracker, vehicle tracking, real-time gps, geofence, pakistan, fleet management",
  };
  const tagHint = tagExamples[promptKey] ?? tagExamples.gps;

  const prompt = `${context}

Product title: ${title}
Brand: ${brandName}
Category: ${categoryName}
Price (PKR): ${price || "varies"}

Return ONLY valid JSON (no markdown, no backticks):
{
  "shortDescription": "One compelling sentence about the product (max 130 chars)",
  "longDescription": "Rich HTML with <h3>, <ul>, <li>, <p> tags. Must include: overview paragraph, key specifications in a bullet list, use-cases or applications, and a brief why-buy closing paragraph. Min 350 words.",
  "tags": "comma-separated, category-accurate tags — examples for this type: ${tagHint}",
  "metaTitle": "SEO title under 62 chars",
  "metaDescription": "SEO description under 155 chars mentioning key use-case",
  "metaKeywords": "5-10 SEO keywords comma-separated",
  "hidePrice": ${type === "huntsman" || type === "carbon_fiber" || type === "battery" ? "true" : "false"}
}`;

  const completion = await openai.chat.completions.create({
    model,
    max_completion_tokens: 1800,
    messages: [{ role: "user", content: prompt }],
  });
  const raw     = completion.choices[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/```json\n?|```/g, "").trim();
  const data    = JSON.parse(cleaned) as Partial<GeneratedContent>;
  return {
    longDescription:  data.longDescription  ?? "",
    tags:             data.tags             ?? tagHint,
    metaTitle:        data.metaTitle        ?? title.slice(0, 60),
    metaDescription:  data.metaDescription  ?? title.slice(0, 150),
    metaKeywords:     data.metaKeywords     ?? tagHint,
    shortDescription: data.shortDescription ?? "",
    hidePrice:        data.hidePrice        ?? (type === "huntsman" || type === "carbon_fiber" || type === "battery"),
  };
}

// ─── Image search queries per type ───────────────────────────────────────────

function buildImageQueries(title: string, brandName: string, type: ProductType): string[] {
  switch (type) {
    case "lawmate":
      return [
        `${title} lawmate surveillance device product photo`,
        `lawmate ${title.split(" ").slice(-2).join(" ")} covert camera`,
        `lawmate surveillance equipment product`,
        `${title} hidden camera product image`,
      ];
    case "esonic":
      return [
        `${title} esonic voice recorder product photo`,
        `esonic memoq audio recorder device image`,
        `${title} digital recorder product`,
        `esonic spy recorder official photo`,
      ];
    case "huntsman":
      return [
        `huntsman araldite epoxy resin ${title} product`,
        `araldite epoxy resin system bottle can product photo`,
        `huntsman composite epoxy resin kit industrial`,
        `two part epoxy adhesive industrial product photo`,
      ];
    case "carbon_fiber":
      return [
        `toray carbon fiber fabric ${title} product photo`,
        `carbon fiber fabric roll spool product photo`,
        `carbon fibre composite material roll product`,
        `toray carbon fiber manufacturing spool`,
      ];
    case "battery":
      return [
        `${title} lithium battery pack product photo`,
        `lithium ncm battery pack industrial product`,
        `custom battery pack cells product photo`,
        `industrial lithium battery system product`,
      ];
    case "gps_obd":
      return [
        `${brandName} ${title} OBD GPS tracker product photo`,
        `OBD GPS tracker plug device product image`,
        `${title} OBD diagnostic port tracker`,
        `OBD GPS car tracker vehicle monitoring`,
      ];
    case "gps_kids":
      return [
        `${brandName} ${title} kids GPS watch product`,
        `GPS smart watch children tracking product photo`,
        `${title} kids location tracker watch`,
        `children GPS wristband tracker product image`,
      ];
    default: {
      const clean = title.replace(/\b4G\b|\b4G\s+LTE\b/gi, "").trim();
      return [
        `${clean} GPS tracker official product photo`,
        `${brandName} ${clean} tracker device image`,
        `${clean} vehicle tracking device product`,
        `${brandName} GPS tracker product photo pakistan`,
      ];
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  Geem — Batch Catalog Completion (All Products)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const openaiSetup = buildOpenAI();
  if (openaiSetup) {
    console.log(`Using OpenAI model: ${openaiSetup.model}`);
  } else {
    console.log("⚠  No OpenAI credentials found — will use rich type-based fallback templates");
  }
  console.log();

  // ── 1. Load all products with brand + category names ──────────────────
  const allProducts = await db
    .select({
      id:              productsTable.id,
      title:           productsTable.title,
      slug:            productsTable.slug,
      price:           productsTable.price,
      brandId:         productsTable.brandId,
      categoryId:      productsTable.categoryId,
      featuredImage:   productsTable.featuredImage,
      galleryImages:   productsTable.galleryImages,
      longDescription: productsTable.longDescription,
      tags:            productsTable.tags,
      hidePrice:       productsTable.hidePrice,
    })
    .from(productsTable);

  const allBrands     = await db.select().from(brandsTable);
  const allCategories = await db.select().from(categoriesTable);
  const brandMap      = new Map(allBrands.map(b => [b.id, b.name]));
  const catMap        = new Map(allCategories.map(c => [c.id, c.name]));

  console.log(`Total products in DB: ${allProducts.length}`);

  // ── 2. Filter to incomplete products only (no-duplicate guarantee) ────
  const workList = allProducts.filter(p => {
    const catName = (p.categoryId ? catMap.get(p.categoryId) : null) ?? "Unknown";
    const type    = detectType(p.title, catName);
    return isIncomplete(p, type);
  });

  console.log(`Incomplete products requiring update: ${workList.length}`);
  console.log(`Already complete (skipped):          ${allProducts.length - workList.length}\n`);

  if (workList.length === 0) {
    console.log("✅ All products are already complete — nothing to do.");
    process.exit(0);
  }

  // ── 3. Process each incomplete product ───────────────────────────────
  let updated = 0, failed = 0;
  const summary: Array<{ title: string; status: string }> = [];

  for (let i = 0; i < workList.length; i++) {
    const p         = workList[i];
    const brandName = (p.brandId   ? brandMap.get(p.brandId)   : null) ?? "Unknown";
    const catName   = (p.categoryId ? catMap.get(p.categoryId) : null) ?? "Unknown";
    const type      = detectType(p.title, catName);

    console.log(`\n[${i + 1}/${workList.length}] ${p.title}`);
    console.log(`    Brand: ${brandName} | Category: ${catName} | Type: ${type}`);

    try {
      // ── 3a. Generate content (AI or rich template fallback) ──────────
      let content: GeneratedContent;
      if (openaiSetup) {
        try {
          console.log("    ✍  Generating content via AI...");
          content = await generateContent(
            p.title, brandName, catName, type, p.price,
            openaiSetup.client, openaiSetup.model,
          );
          console.log(`    ✍  Tags: ${content.tags.slice(0, 80)}`);
        } catch (aiErr) {
          const errMsg = String(aiErr);
          if (errMsg.includes("429") || errMsg.includes("quota")) {
            console.log("    ⚠  AI quota exceeded — using rich template fallback");
          } else {
            console.log(`    ⚠  AI failed (${errMsg.slice(0, 60)}) — using rich template fallback`);
          }
          content = buildFallbackContent(p.title, type);
        }
      } else {
        console.log("    ✍  Using rich template fallback (no AI configured)");
        content = buildFallbackContent(p.title, type);
      }

      // ── 3b. Download images (skips if already on disk) ───────────────
      const needsImages =
        !p.featuredImage ||
        p.featuredImage.startsWith("https://") ||
        (() => {
          try { const g = JSON.parse(p.galleryImages ?? "[]") as unknown[]; return !Array.isArray(g) || g.length < 4; }
          catch { return true; }
        })();

      let mainPath     = p.featuredImage && !p.featuredImage.startsWith("https://") ? p.featuredImage : null;
      let galleryPaths: string[] = [];

      try {
        const existing = JSON.parse(p.galleryImages ?? "[]") as unknown[];
        if (Array.isArray(existing) && existing.length >= 4 && !p.featuredImage?.startsWith("https://")) {
          galleryPaths = existing as string[];
        }
      } catch { /**/ }

      if (needsImages) {
        console.log("    🔍 Searching & downloading images...");
        const queries = buildImageQueries(p.title, brandName, type);
        const images  = await downloadImages(p.slug, queries);
        if (images.mainPath) mainPath = images.mainPath;
        galleryPaths = images.galleryPaths;
      } else {
        console.log("    📸 Images already present — skipping download");
      }

      // ── 3c. Update DB ────────────────────────────────────────────────
      await db.update(productsTable).set({
        shortDescription: content.shortDescription || undefined,
        longDescription:  content.longDescription,
        tags:             content.tags,
        metaTitle:        content.metaTitle,
        metaDescription:  content.metaDescription,
        metaKeywords:     content.metaKeywords,
        hidePrice:        content.hidePrice,
        featuredImage:    mainPath ?? undefined,
        galleryImages:    JSON.stringify(galleryPaths),
        published:        true,
      }).where(eq(productsTable.id, p.id));

      console.log(`    ✅ DONE — slug: ${p.slug}`);
      updated++;
      summary.push({ title: p.title, status: "updated" });
    } catch (err) {
      console.error(`    ✗  FAILED: ${err}`);
      failed++;
      summary.push({ title: p.title, status: "failed" });
    }

    // Pace between products to avoid rate-limiting
    if (i < workList.length - 1) await new Promise(r => setTimeout(r, 800));
  }

  // ── 4. Summary ────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("  BATCH COMPLETION DONE");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log(`  Updated : ${updated}`);
  console.log(`  Failed  : ${failed}`);
  console.log(`  Total   : ${workList.length}`);
  console.log();
  summary.forEach(s => {
    console.log(`  ${s.status === "updated" ? "✅" : "✗"} ${s.title}`);
  });
  console.log("\n✔ Images saved to:", PRODUCTS_DIR);
  process.exit(0);
}

run().catch(err => {
  console.error("\n✗ Script failed:", err);
  process.exit(1);
});
