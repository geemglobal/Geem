import { db, brandsTable, categoriesTable, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const IMAGES = {
  // Spy cameras - contextual Unsplash images
  carKey:     "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  coffeeMug:  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
  watch:      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
  pen:        "https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?w=800&q=80",
  clock:      "https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=800&q=80",
  glasses:    "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=800&q=80",
  powerBank:  "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80",
  charger:    "https://images.unsplash.com/photo-1558618047-3c8c76ca5b5a?w=800&q=80",
  usb:        "https://images.unsplash.com/photo-1601737487795-dab272f52420?w=800&q=80",
  button:     "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&q=80",
  security:   "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
  // Smartphones
  iphone15:   "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80",
  iphone14:   "https://images.unsplash.com/photo-1661956602116-aa6865609028?w=800&q=80",
  samsung24:  "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80",
  samsungA:   "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&q=80",
  xiaomi:     "https://images.unsplash.com/photo-1598327106026-d9521da673d1?w=800&q=80",
  huawei:     "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=800&q=80",
};

async function run() {
  console.log("🌱 Seeding products...");

  // ── 1. BRANDS ──────────────────────────────────────────────────────────────
  const brandData = [
    { name: "Apple",   description: "Cupertino-based maker of iPhone and iPad" },
    { name: "Samsung", description: "South Korean global electronics giant" },
    { name: "Xiaomi",  description: "Chinese tech brand known for value flagship phones" },
    { name: "Huawei",  description: "Chinese telecom and consumer electronics brand" },
    { name: "Lawmate", description: "Professional-grade covert surveillance equipment" },
    { name: "SpyTec",  description: "Consumer-level spy cameras and hidden recording devices" },
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

  // ── 2. CATEGORIES ──────────────────────────────────────────────────────────
  const catData = [
    { name: "Smartphones" },
    { name: "Tablets" },
    { name: "Accessories" },
    { name: "Spy Cameras & Surveillance" },
    { name: "GPS Trackers" },
    { name: "Security Equipment" },
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

    // ── Smartphones ──────────────────────────────────────────────────────────
    {
      title: "Apple iPhone 15 Pro (256GB) — Natural Titanium",
      slug: "apple-iphone-15-pro-256gb",
      sku: "APL-IP15P-256-NT",
      brandId: brandIds["Apple"],
      categoryId: catIds["Smartphones"],
      tags: "iphone,apple,smartphone,pta approved,256gb",
      price: "449000",
      salePrice: "429000",
      costPrice: "385000",
      stockQty: 12,
      shortDescription: "Apple iPhone 15 Pro with 48MP camera system, A17 Pro chip, titanium frame, and USB-C. PTA approved.",
      longDescription: `Apple iPhone 15 Pro — Pakistan's #1 PTA-Approved Flagship

Specifications:
• Display: 6.1\" Super Retina XDR OLED, ProMotion 120Hz
• Chip: A17 Pro — fastest mobile chip ever
• Camera: 48MP Main + 12MP Ultra-Wide + 12MP 3x Telephoto
• Storage: 256GB
• Battery: All-day life with USB-C fast charging
• Frame: Grade 5 Titanium (lightest Pro ever)
• OS: iOS 17 (upgradeable)
• PTA Status: APPROVED ✓ — fully legal in Pakistan
• Warranty: 1 Year Apple (International)

In the Box: iPhone 15 Pro, USB-C cable, Documentation`,
      featuredImage: IMAGES.iphone15,
      galleryImages: JSON.stringify([IMAGES.iphone15, IMAGES.iphone14]),
      published: true,
      featured: true,
      metaTitle: "Apple iPhone 15 Pro 256GB Price in Pakistan — Geem.pk",
      metaDescription: "Buy Apple iPhone 15 Pro 256GB Natural Titanium in Pakistan. PTA approved, verified IMEI. Rs 429,000. Nationwide delivery. Geem.pk",
    },
    {
      title: "Apple iPhone 14 (128GB) — Midnight",
      slug: "apple-iphone-14-128gb-midnight",
      sku: "APL-IP14-128-MN",
      brandId: brandIds["Apple"],
      categoryId: catIds["Smartphones"],
      tags: "iphone,apple,smartphone,pta approved,128gb",
      price: "289000",
      salePrice: "269000",
      costPrice: "240000",
      stockQty: 8,
      shortDescription: "iPhone 14 with A15 Bionic, dual camera, Ceramic Shield. PTA approved. Perfect everyday flagship.",
      longDescription: `Apple iPhone 14 128GB — PTA Approved

Specifications:
• Display: 6.1\" Super Retina XDR OLED
• Chip: A15 Bionic (5-core GPU)
• Camera: 12MP Main + 12MP Ultra-Wide, Photonic Engine
• Front: 12MP TrueDepth with autofocus
• Storage: 128GB
• Crash Detection & Emergency SOS via Satellite
• PTA Status: APPROVED ✓
• Warranty: 1 Year

Color: Midnight (Black)`,
      featuredImage: IMAGES.iphone14,
      galleryImages: JSON.stringify([IMAGES.iphone14, IMAGES.iphone15]),
      published: true,
      featured: true,
      metaTitle: "Apple iPhone 14 128GB Price in Pakistan — Geem.pk",
      metaDescription: "Buy Apple iPhone 14 128GB Midnight in Pakistan. PTA approved. Rs 269,000. Geem.pk — trusted mobile store.",
    },
    {
      title: "Samsung Galaxy S24 Ultra (256GB) — Titanium Black",
      slug: "samsung-galaxy-s24-ultra-256gb",
      sku: "SAM-S24U-256-TB",
      brandId: brandIds["Samsung"],
      categoryId: catIds["Smartphones"],
      tags: "samsung,galaxy,s24 ultra,android,pta approved,s-pen",
      price: "399000",
      salePrice: "379000",
      costPrice: "340000",
      stockQty: 6,
      shortDescription: "Samsung's ultimate flagship with 200MP camera, built-in S Pen, 5000mAh battery. PTA approved.",
      longDescription: `Samsung Galaxy S24 Ultra — Ultimate Android Flagship

Specifications:
• Display: 6.8\" Dynamic AMOLED 2X, 120Hz, 2600 nits
• Processor: Snapdragon 8 Gen 3 for Galaxy
• RAM: 12GB  |  Storage: 256GB
• Camera: 200MP Main + 12MP Ultra-Wide + 10MP 3x + 50MP 5x Telephoto
• S Pen: Built-in with AI-powered features
• Battery: 5000mAh, 45W fast charging
• OS: Android 14 + One UI 6.1
• PTA Status: APPROVED ✓
• Warranty: 1 Year Samsung Pakistan

Galaxy AI features: Circle to Search, Live Translate, Chat Assist`,
      featuredImage: IMAGES.samsung24,
      galleryImages: JSON.stringify([IMAGES.samsung24, IMAGES.samsungA]),
      published: true,
      featured: true,
      metaTitle: "Samsung Galaxy S24 Ultra 256GB Price Pakistan — Geem.pk",
      metaDescription: "Samsung Galaxy S24 Ultra 256GB Titanium Black. PTA approved. Rs 379,000. Geem.pk — Pakistan's trusted store.",
    },
    {
      title: "Samsung Galaxy A54 5G (128GB) — Awesome Violet",
      slug: "samsung-galaxy-a54-5g-128gb",
      sku: "SAM-A54-128-AV",
      brandId: brandIds["Samsung"],
      categoryId: catIds["Smartphones"],
      tags: "samsung,galaxy a54,5g,android,mid-range",
      price: "89000",
      salePrice: "79000",
      costPrice: "65000",
      stockQty: 20,
      shortDescription: "Samsung's best mid-ranger with 50MP OIS camera, 5000mAh battery, 5G, and 120Hz display.",
      longDescription: `Samsung Galaxy A54 5G — Best Mid-Range of 2024

Specifications:
• Display: 6.4\" Super AMOLED, 120Hz, Gorilla Glass 5
• Processor: Exynos 1380 (5nm)
• RAM: 8GB  |  Storage: 128GB (expandable)
• Camera: 50MP OIS + 12MP Ultra-Wide + 5MP Macro
• Front: 32MP
• Battery: 5000mAh, 25W fast charging
• 5G Ready  |  IP67 Water Resistant
• PTA Status: APPROVED ✓
• OS: Android 14 + One UI 6.1
• Warranty: 1 Year Samsung Pakistan`,
      featuredImage: IMAGES.samsungA,
      published: true,
      featured: false,
      metaTitle: "Samsung Galaxy A54 5G 128GB Price Pakistan — Geem.pk",
      metaDescription: "Samsung Galaxy A54 5G 128GB. PTA approved. Rs 79,000. Best mid-range phone in Pakistan. Geem.pk.",
    },
    {
      title: "Xiaomi 14 Pro (512GB) — Ceramic White",
      slug: "xiaomi-14-pro-512gb",
      sku: "XMI-14P-512-CW",
      brandId: brandIds["Xiaomi"],
      categoryId: catIds["Smartphones"],
      tags: "xiaomi,14 pro,leica camera,512gb,android",
      price: "229000",
      salePrice: "209000",
      costPrice: "180000",
      stockQty: 5,
      shortDescription: "Xiaomi 14 Pro with Leica Summilux cameras, Snapdragon 8 Gen 3, 50W wireless charging.",
      longDescription: `Xiaomi 14 Pro — Leica Triple Camera Flagship

Specifications:
• Display: 6.73\" LTPO AMOLED, 1-120Hz adaptive, 3000 nits
• Processor: Qualcomm Snapdragon 8 Gen 3
• RAM: 12GB  |  Storage: 512GB UFS 4.0
• Camera System: Leica Summilux
  - 50MP Light Fusion 900 Main (1" sensor)
  - 50MP Ultra-Wide with macro
  - 50MP 3.2x Telephoto
• Battery: 4880mAh, 120W HyperCharge (wired) + 50W wireless
• Build: Ceramic back, IP68
• PTA Status: APPROVED ✓`,
      featuredImage: IMAGES.xiaomi,
      galleryImages: JSON.stringify([IMAGES.xiaomi]),
      published: true,
      featured: true,
      metaTitle: "Xiaomi 14 Pro 512GB Leica Camera Price Pakistan — Geem.pk",
      metaDescription: "Xiaomi 14 Pro 512GB Ceramic White with Leica cameras. Rs 209,000. PTA approved. Geem.pk Pakistan.",
    },
    {
      title: "Huawei Nova 12 Pro (256GB) — Peacock Blue",
      slug: "huawei-nova-12-pro-256gb",
      sku: "HW-NV12P-256-PB",
      brandId: brandIds["Huawei"],
      categoryId: catIds["Smartphones"],
      tags: "huawei,nova 12,256gb,android",
      price: "119000",
      salePrice: null,
      costPrice: "95000",
      stockQty: 7,
      shortDescription: "Huawei Nova 12 Pro with 60MP front camera, curved display, and Kirin performance.",
      longDescription: `Huawei Nova 12 Pro — 60MP Selfie Expert

Specifications:
• Display: 6.76\" OLED, 120Hz, curved edges
• Processor: Kirin 8000
• RAM: 12GB  |  Storage: 256GB
• Rear Camera: 50MP Main + 8MP Ultra-Wide
• Front: 60MP + 8MP (wide) — best selfie phone
• Battery: 4600mAh, 100W SuperCharge
• PTA Status: APPROVED ✓
• Warranty: 1 Year Huawei Pakistan`,
      featuredImage: IMAGES.huawei,
      published: true,
      featured: false,
      metaTitle: "Huawei Nova 12 Pro 256GB Price Pakistan — Geem.pk",
      metaDescription: "Huawei Nova 12 Pro 256GB. 60MP selfie camera. Rs 119,000. PTA approved. Geem.pk Pakistan.",
    },

    // ── Lawmate Spy Cameras ───────────────────────────────────────────────────
    {
      title: "Lawmate PV-RC200HD Car Key Fob Hidden Camera",
      slug: "lawmate-pv-rc200hd-car-key-fob-camera",
      sku: "LM-PV-RC200HD",
      brandId: brandIds["Lawmate"],
      categoryId: catIds["Spy Cameras & Surveillance"],
      tags: "spy camera,hidden camera,car key camera,Lawmate,covert,surveillance,PV-RC200HD",
      price: "18500",
      salePrice: "16000",
      costPrice: "12000",
      stockQty: 15,
      shortDescription: "Fully functional car remote + 1080p HD hidden camera. Loop recording, motion detection. Perfect covert surveillance tool.",
      longDescription: `Lawmate PV-RC200HD — Professional Car Key Fob Hidden Camera

The Lawmate PV-RC200HD is a fully functional car remote key that doubles as a professional-grade covert 1080p HD surveillance camera.

Key Features:
• Resolution: Full HD 1080p @ 30fps
• Built-in DVR: records directly to microSD (up to 32GB)
• Loop Recording: auto-overwrites oldest footage
• Motion Detection: starts recording only when motion detected
• Battery Life: up to 2 hours continuous recording
• Dimensions: exactly like a real car key fob — undetectable
• Storage: microSD card slot (card not included)
• Format: H.264 video, AVI files
• Works as a real functioning car remote

Applications:
• Home security
• Office monitoring
• Nanny cam
• Evidence gathering
• Personal protection

Package Includes: Camera unit, USB charging cable, User manual
Note: Legal use only. For personal security purposes.`,
      featuredImage: IMAGES.carKey,
      galleryImages: JSON.stringify([IMAGES.carKey, IMAGES.security]),
      published: true,
      featured: true,
      metaTitle: "Lawmate PV-RC200HD Car Key Fob Hidden Camera Pakistan — Geem.pk",
      metaDescription: "Buy Lawmate PV-RC200HD car key spy camera in Pakistan. 1080p HD, loop recording, motion detection. Rs 16,000. Geem.pk.",
    },
    {
      title: "Lawmate PV-CM10i Coffee Mug Spy Camera 1080p",
      slug: "lawmate-pv-cm10i-coffee-mug-spy-camera",
      sku: "LM-PV-CM10i",
      brandId: brandIds["Lawmate"],
      categoryId: catIds["Spy Cameras & Surveillance"],
      tags: "spy camera,hidden camera,coffee mug camera,Lawmate,covert,surveillance,PV-CM10i",
      price: "24000",
      salePrice: "21500",
      costPrice: "16000",
      stockQty: 8,
      shortDescription: "A fully functional stainless steel coffee mug with a 1080p HD pinhole camera. Completely undetectable covert recording.",
      longDescription: `Lawmate PV-CM10i — Coffee Mug Hidden Surveillance Camera

The Lawmate PV-CM10i looks and functions exactly like a stainless steel travel mug — but hides a professional 1080p HD camera inside.

Specifications:
• Resolution: 1080p Full HD @ 30fps
• Pinhole Lens: 1/4" CMOS sensor
• Recording Format: H.264 AVI
• Storage: Built-in 8GB + microSD slot (up to 32GB)
• Battery: Built-in rechargeable (charges via USB)
• Recording Time: ~3 hours continuous
• Loop Recording: Yes
• Motion Detection: Yes
• Night Vision: No (daytime use)
• Connectivity: USB for charging and file transfer

The mug is fully functional — you can actually put drinks in it. The camera is completely hidden and undetectable.

Ideal for:
• Office desk monitoring
• Meeting room surveillance
• Reception area recording
• Covert evidence gathering

Package: Mug camera unit, USB cable, Manual`,
      featuredImage: IMAGES.coffeeMug,
      galleryImages: JSON.stringify([IMAGES.coffeeMug, IMAGES.security]),
      published: true,
      featured: true,
      metaTitle: "Lawmate Coffee Mug Spy Camera 1080p Pakistan — Geem.pk",
      metaDescription: "Lawmate PV-CM10i coffee mug hidden spy camera in Pakistan. 1080p HD, motion detection. Rs 21,500. Geem.pk.",
    },
    {
      title: "Lawmate PV-WT10i Wristwatch Spy Camera",
      slug: "lawmate-pv-wt10i-wristwatch-spy-camera",
      sku: "LM-PV-WT10i",
      brandId: brandIds["Lawmate"],
      categoryId: catIds["Spy Cameras & Surveillance"],
      tags: "spy camera,watch camera,wristwatch camera,Lawmate,covert,hidden camera,PV-WT10i",
      price: "22000",
      salePrice: "19500",
      costPrice: "15000",
      stockQty: 10,
      shortDescription: "A genuine working wristwatch with 1080p HD hidden camera. Captures video and audio discreetly on the go.",
      longDescription: `Lawmate PV-WT10i — Professional Wristwatch Hidden Camera

Wear it, record it. The PV-WT10i is an actual working wristwatch that secretly records everything you see in 1080p HD.

Specifications:
• Resolution: 1080p Full HD @ 30fps
• Sensor: CMOS pinhole lens hidden in watch face
• Storage: Built-in 8GB internal (no external card needed)
• Battery Life: ~2.5 hours recording per charge
• Charging: Magnetic USB dock (included)
• Dimensions: Normal wristwatch size
• Operating: One-button operation — simple press to record/stop
• Audio: Yes — built-in microphone records audio
• Loop Recording: Yes
• Night Recording: Low-light capable

Why choose the PV-WT10i?
• No one suspects a watch
• Hands-free recording while walking, driving, or in meetings
• Professional build quality from Lawmate

Package Includes: Watch camera, Magnetic charging dock, USB cable, Manual`,
      featuredImage: IMAGES.watch,
      galleryImages: JSON.stringify([IMAGES.watch]),
      published: true,
      featured: true,
      metaTitle: "Lawmate Wristwatch Spy Camera Pakistan — Geem.pk",
      metaDescription: "Lawmate PV-WT10i wristwatch hidden camera in Pakistan. 1080p, audio recording. Rs 19,500. Geem.pk.",
    },
    {
      title: "Lawmate PV-BC10HD Button Spy Camera 1080p",
      slug: "lawmate-pv-bc10hd-button-spy-camera",
      sku: "LM-PV-BC10HD",
      brandId: brandIds["Lawmate"],
      categoryId: catIds["Spy Cameras & Surveillance"],
      tags: "spy camera,button camera,wearable camera,Lawmate,covert,hidden camera,PV-BC10HD",
      price: "15000",
      salePrice: "12500",
      costPrice: "9000",
      stockQty: 20,
      shortDescription: "Sew-on button that hides a 1080p HD camera and microphone. The world's most discreet wearable spy camera.",
      longDescription: `Lawmate PV-BC10HD — Button Wearable Hidden Camera

Clip it on or sew it to any shirt, jacket, or bag — the PV-BC10HD is disguised as an ordinary fabric button.

Specifications:
• Resolution: 1080p Full HD @ 30fps
• Lens: Ultra-miniature pinhole (2.5mm)
• Sensor: 1/7" CMOS
• Storage: microSD up to 32GB
• Battery Life: ~3 hours
• Dimensions: 20mm diameter (button size)
• Recording: One-touch start/stop
• Audio Recording: Built-in MEMS microphone
• Motion Detection: Yes
• Loop Recording: Yes

This is one of Lawmate's most popular products for professionals.

Includes: Button camera unit, 3 replacement button covers, USB cable, Manual`,
      featuredImage: IMAGES.button,
      galleryImages: JSON.stringify([IMAGES.button, IMAGES.security]),
      published: true,
      featured: false,
      metaTitle: "Lawmate Button Spy Camera 1080p Pakistan — Geem.pk",
      metaDescription: "Lawmate PV-BC10HD wearable button spy camera in Pakistan. 1080p HD. Rs 12,500. Geem.pk.",
    },
    {
      title: "Spy Pen Camera — Full HD 1080p with Audio",
      slug: "spy-pen-camera-hd-1080p",
      sku: "STC-PEN-1080",
      brandId: brandIds["SpyTec"],
      categoryId: catIds["Spy Cameras & Surveillance"],
      tags: "spy camera,pen camera,hidden camera,covert,1080p,audio recording",
      price: "8500",
      salePrice: "6999",
      costPrice: "4500",
      stockQty: 30,
      shortDescription: "Fully functional ballpoint pen with 1080p HD camera and audio. Records up to 2 hours. Ideal for meetings.",
      longDescription: `SpyTec Pen Camera — Covert 1080p HD Recording Pen

The best-selling spy pen in Pakistan. A real working ballpoint pen that secretly records video and audio.

Specifications:
• Resolution: 1080p Full HD
• Video Format: AVI (H.264)
• Audio: Yes — clear audio recording
• Storage: 8GB built-in (records ~2 hours)
• Battery Life: ~70 minutes continuous recording
• Charging: USB (pen cap is the USB connector)
• Loop Recording: Yes
• One-click recording start

How It Works:
1. Click the pen button to start recording
2. Blue LED flashes once to confirm
3. Click again to stop — no visible indicator during recording

Ideal for: Interviews, meetings, evidence collection, lectures

Package: Pen camera, Extra ink refills, USB cable, Manual`,
      featuredImage: IMAGES.pen,
      galleryImages: JSON.stringify([IMAGES.pen]),
      published: true,
      featured: false,
      metaTitle: "Spy Pen Camera 1080p Price Pakistan — Geem.pk",
      metaDescription: "Spy pen camera with 1080p HD video and audio recording. Rs 6,999. Buy in Pakistan at Geem.pk.",
    },
    {
      title: "Wall Clock Hidden Spy Camera — 1080p WiFi",
      slug: "wall-clock-spy-camera-1080p-wifi",
      sku: "STC-CLK-WIFI-1080",
      brandId: brandIds["SpyTec"],
      categoryId: catIds["Spy Cameras & Surveillance"],
      tags: "spy camera,clock camera,WiFi camera,hidden camera,home security,1080p",
      price: "19500",
      salePrice: "17000",
      costPrice: "13000",
      stockQty: 12,
      shortDescription: "Elegant wall clock with built-in 1080p WiFi camera. Live view from your phone. Motion alerts. Night vision.",
      longDescription: `SpyTec WiFi Wall Clock Hidden Camera

Hang it in any room — it looks like a normal decorative clock. Connect to WiFi and watch live from anywhere in the world.

Specifications:
• Resolution: 1080p Full HD
• WiFi: 2.4GHz — connects to home/office WiFi
• Live View: Yes — watch real-time via smartphone app
• Night Vision: Yes — infrared LEDs (invisible to eye)
• Motion Detection: Yes — push notification alerts
• Cloud Storage: Optional (supports SD card up to 128GB)
• Power: Plug-in (AC adapter included) — continuous power
• App: Compatible with iOS and Android
• Remote Pan: No (fixed lens)
• Two-Way Audio: Microphone only

Setup: Scan QR code → download app → connect to WiFi → done!

Ideal For: Living room, office reception, shop counter, hallway

Package: Clock camera unit, AC power adapter, Manual`,
      featuredImage: IMAGES.clock,
      galleryImages: JSON.stringify([IMAGES.clock, IMAGES.security]),
      published: true,
      featured: false,
      metaTitle: "WiFi Wall Clock Spy Camera 1080p Pakistan — Geem.pk",
      metaDescription: "WiFi hidden clock camera. 1080p, night vision, motion detection. Rs 17,000. Pakistan. Geem.pk.",
    },
    {
      title: "Spy Glasses Camera — HD 720p Sunglasses DVR",
      slug: "spy-glasses-camera-hd-sunglasses",
      sku: "STC-GLASS-720",
      brandId: brandIds["SpyTec"],
      categoryId: catIds["Spy Cameras & Surveillance"],
      tags: "spy camera,glasses camera,sunglasses camera,covert camera,wearable camera",
      price: "12000",
      salePrice: "9999",
      costPrice: "7000",
      stockQty: 18,
      shortDescription: "UV400 sunglasses with integrated HD camera. Records what you see in 720p. 1.5 hour battery. Fashionable design.",
      longDescription: `SpyTec Spy Glasses — Hidden Camera Sunglasses

These look like ordinary trendy sunglasses — and they actually function as sunglasses with UV400 protection — but they secretly record HD video.

Specifications:
• Resolution: 720p HD @ 30fps
• Storage: 8GB built-in (approx 90 minutes)
• Battery: ~1.5 hours recording
• Charging: Micro-USB
• Lens: UV400 polarized sun protection
• Frame: Lightweight TR90 plastic
• Recording: Single button on temple
• Audio: Yes — built-in microphone

One-Touch Operation:
• Hold button 2 seconds to power on
• Short press to start recording
• Short press again to stop and save

Looks: Fashionable design suitable for everyday wear

Includes: Glasses camera, Soft case, USB cable, Cleaning cloth, Manual`,
      featuredImage: IMAGES.glasses,
      galleryImages: JSON.stringify([IMAGES.glasses]),
      published: true,
      featured: false,
      metaTitle: "Spy Glasses Camera Sunglasses Pakistan — Geem.pk",
      metaDescription: "Spy sunglasses with hidden HD camera. 720p video, audio recording. Rs 9,999. Pakistan. Geem.pk.",
    },
    {
      title: "Power Bank Hidden Spy Camera — 10000mAh + 1080p",
      slug: "power-bank-hidden-spy-camera-10000mah",
      sku: "STC-PB-10K-1080",
      brandId: brandIds["SpyTec"],
      categoryId: catIds["Spy Cameras & Surveillance"],
      tags: "spy camera,power bank camera,hidden camera,10000mAh,covert,1080p",
      price: "16500",
      salePrice: "14000",
      costPrice: "10000",
      stockQty: 10,
      shortDescription: "Real functioning 10,000mAh power bank with 1080p hidden camera. Actually charges phones while recording.",
      longDescription: `SpyTec Power Bank Hidden Camera — Dual Function Device

This is a genuine 10,000mAh power bank that fully charges smartphones — and also secretly records 1080p HD video.

Specifications:
• Camera Resolution: 1080p Full HD @ 30fps
• Audio Recording: Yes
• Storage: microSD up to 128GB
• Power Bank Capacity: 10,000mAh real capacity
• Output: 5V/2A USB-A + 5V/1.5A USB-C
• Can charge iPhone, Android phones simultaneously while recording
• Motion Detection: Yes
• Loop Recording: Yes
• Battery Life for Camera: ~8 hours (uses power bank power)
• Build: Aircraft-grade aluminum

No one suspects a power bank.

Includes: Power bank camera unit, USB-C cable, Quick start guide`,
      featuredImage: IMAGES.powerBank,
      galleryImages: JSON.stringify([IMAGES.powerBank]),
      published: true,
      featured: false,
      metaTitle: "Power Bank Spy Camera 10000mAh Pakistan — Geem.pk",
      metaDescription: "10000mAh power bank with hidden 1080p spy camera. Actually charges phones. Rs 14,000. Geem.pk Pakistan.",
    },
    {
      title: "USB Wall Charger Hidden Spy Camera — WiFi 1080p",
      slug: "usb-wall-charger-spy-camera-wifi",
      sku: "STC-CHG-WIFI-1080",
      brandId: brandIds["SpyTec"],
      categoryId: catIds["Spy Cameras & Surveillance"],
      tags: "spy camera,charger camera,wall charger camera,WiFi camera,hidden camera,1080p",
      price: "11500",
      salePrice: "9500",
      costPrice: "6500",
      stockQty: 25,
      shortDescription: "USB wall charger that fully charges devices and secretly records 1080p WiFi video. Live view on phone app.",
      longDescription: `SpyTec Wall Charger Hidden WiFi Camera

Plug it in anywhere — it charges your devices AND secretly watches the room in 1080p HD with WiFi live streaming.

Specifications:
• Camera: 1080p Full HD
• WiFi: 2.4GHz live streaming
• App: iOS & Android compatible
• Motion Detection: Push notification alerts
• Night Vision: No (daytime recommended)
• Storage: microSD up to 64GB
• USB Output: 5V/2A — actually charges devices
• Power: 110-240V universal (works in Pakistan)
• Loop Recording: Yes

The perfect always-on home security camera disguised as everyday tech.

Setup: Plug in → connect to WiFi via app → watch live from anywhere

Includes: Charger camera unit, Quick setup guide`,
      featuredImage: IMAGES.charger,
      galleryImages: JSON.stringify([IMAGES.charger, IMAGES.security]),
      published: true,
      featured: false,
      metaTitle: "USB Charger Hidden WiFi Spy Camera Pakistan — Geem.pk",
      metaDescription: "Wall charger with hidden WiFi 1080p spy camera. Live view on phone. Rs 9,500. Pakistan. Geem.pk.",
    },
    {
      title: "USB Flash Drive Spy Camera — Full HD 1080p",
      slug: "usb-flash-drive-spy-camera-1080p",
      sku: "STC-USB-FD-1080",
      brandId: brandIds["SpyTec"],
      categoryId: catIds["Spy Cameras & Surveillance"],
      tags: "spy camera,USB camera,flash drive camera,covert camera,1080p,hidden camera",
      price: "8000",
      salePrice: "6500",
      costPrice: "4000",
      stockQty: 22,
      shortDescription: "A real 32GB USB flash drive with a built-in 1080p HD camera. The most inconspicuous spy camera available.",
      longDescription: `SpyTec USB Flash Drive Hidden Camera

It looks exactly like a normal USB drive. It works as a USB drive. But it also records 1080p HD video with audio.

Specifications:
• Resolution: 1080p Full HD @ 30fps
• Lens: Ultra-miniature pinhole
• Storage: 32GB USB storage (actual usable storage)
• Camera Storage: separate microSD slot (up to 32GB)
• Battery: Built-in rechargeable (charges via USB)
• Recording Time: ~60 minutes per charge
• Motion Detection: Yes
• Loop Recording: Yes
• Audio: Yes — built-in microphone
• Dimensions: Standard USB flash drive size

Dual function: copy files AND record video with the same device.

Includes: USB camera unit, User guide`,
      featuredImage: IMAGES.usb,
      galleryImages: JSON.stringify([IMAGES.usb]),
      published: true,
      featured: false,
      metaTitle: "USB Flash Drive Spy Camera 1080p Pakistan — Geem.pk",
      metaDescription: "USB flash drive with hidden 1080p spy camera. 32GB storage, audio recording. Rs 6,500. Pakistan. Geem.pk.",
    },

    // ── Security Equipment ────────────────────────────────────────────────────
    {
      title: "Lawmate BU-18HD Mini Bullet CCTV Hidden Camera",
      slug: "lawmate-bu-18hd-mini-bullet-camera",
      sku: "LM-BU-18HD",
      brandId: brandIds["Lawmate"],
      categoryId: catIds["Security Equipment"],
      tags: "CCTV,hidden camera,Lawmate,bullet camera,security camera,1080p,covert",
      price: "14500",
      salePrice: "12000",
      costPrice: "8500",
      stockQty: 14,
      shortDescription: "Lawmate professional grade 1080p mini bullet camera. Tiny enough to hide anywhere. Perfect for covert CCTV installations.",
      longDescription: `Lawmate BU-18HD — Professional Mini Bullet Hidden Camera

The BU-18HD is a professional covert bullet camera used by security professionals worldwide. Its tiny size (18mm diameter) makes it easy to conceal.

Specifications:
• Resolution: Full HD 1080p
• Sensor: 1/3" CMOS Sony
• Lens: 3.7mm pinhole
• Viewing Angle: 90°
• Night Vision: Up to 10 meters (IR LEDs)
• Power: DC 12V (adapter included)
• Output: AHD 1080p (connects to any AHD/CCTV DVR)
• Dimensions: 18mm x 45mm (lipstick-sized)
• IP Rating: IP54 — splash proof
• Operating Temperature: -10°C to +50°C

Professional grade components trusted by law enforcement and security agencies.

Includes: Mini camera, 12V DC adapter, Mounting bracket, 5m cable`,
      featuredImage: IMAGES.security,
      galleryImages: JSON.stringify([IMAGES.security]),
      published: true,
      featured: false,
      metaTitle: "Lawmate Mini Bullet CCTV Hidden Camera Pakistan — Geem.pk",
      metaDescription: "Lawmate BU-18HD professional mini hidden camera. 1080p, night vision. Rs 12,000. Pakistan. Geem.pk.",
    },
  ];

  let added = 0;
  let skipped = 0;
  for (const p of products) {
    const [existing] = await db.select().from(productsTable).where(eq(productsTable.slug, p.slug));
    if (existing) {
      await db.update(productsTable).set({
        stockQty: p.stockQty,
        salePrice: p.salePrice ?? null,
        sku: p.sku,
        tags: p.tags,
        galleryImages: p.galleryImages ?? null,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        published: true,
      }).where(eq(productsTable.slug, p.slug));
      skipped++;
    } else {
      await db.insert(productsTable).values(p as any);
      added++;
      console.log(`  + Product: ${p.title}`);
    }
  }

  console.log(`\n✅ Done! Added: ${added} products, Updated: ${skipped} products`);
  console.log(`   Brands: ${Object.keys(brandIds).length}, Categories: ${Object.keys(catIds).length}`);
  process.exit(0);
}

run().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
