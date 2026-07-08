import { db, brandsTable, categoriesTable, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const IMAGES = {
  // Counter-Surveillance
  rfDetector:       "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
  circuitBoard:     "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
  handheldDevice:   "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
  blackDevice:      "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80",
  electronicsTool:  "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=800&q=80",
  // Covert Communications
  tacRadio:         "https://images.unsplash.com/photo-1580834341580-8c17a3a630ca?w=800&q=80",
  earpiece:         "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
  encryptedPhone:   "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80",
  tacGear:          "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80",
  radio:            "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=800&q=80",
  // Security Equipment
  alarmPanel:       "https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80",
  accessControl:    "https://images.unsplash.com/photo-1558618047-3c8c76ca5b5a?w=800&q=80",
  doorLock:         "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  motionSensor:     "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
  intercom:         "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
  // Signal & RF Detectors
  spectrumAnalyzer: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
  bugSweeper:       "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=800&q=80",
  wirelessDetector: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80",
  detector:         "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
  // Smart Security Systems
  ipCamera:         "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
  nvr:              "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  smartLock:        "https://images.unsplash.com/photo-1558618047-3c8c76ca5b5a?w=800&q=80",
  domeCamera:       "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80",
  security:         "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
};

async function run() {
  console.log("🌱 Seeding security & surveillance products...");

  // ── 1. BRANDS ──────────────────────────────────────────────────────────────
  const brandData = [
    { name: "Ajax Systems",    description: "Industry-leading wireless smart alarm and security systems from Ukraine" },
    { name: "Paradox",         description: "Canadian professional alarm panels and intrusion detection systems" },
    { name: "Hikvision",       description: "World's #1 CCTV and IP camera manufacturer" },
    { name: "Dahua",           description: "Leading Chinese manufacturer of IP cameras, NVRs and surveillance systems" },
    { name: "Reolink",         description: "Smart IP cameras and NVR systems with advanced AI detection" },
    { name: "Hanwha",          description: "Professional-grade Samsung-origin CCTV and NVR systems" },
    { name: "Unbranded",       description: "Quality generic security and surveillance equipment" },
  ];

  const brandIds: Record<string, number> = {};
  for (const b of brandData) {
    const [existing] = await db.select().from(brandsTable).where(eq(brandsTable.name, b.name));
    if (existing) {
      brandIds[b.name] = existing.id;
    } else {
      const [row] = await db.insert(brandsTable).values({ name: b.name, description: b.description, active: true }).returning();
      brandIds[b.name] = row.id;
      console.log(`  + Brand: ${b.name}`);
    }
  }

  // ── 2. CATEGORIES (ensure they exist) ──────────────────────────────────────
  const catData = [
    { name: "Counter-Surveillance" },
    { name: "Covert Communications" },
    { name: "Security Equipment" },
    { name: "Signal & RF Detectors" },
    { name: "Smart Security Systems" },
  ];

  const catIds: Record<string, number> = {};
  for (const c of catData) {
    const [existing] = await db.select().from(categoriesTable).where(eq(categoriesTable.name, c.name));
    if (existing) {
      catIds[c.name] = existing.id;
    } else {
      const [row] = await db.insert(categoriesTable).values({ name: c.name, active: true }).returning();
      catIds[c.name] = row.id;
      console.log(`  + Category: ${c.name}`);
    }
  }

  // ── 3. PRODUCTS ────────────────────────────────────────────────────────────
  const products = [

    // ══════════════════════════════════════════════════════════════════════════
    //  COUNTER-SURVEILLANCE
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "Professional RF Bug Detector & Hidden Camera Finder",
      slug: "professional-rf-bug-detector-camera-finder",
      sku: "CS-RFBUG-PRO",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Counter-Surveillance"],
      tags: "bug detector,rf detector,hidden camera finder,counter surveillance,anti spy,TSCM,sweep",
      price: "18500",
      salePrice: "15999",
      costPrice: "10000",
      stockQty: 15,
      shortDescription: "Wide-band RF bug detector and lens finder in one device. Detects GSM, 3G/4G, WiFi, Bluetooth bugs and pinhole cameras.",
      longDescription: `Professional RF Bug Detector & Hidden Camera Finder — Counter-Surveillance Sweep Tool

This all-in-one counter-surveillance device detects radio-frequency listening devices, hidden cameras, GPS trackers, and wireless bugs across all modern frequency bands.

Detection Capabilities:
• RF Frequency Range: 1MHz – 8GHz
• Detects: GSM (2G/3G/4G/5G), WiFi, Bluetooth, DECT, NFC transmitters
• Hidden Camera Detection: Infrared lens reflection (10m range in darkness)
• GPS Tracker Detection: 10MHz–6GHz sweep
• Wiretap Detection: Carrier current and induction field detection

Features:
• Sensitivity Adjustment: 10-level dial for fine-tuning (avoid false positives)
• LED Bar Graph: Visual signal strength indicator
• Vibration Alert Mode: Silent detection for discreet sweeping
• Earphone Jack: Private audio alert
• Pocket-sized: 120 × 60 × 22mm, weighs only 85g
• Battery: 9V (included), 12–15 hours continuous use

How to Use:
1. Turn sensitivity to minimum — slowly increase while sweeping
2. Move device slowly around walls, furniture, power outlets
3. Signal strength spikes near a transmitter — locate the bug
4. Use lens finder in darkness to spot hidden pinhole cameras

Best For:
• Hotel and rental room sweeps
• Office counter-surveillance
• Vehicle bug checks
• Private meeting security
• Personal privacy protection

Package Includes: Detector unit, 9V battery, Earphone, Wrist strap, Carrying case, User manual`,
      featuredImage: IMAGES.rfDetector,
      galleryImages: JSON.stringify([IMAGES.rfDetector, IMAGES.handheldDevice]),
      published: true,
      featured: true,
      metaTitle: "RF Bug Detector Hidden Camera Finder Pakistan — Geem.pk",
      metaDescription: "Professional RF bug detector and hidden camera finder in Pakistan. Detects GSM, WiFi, pinhole cameras. Rs 15,999. Geem.pk.",
    },
    {
      title: "GSM/4G Bug Detector — Non-Linear Tap Finder Pro",
      slug: "gsm-4g-bug-detector-tap-finder-pro",
      sku: "CS-GSM-DET-PRO",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Counter-Surveillance"],
      tags: "gsm bug detector,4g bug,phone tap detector,counter surveillance,eavesdropping,anti bug",
      price: "22000",
      salePrice: "19500",
      costPrice: "13000",
      stockQty: 10,
      shortDescription: "Advanced GSM/3G/4G/5G listening device detector. Identifies SIM-card based bugs that transmit audio over cellular networks.",
      longDescription: `GSM/4G Bug Detector — Advanced Cellular Listening Device Finder

Modern listening bugs use SIM cards and cellular networks — making them invisible to basic RF detectors. This professional device specifically targets GSM, 3G, 4G LTE, and 5G-band transmitters.

Technical Specifications:
• Detection Bands: 900MHz, 1800MHz, 2100MHz, 2600MHz (all Pakistan cellular bands)
• Sensitivity: Detects transmitters from up to 3 meters away
• False-Positive Rejection: Dual-confirmation algorithm
• Display: OLED digital signal strength meter
• Alert Modes: Audio beep + visual LED + vibration (all switchable)
• Battery: Built-in Li-ion, USB-C rechargeable — 10+ hours
• Dimensions: 110 × 55 × 18mm
• Weight: 75g

Advanced Features:
• Frequency Lock: Locks onto detected frequency for tracking
• Signal History: Logs detection events with timestamp
• Threshold Setting: Ignore ambient cellular noise (set baseline)
• Two antenna modes: omnidirectional and directional

What It Detects:
• SIM-card audio bugs (voice-activated GSM bugs)
• Cellular data loggers
• 4G LTE listening devices
• Wireless intercept equipment

Not Detected (use RF Bug Detector for these): WiFi cameras, Bluetooth devices, analog bugs

Sweep Procedure:
• Set baseline sensitivity in open area
• Slowly sweep room at 20cm/sec
• Pay special attention to power outlets, smoke detectors, clocks
• Check under desks and furniture

Package: Detector, USB-C cable, Earphones, Directional antenna tip, Hard case`,
      featuredImage: IMAGES.blackDevice,
      galleryImages: JSON.stringify([IMAGES.blackDevice, IMAGES.rfDetector]),
      published: true,
      featured: false,
      metaTitle: "GSM 4G Bug Detector Pakistan — Anti Eavesdropping Device — Geem.pk",
      metaDescription: "GSM 4G bug detector Pakistan. Finds SIM-card listening devices and cellular bugs. Rs 19,500. Geem.pk.",
    },
    {
      title: "Camera Lens Finder — Pinhole & Covert Camera Detector",
      slug: "camera-lens-finder-pinhole-detector",
      sku: "CS-LENS-FIND",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Counter-Surveillance"],
      tags: "camera finder,lens detector,pinhole camera,hidden camera detector,anti spy camera,privacy protection",
      price: "9500",
      salePrice: "7999",
      costPrice: "4500",
      stockQty: 20,
      shortDescription: "Optical lens finder using infrared reflection. Detects ANY hidden camera — even offline cameras with no RF signal.",
      longDescription: `Camera Lens Finder — Pinhole & Covert Camera Detector

The most effective tool against hidden cameras that have no wireless signal — offline recording cameras, motion-triggered cameras, and wired pinhole cameras are invisible to RF detectors. This device uses infrared optics to find any camera lens.

How It Works:
The device shines a circle of infrared LEDs. When aimed at a camera lens, the optics retro-reflect the light — you see a bright glint through the viewfinder, revealing the camera's position.

Specifications:
• IR LEDs: 12 high-intensity infrared emitters
• Viewfinder: Red-filter optical finder for contrast
• Effective Range: Up to 10 meters (optimal 1–5m)
• Detection: ANY camera — WiFi, wired, recording-only, offline
• Battery: 2× AAA (included)
• Size: Compact keyring or pocket size

What It Finds (that RF detectors miss):
• Memory card recorders (no wireless signal)
• Wired CCTV hidden as everyday objects
• Turned-off cameras (lens is always reflective)
• Micro pinhole cameras embedded in walls/objects
• Clock cameras, alarm camera hybrids while not transmitting

Sweep Method:
1. Dim lights or close curtains
2. Hold finder at eye level, turn on IR
3. Scan room slowly looking through viewfinder
4. Any camera lens glints back bright red
5. Pinpoint the device and investigate

Ideal For:
• Hotel room privacy sweep
• Changing rooms, bathrooms (look first before undressing)
• Airbnb and short-term rental checks
• Personal privacy anywhere

Package: Lens finder unit, AAA batteries, Carry pouch`,
      featuredImage: IMAGES.electronicsTool,
      galleryImages: JSON.stringify([IMAGES.electronicsTool, IMAGES.rfDetector]),
      published: true,
      featured: false,
      metaTitle: "Hidden Camera Lens Finder Detector Pakistan — Geem.pk",
      metaDescription: "Optical pinhole camera lens detector. Finds any hidden camera even without WiFi or RF signal. Rs 7,999. Geem.pk.",
    },
    {
      title: "Telephone Line Tap Detector & Voice Scrambler",
      slug: "telephone-line-tap-detector-scrambler",
      sku: "CS-TELE-TAP",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Counter-Surveillance"],
      tags: "telephone tap,phone tap detector,wiretap detector,voice scrambler,landline security,counter surveillance",
      price: "14000",
      salePrice: "12500",
      costPrice: "8000",
      stockQty: 8,
      shortDescription: "Detects active wiretaps on telephone lines and activates voice scrambling for secure conversations.",
      longDescription: `Telephone Line Tap Detector & Voice Scrambler

Landline and VoIP phones remain vulnerable to physical line taps and electronic intercepts. This device installs inline on any telephone line and provides continuous monitoring and optional call scrambling.

Detection Features:
• Detects voltage irregularities caused by parallel taps
• Detects series taps (drops in line impedance)
• Identifies induction coil taps (no contact taps)
• Real-time signal monitoring during calls
• LED status indicator: Green (clean) / Red (tap detected) / Amber (suspicious)

Voice Scrambler Mode:
• Activates with one button during a call
• Both parties need compatible device for intelligible comms
• Scrambling algorithm: frequency inversion + time-domain shifting
• Makes intercepted audio completely unintelligible

Specifications:
• Compatible: All analog landlines, PABX extensions, VoIP ATA adapters
• Line Voltage Monitor: 15–60V range
• Current Monitor: 20–80mA range
• Power: Line-powered (no battery needed) + USB backup
• Connectors: Standard RJ11 (2-way pass-through)
• Dimensions: 95 × 60 × 25mm

Installation: Plug into wall socket, plug phone into device. Zero configuration required.

Package: Tap detector/scrambler unit, RJ11 cable, User guide`,
      featuredImage: IMAGES.circuitBoard,
      galleryImages: JSON.stringify([IMAGES.circuitBoard]),
      published: true,
      featured: false,
      metaTitle: "Telephone Wiretap Detector Voice Scrambler Pakistan — Geem.pk",
      metaDescription: "Telephone line tap detector and voice scrambler for Pakistan landlines. Rs 12,500. Counter-surveillance. Geem.pk.",
    },
    {
      title: "TSCM Sweep Kit — Professional Counter-Surveillance Bundle",
      slug: "tscm-sweep-kit-professional",
      sku: "CS-TSCM-KIT",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Counter-Surveillance"],
      tags: "TSCM,counter surveillance,bug sweep kit,RF detector bundle,professional sweep,anti espionage",
      price: "65000",
      salePrice: "55000",
      costPrice: "38000",
      stockQty: 5,
      shortDescription: "Complete professional TSCM (Technical Surveillance Counter-Measures) kit. Includes RF detector, lens finder, GSM detector, and non-linear detector — everything for a thorough sweep.",
      longDescription: `TSCM Professional Sweep Kit — Complete Counter-Surveillance Bundle

Used by corporate security teams, law firms, government offices, and security consultants. This kit provides everything needed to conduct a thorough Technical Surveillance Counter-Measures (TSCM) sweep of any facility.

Kit Contents:
1. Professional RF Bug Detector (1MHz–8GHz)
2. GSM/4G Cellular Bug Detector
3. Optical Camera Lens Finder (IR)
4. Non-Linear Junction Detector Probe (NLJD)
5. Telephone Line Tap Tester
6. USB Power Bank (10,000mAh) for field use
7. Professional Carry Case (hard foam-lined)

Combined Detection Capabilities:
✓ All RF-transmitting devices (WiFi, Bluetooth, GSM, 4G, 5G, DECT)
✓ Hidden cameras — both active and passive (no signal)
✓ Pinhole cameras embedded in objects
✓ Telephone taps (parallel, series, induction)
✓ Non-transmitting recording devices (detects electronic components)
✓ GPS trackers

Sweep Protocol Included:
• Step-by-step sweep checklist
• Room-by-room documentation forms
• Training guide for in-house security teams

Ideal For:
• Corporate boardrooms and executive offices
• Law firm meeting rooms
• Government and diplomatic facilities
• VIP residences and villas
• Hotels and hospitality security

Service Option Available: Geem offers professional TSCM sweeps — WhatsApp 0307-8680005 for enquiry.

Package: Full kit in professional carry case, Documentation, 1-year warranty on all devices`,
      featuredImage: IMAGES.handheldDevice,
      galleryImages: JSON.stringify([IMAGES.handheldDevice, IMAGES.rfDetector, IMAGES.blackDevice]),
      published: true,
      featured: true,
      metaTitle: "TSCM Professional Counter Surveillance Sweep Kit Pakistan — Geem.pk",
      metaDescription: "Complete TSCM professional sweep kit. RF detector, camera finder, GSM detector and more. Rs 55,000. Geem.pk Pakistan.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    //  COVERT COMMUNICATIONS
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "Encrypted Tactical Handheld Radio — AES-256 VHF/UHF",
      slug: "encrypted-tactical-radio-aes256-vhf-uhf",
      sku: "CC-TAC-RADIO-AES",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Covert Communications"],
      tags: "encrypted radio,tactical radio,AES256,VHF,UHF,secure comms,military radio,two way radio",
      price: "48000",
      salePrice: "42000",
      costPrice: "30000",
      stockQty: 6,
      shortDescription: "Military-grade AES-256 encrypted VHF/UHF handheld radio. Frequency hopping, voice scrambling. Ideal for professional security teams.",
      longDescription: `Encrypted Tactical Handheld Radio — AES-256 Military-Grade Secure Communications

When standard radios are a security liability, this professional encrypted tactical radio ensures your communications cannot be intercepted or decoded — even if frequency is identified.

Technical Specifications:
• Frequency: VHF 136–174MHz / UHF 400–480MHz (dual-band)
• Encryption: AES-256 digital voice encryption
• Frequency Hopping: 50 hops/second (FHSS)
• Output Power: 5W (high) / 1W (low) / 0.5W (ultra-low)
• Channels: 128 programmable channels
• Battery: 3000mAh Li-ion, 16–20 hours standby
• Range: 3–5km open terrain, 500m–1km urban
• IP Rating: IP54 dust and splash resistant
• Display: 1.8" backlit LCD
• Weight: 285g with battery and antenna

Security Features:
• AES-256 End-to-End Encryption
• Frequency Hopping: makes interception nearly impossible
• Scrambler Backup: analog voice inversion for legacy systems
• Emergency Button: programmable distress signal
• VOX: hands-free voice activation
• Lone Worker Alarm: check-in timer with alert

Accessories Included:
• Li-ion battery pack (3000mAh)
• Desktop charger
• Belt holster
• Covert earpiece (2-pin)
• Programming cable + software

Ideal For:
• Private security companies
• Executive protection teams
• Law enforcement support
• Counter-narcotics operations
• High-value asset escorts

Package: Radio unit, Battery, Charger, Covert earpiece, Belt clip, User manual`,
      featuredImage: IMAGES.tacRadio,
      galleryImages: JSON.stringify([IMAGES.tacRadio, IMAGES.tacGear]),
      published: true,
      featured: true,
      metaTitle: "AES-256 Encrypted Tactical Radio Pakistan — Geem.pk",
      metaDescription: "AES-256 encrypted VHF/UHF tactical radio. Frequency hopping, military-grade. Rs 42,000. Geem.pk Pakistan.",
    },
    {
      title: "Covert Surveillance Earpiece Kit — Single-Wire + PTT",
      slug: "covert-surveillance-earpiece-kit-single-wire",
      sku: "CC-EARPC-KIT",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Covert Communications"],
      tags: "covert earpiece,surveillance earpiece,single wire earpiece,PTT,radio earpiece,security earpiece,body worn",
      price: "8500",
      salePrice: "7200",
      costPrice: "4000",
      stockQty: 25,
      shortDescription: "Completely invisible single-wire covert earpiece with in-line PTT microphone. Compatible with Kenwood, Motorola, Hytera 2-pin radios.",
      longDescription: `Covert Surveillance Earpiece Kit — Invisible Single-Wire System

The gold standard for undercover and plainclothes security operations. This earpiece and microphone system is completely invisible under clothing — no visible wire at the ear.

Kit Components:
• Acoustic tube earpiece (clear, left or right ear)
• Covert lapel/tie microphone
• In-line PTT (Push-to-Talk) button
• All connected via ultra-thin single wire

Earpiece Design:
• Acoustic tube carries sound from hidden transducer
• Transducer sits at collar level, hidden under shirt
• The ear portion is transparent and nearly invisible
• Fits all ear sizes — tips included (S/M/L)

PTT Microphone:
• Clip-on mic hides behind tie, lapel, or collar
• One-button PTT operation
• Sensitive directional microphone
• 120cm cable with in-line PTT controller

Compatibility (choose connector):
• Kenwood 2-pin (K1)
• Motorola 2-pin (M1)
• Hytera 2-pin
• Icom 2-pin

Typical Applications:
• Close protection / bodyguard operations
• Event security (concerts, VIP protection)
• Undercover operations
• Retail loss prevention
• Court and diplomatic security

Materials: Medical-grade silicone tube, reinforced cable, plated connectors

Package: Acoustic tube earpiece, Lapel mic + PTT, 3× ear tips (S/M/L), Cleaning brush, Storage pouch`,
      featuredImage: IMAGES.earpiece,
      galleryImages: JSON.stringify([IMAGES.earpiece, IMAGES.tacGear]),
      published: true,
      featured: false,
      metaTitle: "Covert Surveillance Earpiece Kit Pakistan — Geem.pk",
      metaDescription: "Invisible covert earpiece with PTT microphone. Compatible with Kenwood/Motorola/Hytera. Rs 7,200. Geem.pk.",
    },
    {
      title: "Bone Conduction Throat Microphone Tactical Kit",
      slug: "bone-conduction-throat-microphone-tactical",
      sku: "CC-THROAT-MIC",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Covert Communications"],
      tags: "throat microphone,bone conduction,tactical mic,noise cancelling,military mic,radio accessory,covert comms",
      price: "12000",
      salePrice: "10500",
      costPrice: "7000",
      stockQty: 12,
      shortDescription: "Throat-contact bone conduction microphone with PTT. Picks up voice through vibration — works in extreme noise. Ideal for tactical operations.",
      longDescription: `Bone Conduction Throat Microphone — Tactical Communication Kit

A must-have for operations in loud environments — gunfire, generators, crowd noise, or wind noise renders standard mics useless. The throat mic bypasses ambient noise entirely by detecting vocal cord vibration through the neck.

How Bone Conduction Works:
The mic sits against your throat (not in front of your face). It detects vibrations from your vocal cords directly — background noise is completely ignored regardless of volume.

Specifications:
• Microphone Type: Dual-element bone conduction
• Frequency Response: 300Hz–3.4kHz (optimized for voice)
• Sensitivity: -46dB ± 3dB
• Signal-to-Noise Ratio: >40dB even in 120dB noise environment
• PTT Button: Glove-friendly, waterproof
• Earphone: In-ear with 2dB hearing protection
• Cable: 100cm Kevlar-reinforced
• Connector: 2-pin K1 (Kenwood) — specify variant on order
• Weight: 45g full kit

Environments It Excels In:
• Active shooter response and breach operations
• Motorcycle or vehicle-borne security
• Factory or generator room coordination
• Riot or crowd control environments
• Helicopter operations (with appropriate headset adapter)

Compatible Radios: All major 2-pin connector radios (Kenwood, Baofeng, Retevis, Quansheng)

Package: Throat mic with hook-and-loop neck strap, PTT button, In-ear monitor, Foam eartips, Radio connector adapter`,
      featuredImage: IMAGES.tacGear,
      galleryImages: JSON.stringify([IMAGES.tacGear, IMAGES.tacRadio]),
      published: true,
      featured: false,
      metaTitle: "Bone Conduction Throat Microphone Tactical Pakistan — Geem.pk",
      metaDescription: "Bone conduction throat mic for tactical operations. Works in extreme noise. Rs 10,500. Geem.pk Pakistan.",
    },
    {
      title: "Encrypted Push-to-Talk (PoC) Radio — 4G LTE Network",
      slug: "encrypted-poc-radio-4g-lte-network",
      sku: "CC-POC-4G-ENC",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Covert Communications"],
      tags: "PoC radio,4G radio,push to talk,LTE radio,nationwide range,encrypted PTT,internet radio",
      price: "35000",
      salePrice: "31000",
      costPrice: "22000",
      stockQty: 8,
      shortDescription: "4G LTE Push-to-Talk radio with AES encryption. Nationwide and international range over cellular network. No radio license needed in Pakistan.",
      longDescription: `Encrypted PoC (Push-to-Call) Radio — 4G LTE + WiFi Nationwide Coverage

Traditional radios have range limits. PoC (Push-to-Call) radios use 4G LTE cellular networks — giving you unlimited range anywhere with cell coverage, including international.

Technical Specifications:
• Network: 4G LTE + 3G fallback + WiFi
• SIM: Single nano-SIM (works on Zong, Jazz, Telenor, Ufone)
• Display: 2.4" color touchscreen
• Battery: 4000mAh, 24+ hours standby
• PTT Button: Dedicated hardware PTT on side
• IP Rating: IP67 waterproof and dustproof
• Drop Resistance: 1.5m MIL-STD-810G
• Weight: 198g
• Audio: Loud 1W speaker with noise cancellation
• GPS: Built-in for real-time location sharing

Communication Features:
• Instant PTT across any distance (city to city, country to country)
• Group calls: up to 1,000 users per group
• Private 1-on-1 calls
• Broadcast mode: dispatcher to all units
• Dispatch console available (web-based)
• Real-time GPS tracking of all units on map

Security:
• End-to-End AES-256 encryption on all calls
• Private server option available
• No third-party eavesdropping

License Requirements: No radio frequency license needed (uses cellular network)

Package: PoC radio, SIM tray tool, USB-C cable, Wall charger, Belt holster, User manual
Server: 1-month trial included, then subscription-based (or private server option)`,
      featuredImage: IMAGES.radio,
      galleryImages: JSON.stringify([IMAGES.radio, IMAGES.tacRadio]),
      published: true,
      featured: true,
      metaTitle: "4G LTE PoC Encrypted Radio Pakistan — Nationwide PTT — Geem.pk",
      metaDescription: "4G LTE Push-to-Talk encrypted radio. Unlimited range, AES-256. No license needed in Pakistan. Rs 31,000. Geem.pk.",
    },
    {
      title: "Mini Covert Body-Worn Radio — Concealable TX/RX",
      slug: "mini-covert-body-worn-radio-concealable",
      sku: "CC-MINI-BWR",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Covert Communications"],
      tags: "body worn radio,covert radio,mini radio,concealable radio,plainclothes radio,surveillance radio",
      price: "16000",
      salePrice: "13500",
      costPrice: "9000",
      stockQty: 10,
      shortDescription: "Ultra-compact body-worn radio smaller than a matchbox. Completely concealable under clothing. For plainclothes security and covert ops.",
      longDescription: `Mini Covert Body-Worn Radio — Ultra-Concealable Tactical Comms

Standard walkie-talkies are obvious. This miniature radio is designed to be completely hidden under clothing — smaller than a matchbox, it clips inside a shirt, trouser waistband, or jacket lining.

Dimensions & Concealment:
• Size: 68 × 38 × 12mm (approximately matchbox-sized)
• Weight: 42g (lighter than a phone)
• Clip: Reversible spring clip (flat against body)
• Color: Black matte (non-reflective)

Technical Specifications:
• Frequency: UHF 400–470MHz
• Channels: 16 channels
• Output Power: 1W (urban range 500m–1km)
• Battery: Built-in 400mAh Li-ion (USB-C charge)
• Battery Life: 8 hours standby / 4 hours TX
• Squelch: Digital coded (no channel bleed)
• Compatible: With all 2-pin Kenwood/K1 earpiece accessories

Operation:
• PTT via in-line button on covert cable
• No display needed — channel set before deployment
• Audio via covert earpiece only (no external speaker)
• Single LED for battery/channel indicator

Use Cases:
• Plainclothes/undercover security
• Retail store loss prevention
• Event security (usher-level concealment)
• Executive protection close-in team
• Prison/detention facility officers

Package: Mini radio, USB-C charging cable, 2× spare Li-ion cells, K1 2-pin adapter cable, User guide`,
      featuredImage: IMAGES.encryptedPhone,
      galleryImages: JSON.stringify([IMAGES.encryptedPhone, IMAGES.earpiece]),
      published: true,
      featured: false,
      metaTitle: "Mini Covert Body Worn Radio Pakistan — Concealable Security Radio — Geem.pk",
      metaDescription: "Ultra-mini concealable body-worn radio for plainclothes security. 1W UHF, 16ch. Rs 13,500. Geem.pk.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    //  SECURITY EQUIPMENT
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "Ajax Hub 2 — Wireless Smart Alarm System (Starter Kit)",
      slug: "ajax-hub2-wireless-smart-alarm-starter-kit",
      sku: "SE-AJAX-HUB2-KIT",
      brandId: brandIds["Ajax Systems"],
      categoryId: catIds["Security Equipment"],
      tags: "Ajax,wireless alarm,smart alarm,Ajax Hub 2,intrusion detection,GSM alarm,home security system",
      price: "55000",
      salePrice: "49000",
      costPrice: "36000",
      stockQty: 5,
      shortDescription: "Ajax Hub 2 wireless smart alarm starter kit. GSM + Ethernet dual-path. Includes PIR motion detector, door sensor, siren and keypad.",
      longDescription: `Ajax Hub 2 Wireless Smart Alarm System — Starter Kit

Ajax is the world's most awarded wireless security alarm system. The Ajax Hub 2 is the central brain — managing all detectors, sirens, and users through a military-grade encrypted mesh radio network.

What's in the Starter Kit:
• Ajax Hub 2 (central alarm panel)
• 2× MotionProtect (PIR motion detectors)
• 2× DoorProtect (magnetic door/window sensors)
• 1× HomeSiren (indoor siren, 85dB)
• 1× KeyPad (touchscreen arming keypad)
• 1× SpaceControl (key fob remote arm/disarm)

Hub 2 Technical Specifications:
• Communication: GSM (2 SIM slots) + Ethernet (dual-path)
• Encrypted Radio: 868MHz Jeweller protocol, 2km range
• Backup Power: Built-in battery (12h without mains)
• Users: Up to 200 per hub
• Detectors: Up to 200 Ajax devices
• Partitions: Up to 25 independent zones
• Monitoring: Direct to Ajax Cloud + monitoring center

MotionProtect Specs:
• Detection: Passive infrared (PIR) with pet immunity
• Angle: 90° horizontal, 12m range
• Temperature Compensation: -10°C to +40°C
• Battery: 3.5 years (CR123A)

Intelligent Features (via Ajax App — iOS & Android):
• Live arm/disarm from anywhere
• Instant push notifications on alarm
• Event history with timestamps
• Add/remove users remotely
• Connect to 24/7 monitoring station (Geem or your own)

Why Ajax over traditional alarms:
• No wiring required — install in hours, not days
• Encrypted radio — unjammable and tamper-proof
• Works through power cuts (backup battery on all devices)
• Cloud verified — no false alarms relayed to police

Package: Hub 2, 2× MotionProtect, 2× DoorProtect, HomeSiren, KeyPad, SpaceControl, All mounting hardware, SIM tray tools, User manuals`,
      featuredImage: IMAGES.alarmPanel,
      galleryImages: JSON.stringify([IMAGES.alarmPanel, IMAGES.motionSensor]),
      published: true,
      featured: true,
      metaTitle: "Ajax Hub 2 Wireless Alarm System Pakistan — Geem.pk",
      metaDescription: "Ajax Hub 2 smart wireless alarm starter kit. GSM + Ethernet, encrypted. Rs 49,000. Pakistan. Geem.pk.",
    },
    {
      title: "Biometric Fingerprint Access Controller — RFID + Password",
      slug: "biometric-fingerprint-access-controller-rfid",
      sku: "SE-BIO-ACS-PRO",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Security Equipment"],
      tags: "fingerprint access control,biometric door,RFID access,door access system,office security,standalone access",
      price: "18000",
      salePrice: "15500",
      costPrice: "10000",
      stockQty: 12,
      shortDescription: "Standalone biometric fingerprint + RFID card + password access controller. Manages up to 3,000 users. No PC required.",
      longDescription: `Standalone Biometric Fingerprint Access Controller — 3-in-1 Authentication

Replace keys and PIN pads with professional biometric access control. This standalone unit requires no PC or network — all user management is done at the device itself.

Authentication Methods (can use any combination):
• Fingerprint: Optical sensor, 3,000 fingerprint capacity
• RFID Card: 125kHz EM cards (Mifare cards optional)
• Password: 4–8 digit PIN code
• Combined: Fingerprint + Card, Fingerprint + PIN, Card + PIN

Technical Specifications:
• Display: 2.8" TFT color touchscreen
• Fingerprint Sensor: 500 DPI optical with live finger detection
• User Capacity: 3,000 fingerprints, 3,000 cards, 3,000 PINs
• Log Capacity: 100,000 records (exportable via USB)
• Communication: TCP/IP + USB + RS485 (optional software)
• Lock Output: 12V relay (NC/NO configurable)
• Wiegand: Out 26/34-bit for integration with existing systems
• Power: 12VDC (adaptor included)
• Backup Power Input: External battery terminal
• Weatherproofing: IP65 (outdoor rated)

Management Features:
• 9 Access Levels (time-zone based)
• Anti-passback (prevents card sharing)
• Door open timeout alarm
• Forced open alarm
• Tamper alarm (if device is removed from wall)

Installation Includes: Complete door hardware pack (EM lock 280kg, exit button, power supply, all cables) — order complete kit or unit only.

Package: Controller unit, AC/DC adaptor, EM card reader (built-in), 10× sample EM cards, Mounting hardware, Software CD, Manual`,
      featuredImage: IMAGES.accessControl,
      galleryImages: JSON.stringify([IMAGES.accessControl, IMAGES.doorLock]),
      published: true,
      featured: true,
      metaTitle: "Biometric Fingerprint Access Controller Pakistan — Geem.pk",
      metaDescription: "Biometric fingerprint + RFID + password door access controller. 3000 users, standalone. Rs 15,500. Geem.pk.",
    },
    {
      title: "Electromagnetic Door Lock 600lbs — Glass Door / Frame Mount",
      slug: "electromagnetic-door-lock-600lbs",
      sku: "SE-EM-LOCK-600",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Security Equipment"],
      tags: "electromagnetic lock,EM lock,600lb,door lock,access control,electric lock,maglock,office door",
      price: "8500",
      salePrice: "7200",
      costPrice: "4500",
      stockQty: 20,
      shortDescription: "600lb (272kg) holding force electromagnetic door lock. Universal L-bracket included for glass, wood, and metal doors.",
      longDescription: `Electromagnetic Door Lock — 600lbs (272kg) Holding Force

The cornerstone of any access control installation. This EM lock creates an invisible magnetic hold that is stronger than the frame itself — no mechanical parts, no wear, virtually maintenance-free.

Specifications:
• Holding Force: 600lbs / 272kg (tested)
• Power: 12VDC @ 400mA / 24VDC @ 200mA
• Operating Temperature: -10°C to +50°C
• Material: Zinc alloy housing, rare-earth magnets
• Status LED: Green (locked) / Red (unlocked)
• Door Sensor: Built-in reed switch with status output
• Bond Sensor: Detects whether armature is aligned (tamper feedback)
• IP Rating: IP54
• Dimensions: 180 × 45 × 26mm (body)

Mounting Hardware Included:
• Z-bracket (frameless glass door mount)
• L-bracket (90° for swinging door on frame)
• Standard flat plate (single surface mount)
• Full stainless hardware pack

Wiring:
• Lock powered via access controller or standalone timer
• Fail-Safe (power = locked, cut power = unlocks) — standard
• Fail-Secure version available (power = unlocked, cut = stays locked) — order separately

Integration:
• Works with all Wiegand access controllers (Hikvision, Dahua, ZKTeco, Ajax)
• Relay output compatible with alarm systems
• 12V / 24V universal power

Required Accessories (sold separately): Power supply 12V 2A, Exit button, Access controller or keypad

Package: EM lock body, Armature plate, Z-bracket, L-bracket, Flat plate, Stainless bolt kit, Wiring diagram`,
      featuredImage: IMAGES.doorLock,
      galleryImages: JSON.stringify([IMAGES.doorLock, IMAGES.accessControl]),
      published: true,
      featured: false,
      metaTitle: "Electromagnetic Door Lock 600lbs Pakistan — Geem.pk",
      metaDescription: "600lb electromagnetic door lock with universal bracket kit. 12V/24V. Rs 7,200. Geem.pk Pakistan.",
    },
    {
      title: "Paradox SP65 Alarm Panel — Professional Grade 8-Zone",
      slug: "paradox-sp65-alarm-panel-8-zone",
      sku: "SE-PDX-SP65",
      brandId: brandIds["Paradox"],
      categoryId: catIds["Security Equipment"],
      tags: "Paradox,alarm panel,SP65,intrusion detection,8 zone alarm,PSTN,GSM alarm,professional alarm",
      price: "28000",
      salePrice: "24500",
      costPrice: "17000",
      stockQty: 8,
      shortDescription: "Paradox SP65 8-zone professional alarm panel with PSTN + GSM reporting. Industry standard in commercial and residential security.",
      longDescription: `Paradox SP65 — 8-Zone Professional Alarm Panel

Paradox (Canada) is one of the most trusted names in professional alarm systems worldwide, used by certified installers across Pakistan. The SP65 is the workhorse panel for residential and small commercial installations.

Panel Specifications:
• Zones: 8 fully programmable zones (expandable to 32 with modules)
• Users: 96 user codes + 1 master code
• Partitions: 2 independent partitions (e.g. home + shop)
• Communication: PSTN dialler + optional GSM module
• Event Log: 512 events with time/date stamp
• Output: 2 programmable PGM outputs (lights, sirens, gates)
• Keypad: Compatible with K636 touchscreen or K32LCD LCD keypad (sold separately)
• Power: 12VDC @ 2A from included transformer, 12V 7Ah battery backup

Communication Options:
• PTSC/PSTN: Calls up to 8 phone numbers on alarm
• SMS Reporting: Via optional RTX3 GSM communicator
• Contact ID: Compatible with monitoring station software
• IP Reporting: Via IP150 module (optional)

Zone Types Supported:
• Instant, Stay/Away, Interior, Perimeter, 24-Hour, Fire, Flood, Medical, Follower

Certifications: UL Listed, CE Marked, Grade 2 EN50131

Compatible Accessories (all available at Geem):
• K636 touchscreen keypad
• K32LCD LCD keypad
• RTX3 GSM communicator module
• NV25 wireless receiver
• IP150 IP reporting module

Package: SP65 panel board, Cabinet, Transformer, Terminal block connectors, Programming guide, Installer manual`,
      featuredImage: IMAGES.alarmPanel,
      galleryImages: JSON.stringify([IMAGES.alarmPanel]),
      published: true,
      featured: false,
      metaTitle: "Paradox SP65 Alarm Panel 8 Zone Pakistan — Geem.pk",
      metaDescription: "Paradox SP65 8-zone professional alarm panel. PSTN+GSM reporting. Rs 24,500. Certified installer available. Geem.pk.",
    },
    {
      title: "Hikvision Video Door Intercom — DS-KV8113-WME1 + Monitor",
      slug: "hikvision-video-door-intercom-ds-kv8113",
      sku: "SE-HIK-VDI-KV8113",
      brandId: brandIds["Hikvision"],
      categoryId: catIds["Security Equipment"],
      tags: "video intercom,video door phone,Hikvision intercom,IP intercom,door station,DS-KV8113,villa intercom",
      price: "32000",
      salePrice: "27500",
      costPrice: "19000",
      stockQty: 7,
      shortDescription: "Hikvision DS-KV8113 IP video door station with 7\" indoor monitor. Two-way audio/video, remote door unlock, PoE, app control.",
      longDescription: `Hikvision IP Video Intercom Kit — DS-KV8113-WME1 Door Station + 7" Monitor

The professional standard for villa and apartment video intercoms in Pakistan. Hikvision's IP-based system integrates with CCTV, access control, and smartphone apps.

Door Station (DS-KV8113-WME1) Specifications:
• Camera: 2MP, 180° horizontal, IR night vision (3m)
• Display: Wide-angle fisheye lens view
• Audio: Two-way with active noise cancellation
• Door Lock: Built-in relay for EM lock, electric strike, or door release
• Power: PoE (802.3af) or 12VDC
• IP Rating: IP65 weatherproof
• Tamper: Alarm output on tampering
• Dimensions: 130 × 50 × 23mm (flush mount)
• Surface/Flush mount: Both kits included

7" Indoor Monitor Specifications:
• Display: 7" IPS touchscreen, 1024 × 600px
• Video: H.264 live view from door station
• Audio: Full-duplex two-way voice
• Unlock: Button on monitor opens connected lock
• Call Log: Last 50 missed calls with photos
• Power: 12VDC
• WiFi: Built-in (for app control + multiple apartment scenarios)

Hik-Connect App Features:
• See and speak to visitor from anywhere via internet
• Unlock door remotely (one tap in app)
• Snapshot capture at every call attempt
• Works with Hik-Connect platform (free cloud service)

Expandable: System supports multiple monitors (up to 4 per door station) and multiple door stations per building.

Package: DS-KV8113-WME1 door station, 7" indoor monitor, Power supply, Flush mount box, Surface mount bracket, Wiring guide, Hik-Connect setup card`,
      featuredImage: IMAGES.intercom,
      galleryImages: JSON.stringify([IMAGES.intercom, IMAGES.accessControl]),
      published: true,
      featured: true,
      metaTitle: "Hikvision Video Door Intercom DS-KV8113 Pakistan — Geem.pk",
      metaDescription: "Hikvision DS-KV8113 IP video intercom + 7 inch monitor. Two-way video, app unlock, PoE. Rs 27,500. Geem.pk.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    //  SIGNAL & RF DETECTORS
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "RF Explorer 6G Combo — Portable Spectrum Analyzer",
      slug: "rf-explorer-6g-combo-spectrum-analyzer",
      sku: "RF-EXP-6G-COMBO",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Signal & RF Detectors"],
      tags: "spectrum analyzer,RF explorer,6G spectrum,RF analysis,frequency analyzer,signal analysis,TSCM tool",
      price: "45000",
      salePrice: "39000",
      costPrice: "28000",
      stockQty: 4,
      shortDescription: "Professional handheld RF spectrum analyzer covering 15MHz–2.7GHz + 4.85–6.1GHz. Real-time signal visualization on color display. TSCM professional tool.",
      longDescription: `RF Explorer 6G Combo — Handheld RF Spectrum Analyzer

The RF Explorer 6G Combo is the professional's choice for field signal analysis, bug sweeping, interference hunting, and RF security audits. It visualizes every signal in your environment in real time.

Frequency Coverage:
• Band 1: 15MHz – 2.7GHz (covers all cellular, WiFi, Bluetooth, GSM, GPS, ISM)
• Band 2: 4.85GHz – 6.1GHz (covers 5GHz WiFi, unlicensed 5.8GHz devices)
• Combined: Near-complete spectrum coverage for all modern surveillance devices

Hardware Specifications:
• Display: 128 × 64 color OLED (high contrast in sunlight)
• Sweep Speed: Up to 112 sweeps/second
• Resolution Bandwidth (RBW): 1kHz minimum
• Dynamic Range: -115dBm to 0dBm
• Reference Oscillator: TCXO (temperature-compensated, high accuracy)
• Interface: USB + Serial (logs to PC in real time)
• Battery: Li-ion built-in, 3 hours continuous
• Weight: 120g
• Dimensions: 113 × 70 × 12mm

PC Software (included, free):
• RFExplorer for Windows: waterfall display, recording, analysis
• Real-time spectrum + waterfall export
• Automatic peak detection

Field Uses:
• Bug sweeping and TSCM operations
• Detect hidden transmitters by visualizing their signal
• Identify unknown signal sources in a facility
• 5GHz WiFi camera detection
• Drone frequency detection (2.4GHz / 5.8GHz)
• Cellular signal mapping

Package: RF Explorer 6G Combo analyzer, USB-A to Mini-USB cable, 2× SMA antennas (whip), Hard EVA carry case, PC software download card`,
      featuredImage: IMAGES.spectrumAnalyzer,
      galleryImages: JSON.stringify([IMAGES.spectrumAnalyzer, IMAGES.rfDetector]),
      published: true,
      featured: true,
      metaTitle: "RF Explorer 6G Spectrum Analyzer Pakistan — Geem.pk",
      metaDescription: "RF Explorer 6G Combo portable spectrum analyzer 15MHz–6.1GHz. TSCM professional tool. Rs 39,000. Geem.pk.",
    },
    {
      title: "Multi-Band Bug Sweeper — 1MHz to 12GHz Professional",
      slug: "multi-band-bug-sweeper-1mhz-12ghz-professional",
      sku: "RF-SWEEP-12G",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Signal & RF Detectors"],
      tags: "bug sweeper,multi band detector,12GHz,RF bug sweeper,professional TSCM,broadband detector",
      price: "38000",
      salePrice: "33500",
      costPrice: "24000",
      stockQty: 6,
      shortDescription: "Professional broadband RF bug sweeper 1MHz–12GHz. Detects all known surveillance transmitters including 5G-band and short-range microwave bugs.",
      longDescription: `Professional Multi-Band RF Bug Sweeper — 1MHz to 12GHz

Unlike cheap detectors that miss high-frequency devices, this professional sweeper covers the entire practical RF spectrum — including X-band (10–12GHz) microwave transmission bugs used in high-value targets.

Frequency Coverage:
• Low Band: 1MHz–100MHz (AM, shortwave, FM, VHF)
• Mid Band: 100MHz–3GHz (GSM, 3G/4G, WiFi, Bluetooth, GPS)
• High Band: 3GHz–12GHz (5G, X-band microwave, 60GHz emerging)

Detection Modes:
• Broadband Sweep: Detects any signal above threshold
• Narrowband Tracking: Locks to and tracks a detected signal
• Frequency Display: Shows detected signal frequency in MHz/GHz
• Signal Strength: Logarithmic bar graph + numeric dBm readout
• Audio Demodulation: Listen to captured signal (AM/FM modes)

Advanced Features:
• Auto-Threshold: Sets baseline from environment automatically
• Memory: Last 20 detected signals stored
• OLED Display: Clear readout in all lighting conditions
• 3 Antenna Ports: Omni, directional panel, and probe included
• Earphone Jack: Private audio monitoring
• Battery: 4000mAh, 8 hours continuous

Detects (coverage validated):
✓ GSM 2G/3G/4G/5G bugs
✓ WiFi and Bluetooth devices
✓ Analog VHF/UHF transmitters
✓ GPS trackers (transmitting)
✓ Digital DECT phones
✓ Microwave transmission bugs (3–12GHz)
✓ 5GHz WiFi cameras

Package: Detector unit, Omnidirectional antenna, Directional panel antenna, Near-field probe antenna, USB-C charger, Earphones, Hard case`,
      featuredImage: IMAGES.bugSweeper,
      galleryImages: JSON.stringify([IMAGES.bugSweeper, IMAGES.spectrumAnalyzer]),
      published: true,
      featured: false,
      metaTitle: "Professional Multi-Band Bug Sweeper 12GHz Pakistan — Geem.pk",
      metaDescription: "Multi-band RF bug sweeper 1MHz–12GHz. Broadband professional TSCM detection. Rs 33,500. Geem.pk.",
    },
    {
      title: "Wireless Hidden Camera Detector — 1.2GHz / 2.4GHz / 5.8GHz",
      slug: "wireless-hidden-camera-detector-wifi-spy",
      sku: "RF-WCAM-DET",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Signal & RF Detectors"],
      tags: "wireless camera detector,WiFi camera finder,spy camera detector,2.4GHz,5.8GHz,hidden camera,anti spy",
      price: "12000",
      salePrice: "10200",
      costPrice: "6500",
      stockQty: 15,
      shortDescription: "Detects WiFi and analog wireless spy cameras on 1.2GHz, 2.4GHz, and 5.8GHz bands. Built-in viewfinder to locate the camera after detection.",
      longDescription: `Wireless Hidden Camera Detector — 3-Band (1.2GHz / 2.4GHz / 5.8GHz)

Specifically designed to find wireless spy cameras — the most common threat in hotels, changing rooms, rental properties, and private spaces.

Detection Bands:
• 1.2GHz: Older analog wireless cameras (still widely used in cheap spy cams)
• 2.4GHz: WiFi cameras, WiFi spy cameras, analog 2.4GHz AV senders
• 5.8GHz: Modern WiFi cameras, 5.8GHz analog spy cameras

Dual Detection System:
1. RF Detection: Detects wireless signal from any transmitting camera
2. Optical Lens Finder: IR reflection finder in the built-in viewfinder (finds non-transmitting cameras too)

Features:
• Sensitivity: 5-level dial (fine to coarse)
• Alert: Variable-rate audio beep (faster = stronger signal)
• LED Bar: 8-segment signal strength display
• Viewfinder: Built-in IR lens reflection finder
• IR LEDs: 7× infrared LEDs for lens detection
• Battery: 9V (included), 8+ hours
• Size: Compact handheld — fits in pocket

How to Use:
1. Turn on RF detection, walk slowly around room
2. Audio beeps faster near wireless camera signal
3. Once signal detected, switch to optical finder
4. In semi-dark room, look through viewfinder — lens will glow

Limitations: Does not detect recording-only cameras with no wireless transmitter (use lens finder or NLJD for those)

Package: Detector unit, 9V battery, Wrist strap, Carry pouch, Quick guide`,
      featuredImage: IMAGES.wirelessDetector,
      galleryImages: JSON.stringify([IMAGES.wirelessDetector, IMAGES.rfDetector]),
      published: true,
      featured: false,
      metaTitle: "Wireless Camera Detector 2.4GHz 5.8GHz Pakistan — Geem.pk",
      metaDescription: "WiFi wireless spy camera detector. 1.2/2.4/5.8GHz plus optical lens finder. Rs 10,200. Geem.pk Pakistan.",
    },
    {
      title: "Non-Linear Junction Detector (NLJD) — Electronic Device Finder",
      slug: "non-linear-junction-detector-nljd",
      sku: "RF-NLJD-PRO",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Signal & RF Detectors"],
      tags: "NLJD,non linear junction detector,electronic bug finder,TSCM,semiconductor detector,active passive bug",
      price: "120000",
      salePrice: "105000",
      costPrice: "78000",
      stockQty: 2,
      shortDescription: "Professional Non-Linear Junction Detector (NLJD). Finds ANY electronic device — even switched off, battery removed, never powered on. The ultimate TSCM tool.",
      longDescription: `Non-Linear Junction Detector (NLJD) — Professional Grade

The NLJD is the most powerful TSCM tool in existence. It detects semiconductor junctions (transistors, diodes) in any electronic device — regardless of whether the device is active, passive, switched off, or even has no battery. If it has electronics, the NLJD will find it.

Working Principle:
The NLJD transmits a continuous-wave RF signal. When it strikes a semiconductor (any electronic component), the non-linear junction reflects back at 2× and 3× the transmitted frequency (harmonic frequencies). The NLJD detects this harmonic return signal — uniquely identifying electronics hidden in walls, furniture, objects.

Technical Specifications:
• Transmit Frequency: 915MHz (ISM band)
• Detection: 2nd harmonic (1830MHz) and 3rd harmonic (2745MHz)
• Transmit Power: 200mW (adjustable)
• Detection Sensitivity: -120dBm
• Display: Analog bar graph + digital dBm readout
• Audio: Dual-tone (different pitch for 2nd vs 3rd harmonic — distinguishes bugs from natural materials)
• Probe: Non-contact telescoping antenna (20cm–90cm)
• Battery: Li-ion pack, 4 hours continuous operation
• Weight: 1.8kg (probe + control unit)

What it Detects (everything RF detectors miss):
✓ Switched-off recording bugs
✓ Passive transmitters (activate on interrogation)
✓ Bugs with depleted batteries
✓ Devices waiting to be activated
✓ Embedded electronics in walls or objects
✓ SIM-card bugs that are not currently transmitting

Distinction Feature: 2nd harmonic = strong reflection from electronics; 3rd harmonic weak = confirms electronics vs natural non-linearity (oxidized metal, rust). This eliminates false positives.

Package: NLJD probe + control unit, Li-ion battery pack, Charger, Telescoping probe antenna, Hard carry case, Calibration certificate, Full user manual`,
      featuredImage: IMAGES.detector,
      galleryImages: JSON.stringify([IMAGES.detector, IMAGES.spectrumAnalyzer]),
      published: true,
      featured: true,
      metaTitle: "Non-Linear Junction Detector NLJD Pakistan — Geem.pk",
      metaDescription: "Professional NLJD non-linear junction detector. Finds any electronic bug even switched off. Rs 105,000. Geem.pk.",
    },
    {
      title: "Cell Phone Detector — Unauthorized Mobile Phone Finder",
      slug: "cell-phone-detector-unauthorized-mobile",
      sku: "RF-CELL-DET",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Signal & RF Detectors"],
      tags: "cell phone detector,mobile phone detector,contraband phone,prison phone detector,2G 3G 4G 5G detector",
      price: "28000",
      salePrice: "24000",
      costPrice: "17000",
      stockQty: 6,
      shortDescription: "Detects active, standby, and even switched-off mobile phones. Multi-band detection (2G/3G/4G/5G). Used in prisons, courtrooms, exam halls, and secure facilities.",
      longDescription: `Cell Phone Detector — Multi-Band Mobile Phone Detection System

Unauthorized mobile phones in prisons, courtrooms, exam halls, and secure facilities are a serious security breach. This detector identifies ALL mobile phones across all Pakistani cellular bands — even phones on standby or in airplane mode.

Detection Capabilities:
• Active Call Detection: 2G/3G/4G/5G transmission detection
• Standby Detection: Detects passive paging signals (phone idle)
• Airplane Mode: Detects Bluetooth and WiFi if enabled
• Switched Off: Detects battery presence via passive electromagnetic emission

Frequency Bands Covered:
• 900MHz (GSM) — Jazz, Zong 2G
• 1800MHz (GSM) — Ufone, Telenor 2G
• 2100MHz (3G/H+) — All operators
• 2600MHz (4G LTE) — Zong 4G
• 700MHz (4G LTE) — Telenor 4G Band 28
• 2400MHz — WiFi + Bluetooth (when active)
• 5800MHz — 5GHz WiFi

Device Features:
• Directional Antenna: Narrows detection to within 1m for pinpointing
• Signal Strength Meter: Guides user to phone location
• Alert Mode: Silent vibration or audible alarm (switchable)
• Discrimination Mode: Distinguishes phone signals from ambient interference
• Log Mode: Records detection events with timestamp

Typical Deployment:
• Corrections facilities (cell blocks, visiting rooms)
• Courtroom and judiciary security
• Competitive examination halls
• Corporate restricted zones
• Parliament and government chambers

Package: Detector unit with directional antenna, Omnidirectional antenna, USB-C charger, Earphone, Hard carry case, Calibration guide`,
      featuredImage: IMAGES.blackDevice,
      galleryImages: JSON.stringify([IMAGES.blackDevice, IMAGES.detector]),
      published: true,
      featured: false,
      metaTitle: "Cell Phone Detector Pakistan — Prison Exam Hall Mobile Finder — Geem.pk",
      metaDescription: "Multi-band cell phone detector. Finds 2G 3G 4G 5G mobile phones. Prisons, exams, secure areas. Rs 24,000. Geem.pk.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    //  SMART SECURITY SYSTEMS
    // ══════════════════════════════════════════════════════════════════════════
    {
      title: "Hikvision DS-2CD2T47G2-L 4MP ColorVu Network Camera",
      slug: "hikvision-ds-2cd2t47g2-l-4mp-colorvu",
      sku: "SS-HIK-2CD2T47G2",
      brandId: brandIds["Hikvision"],
      categoryId: catIds["Smart Security Systems"],
      tags: "Hikvision,IP camera,4MP,ColorVu,color night vision,outdoor camera,bullet camera,network camera",
      price: "22000",
      salePrice: "18500",
      costPrice: "13000",
      stockQty: 20,
      shortDescription: "Hikvision 4MP ColorVu IP bullet camera. Full-colour night vision (no black & white), built-in microphone, 60m illumination. PoE powered.",
      longDescription: `Hikvision DS-2CD2T47G2-L — 4MP ColorVu Full-Color IP Bullet Camera

Forget grainy black-and-white night footage. ColorVu cameras maintain vivid, full-colour video around the clock — even in total darkness — using supplemental light technology and a large F/1.0 aperture lens.

Technical Specifications:
• Image Sensor: 1/1.8" progressive scan CMOS
• Resolution: 4MP (2688 × 1520)
• Lens: 2.8mm or 4mm (specify on order)
• Aperture: F/1.0 (extremely large for maximum light capture)
• Night Vision: ColorVu — full colour at night, white supplemental light
• Illumination Range: 60 metres (colour night vision)
• Frame Rate: 25fps @ 4MP
• Compression: H.265+, H.265, H.264+, H.264
• WDR: 130dB (handles bright sunlight + dark shadows simultaneously)
• Microphone: Built-in, audio stream to NVR/app

Connectivity & Power:
• Interface: RJ45 (PoE + data on single cat6 cable)
• Power: PoE (802.3af) or 12VDC
• Video Output: Onvif / Hikvision SDK / RTSP
• Smart Features: Line crossing, area intrusion, loitering, face detection

Weather Rating:
• IP67: Dustproof + jet-waterproof
• IK10: Vandal-resistant housing
• Operating: -40°C to +60°C (suited for Pakistan's climate extremes)

Ideal Placement:
• Villa boundary walls and gates
• Commercial parking lots and loading bays
• Petrol stations and road checkpoints
• Industrial outdoor perimeters

Package: Camera unit, Mounting bracket, Anchors and screws, PoE installation guide
Note: NVR, switch, and cable sold separately`,
      featuredImage: IMAGES.ipCamera,
      galleryImages: JSON.stringify([IMAGES.ipCamera, IMAGES.security]),
      published: true,
      featured: true,
      metaTitle: "Hikvision 4MP ColorVu IP Camera DS-2CD2T47G2 Pakistan — Geem.pk",
      metaDescription: "Hikvision DS-2CD2T47G2 4MP ColorVu full-color night vision IP camera. Rs 18,500. Geem.pk Pakistan.",
    },
    {
      title: "Dahua NVR4108HS-8P-4KS3 — 8CH PoE Network Video Recorder",
      slug: "dahua-nvr4108hs-8p-4ks3-8ch-poe-nvr",
      sku: "SS-DAH-NVR4108HS",
      brandId: brandIds["Dahua"],
      categoryId: catIds["Smart Security Systems"],
      tags: "Dahua,NVR,8 channel,PoE NVR,network video recorder,4K,H.265+,AI NVR,IP NVR",
      price: "35000",
      salePrice: "29500",
      costPrice: "21000",
      stockQty: 10,
      shortDescription: "Dahua 8-channel PoE NVR with H.265+ compression, AI features (face detection, people counting), and 4K output. Powers cameras directly via 8× PoE ports.",
      longDescription: `Dahua NVR4108HS-8P-4KS3 — 8-Channel Smart H.265 PoE NVR

A complete CCTV recording brain with built-in PoE switch — connect up to 8 IP cameras with a single Cat6 cable each (no separate switch needed).

Key Specifications:
• Channels: 8 IP cameras
• Built-in PoE: 8× 802.3af/at ports (total PoE budget: 80W)
• Max Resolution: 4K (8MP) per camera
• Total Bandwidth: 80Mbps incoming
• Compression: H.265+ / H.265 / H.264+ / H.264
• HDD: 1× SATA bay (up to 8TB — not included)
• Display Output: 1× HDMI (4K) + 1× VGA (1080p)
• Onboard Playback: Up to 4 channels simultaneously

AI & Smart Features:
• Face Detection & Recognition (optional license)
• People Counting Analytics
• Intrusion Detection
• Line Crossing
• SMD Plus: Separates people, vehicles, and objects — reduces false alarms
• Perimeter Protection

Network Features:
• Remote View: Dahua gDMSS / iDMSS app (iOS and Android)
• P2P Cloud Access: scan QR code and view in 60 seconds
• ONVIF Profile S/G/T compatible (works with 3rd party cameras)
• 2-way audio through compatible cameras

HDD Recommendation:
• For 8 cameras × 7 days continuous: 4TB minimum
• For 8 cameras × 30 days: 16TB (requires expansion)

Package: NVR unit, Power adaptor, HDMI cable, 2× SATA data cables, Quick setup guide, Mouse
Note: Hard drive sold separately; IP cameras sold separately`,
      featuredImage: IMAGES.nvr,
      galleryImages: JSON.stringify([IMAGES.nvr, IMAGES.ipCamera]),
      published: true,
      featured: true,
      metaTitle: "Dahua 8 Channel PoE NVR NVR4108HS Pakistan — Geem.pk",
      metaDescription: "Dahua NVR4108HS 8-channel PoE NVR with AI features. H.265+ 4K recording. Rs 29,500. Geem.pk Pakistan.",
    },
    {
      title: "Reolink RLC-810A 8MP Smart IP Camera — PoE + Spotlight",
      slug: "reolink-rlc-810a-8mp-smart-ip-camera",
      sku: "SS-REO-RLC810A",
      brandId: brandIds["Reolink"],
      categoryId: catIds["Smart Security Systems"],
      tags: "Reolink,8MP,4K,IP camera,smart detection,spotlight camera,color night vision,PoE camera,AI camera",
      price: "18000",
      salePrice: "15200",
      costPrice: "10500",
      stockQty: 18,
      shortDescription: "Reolink RLC-810A 8MP (4K) PoE IP camera with person/vehicle AI detection, built-in spotlight for color night vision, and two-way audio.",
      longDescription: `Reolink RLC-810A — 4K Smart Detection Spotlight IP Camera

4K resolution with AI-powered smart detection that distinguishes people and vehicles — so you get alerts only when it matters, not for every cat or passing headlight.

Technical Specifications:
• Resolution: 8MP (3840 × 2160) — true 4K
• Lens: 2.8mm wide angle (105° field of view)
• Frame Rate: 25fps @ 8MP
• Sensor: CMOS 1/1.8"
• Compression: H.265 smart encoding
• Night Vision: Built-in white spotlight (30m) — full colour at night
• IR: Also includes 30m IR for optional B&W IR mode
• WDR: 100dB
• Microphone + Speaker: Two-way audio built-in

Smart Detection (AI):
• Person Detection: Alerts only when a human is detected
• Vehicle Detection: Alerts for cars, bikes, trucks
• Pet Detection: Separate pet alerts (optional)
• Motion Zones: Draw custom detection areas to avoid false alerts
• Smart Alerts: Push notification with thumbnail preview to Reolink app

Connectivity:
• Power: PoE (802.3af single cable) or 12V DC
• Interface: RJ45 Ethernet
• Protocol: ONVIF 2.0, RTSP
• App: Reolink (iOS / Android) — remote view, playback, alerts
• NVR: Compatible with all Reolink NVRs + 3rd party ONVIF systems

Build Quality:
• IP66 waterproof
• Operating temperature: -10°C to +55°C

Package: RLC-810A camera, Mounting bracket, 3m installation template, Waterproof connector kit, Hardware bag`,
      featuredImage: IMAGES.domeCamera,
      galleryImages: JSON.stringify([IMAGES.domeCamera, IMAGES.ipCamera]),
      published: true,
      featured: false,
      metaTitle: "Reolink RLC-810A 4K 8MP Smart IP Camera Pakistan — Geem.pk",
      metaDescription: "Reolink RLC-810A 8MP 4K PoE camera with AI person/vehicle detection and spotlight. Rs 15,200. Geem.pk.",
    },
    {
      title: "Smart Fingerprint Door Lock — Biometric + App + RFID",
      slug: "smart-fingerprint-door-lock-biometric-app",
      sku: "SS-SFLOCK-APP",
      brandId: brandIds["Unbranded"],
      categoryId: catIds["Smart Security Systems"],
      tags: "smart lock,fingerprint lock,biometric lock,WiFi lock,app door lock,smart home lock,electronic lock",
      price: "24000",
      salePrice: "20500",
      costPrice: "14000",
      stockQty: 14,
      shortDescription: "Smart door lock with fingerprint, RFID card, PIN code, mechanical key, and smartphone app (WiFi). Manage access remotely, view entry logs, issue temporary codes.",
      longDescription: `Smart Biometric Door Lock — 5-in-1 Access + WiFi App Control

Replace your standard door lock with a smart lock that lets you grant access to family, staff, or guests from anywhere in the world — and track every entry.

Unlocking Methods (5 in 1):
1. Fingerprint: 100 prints, 0.5-second unlock, anti-wear optical sensor
2. RFID Card/Fob: 125kHz EM (or 13.56MHz Mifare — specify)
3. PIN Code: 4–12 digit personal code
4. App (WiFi): Unlock from phone from anywhere
5. Mechanical Key Override: Emergency backup (2 keys included)

Smart App Features (iOS & Android):
• Remote unlock: one tap in app
• Temporary access codes: issue time-limited PINs to guests or contractors
• Access log: see who entered and when, with photo (optional camera model)
• Low battery notification: alert before battery dies
• Auto-lock: set door to auto-lock after 10/30/60 seconds

Technical Specifications:
• Motor: Anti-saw and anti-pry steel bolt (30mm throw)
• WiFi: 2.4GHz direct connection (no hub needed for most features)
• Battery: 4× AA alkaline (12 months typical life) + USB-C emergency charging port
• Material: Zinc alloy exterior + ABS interior panel
• Fire rating: Handles up to 350°C for 30 minutes
• Fits Doors: 38–100mm thick (adjustable)
• Lock Size: 380 × 72mm (standard fit for most Pakistani doors)

What's Included:
• Exterior touchscreen panel
• Interior control panel
• Smart deadbolt
• 2× mechanical emergency keys
• 3× RFID cards
• 4× AA batteries
• Full hardware pack (screws, templates, strike plate)
• App setup guide`,
      featuredImage: IMAGES.smartLock,
      galleryImages: JSON.stringify([IMAGES.smartLock, IMAGES.doorLock]),
      published: true,
      featured: true,
      metaTitle: "Smart Biometric Fingerprint Door Lock Pakistan — Geem.pk",
      metaDescription: "Smart door lock with fingerprint, RFID, PIN, app and key. WiFi remote access. Rs 20,500. Geem.pk Pakistan.",
    },
    {
      title: "Hikvision DS-7616NI-M2 — 16-Channel 4K IP NVR",
      slug: "hikvision-ds-7616ni-m2-16ch-4k-nvr",
      sku: "SS-HIK-7616NI-M2",
      brandId: brandIds["Hikvision"],
      categoryId: catIds["Smart Security Systems"],
      tags: "Hikvision,16 channel NVR,4K NVR,DS-7616NI,IP NVR,commercial NVR,H.265+ NVR,2 HDD NVR",
      price: "62000",
      salePrice: "54000",
      costPrice: "39000",
      stockQty: 5,
      shortDescription: "Hikvision 16-channel 4K NVR with dual HDD bays (up to 16TB), H.265+ compression, AI deep learning, and 2-way audio. Commercial-grade central recorder.",
      longDescription: `Hikvision DS-7616NI-M2 — 16-Channel 4K Smart IP NVR

The commercial-grade NVR for businesses, factories, and large residential complexes. 16 camera channels, dual HDD for RAID-1 redundancy, and deep-learning AI built in.

Key Specifications:
• Channels: 16 IP cameras
• Max Resolution: 4K (8MP) per channel
• Total Incoming Bandwidth: 160Mbps
• HDD Bays: 2× SATA (up to 8TB each = 16TB total)
• RAID: RAID-1 mirroring for data redundancy (optional)
• Compression: H.265+ / H.265 / H.264+
• Display Output: 1× HDMI 4K + 1× HDMI 1080p (dual monitor support)
• Playback: Up to 16ch synchronous
• Audio: 16× audio input, 1× audio output

Deep Learning AI Features:
• Face Detection and Recognition database
• Perimeter Intrusion (line crossing + zone intrusion)
• People Counting (business analytics)
• Vehicle detection and plate recognition (ANPR with license)
• Behavior analysis: loitering, crowd gathering

Remote Access:
• Hik-Connect P2P cloud (free)
• iVMS-4200 PC software (free)
• App: Hik-Connect (iOS/Android)
• Web browser access (built-in web server)
• API: Open SDK for integration

Hardware:
• Processor: Embedded Linux with dedicated AI chip
• RAM: 4GB DDR4
• USB: 2× USB 3.0 (front) + 2× USB 2.0 (rear) for backup
• Network: 2× RJ45 Gigabit (dual NIC for redundancy)
• Power: 100–240VAC auto-switching

Package: NVR unit, Power cable, 2× SATA cables, 2× SATA power cables, Mouse, HDMI cable, Quick install guide
Note: Hard drives sold separately; IP cameras sold separately`,
      featuredImage: IMAGES.nvr,
      galleryImages: JSON.stringify([IMAGES.nvr, IMAGES.security]),
      published: true,
      featured: true,
      metaTitle: "Hikvision 16 Channel 4K NVR DS-7616NI-M2 Pakistan — Geem.pk",
      metaDescription: "Hikvision DS-7616NI-M2 16-channel 4K NVR. Dual HDD, H.265+, AI deep learning. Rs 54,000. Geem.pk.",
    },
  ];

  // ── 4. INSERT PRODUCTS ─────────────────────────────────────────────────────
  let added = 0;
  let skipped = 0;
  for (const p of products) {
    const [existing] = await db.select().from(productsTable).where(eq(productsTable.slug, p.slug));
    if (existing) {
      skipped++;
    } else {
      await db.insert(productsTable).values(p);
      added++;
      console.log(`  + Product: ${p.title}`);
    }
  }

  console.log(`\n✅ Done! Added ${added} products, skipped ${skipped} duplicates.`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
