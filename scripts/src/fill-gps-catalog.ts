/**
 * fill-gps-catalog.ts
 *
 * Seeds the e-commerce product catalog with all GPS tracker models
 * that exist in the Geem inventory. Includes:
 *  - Real product images (stored locally under /products/gps/)
 *  - Professional SEO-optimised long descriptions
 *  - metaTitle / metaDescription / metaKeywords for Google ranking
 *  - Brands and categories
 *
 * Run: pnpm --filter @workspace/scripts run fill-gps-catalog
 */

import { db, brandsTable, categoriesTable, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── Image paths (stored as static assets in artifacts/geem/public/) ────────
// NOTE: prefer per-model subfolders (img_1…img_5) over flat single images.
// The flat files below are only for models that have no subfolder yet.
const IMG = {
  // Geem branded
  orange_sim:  "/products/gps/orange_sim.jpg",
  orange_sim2: "/products/gps/orange_sim2.jpg",
  // Yuntrack — use subfolder images (5 images each)
  cj220_1:     "/products/gps/cj220/img_1.jpg",
  cj220_2:     "/products/gps/cj220/img_2.jpg",
  cj750_1:     "/products/gps/cj750/img_1.jpg",
  cj750_2:     "/products/gps/cj750/img_2.jpg",
  cj750_3:     "/products/gps/cj750/img_3.jpg",
  cj750_4:     "/products/gps/cj750/img_4.jpg",
  cj750_5:     "/products/gps/cj750/img_5.jpg",
  cj780_1:     "/products/gps/cj780/img_1.jpg",
  cj780_2:     "/products/gps/cj780/img_2.jpg",
  cj780_3:     "/products/gps/cj780/img_3.jpg",
  cj780_4:     "/products/gps/cj780/img_4.png",
  cj780_5:     "/products/gps/cj780/img_5.png",
  cj790d_1:    "/products/gps/cj790d/img_1.jpg",
  cj790d_2:    "/products/gps/cj790d/img_2.jpg",
  cj790d_3:    "/products/gps/cj790d/img_3.jpg",
  cj790d_4:    "/products/gps/cj790d/img_4.jpg",
  cj790d_5:    "/products/gps/cj790d/img_5.jpeg",
  lk208_1:     "/products/gps/lk208/img_1.jpg",
  lk208_2:     "/products/gps/lk208/img_2.jpg",
  lk208_3:     "/products/gps/lk208/img_3.jpg",
  lk208_4:     "/products/gps/lk208/img_4.jpg",
  lk208_5:     "/products/gps/lk208/img_5.jpg",
  // Micodus — use subfolder images
  g20_1:       "/products/gps/g20/img_1.jpg",
  g20_2:       "/products/gps/g20/img_2.jpg",
  g20_3:       "/products/gps/g20/img_3.jpg",
  g20m_1:      "/products/gps/g20m/img_1.jpg",
  g20m_2:      "/products/gps/g20m/img_2.jpg",
  g20m_3:      "/products/gps/g20m/img_3.jpg",
  g20m_4:      "/products/gps/g20m/img_4.png",
  gt06_1:      "/products/gps/gt06/img_1.jpg",
  gt06_2:      "/products/gps/gt06/img_2.jpg",
  gt06_3:      "/products/gps/gt06/img_3.jpg",
  gt06_4:      "/products/gps/gt06/img_4.jpg",
  gt06_5:      "/products/gps/gt06/img_5.jpg",
  // GF21 — use subfolder images
  gf21_1:      "/products/gps/gf21/img_1.jpg",
  gf21_2:      "/products/gps/gf21/img_2.jpg",
  gf21_3:      "/products/gps/gf21/img_3.jpg",
  gf21_4:      "/products/gps/gf21/img_4.jpg",
  gf21_5:      "/products/gps/gf21/img_5.jpg",
  // Flat files for models without subfolders
  td02s:       "/products/gps/td02s.jpg",
  s20:         "/products/gps/s20.jpg",
  s20_2:       "/products/gps/s20_2.jpg",
  s20_3:       "/products/gps/s20_3.jpg",
  s20_4:       "/products/gps/s20_4.jpg",
  gm06nw:      "/products/gps/gm06nw.jpg",
  gm06nw_2:    "/products/gps/gm06nw_2.jpg",
  gs900:       "/products/gps/gs900.png",
  st900:       "/products/gps/st900.jpg",
  st900_2:     "/products/gps/st900_2.jpg",
  st915_1:     "/products/gps/st915/img_1.jpg",
};

async function upsertBrand(name: string, description: string) {
  const [ex] = await db.select().from(brandsTable).where(eq(brandsTable.name, name));
  if (ex) return ex.id;
  const [row] = await db.insert(brandsTable).values({ name, description, active: true }).returning();
  console.log(`  + Brand: ${name}`);
  return row.id;
}

async function upsertCategory(name: string, parentId?: number) {
  const [ex] = await db.select().from(categoriesTable).where(eq(categoriesTable.name, name));
  if (ex) return ex.id;
  const [row] = await db
    .insert(categoriesTable)
    .values({ name, parentId: parentId ?? null, active: true })
    .returning();
  console.log(`  + Category: ${name}`);
  return row.id;
}

async function run() {
  console.log("🚀  GPS Tracker Catalog Seeder — Geem.pk\n");

  // ── BRANDS ────────────────────────────────────────────────────────────────
  const brands: Record<string, number> = {};
  const brandDefs = [
    { name: "Yuntrack",    desc: "Chinese manufacturer of professional 4G/LTE vehicle GPS trackers trusted by fleets worldwide" },
    { name: "Goome",       desc: "IoT GPS tracking specialist known for ultra-compact and waterproof tracker modules" },
    { name: "Micodus",     desc: "MiCODUS — global GPS tracker brand with 4G LTE fleet, personal and asset tracking devices" },
    { name: "Wanway",      desc: "Wanway Tech — manufacturer of rugged 4G GPS trackers for motorcycles, cars and trucks" },
    { name: "CarePro",     desc: "CarePro — smart wearable GPS devices designed for children's safety and elderly care" },
    { name: "SinoTrack",   desc: "SinoTrack — affordable 4G GPS tracking devices sold in 100+ countries with free platform access" },
    { name: "365GPS",      desc: "365GPS — compact coin-sized personal GPS trackers for assets and personal safety" },
    { name: "360GPS",      desc: "360GPS — reliable 4G mini GPS trackers for vehicles, bikes and personal use" },
    { name: "Geem",        desc: "Geem — in-house branded GPS trackers with built-in Geem SIM connectivity for Pakistan" },
    { name: "Unbranded",   desc: "Generic GPS tracking devices — value hardware with standard GSM/LTE connectivity" },
  ];
  for (const b of brandDefs) brands[b.name] = await upsertBrand(b.name, b.desc);

  // ── CATEGORIES ────────────────────────────────────────────────────────────
  const gpsParent = await upsertCategory("GPS Trackers");
  const cats: Record<string, number> = {
    "GPS Trackers":          gpsParent,
    "Vehicle GPS Trackers":  await upsertCategory("Vehicle GPS Trackers",  gpsParent),
    "OBD GPS Trackers":      await upsertCategory("OBD GPS Trackers",      gpsParent),
    "Motorcycle GPS Trackers": await upsertCategory("Motorcycle GPS Trackers", gpsParent),
    "Kids GPS Watches":      await upsertCategory("Kids GPS Watches",       gpsParent),
    "Personal GPS Trackers": await upsertCategory("Personal GPS Trackers",  gpsParent),
  };

  // ── PRODUCTS ──────────────────────────────────────────────────────────────
  const products = [

    // ══════════════════════════════════════════════════════════════════════
    //  GEEM SIM – Orange 2.0  (highest inventory: 93 units)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "Geem Orange 2.0 — 4G LTE GPS Tracker with Geem SIM (Vehicle & Motorcycle)",
      slug: "geem-orange-2-gps-tracker-4g-lte",
      sku: "GEEM-OR2-4G",
      brandId: brands["Geem"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "geem orange 2,4g gps tracker,pakistan gps tracker,vehicle tracker,sim card tracker,real time tracking,geem sim",
      price: "4500",
      salePrice: "3999",
      costPrice: "2200",
      stockQty: 93,
      shortDescription: "Geem's most popular 4G LTE GPS tracker with built-in Geem SIM. Real-time location, engine cut-off, geo-fence alerts, and free Geem tracking platform access.",
      longDescription: `Geem Orange 2.0 — Pakistan's Best-Selling 4G GPS Tracker with Geem SIM

The Orange 2.0 is Geem's flagship GPS tracking device, built specifically for the Pakistan market and pre-loaded with a Geem SIM card for zero-hassle activation. Whether you're tracking a car, motorcycle, van, or truck — the Orange 2.0 delivers real-time location updates every 10 seconds.

Key Features:
• 4G LTE + 2G fallback for nationwide Pakistan coverage
• Pre-installed Geem SIM — no separate SIM purchase needed
• Real-time live tracking via Geem app (Android & iOS) and web portal
• Engine Cut-Off relay — remotely disable engine if vehicle is stolen
• Geo-Fence Alerts — get SMS/push notification when vehicle leaves a defined area
• Over-Speed Alert — alert when driver exceeds a set speed limit
• Low Battery Alert for vehicle battery monitoring
• Ignition On/Off Notification
• Waterproof housing (IP67) — safe under bonnet or beneath motorcycle

Technical Specifications:
• Network: 4G LTE (B1/B3/B5/B8) + 2G GSM fallback
• GNSS: GPS + GLONASS dual positioning
• Positioning Accuracy: ≤5 metres
• Update Interval: 10 seconds (configurable)
• Input Voltage: DC 9–90V (universal vehicle voltage)
• Standby Current: <8mA
• Operating Temperature: -20°C to +70°C
• Dimensions: 68 × 38 × 18mm | Weight: 55g
• Waterproof: IP67

Why Choose Orange 2.0?
Pakistan roads demand a tough, reliable tracker with local SIM coverage. The Orange 2.0 has been deployed on thousands of vehicles across Karachi, Lahore, Islamabad, and beyond. With Geem SIM already inside, you get instant online connectivity — no trips to a mobile shop, no configuration headaches.

In the Box: Orange 2.0 GPS Tracker, Geem SIM (pre-installed), Wiring harness, Relay cable, Mounting tape, Quick-start guide`,
      featuredImage: IMG.orange_sim,
      galleryImages: JSON.stringify([IMG.orange_sim, IMG.orange_sim2]),
      published: true,
      featured: true,
      metaTitle: "Geem Orange 2.0 — 4G GPS Tracker Pakistan | Geem.pk",
      metaDescription: "Buy Geem Orange 2.0 4G GPS tracker in Pakistan. Pre-loaded Geem SIM, real-time tracking, engine cut-off, geo-fence. Rs 3,999 — free delivery. Geem.pk.",
      metaKeywords: "gps tracker pakistan,4g gps tracker,vehicle gps tracker,geem gps,orange 2 gps,car tracker pakistan,bike tracker pakistan",
    },

    // ── Geem Orange (v1)  (14 units)
    {
      title: "Geem Orange — 4G GPS Tracker with Geem SIM",
      slug: "geem-orange-gps-tracker-4g",
      sku: "GEEM-OR1-4G",
      brandId: brands["Geem"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "geem orange,4g gps tracker,vehicle tracker,sim tracker,pakistan gps",
      price: "3800",
      salePrice: "3499",
      costPrice: "1900",
      stockQty: 14,
      shortDescription: "Geem Orange 4G GPS tracker with pre-installed Geem SIM. Reliable real-time tracking for cars and bikes across Pakistan.",
      longDescription: `Geem Orange — 4G LTE Vehicle GPS Tracker for Pakistan

The original Geem Orange is a compact 4G GPS tracker designed and tuned for Pakistan's network environment. Pre-installed with a Geem SIM card for instant connectivity, it offers the core features every vehicle owner needs — real-time tracking, geo-fence alerts, and engine cut-off.

Features:
• 4G LTE + 2G fallback — works nationwide across Pakistan
• Pre-installed Geem SIM — no configuration needed
• Real-time tracking every 10–30 seconds
• Geo-Fence zone alerts via SMS and push notification
• Engine Cut-Off relay support
• Ignition on/off detection
• Over-speed alert
• Compact waterproof body — easy hidden installation

Specifications:
• Network: 4G LTE + 2G GSM
• GNSS: GPS + GLONASS
• Input Voltage: DC 9–40V
• Operating Temp: -20°C to +70°C
• Dimensions: 65 × 35 × 17mm

Tracked on Geem's free web and mobile platform — no monthly subscription for basic tracking.

In the Box: Geem Orange tracker, Geem SIM (pre-installed), Wiring kit, Relay cable, User guide`,
      featuredImage: IMG.orange_sim,
      galleryImages: JSON.stringify([IMG.orange_sim, IMG.orange_sim2]),
      published: true,
      featured: false,
      metaTitle: "Geem Orange 4G GPS Tracker Pakistan | Geem.pk",
      metaDescription: "Geem Orange 4G vehicle GPS tracker with Geem SIM. Real-time tracking, geo-fence, engine cut-off. Rs 3,499. Geem.pk Pakistan.",
      metaKeywords: "geem orange gps tracker,gps tracker pakistan,vehicle tracker,4g gps,sim gps tracker",
    },

    // ══════════════════════════════════════════════════════════════════════
    //  YUNTRACK CJ780  (16 units)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "Yuntrack CJ780 — 4G LTE Vehicle GPS Tracker with Engine Cut-Off",
      slug: "yuntrack-cj780-4g-gps-tracker",
      sku: "YUN-CJ780-4G",
      brandId: brands["Yuntrack"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "yuntrack cj780,4g gps tracker,vehicle tracker,engine cutoff,acc detection,fleet tracker,pakistan",
      price: "5500",
      salePrice: "4799",
      costPrice: "2800",
      stockQty: 16,
      shortDescription: "Yuntrack CJ780 4G LTE GPS tracker with remote engine cut-off, ACC detection, and real-time vehicle tracking. Compatible with any SIM card.",
      longDescription: `Yuntrack CJ780 — Professional 4G LTE Vehicle GPS Tracker

The Yuntrack CJ780 is a professional-grade 4G GPS tracker designed for cars, trucks, vans, and light commercial vehicles. It stands out with its ACC (Accessory Circuit) detection — the device knows when the ignition is on or off, enabling intelligent power management and precise trip logging.

Core Capabilities:
• 4G LTE connectivity with GNSS dual-chip positioning (GPS + GLONASS)
• Remote Engine Cut-Off — send a command via app to disable the ignition circuit
• ACC Detection — ignition-on/off events trigger instant alerts
• Vibration Sensor — tamper or tow-away alerts in seconds
• Real-time tracking (5–60 second intervals, configurable)
• Geo-Fence zones — entry/exit SMS and push alerts
• Over-Speed Alert — customisable speed limit notifications
• Trip History — view complete route history for any date

Technical Specifications:
• Network: 4G LTE (B1/B3/B5/B8/B28) + 2G fallback
• GNSS Chipset: MediaTek MT3333 — GPS, GLONASS, BeiDou
• Positioning Accuracy: <3 metres CEP
• Input Voltage: DC 9–90V (vehicle battery wired)
• Backup Battery: 80mAh internal (park-mode ping)
• Operating Temp: -20°C to +70°C
• IP Rating: IP65 splash-proof
• SIM: Standard SIM (bring your own operator)

Platform & App:
Supported on GPSTracker365, SeekTeck, and other standard tracking platforms. The CJ780 uses the standard GT06/GT06N protocol — compatible with virtually any GPRS tracking software.

Ideal For:
Fleet owners, private car tracking, company vehicles, delivery vans, school transport, courier services.

In the Box: CJ780 GPS tracker, Power harness, Engine cut-off relay, SIM slot cover, Mounting screws, Manual`,
      featuredImage: IMG.cj780_1,
      galleryImages: JSON.stringify([IMG.cj780_1, IMG.cj780_2, IMG.cj780_3, IMG.cj780_4, IMG.cj780_5]),
      published: true,
      featured: true,
      metaTitle: "Yuntrack CJ780 4G GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Buy Yuntrack CJ780 4G GPS tracker in Pakistan. Engine cut-off, ACC detection, real-time tracking. Rs 4,799 — Geem.pk.",
      metaKeywords: "yuntrack cj780,4g gps tracker pakistan,vehicle gps tracker,engine cutoff gps,fleet tracker pakistan",
    },

    // ══════════════════════════════════════════════════════════════════════
    //  CAREPRO TD-02S KIDS SMART WATCH  (12 units)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "CarePro TD-02S — Kids GPS Smart Watch with SIM Calling & Live Tracking",
      slug: "carepro-td02s-kids-gps-smartwatch",
      sku: "CP-TD02S-KID",
      brandId: brands["CarePro"],
      categoryId: cats["Kids GPS Watches"],
      tags: "kids gps watch,children smartwatch,gps watch pakistan,carepro td02s,kids tracker watch,sim calling watch,school watch",
      price: "6500",
      salePrice: "5999",
      costPrice: "3200",
      stockQty: 12,
      shortDescription: "CarePro TD-02S kids GPS smart watch with SIM card calling, live GPS tracking, SOS emergency button, and two-way voice — perfect for school-age children.",
      longDescription: `CarePro TD-02S — Smart GPS Watch for Children | Keep Your Child Safe

The CarePro TD-02S is a purpose-built GPS smart watch for school-going children aged 4–12. Parents can see exactly where their child is at any moment, call them directly through the watch, and receive an SOS emergency alert if their child needs help.

Safety Features:
• Live GPS + LBS dual-mode location tracking
• SOS Emergency Button — one press calls parent's number and sends location
• Geo-Fence — get alerted if child leaves school, home, or park zones
• Two-way voice calling — call the watch or the child calls home
• Speed-Dial with up to 10 trusted contacts
• Do Not Disturb (class mode) — disables calls during school hours
• Step counter and activity tracking

Connectivity:
• SIM card slot (insert any network SIM — Zong/Telenor/Jazz/Ufone recommended)
• Real-time tracking via dedicated parent app (Android & iOS)
• Remote check-in — parents can silently listen to surroundings (monitoring mode)

Hardware:
• Display: 1.44" colour TFT touchscreen
• Camera: 0.3MP camera for photos
• Battery: 400mAh — up to 36 hours standby, 8 hours active use
• Charging: Magnetic snap charger
• Water Resistance: IP67 — splashproof for everyday use
• Wrist Size: Adjustable 12–20cm — fits children 4–14 years
• Available colours: Pink, Blue, Yellow

Why Parents Choose the TD-02S:
Unlike smartphones, the TD-02S has no internet browsing, social media, or distracting apps. It is purely a safety and communication tool — giving parents peace of mind without overloading the child.

In the Box: TD-02S watch, Magnetic charger cable, User manual`,
      featuredImage: IMG.td02s,
      galleryImages: JSON.stringify([IMG.td02s]),
      published: true,
      featured: true,
      metaTitle: "CarePro TD-02S Kids GPS Smart Watch Pakistan — Geem.pk",
      metaDescription: "CarePro TD-02S children's GPS smart watch. SIM calling, SOS button, live tracking, geo-fence. Rs 5,999. Buy online — Geem.pk Pakistan.",
      metaKeywords: "kids gps watch pakistan,children gps smartwatch,carepro td02s,school watch tracker,kids safety watch",
    },

    // ══════════════════════════════════════════════════════════════════════
    //  WANWAY S20  (11 units)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "Wanway S20 — 4G LTE Motorcycle & Vehicle GPS Tracker",
      slug: "wanway-s20-4g-motorcycle-gps-tracker",
      sku: "WAN-S20-4G",
      brandId: brands["Wanway"],
      categoryId: cats["Motorcycle GPS Trackers"],
      tags: "wanway s20,motorcycle gps tracker,4g gps,bike tracker,vehicle tracker pakistan,engine cutoff",
      price: "4800",
      salePrice: "4299",
      costPrice: "2400",
      stockQty: 11,
      shortDescription: "Wanway S20 4G GPS tracker optimised for motorcycles and light vehicles. IP67 waterproof, engine cut-off, geo-fence, and real-time live tracking.",
      longDescription: `Wanway S20 — 4G Motorcycle GPS Tracker | Protect Your Bike

The Wanway S20 is a rugged 4G GPS tracker built for two-wheelers and compact vehicles. Its IP67-rated waterproof body can be hidden under the seat, in the frame, or behind the fairing — completely concealed and protected from rain and dust.

Features Built for Bikes:
• 4G LTE (with 2G fallback) for full Pakistan network coverage
• IP67 Fully Waterproof — monsoon-proof installation
• Engine Cut-Off relay — remotely disable ignition if bike is stolen
• Vibration & tamper alert — alerts if bike is moved without ignition
• Geo-Fence — alerts when bike leaves your parking area
• Ignition on/off events with real-time push notifications
• Speed alert — know if someone is riding over your limit
• Compact body — easy hidden installation on any motorcycle

Technical Specifications:
• Network: 4G LTE + 2G GSM
• Positioning: GPS + GLONASS (accuracy <5m)
• Input Voltage: DC 9–40V
• Current Draw (standby): <6mA — no battery drain
• Temp Range: -20°C to +70°C
• Waterproof: IP67
• Dimensions: 60 × 33 × 16mm
• SIM: Standard SIM (any operator)

Tracking Platform:
Compatible with SeekTeck, GPSTracker365, Wanway Cloud, and standard GPRS platforms. Free app tracking available.

Best For: Motorcycles, rickshaws, 3-wheelers, small delivery vehicles, e-bikes.

In the Box: S20 tracker, Wiring harness, Relay (engine cut-off), User manual`,
      featuredImage: IMG.s20,
      galleryImages: JSON.stringify([IMG.s20, IMG.s20_2, IMG.s20_3, IMG.s20_4]),
      published: true,
      featured: false,
      metaTitle: "Wanway S20 4G Motorcycle GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Wanway S20 4G GPS tracker for motorcycles and bikes. IP67 waterproof, engine cut-off, geo-fence. Rs 4,299. Geem.pk Pakistan.",
      metaKeywords: "motorcycle gps tracker pakistan,bike gps tracker,wanway s20,4g bike tracker,engine cutoff motorcycle",
    },

    // ══════════════════════════════════════════════════════════════════════
    //  YUNTRACK CJ750 OBDII  (11 units)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "Yuntrack CJ750 OBD — Plug & Play 4G GPS Tracker (No Wiring Required)",
      slug: "yuntrack-cj750-obd-gps-tracker",
      sku: "YUN-CJ750-OBD",
      brandId: brands["Yuntrack"],
      categoryId: cats["OBD GPS Trackers"],
      tags: "obd gps tracker,yuntrack cj750,plug and play gps,no wiring gps,obd2 tracker,car tracker pakistan,fleet",
      price: "5000",
      salePrice: "4499",
      costPrice: "2600",
      stockQty: 11,
      shortDescription: "Yuntrack CJ750 OBD II plug-and-play GPS tracker. No wiring, no tools — plug into any car's OBD port for instant real-time tracking. 4G LTE.",
      longDescription: `Yuntrack CJ750 OBD — Plug-in 4G GPS Tracker | No Installation Required

The Yuntrack CJ750 is the easiest GPS tracker you will ever install. Plug it into your car's OBD II port (standard on all vehicles made after 2000), insert a SIM card, and you're live within 60 seconds. No cutting wires, no electrician needed.

Why OBD Trackers Are Smarter:
• Powers directly from the OBD port — no separate wiring or battery
• Always on while the car is on; enters sleep mode when engine is off
• Reads vehicle diagnostics data: fuel level, engine RPM, error codes
• Non-destructive — remove and reinstall in seconds

Core Tracking Features:
• 4G LTE real-time location tracking (10-second intervals)
• Geo-Fence entry/exit alerts
• Over-speed alerts
• Engine on/off event notifications
• Trip log: start/end point, distance, duration
• Vehicle diagnostic alerts (check engine codes)
• Driver behaviour analysis: harsh braking, rapid acceleration

Technical Specifications:
• Network: 4G LTE + 2G GPRS fallback
• GNSS: GPS + GLONASS
• OBD Connector: Standard OBD II / SAE J1939
• Power Draw: <50mA from OBD bus
• Operating Temp: -20°C to +70°C
• Dimensions: 65 × 42 × 24mm
• SIM: Standard SIM (bring any operator)

Best For:
Rental car companies, personal fleet monitoring, company car tracking, insurance telematics, individual owners who want a no-fuss tracker.

OBD Port Location in Common Pakistan Vehicles:
Usually found under the steering column, near the driver's knees — Toyota Corolla, Honda Civic, Suzuki Swift, Fortuner, Prado all have it in this location.

In the Box: CJ750 OBD tracker, SIM tray pin, User manual`,
      featuredImage: IMG.cj750_1,
      galleryImages: JSON.stringify([IMG.cj750_1, IMG.cj750_2, IMG.cj750_3, IMG.cj750_4, IMG.cj750_5]),
      published: true,
      featured: true,
      metaTitle: "Yuntrack CJ750 OBD GPS Tracker Pakistan — No Wiring | Geem.pk",
      metaDescription: "Yuntrack CJ750 OBD plug-and-play 4G GPS tracker. No wiring needed — plug into OBD port. Vehicle diagnostics + live tracking. Rs 4,499. Geem.pk.",
      metaKeywords: "obd gps tracker pakistan,plug and play gps tracker,yuntrack cj750,obd2 tracker,no wiring gps tracker",
    },

    // ══════════════════════════════════════════════════════════════════════
    //  YUNTRACK CJ790D  (10 units)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "Yuntrack CJ790D — 4G LTE Advanced Fleet GPS Tracker with Engine Cut-Off",
      slug: "yuntrack-cj790d-4g-fleet-gps-tracker",
      sku: "YUN-CJ790D-4G",
      brandId: brands["Yuntrack"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "yuntrack cj790d,4g fleet tracker,engine cutoff,vehicle tracker,fleet gps,commercial vehicle tracker",
      price: "6000",
      salePrice: "5499",
      costPrice: "3000",
      stockQty: 10,
      shortDescription: "Yuntrack CJ790D 4G fleet GPS tracker with engine cut-off, driver identification, and advanced fleet management features for commercial vehicles.",
      longDescription: `Yuntrack CJ790D — 4G Fleet-Grade GPS Tracker for Commercial Vehicles

The CJ790D is Yuntrack's advanced fleet GPS solution, built for businesses operating cars, trucks, vans, and delivery vehicles. Beyond basic tracking, it offers driver ID cards, I/O ports for external sensors, and advanced route replay.

Fleet Management Features:
• 4G LTE real-time tracking with 3-second high-frequency mode
• Remote Engine Cut-Off and Engine Immobiliser
• Driver ID using RFID card — know exactly who is driving
• Dual I/O Ports — connect temperature sensors, door sensors, fuel probes
• Harsh Driving Detection: rapid acceleration, hard braking, sharp cornering
• Overspeed alert with configurable thresholds per vehicle
• Geo-Fence with business hours scheduling (e.g. no movement after 10pm)
• Full route history and route replay (365-day log retention)
• Mileage logging for maintenance scheduling

Technical Specifications:
• Network: 4G LTE Cat-M1 + 2G GSM
• GNSS: GPS + GLONASS + BeiDou (3 systems for improved accuracy)
• Positioning Accuracy: <3 metres
• Input Voltage: DC 9–90V (HGV compatible)
• Internal Backup Battery: 170mAh — sends last-known position on power cut
• Inputs: 2 digital inputs, 1 analog input, 1 relay output
• Operating Temp: -40°C to +85°C
• IP65 Splash-proof

Platform Integration:
Works with standard fleet platforms — Wialon, GPSTracker365, SeekTeck — or configure with any GPRS/HTTP platform.

Best For:
Delivery fleets, school van operators, taxi companies, logistics companies, rental car tracking, heavy equipment monitoring.

In the Box: CJ790D tracker, Wiring harness, Relay cable, I/O extension cable, User manual, RFID test card`,
      featuredImage: IMG.cj790d_1,
      galleryImages: JSON.stringify([IMG.cj790d_1, IMG.cj790d_2, IMG.cj790d_3, IMG.cj790d_4, IMG.cj790d_5]),
      published: true,
      featured: false,
      metaTitle: "Yuntrack CJ790D 4G Fleet GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Yuntrack CJ790D 4G fleet GPS tracker. Engine cut-off, driver ID, harsh driving detection. Rs 5,499. Geem.pk Pakistan.",
      metaKeywords: "fleet gps tracker pakistan,yuntrack cj790d,commercial vehicle tracker,4g fleet tracker,engine cutoff gps",
    },

    // ══════════════════════════════════════════════════════════════════════
    //  GOOME GM06NW  (7 units)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "Goome GM06NW — Waterproof 4G Motorcycle GPS Tracker with Anti-Theft Alarm",
      slug: "goome-gm06nw-motorcycle-gps-tracker",
      sku: "GME-GM06NW-4G",
      brandId: brands["Goome"],
      categoryId: cats["Motorcycle GPS Trackers"],
      tags: "goome gm06nw,motorcycle gps tracker,anti theft alarm,waterproof tracker,bike tracker,2 wheeler tracker",
      price: "5200",
      salePrice: "4699",
      costPrice: "2700",
      stockQty: 7,
      shortDescription: "Goome GM06NW 4G motorcycle GPS tracker with built-in anti-theft siren, vibration alarm, engine cut-off, and IP67 waterproofing.",
      longDescription: `Goome GM06NW — All-in-One 4G Motorcycle GPS Tracker & Anti-Theft Alarm System

The Goome GM06NW combines GPS tracking with a built-in 105dB anti-theft siren — making it one of the most comprehensive two-wheeler security devices available. No need for a separate alarm system; the GM06NW does it all.

Security Features:
• Built-in 105dB Alarm Siren — sounds if bike is moved without proper disarm
• Vibration Sensor with 3-level sensitivity adjustment
• Engine Cut-Off via relay — remotely immobilise the bike
• Arm/Disarm via SMS command or companion app
• Geo-Fence — alerts if bike leaves a defined parking area
• Low Voltage Alert — warns before battery dies

GPS Tracking:
• 4G LTE real-time tracking (10-second intervals)
• GPS + LBS dual positioning for indoor/poor-signal environments
• Route history with speed, distance, and stop logging
• Over-speed alerts

Technical Specifications:
• Network: 4G LTE + 2G GPRS fallback
• GNSS: GPS + GLONASS
• Input Voltage: DC 9–85V (motorcycle and car battery)
• Built-in Siren: 105dB
• Waterproof: IP67 — fully weatherproof
• Operating Temp: -20°C to +70°C
• Dimensions: 87 × 55 × 24mm
• SIM: Standard SIM (any operator)

Platform:
Compatible with SeekTeck, GPSTracker365, and standard GT06 protocol platforms.

Best For: Motorcycles, scooters, rickshaws, electric bikes, mopeds.

In the Box: GM06NW unit, Wiring harness, Engine relay, User manual`,
      featuredImage: IMG.gm06nw,
      galleryImages: JSON.stringify([IMG.gm06nw, IMG.gm06nw_2]),
      published: true,
      featured: false,
      metaTitle: "Goome GM06NW 4G Motorcycle GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Goome GM06NW motorcycle GPS tracker with anti-theft siren, engine cut-off, IP67. Rs 4,699. Buy online — Geem.pk Pakistan.",
      metaKeywords: "motorcycle gps tracker pakistan,goome gm06nw,anti theft bike alarm,waterproof gps motorcycle",
    },

    // ══════════════════════════════════════════════════════════════════════
    //  MICODUS G20  (6 units)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "Micodus G20 — 4G LTE Magnetic GPS Tracker with Voice Monitoring",
      slug: "micodus-g20-magnetic-gps-tracker",
      sku: "MIC-G20-4G",
      brandId: brands["Micodus"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "micodus g20,magnetic gps tracker,4g gps,asset tracker,voice monitor,vehicle tracker,hidden tracker",
      price: "5800",
      salePrice: "5199",
      costPrice: "3000",
      stockQty: 6,
      shortDescription: "Micodus G20 4G magnetic GPS tracker with built-in microphone for voice monitoring. Strong magnetic mount — attach anywhere on any vehicle.",
      longDescription: `Micodus G20 — 4G Magnetic GPS Tracker with Voice Monitor

The Micodus G20 is a self-contained 4G GPS tracker with a powerful built-in magnet — simply attach it to the undercarriage, inside a wheel arch, behind a bumper, or anywhere on a metal surface. No wiring, no tools.

Key Features:
• Strong Magnetic Mount — holds securely at highway speeds
• Built-in Microphone — remote voice monitoring via companion app
• 4G LTE real-time tracking with <3m positioning accuracy
• Geo-Fence — instant alerts when tracker leaves defined area
• Motion / Vibration Alert — track theft as it happens
• SOS Button (on select variants)
• Long Standby Mode — up to 60 days in deep sleep (900mAh battery)

Technical Specifications:
• Network: 4G LTE + 2G GSM fallback
• GNSS: GPS + GLONASS
• Battery: 900mAh internal lithium — up to 60 days standby, 3–7 days active
• Charging: Micro-USB
• Magnetic Force: ~2kg pull force (holds on flat steel surface)
• Waterproof: IP65
• Dimensions: 75 × 45 × 22mm
• SIM: Nano SIM

Use Cases:
• Personal vehicle anti-theft tracker (hidden on undercarriage)
• Asset tracking (containers, equipment, trailers)
• Rental car covert monitoring
• Evidence gathering with voice monitor

Platform: Compatible with SeekTeck, MiCODUS app, GPSTracker365.

In the Box: G20 tracker, Magnetic base, Micro-USB charging cable, Nano-SIM tray tool, User guide`,
      featuredImage: IMG.g20_1,
      galleryImages: JSON.stringify([IMG.g20_1, IMG.g20_2, IMG.g20_3]),
      published: true,
      featured: false,
      metaTitle: "Micodus G20 Magnetic 4G GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Micodus G20 4G magnetic GPS tracker with voice monitoring. No wiring — strong magnet mount. Rs 5,199. Geem.pk Pakistan.",
      metaKeywords: "magnetic gps tracker,micodus g20,hidden gps tracker,4g asset tracker,voice monitor gps",
    },

    // ══════════════════════════════════════════════════════════════════════
    //  MICODUS G20M  (2 units)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "Micodus G20M — 4G Magnetic GPS Tracker (Extended Battery, 20000mAh)",
      slug: "micodus-g20m-extended-battery-gps-tracker",
      sku: "MIC-G20M-4G",
      brandId: brands["Micodus"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "micodus g20m,extended battery gps,magnetic gps,20000mah gps,long life gps tracker,asset tracker",
      price: "12000",
      salePrice: "10999",
      costPrice: "6500",
      stockQty: 2,
      shortDescription: "Micodus G20M 4G GPS tracker with massive 20,000mAh battery and strong magnetic mount. Up to 365 days standby — ideal for long-term asset tracking.",
      longDescription: `Micodus G20M — 4G GPS Tracker with 20,000mAh Extended Battery

For applications where you need to track an asset for months without recharging, the Micodus G20M is the ultimate solution. Its 20,000mAh battery delivers up to 365 days of standby life in sleep mode — making it perfect for containers, trailers, construction equipment, and long-term covert monitoring.

Why the G20M?
• 20,000mAh Battery — 1 year standby; 14–30 days with 60-minute update intervals
• Super-Strong Magnet — industrial-grade magnetic base attaches to steel surfaces instantly
• Fully Waterproof IP67 — designed for outdoor and underbody installation
• No wiring, no tools, no electrician — attach and track

Tracking Features:
• 4G LTE real-time tracking (configurable intervals: 10s to 24h)
• GPS + GLONASS + LBS tri-positioning
• Geo-Fence zone alerts
• Motion / tamper alerts
• Low battery alert (at 20%, 10%, 5%)
• SOS button for emergency location ping

Technical Specifications:
• Network: 4G LTE + 2G GSM
• GNSS: GPS + GLONASS
• Battery: 20,000mAh lithium — 365 days standby (10-min intervals)
• Waterproof: IP67
• Magnetic Force: 5kg+ (heavy-duty magnetic base)
• Operating Temp: -20°C to +65°C
• SIM: Nano SIM

Best For:
Shipping containers, trailers, heavy machinery, generators, boats, long-term asset tracking, vehicle surveillance.

In the Box: G20M tracker, Heavy-duty magnetic base, USB-C charging cable, Tool, Manual`,
      featuredImage: IMG.g20m_1,
      galleryImages: JSON.stringify([IMG.g20m_1, IMG.g20m_2, IMG.g20m_3, IMG.g20m_4]),
      published: true,
      featured: false,
      metaTitle: "Micodus G20M 20000mAh Magnetic GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Micodus G20M 4G GPS tracker with 20,000mAh battery — 1 year standby. Magnetic mount, IP67. Rs 10,999. Geem.pk.",
      metaKeywords: "long battery gps tracker,micodus g20m,20000mah gps,asset tracker pakistan,magnetic gps long life",
    },

    // ══════════════════════════════════════════════════════════════════════
    //  MICODUS GT06  (3 units)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "Micodus GT06 — Mini 4G LTE Vehicle GPS Tracker with Engine Cut-Off",
      slug: "micodus-gt06-mini-gps-tracker",
      sku: "MIC-GT06-4G",
      brandId: brands["Micodus"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "micodus gt06,mini gps tracker,4g gps,engine cutoff,compact tracker,vehicle tracker",
      price: "3500",
      salePrice: "2999",
      costPrice: "1600",
      stockQty: 3,
      shortDescription: "Micodus GT06 mini 4G GPS tracker. Ultra-compact wired vehicle tracker with engine cut-off relay support. Works on any 2G/3G/4G network.",
      longDescription: `Micodus GT06 — Mini 4G Vehicle GPS Tracker

The Micodus GT06 is one of the most widely deployed GPS trackers globally. Its compact size, universal compatibility, and reliable GT06/GT06N protocol make it the go-to choice for budget-conscious fleet managers and individual vehicle owners.

Features:
• 4G LTE (with 2G fallback) — works on any GSM network in Pakistan
• Engine Cut-Off relay support — remotely disable ignition
• Real-time location every 10–60 seconds (configurable)
• Geo-Fence with SMS alerts
• Vibration and motion alert (anti-theft)
• Overspeed SMS alert
• Listen-in (ambient audio monitoring via call)
• Ignition on/off detection and alert

Technical Specifications:
• Network: 4G LTE + 2G GSM
• GNSS: GPS (10m accuracy, <45s cold start)
• Input Voltage: DC 9–40V
• Backup Battery: 40mAh (sends last location on power cut)
• Standby Current: <5mA
• Operating Temp: -20°C to +70°C
• Dimensions: 56 × 38 × 18mm (ultra compact)
• SIM: Standard SIM

Platform: Universal GT06 protocol — works with any standard GPRS tracking platform or app (SeekTeck, GPSTracker365, TrackSolid).

In the Box: GT06 tracker, Wiring harness, Relay cable, User manual`,
      featuredImage: IMG.gt06_1,
      galleryImages: JSON.stringify([IMG.gt06_1, IMG.gt06_2, IMG.gt06_3, IMG.gt06_4, IMG.gt06_5]),
      published: true,
      featured: false,
      metaTitle: "Micodus GT06 Mini 4G GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Micodus GT06 mini 4G GPS tracker with engine cut-off. Compact, reliable, universal SIM. Rs 2,999. Geem.pk Pakistan.",
      metaKeywords: "gt06 gps tracker,micodus gt06,mini gps tracker pakistan,engine cutoff tracker",
    },

    // ── Micodus GT06/TK200  (1 unit)
    {
      title: "Micodus GT06/TK200 — 4G Mini GPS Tracker (Dual-Mode)",
      slug: "micodus-gt06-tk200-4g-gps-tracker",
      sku: "MIC-TK200-4G",
      brandId: brands["Micodus"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "micodus tk200,gt06 tracker,4g gps,mini vehicle tracker,dual mode tracker",
      price: "3800",
      salePrice: "3399",
      costPrice: "1800",
      stockQty: 1,
      shortDescription: "Micodus GT06/TK200 dual-mode 4G GPS tracker. Compact wired vehicle tracker with engine cut-off and real-time tracking.",
      longDescription: `Micodus GT06/TK200 — Dual-Mode 4G Mini Vehicle GPS Tracker

The TK200 (also known as GT06) is Micodus's compact wired GPS tracker supporting 4G LTE. Perfect for hidden installation in cars, bikes, and light commercial vehicles. Compatible with the universal GT06 protocol for maximum platform flexibility.

Key Features:
• 4G LTE + 2G GSM network support
• Engine cut-off relay connection
• Real-time location tracking
• Geo-fence and overspeed alerts
• Ignition and motion detection
• Vibration tamper alerts
• Compact body — easy hidden wired install

Specs: DC 9–40V input, <5mA standby, GPS+LBS positioning, Standard SIM.`,
      featuredImage: IMG.gt06_1,
      galleryImages: JSON.stringify([IMG.gt06_1, IMG.gt06_2, IMG.gt06_3, IMG.gt06_4, IMG.gt06_5]),
      published: true,
      featured: false,
      metaTitle: "Micodus GT06/TK200 4G GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Micodus GT06/TK200 4G mini GPS tracker. Engine cut-off, geo-fence. Rs 3,399. Geem.pk Pakistan.",
      metaKeywords: "micodus tk200,gt06 gps,mini gps tracker pakistan",
    },

    // ── Micodus GT02D  (1 unit)
    {
      title: "Micodus GT02D — 4G Compact Vehicle GPS Tracker",
      slug: "micodus-gt02d-4g-gps-tracker",
      sku: "MIC-GT02D-4G",
      brandId: brands["Micodus"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "micodus gt02d,4g gps,compact tracker,vehicle gps pakistan",
      price: "3500",
      salePrice: "2999",
      costPrice: "1700",
      stockQty: 1,
      shortDescription: "Micodus GT02D compact 4G wired vehicle GPS tracker. Real-time tracking, engine cut-off, geo-fence alerts.",
      longDescription: `Micodus GT02D — 4G Vehicle GPS Tracker

The GT02D is a compact wired GPS tracking device for cars, motorcycles and light vehicles. It runs on 4G LTE with 2G fallback and supports engine cut-off via relay.

Features: Real-time tracking, engine cut-off, geo-fence, overspeed alert, vibration alert, ignition detection. Works on standard GT06 protocol.

Specs: 4G LTE + 2G, DC 9–40V, GPS + LBS positioning, Standard SIM.`,
      featuredImage: IMG.gt06_1,
      galleryImages: JSON.stringify([IMG.gt06_1, IMG.gt06_2, IMG.gt06_3, IMG.gt06_4, IMG.gt06_5]),
      published: true,
      featured: false,
      metaTitle: "Micodus GT02D GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Micodus GT02D 4G compact vehicle GPS tracker. Engine cut-off, geo-fence. Geem.pk Pakistan.",
      metaKeywords: "micodus gt02d,4g gps tracker,vehicle tracker pakistan",
    },

    // ── Micodus GT02/T3  (1 unit)
    {
      title: "Micodus GT02/T3 — 4G Wired Vehicle GPS Tracker",
      slug: "micodus-gt02-t3-4g-gps-tracker",
      sku: "MIC-T3-4G",
      brandId: brands["Micodus"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "micodus t3,gt02 tracker,4g gps,vehicle tracker",
      price: "3500",
      salePrice: "2999",
      costPrice: "1700",
      stockQty: 1,
      shortDescription: "Micodus GT02/T3 4G compact wired GPS tracker for vehicles. Engine cut-off, geo-fence, real-time tracking.",
      longDescription: `Micodus GT02/T3 — 4G Vehicle GPS Tracker

Reliable 4G wired GPS tracker for vehicles. Supports engine cut-off, geo-fence, ignition monitoring and overspeed alerts. GT06 protocol compatible — works on all major tracking platforms.

Specs: 4G LTE + 2G, DC 9–40V, GPS + LBS, Standard SIM.`,
      featuredImage: IMG.gt06_1,
      galleryImages: JSON.stringify([IMG.gt06_1, IMG.gt06_2, IMG.gt06_3, IMG.gt06_4, IMG.gt06_5]),
      published: true,
      featured: false,
      metaTitle: "Micodus GT02/T3 GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Micodus GT02/T3 4G GPS tracker. Engine cut-off, real-time tracking. Geem.pk Pakistan.",
      metaKeywords: "micodus t3,gt02 gps,vehicle tracker pakistan",
    },

    // ── Micodus MV710G  (1 unit)
    {
      title: "Micodus MV710G — 4G Advanced Vehicle GPS Tracker with Fuel Monitoring",
      slug: "micodus-mv710g-4g-fuel-gps-tracker",
      sku: "MIC-MV710G-4G",
      brandId: brands["Micodus"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "micodus mv710g,fuel monitoring gps,4g fleet tracker,vehicle gps,fuel sensor tracker",
      price: "7500",
      salePrice: "6999",
      costPrice: "4000",
      stockQty: 1,
      shortDescription: "Micodus MV710G 4G advanced GPS tracker with fuel probe monitoring, engine cut-off, and driver behaviour analysis for fleet management.",
      longDescription: `Micodus MV710G — 4G Fleet GPS Tracker with Fuel Monitoring

The MV710G is Micodus's advanced fleet device combining GPS tracking with fuel consumption monitoring via external fuel probe. Ideal for businesses tracking fuel costs on trucks, generators, and heavy equipment.

Features:
• 4G LTE real-time tracking
• External fuel sensor support — monitor actual fuel level and consumption
• Engine cut-off relay
• Driver behaviour analysis (acceleration, braking, cornering)
• Geo-fence with scheduling
• Multiple I/O ports for sensors
• 360-day route history

Specs: 4G LTE + 2G, GPS + GLONASS, DC 9–90V, IP64.`,
      featuredImage: IMG.g20_1,
      galleryImages: JSON.stringify([IMG.g20_1, IMG.g20_2, IMG.g20_3]),
      published: true,
      featured: false,
      metaTitle: "Micodus MV710G 4G Fuel Monitoring GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Micodus MV710G fleet GPS tracker with fuel monitoring. Engine cut-off, driver behaviour. Geem.pk Pakistan.",
      metaKeywords: "fuel monitoring gps tracker,micodus mv710g,fleet tracker pakistan",
    },

    // ══════════════════════════════════════════════════════════════════════
    //  WANWAY GS900  (2 units)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "Wanway GS900 — 4G Motorcycle GPS Tracker with Alarm System",
      slug: "wanway-gs900-motorcycle-gps-tracker",
      sku: "WAN-GS900-4G",
      brandId: brands["Wanway"],
      categoryId: cats["Motorcycle GPS Trackers"],
      tags: "wanway gs900,motorcycle gps,4g bike tracker,alarm gps,waterproof motorcycle tracker",
      price: "5000",
      salePrice: "4499",
      costPrice: "2500",
      stockQty: 2,
      shortDescription: "Wanway GS900 4G motorcycle GPS tracker with integrated alarm system, engine cut-off, and IP67 waterproofing.",
      longDescription: `Wanway GS900 — 4G Motorcycle GPS Tracker with Alarm

The GS900 is Wanway's all-in-one motorcycle GPS tracker and alarm system. Designed to withstand Pakistani road conditions, it is waterproof, shock-resistant, and delivers reliable 4G tracking.

Features:
• 4G LTE real-time tracking
• Built-in alarm (arms/disarms via SMS or app)
• Engine cut-off relay
• IP67 fully waterproof
• Vibration and tamper detection
• Geo-fence alerts
• Ignition on/off notifications
• Over-speed alert

Specs: 4G LTE + 2G, GPS + GLONASS, DC 9–85V, IP67, Standard SIM.

Best For: Motorcycles, scooters, three-wheelers, e-bikes.`,
      featuredImage: IMG.gs900,
      galleryImages: JSON.stringify([IMG.gs900]),
      published: true,
      featured: false,
      metaTitle: "Wanway GS900 Motorcycle GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Wanway GS900 4G motorcycle GPS tracker with alarm. IP67, engine cut-off. Rs 4,499. Geem.pk.",
      metaKeywords: "wanway gs900,motorcycle gps tracker,bike alarm gps,waterproof tracker pakistan",
    },

    // ══════════════════════════════════════════════════════════════════════
    //  YUNTRACK LK208  (2 units)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "Yuntrack LK208 — 4G Personal GPS Tracker with SOS Button",
      slug: "yuntrack-lk208-personal-gps-tracker",
      sku: "YUN-LK208-4G",
      brandId: brands["Yuntrack"],
      categoryId: cats["Personal GPS Trackers"],
      tags: "personal gps tracker,yuntrack lk208,sos gps,portable tracker,elderly tracker,kid tracker pakistan",
      price: "4500",
      salePrice: "3999",
      costPrice: "2100",
      stockQty: 2,
      shortDescription: "Yuntrack LK208 4G personal GPS tracker with SOS emergency button, two-way calling, and multi-person location sharing.",
      longDescription: `Yuntrack LK208 — Personal 4G GPS Tracker with SOS

The LK208 is designed for people, not vehicles. A compact clip-on tracker for the elderly, children, field workers, or anyone who needs a portable safety device with a real-time location share.

Features:
• 4G LTE + 2G with GPS + LBS dual positioning
• SOS Emergency Button — one press sends location to pre-set numbers
• Two-way voice calling via built-in speaker and mic
• Share location with up to 5 family members
• Geo-fence — alert if person leaves defined safe area
• Low battery alert
• Fall detection (select variants)
• Step counter and activity tracking
• Compact clip or lanyard attachment

Specs: 4G LTE + 2G, 800mAh battery (3–7 days), Standard SIM, <50g.

Best For: Elderly monitoring, children, lone workers, delivery staff, hiking.`,
      featuredImage: IMG.lk208_1,
      galleryImages: JSON.stringify([IMG.lk208_1, IMG.lk208_2, IMG.lk208_3, IMG.lk208_4, IMG.lk208_5]),
      published: true,
      featured: false,
      metaTitle: "Yuntrack LK208 Personal GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Yuntrack LK208 4G personal GPS tracker. SOS button, two-way calling, elderly & child tracking. Rs 3,999. Geem.pk.",
      metaKeywords: "personal gps tracker pakistan,yuntrack lk208,sos gps tracker,elderly tracker,portable gps",
    },

    // ══════════════════════════════════════════════════════════════════════
    //  SINOTRACK ST900  (1 unit)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "SinoTrack ST-900 — 4G Vehicle GPS Tracker with Free Tracking Platform",
      slug: "sinotrack-st900-4g-gps-tracker",
      sku: "SIN-ST900-4G",
      brandId: brands["SinoTrack"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "sinotrack st900,4g gps tracker,free platform tracker,vehicle tracker,engine cutoff,car tracker",
      price: "4000",
      salePrice: "3599",
      costPrice: "1900",
      stockQty: 1,
      shortDescription: "SinoTrack ST-900 4G GPS tracker with free tracking platform access. Engine cut-off, geo-fence, real-time tracking. Used in 100+ countries.",
      longDescription: `SinoTrack ST-900 — 4G Vehicle GPS Tracker

SinoTrack is one of the world's most widely used GPS tracker brands, deployed across 100+ countries. The ST-900 is their popular vehicle tracker offering 4G LTE tracking with access to the free SinoTrack cloud platform.

Features:
• 4G LTE real-time tracking (10-second intervals)
• Free lifetime access to SinoTrack tracking platform
• Engine cut-off relay
• Geo-fence zone alerts via SMS / push
• Over-speed alert
• Vibration and tamper alert
• Ignition on/off detection
• Voice monitoring (ambient listening)
• 2-year track history

Specs: 4G LTE + 2G, GPS + LBS, DC 9–40V, Standard SIM.

Platform: Free SinoTrack web and app (Android/iOS) — no monthly fee for basic tracking.`,
      featuredImage: IMG.st900,
      galleryImages: JSON.stringify([IMG.st900, IMG.st900_2]),
      published: true,
      featured: false,
      metaTitle: "SinoTrack ST-900 4G GPS Tracker Pakistan — Geem.pk",
      metaDescription: "SinoTrack ST-900 4G vehicle GPS tracker. Free platform, engine cut-off, geo-fence. Rs 3,599. Geem.pk.",
      metaKeywords: "sinotrack st900,4g gps tracker,free platform gps,vehicle tracker pakistan",
    },

    // ── SinoTrack ST815  (1 unit)
    {
      title: "SinoTrack ST815 — 4G Long Battery GPS Tracker (Vehicle & Asset)",
      slug: "sinotrack-st815-4g-gps-tracker",
      sku: "SIN-ST815-4G",
      brandId: brands["SinoTrack"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "sinotrack st815,4g long battery gps,asset tracker,vehicle tracker,anti theft,magnetic gps",
      price: "5500",
      salePrice: "4999",
      costPrice: "2800",
      stockQty: 1,
      shortDescription: "SinoTrack ST815 4G GPS tracker with extended battery for vehicle and asset tracking. No wiring — magnetic mount option.",
      longDescription: `SinoTrack ST815 — 4G Extended Battery GPS Tracker

The ST815 offers a larger internal battery than the standard ST-900, making it ideal for both wired vehicle use and covert magnetic placement. Trusted by SinoTrack's global customer base in 100+ countries.

Features:
• 4G LTE real-time tracking
• Extended battery option for wire-free use
• Magnetic mount compatible
• Engine cut-off relay support (wired mode)
• Geo-fence and over-speed alerts
• Vibration and tamper alerts
• Free SinoTrack platform access
• IP65 water-resistant

Specs: 4G LTE + 2G, GPS + LBS, Standard SIM.`,
      featuredImage: IMG.st915_1,
      galleryImages: JSON.stringify([IMG.st915_1]),
      published: true,
      featured: false,
      metaTitle: "SinoTrack ST815 4G GPS Tracker Pakistan — Geem.pk",
      metaDescription: "SinoTrack ST815 4G extended battery GPS tracker. Magnetic mount, geo-fence. Rs 4,999. Geem.pk.",
      metaKeywords: "sinotrack st815,extended battery gps,4g asset tracker pakistan",
    },

    // ══════════════════════════════════════════════════════════════════════
    //  365GPS GF21  (1 unit)
    // ══════════════════════════════════════════════════════════════════════
    {
      title: "365GPS GF21 — Mini 4G Coin-Sized GPS Tracker (Personal & Asset)",
      slug: "365gps-gf21-mini-gps-tracker",
      sku: "365-GF21-4G",
      brandId: brands["365GPS"],
      categoryId: cats["Personal GPS Trackers"],
      tags: "365gps gf21,mini gps tracker,coin sized tracker,personal gps,asset tracker,small gps,hidden tracker",
      price: "4200",
      salePrice: "3799",
      costPrice: "2000",
      stockQty: 1,
      shortDescription: "365GPS GF21 ultra-compact coin-sized 4G GPS tracker. Tiny enough to hide anywhere — in a bag, wallet, or vehicle — with real-time location tracking.",
      longDescription: `365GPS GF21 — Ultra-Compact 4G Mini GPS Tracker

The GF21 is one of the smallest GPS trackers in the world. About the size of a large coin, it can be placed inside a bag, sewn into clothing, hidden in a vehicle, or attached to valuables — completely undetectable.

Features:
• Ultra-compact design — approx 40 × 40 × 12mm
• 4G LTE real-time tracking
• GPS + LBS + WiFi triple positioning (works indoors)
• Geo-fence and motion alerts
• Low battery notification
• 400mAh internal battery (3–7 days standby)
• SOS button on selected variants
• Compatible with standard GPS tracking apps

Best For:
• Bags, backpacks, luggage
• Personal valuables (cameras, laptops bag)
• Pets (attach to collar)
• Elderly or children (hidden in clothing)
• Vehicle covert placement

Specs: 4G LTE + 2G, GPS + LBS + WiFi, Nano SIM.`,
      featuredImage: IMG.gf21_1,
      galleryImages: JSON.stringify([IMG.gf21_1, IMG.gf21_2, IMG.gf21_3, IMG.gf21_4, IMG.gf21_5]),
      published: true,
      featured: false,
      metaTitle: "365GPS GF21 Mini GPS Tracker Pakistan — Geem.pk",
      metaDescription: "365GPS GF21 ultra-compact mini 4G GPS tracker. Coin-sized, hidden tracking for bags, valuables. Rs 3,799. Geem.pk.",
      metaKeywords: "mini gps tracker pakistan,coin size gps,365gps gf21,small hidden gps tracker,personal asset tracker",
    },

    // ── 360GPS GF21  (1 unit — similar model, different brand)
    {
      title: "360GPS GF21 — 4G Mini GPS Tracker (Personal & Asset Tracking)",
      slug: "360gps-gf21-mini-gps-tracker",
      sku: "360-GF21-4G",
      brandId: brands["360GPS"],
      categoryId: cats["Personal GPS Trackers"],
      tags: "360gps gf21,mini gps,personal tracker,asset gps,small gps tracker pakistan",
      price: "4200",
      salePrice: "3799",
      costPrice: "2000",
      stockQty: 1,
      shortDescription: "360GPS GF21 compact 4G personal GPS tracker for bags, valuables, and personal use. Real-time tracking, geo-fence, motion alerts.",
      longDescription: `360GPS GF21 — Compact 4G GPS Tracker for Personal Use

The 360GPS GF21 is a compact personal GPS tracker supporting 4G LTE positioning. Small enough to place in a bag or attach to valuables, it provides real-time tracking via a free companion app.

Features: 4G real-time tracking, GPS + LBS, geo-fence, motion alerts, low battery notification, compact body, Nano SIM.

Best For: Bags, personal items, kids tracking, pet collar, covert asset placement.`,
      featuredImage: IMG.gf21_1,
      galleryImages: JSON.stringify([IMG.gf21_1, IMG.gf21_2, IMG.gf21_3, IMG.gf21_4, IMG.gf21_5]),
      published: true,
      featured: false,
      metaTitle: "360GPS GF21 Mini GPS Tracker Pakistan — Geem.pk",
      metaDescription: "360GPS GF21 compact 4G personal GPS tracker. Geo-fence, motion alerts. Rs 3,799. Geem.pk.",
      metaKeywords: "360gps gf21,mini gps tracker,personal gps pakistan",
    },

    // ── Yuntrack CJ220  (1 unit)
    {
      title: "Yuntrack CJ220 — 4G Compact Vehicle GPS Tracker",
      slug: "yuntrack-cj220-4g-gps-tracker",
      sku: "YUN-CJ220-4G",
      brandId: brands["Yuntrack"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "yuntrack cj220,4g gps tracker,vehicle tracker,compact tracker pakistan",
      price: "4000",
      salePrice: "3599",
      costPrice: "1900",
      stockQty: 1,
      shortDescription: "Yuntrack CJ220 4G compact wired vehicle GPS tracker. Engine cut-off support, geo-fence, real-time tracking.",
      longDescription: `Yuntrack CJ220 — 4G Compact Vehicle GPS Tracker

The CJ220 is Yuntrack's entry-level 4G GPS tracker for personal vehicle use. Compact and easy to install, it delivers reliable real-time tracking with engine cut-off capability.

Features: 4G LTE + 2G, engine cut-off relay, geo-fence, overspeed alert, ignition detection, vibration alert. GT06 protocol compatible.

Specs: DC 9–40V, GPS + LBS, Standard SIM.`,
      featuredImage: IMG.cj220_1,
      galleryImages: JSON.stringify([IMG.cj220_1, IMG.cj220_2]),
      published: true,
      featured: false,
      metaTitle: "Yuntrack CJ220 GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Yuntrack CJ220 4G compact vehicle GPS tracker. Engine cut-off, geo-fence. Geem.pk Pakistan.",
      metaKeywords: "yuntrack cj220,4g gps tracker pakistan,vehicle tracker",
    },

    // ── Unbranded IOT  (1 unit)
    {
      title: "IoT GPS Tracker — 4G LTE Universal Vehicle & Asset Tracker",
      slug: "iot-universal-4g-gps-tracker",
      sku: "IOT-4G-UNI",
      brandId: brands["Unbranded"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "iot gps tracker,universal gps,4g tracker,asset tracker,vehicle tracker pakistan",
      price: "3500",
      salePrice: "2999",
      costPrice: "1600",
      stockQty: 1,
      shortDescription: "Generic IoT 4G GPS tracker for vehicles and assets. Supports standard GPRS protocols and any tracking platform.",
      longDescription: `IoT 4G Universal GPS Tracker

A versatile IoT-grade GPS tracking device for vehicles and assets. Supports standard GPRS/4G protocol and connects to any tracking platform (SeekTeck, GPSTracker365, etc.).

Features: 4G LTE + 2G, real-time tracking, geo-fence, motion alert, engine cut-off support, Standard SIM.`,
      featuredImage: IMG.gt06_1,
      galleryImages: JSON.stringify([IMG.gt06_1, IMG.gt06_2, IMG.gt06_3, IMG.gt06_4, IMG.gt06_5]),
      published: true,
      featured: false,
      metaTitle: "IoT 4G GPS Tracker Pakistan — Geem.pk",
      metaDescription: "Universal IoT 4G GPS tracker for vehicles and assets. Real-time tracking, geo-fence. Geem.pk.",
      metaKeywords: "iot gps tracker,universal gps tracker,4g tracker pakistan",
    },

    // ── Unbranded P31  (1 unit)
    {
      title: "P31 — 4G Portable Personal GPS Tracker with SOS",
      slug: "p31-portable-personal-gps-tracker",
      sku: "P31-4G-PER",
      brandId: brands["Unbranded"],
      categoryId: cats["Personal GPS Trackers"],
      tags: "p31 gps tracker,portable personal tracker,sos gps,4g gps pakistan,elderly tracker",
      price: "4000",
      salePrice: "3499",
      costPrice: "1900",
      stockQty: 1,
      shortDescription: "P31 portable 4G personal GPS tracker with SOS button and real-time location sharing. For elderly, children, and personal safety.",
      longDescription: `P31 Portable 4G Personal GPS Tracker

The P31 is a compact portable GPS tracker for individuals who need a safety device. Simple SOS button, real-time location sharing, and long battery make it ideal for elderly, delivery workers, or children.

Features: 4G LTE + 2G, SOS emergency button, GPS + LBS positioning, Geo-fence, Low battery alert, Standard SIM, ~800mAh battery.`,
      featuredImage: IMG.lk208_1,
      galleryImages: JSON.stringify([IMG.lk208_1, IMG.lk208_2, IMG.lk208_3, IMG.lk208_4, IMG.lk208_5]),
      published: true,
      featured: false,
      metaTitle: "P31 Portable Personal GPS Tracker Pakistan — Geem.pk",
      metaDescription: "P31 4G portable personal GPS tracker with SOS. Elderly and child safety. Geem.pk Pakistan.",
      metaKeywords: "personal gps tracker pakistan,p31 gps,sos tracker,elderly gps",
    },

    // ── Unbranded N9 GSM  (1 unit — avg price 3785, sale 3785)
    {
      title: "N9 GSM — 4G Multi-Purpose GPS Tracker",
      slug: "n9-gsm-4g-gps-tracker",
      sku: "N9-GSM-4G",
      brandId: brands["Unbranded"],
      categoryId: cats["Vehicle GPS Trackers"],
      tags: "n9 gsm tracker,4g gps,vehicle tracker,gsm tracker pakistan,multi purpose tracker",
      price: "4200",
      salePrice: "3785",
      costPrice: "2000",
      stockQty: 1,
      shortDescription: "N9 GSM 4G multi-purpose GPS tracker for vehicles and personal use. Real-time tracking, geo-fence, SOS.",
      longDescription: `N9 GSM 4G Multi-Purpose GPS Tracker

The N9 is a flexible 4G GPS tracker that supports both vehicle wiring and portable battery use. A versatile option for mixed fleet and personal tracking needs.

Features: 4G LTE + 2G, real-time tracking, geo-fence, SOS, overspeed alert, Standard SIM.`,
      featuredImage: IMG.gt06_1,
      galleryImages: JSON.stringify([IMG.gt06_1, IMG.gt06_2, IMG.gt06_3, IMG.gt06_4, IMG.gt06_5]),
      published: true,
      featured: false,
      metaTitle: "N9 GSM 4G GPS Tracker Pakistan — Geem.pk",
      metaDescription: "N9 GSM 4G multi-purpose GPS tracker. Vehicle and personal tracking. Geem.pk Pakistan.",
      metaKeywords: "n9 gsm gps tracker,4g tracker pakistan,vehicle gps",
    },
  ];

  // ── INSERT / UPDATE ────────────────────────────────────────────────────────
  let added = 0;
  let updated = 0;
  for (const p of products) {
    const [existing] = await db.select().from(productsTable).where(eq(productsTable.slug, p.slug));
    if (existing) {
      await db.update(productsTable).set({
        stockQty:         p.stockQty,
        price:            p.price,
        salePrice:        p.salePrice ?? null,
        costPrice:        p.costPrice ?? null,
        shortDescription: p.shortDescription,
        longDescription:  p.longDescription,
        featuredImage:    p.featuredImage,
        galleryImages:    p.galleryImages ?? null,
        metaTitle:        p.metaTitle ?? null,
        metaDescription:  p.metaDescription ?? null,
        metaKeywords:     (p as any).metaKeywords ?? null,
        tags:             p.tags ?? null,
        published:        true,
      }).where(eq(productsTable.slug, p.slug));
      updated++;
      console.log(`  ↻ Updated: ${p.title}`);
    } else {
      await db.insert(productsTable).values(p as any);
      added++;
      console.log(`  + Added:   ${p.title}`);
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Added:   ${added} products`);
  console.log(`   Updated: ${updated} products`);
  console.log(`   Brands:  ${Object.keys(brands).length}`);
  console.log(`   Categories: GPS parent + ${Object.keys(cats).length - 1} sub-categories`);
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
